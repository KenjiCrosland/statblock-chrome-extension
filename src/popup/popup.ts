import { MonsterCollection, STORAGE_KEYS } from '../types/monster';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function countMonsters(collection: MonsterCollection): number {
  let total = 0;
  for (const [key, value] of Object.entries(collection)) {
    if (key === 'generationCount' || key === 'firstGenerationTime') continue;
    if (Array.isArray(value)) {
      total += value.length;
    }
  }
  return total;
}

async function updateStatus(): Promise<void> {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.MONSTERS,
      STORAGE_KEYS.LAST_SYNC,
    ]);

    const monsters: MonsterCollection | undefined = data[STORAGE_KEYS.MONSTERS];
    const lastSync: number | undefined = data[STORAGE_KEYS.LAST_SYNC];

    const statusDiv = document.getElementById('status')!;
    const syncInfoDiv = document.getElementById('sync-info')!;

    if (!monsters || !lastSync) {
      statusDiv.innerHTML = `
        <div class="status-icon">📭</div>
        <div class="status-text">No monsters synced yet</div>
      `;
      return;
    }

    statusDiv.className = 'status synced';
    statusDiv.innerHTML = `
      <div class="status-icon">✅</div>
      <div class="status-text">Synced</div>
    `;

    const totalMonsters = countMonsters(monsters);
    document.getElementById('last-sync')!.textContent =
      formatRelativeTime(lastSync);
    document.getElementById('total-monsters')!.textContent =
      totalMonsters.toString();
    syncInfoDiv.style.display = 'block';

    const monsterListDiv = document.getElementById('monster-list')!;
    monsterListDiv.innerHTML = '';

    let isFirstCategory = true;

    for (const [category, monsterList] of Object.entries(monsters)) {
      if (category === 'generationCount' || category === 'firstGenerationTime')
        continue;
      if (!Array.isArray(monsterList)) continue;

      const categoryGroup = document.createElement('div');
      categoryGroup.className = 'category-group';

      const categoryHeader = document.createElement('div');
      categoryHeader.className = isFirstCategory
        ? 'category-header'
        : 'category-header collapsed';
      categoryHeader.innerHTML = `
        <span>${category} (${monsterList.length})</span>
        <span class="arrow">▼</span>
      `;
      categoryGroup.appendChild(categoryHeader);

      const monstersContainer = document.createElement('div');
      monstersContainer.className = isFirstCategory
        ? 'category-monsters'
        : 'category-monsters collapsed';

      monsterList.forEach((monster: any, index: number) => {
        const monsterItem = document.createElement('div');
        monsterItem.className = 'monster-item';
        monsterItem.dataset.category = category;
        monsterItem.dataset.index = index.toString();

        const cr = monster.challenge_rating?.split(' ')[0] || 'N/A';
        const type = monster.type_and_alignment?.split(',')[0] || 'Unknown';

        monsterItem.innerHTML = `
          <div class="monster-name">${monster.name}</div>
          <div class="monster-meta">
            <span>CR ${cr}</span>
            <span>${type}</span>
          </div>
        `;

        monsterItem.addEventListener('click', () =>
          selectMonster(category, index, monster),
        );
        monstersContainer.appendChild(monsterItem);
      });

      if (isFirstCategory) {
        requestAnimationFrame(() => {
          monstersContainer.style.maxHeight =
            monstersContainer.scrollHeight + 'px';
        });
      } else {
        monstersContainer.style.maxHeight = '0';
      }

      categoryHeader.addEventListener('click', () => {
        const isCurrentlyCollapsed =
          categoryHeader.classList.contains('collapsed');

        if (isCurrentlyCollapsed) {
          document
            .querySelectorAll('.category-header:not(.collapsed)')
            .forEach((otherHeader) => {
              if (otherHeader !== categoryHeader) {
                const otherContainer =
                  otherHeader.nextElementSibling as HTMLElement;
                otherHeader.classList.add('collapsed');
                otherContainer.classList.add('collapsed');
                otherContainer.style.maxHeight = '0';
              }
            });

          categoryHeader.classList.remove('collapsed');
          monstersContainer.classList.remove('collapsed');
          monstersContainer.style.maxHeight =
            monstersContainer.scrollHeight + 'px';
        } else {
          categoryHeader.classList.add('collapsed');
          monstersContainer.classList.add('collapsed');
          monstersContainer.style.maxHeight = '0';
        }
      });

      categoryGroup.appendChild(monstersContainer);
      monsterListDiv.appendChild(categoryGroup);

      isFirstCategory = false;
    }

    monsterListDiv.style.display = 'block';
    document.getElementById('actions')!.style.display = 'block';
  } catch (error) {
    console.error('Error updating status:', error);
    const statusDiv = document.getElementById('status')!;
    statusDiv.innerHTML = `
      <div class="status-icon">❌</div>
      <div class="status-text">Error loading data</div>
    `;
  }
}

function selectMonster(category: string, index: number, monster: any): void {
  document.querySelectorAll('.monster-item.selected').forEach((el) => {
    el.classList.remove('selected');
  });

  const selectedItem = document.querySelector(
    `.monster-item[data-category="${category}"][data-index="${index}"]`,
  );
  selectedItem?.classList.add('selected');

  chrome.storage.local.set({ selectedMonster: monster });

  const fillButton = document.getElementById(
    'fill-roll20',
  ) as HTMLButtonElement;
  const selectedInfo = document.getElementById('selected-info')!;

  fillButton.disabled = false;
  fillButton.textContent = `Export ${monster.name} to Roll20`;
  selectedInfo.textContent = `Ready to fill Roll20 form`;
}

async function fillRoll20Form(): Promise<void> {
  const fillButton = document.getElementById(
    'fill-roll20',
  ) as HTMLButtonElement;
  const originalText = fillButton.textContent;

  try {
    const data = await chrome.storage.local.get(['selectedMonster']);
    if (!data.selectedMonster) {
      alert('No monster selected');
      return;
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      alert('No active tab found');
      return;
    }

    if (!tab.url?.includes('roll20.net')) {
      alert('Please open a Roll20 character sheet first');
      return;
    }

    fillButton.disabled = true;
    fillButton.textContent = 'Filling...';

    chrome.tabs.sendMessage(
      tab.id,
      { action: 'fillRoll20Form', monster: data.selectedMonster },
      (response) => {
        fillButton.disabled = false;
        fillButton.textContent = originalText;

        if (chrome.runtime.lastError) {
          console.error(
            'Chrome runtime error:',
            chrome.runtime.lastError.message,
          );
          alert(
            'Could not connect to Roll20 character sheet.\n\n' +
              '1. Make sure a character sheet popup is open\n' +
              '2. Try refreshing the Roll20 page\n' +
              '3. Reload the extension',
          );
          return;
        }

        if (response?.success) {
          alert('Form filled successfully!');
        } else {
          alert('Error filling form: ' + (response?.error || 'Unknown error'));
        }
      },
    );
  } catch (error) {
    console.error('Fill error:', error);
    fillButton.disabled = false;
    fillButton.textContent = originalText;
    alert('Unexpected error: ' + (error as Error).message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
  document
    .getElementById('fill-roll20')!
    .addEventListener('click', fillRoll20Form);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STORAGE_KEYS.MONSTERS]) {
    updateStatus();
  }
});
