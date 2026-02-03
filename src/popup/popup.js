import { STORAGE_KEYS } from '../types/monster';
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60)
        return 'just now';
    if (minutes < 60)
        return `${minutes}m ago`;
    if (hours < 24)
        return `${hours}h ago`;
    return `${days}d ago`;
}
function countMonsters(collection) {
    let total = 0;
    for (const [key, value] of Object.entries(collection)) {
        if (key === 'generationCount' || key === 'firstGenerationTime')
            continue;
        if (Array.isArray(value)) {
            total += value.length;
        }
    }
    return total;
}
function isSyncFresh(timestamp) {
    const ONE_HOUR = 60 * 60 * 1000;
    return Date.now() - timestamp < ONE_HOUR;
}
function setFillingState(active, monsterName) {
    const body = document.body;
    const fillingText = document.getElementById('filling-text');
    const fillButton = document.getElementById('fill-roll20');
    const selectedInfo = document.getElementById('selected-info');
    if (active) {
        body.classList.add('filling');
        fillingText.innerHTML = `<strong>${monsterName}</strong><br>Exporting to Roll20, this may take a moment...`;
        fillButton.disabled = true;
        fillButton.textContent = 'Exporting...';
        selectedInfo.textContent = '';
    }
    else {
        body.classList.remove('filling');
    }
}
async function updateStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const monsterListDiv = document.getElementById('monster-list');
    const footer = document.getElementById('footer');
    try {
        const data = await chrome.storage.local.get([
            STORAGE_KEYS.MONSTERS,
            STORAGE_KEYS.LAST_SYNC,
        ]);
        const monsters = data[STORAGE_KEYS.MONSTERS];
        const lastSync = data[STORAGE_KEYS.LAST_SYNC];
        // No data yet
        if (!monsters || !lastSync) {
            statusDot.className = 'status-dot off';
            statusText.innerHTML =
                'No monsters yet — <a href="https://cros.land/ai-powered-dnd-5e-monster-statblock-generator/" target="_blank">generate some at cros.land</a>';
            monsterListDiv.innerHTML = `
        <div class="empty-state">
          <div class="icon">🎲</div>
          <p>Generate monsters at <a href="https://cros.land/ai-powered-dnd-5e-monster-statblock-generator/" target="_blank">cros.land</a> and they'll appear here automatically.</p>
        </div>
      `;
            return;
        }
        const totalMonsters = countMonsters(monsters);
        const fresh = isSyncFresh(lastSync);
        // Status bar
        statusDot.className = `status-dot ${fresh ? 'green' : 'yellow'}`;
        if (fresh) {
            statusText.innerHTML = `<strong>${totalMonsters} monsters</strong> ready · synced ${formatRelativeTime(lastSync)}`;
        }
        else {
            statusText.innerHTML = `<strong>${totalMonsters} monsters</strong> · synced ${formatRelativeTime(lastSync)} · <a href="https://cros.land" target="_blank">refresh</a>`;
        }
        // Build monster list
        monsterListDiv.innerHTML = '';
        let isFirstCategory = true;
        for (const [category, monsterList] of Object.entries(monsters)) {
            if (category === 'generationCount' || category === 'firstGenerationTime')
                continue;
            if (!Array.isArray(monsterList) || monsterList.length === 0)
                continue;
            const categoryGroup = document.createElement('div');
            categoryGroup.className = 'category-group';
            const categoryHeader = document.createElement('div');
            categoryHeader.className = isFirstCategory
                ? 'category-header'
                : 'category-header collapsed';
            categoryHeader.innerHTML = `
        <span>${category} <span class="count">(${monsterList.length})</span></span>
        <span class="arrow">▼</span>
      `;
            categoryGroup.appendChild(categoryHeader);
            const monstersContainer = document.createElement('div');
            monstersContainer.className = isFirstCategory
                ? 'category-monsters'
                : 'category-monsters collapsed';
            monsterList.forEach((monster, index) => {
                const monsterItem = document.createElement('div');
                monsterItem.className = 'monster-item';
                monsterItem.dataset.category = category;
                monsterItem.dataset.index = index.toString();
                const cr = monster.challenge_rating?.split(' ')[0] || '?';
                const type = monster.type_and_alignment?.split(',')[0] || '';
                monsterItem.innerHTML = `
          <div class="monster-name">${monster.name}</div>
          <div class="monster-meta">
            <span>${type}</span>
            <span class="monster-cr">CR ${cr}</span>
          </div>
        `;
                monsterItem.addEventListener('click', () => selectMonster(category, index, monster));
                monstersContainer.appendChild(monsterItem);
            });
            // Expand first category
            if (isFirstCategory) {
                requestAnimationFrame(() => {
                    monstersContainer.style.maxHeight =
                        monstersContainer.scrollHeight + 'px';
                });
            }
            else {
                monstersContainer.style.maxHeight = '0';
            }
            // Accordion toggle
            categoryHeader.addEventListener('click', () => {
                const isCollapsed = categoryHeader.classList.contains('collapsed');
                if (isCollapsed) {
                    // Collapse others
                    document
                        .querySelectorAll('.category-header:not(.collapsed)')
                        .forEach((otherHeader) => {
                        if (otherHeader !== categoryHeader) {
                            const otherContainer = otherHeader.nextElementSibling;
                            otherHeader.classList.add('collapsed');
                            otherContainer.classList.add('collapsed');
                            otherContainer.style.maxHeight = '0';
                        }
                    });
                    categoryHeader.classList.remove('collapsed');
                    monstersContainer.classList.remove('collapsed');
                    monstersContainer.style.maxHeight =
                        monstersContainer.scrollHeight + 'px';
                }
                else {
                    categoryHeader.classList.add('collapsed');
                    monstersContainer.classList.add('collapsed');
                    monstersContainer.style.maxHeight = '0';
                }
            });
            categoryGroup.appendChild(monstersContainer);
            monsterListDiv.appendChild(categoryGroup);
            isFirstCategory = false;
        }
        // Show footer
        footer.style.display = 'block';
    }
    catch (error) {
        console.error('Error updating status:', error);
        statusDot.className = 'status-dot off';
        statusText.textContent = 'Error loading data';
    }
}
function selectMonster(category, index, monster) {
    document.querySelectorAll('.monster-item.selected').forEach((el) => {
        el.classList.remove('selected');
    });
    const selectedItem = document.querySelector(`.monster-item[data-category="${category}"][data-index="${index}"]`);
    selectedItem?.classList.add('selected');
    chrome.storage.local.set({ selectedMonster: monster });
    const fillButton = document.getElementById('fill-roll20');
    const selectedInfo = document.getElementById('selected-info');
    fillButton.disabled = false;
    fillButton.textContent = `Export ${monster.name} to Roll20`;
    selectedInfo.textContent = '';
}
async function fillRoll20Form() {
    const fillButton = document.getElementById('fill-roll20');
    const selectedInfo = document.getElementById('selected-info');
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
        if (!tab.url?.includes('roll20.net') ||
            tab.url?.includes('roll20.net/characters/create')) {
            selectedInfo.innerHTML =
                '<a href="https://app.roll20.net/characters/create/ogl5e" target="_blank">Create a Roll20 character</a>, click <strong>Create an NPC</strong>, then export again';
            return;
        }
        setFillingState(true, data.selectedMonster.name);
        chrome.tabs.sendMessage(tab.id, { action: 'fillRoll20Form', monster: data.selectedMonster }, (response) => {
            setFillingState(false);
            fillButton.disabled = false;
            fillButton.textContent = originalText;
            if (chrome.runtime.lastError) {
                console.error('Chrome runtime error:', chrome.runtime.lastError.message);
                selectedInfo.textContent = '';
                alert('Could not connect to Roll20 character sheet.\n\n' +
                    '1. Make sure a character sheet popup is open\n' +
                    '2. Try refreshing the Roll20 page\n' +
                    '3. Reload the extension');
                return;
            }
            if (response?.success) {
                selectedInfo.textContent = '✓ Export complete';
            }
            else {
                selectedInfo.textContent = '';
                alert('Error: ' + (response?.error || 'Unknown error'));
            }
        });
    }
    catch (error) {
        console.error('Fill error:', error);
        setFillingState(false);
        fillButton.disabled = false;
        fillButton.textContent = originalText;
        selectedInfo.textContent = '';
        alert('Unexpected error: ' + error.message);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    document
        .getElementById('fill-roll20')
        .addEventListener('click', fillRoll20Form);
});
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.MONSTERS]) {
        updateStatus();
    }
});
