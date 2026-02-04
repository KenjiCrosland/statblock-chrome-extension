/**
 * Content script for cros.land
 * Syncs monster data from localStorage to chrome.storage.sync
 *
 * Strategy:
 * 1. Sync on initial page load
 * 2. Detect form submissions (monster generation/save)
 * 3. Adaptive polling: 5s for 90s, then 15s for 90s (responsive for quick gens, patient for slow)
 */

// Inline constants to avoid imports
const STORAGE_KEY_MONSTERS = 'monsters';
const STORAGE_KEY_LAST_SYNC = 'lastSync';

// Dev mode - set to false for production
const DEV_MODE = false;

// Adaptive polling strategy
const FAST_POLL_INTERVAL_MS = 5000; // 5 seconds (responsive)
const FAST_POLL_DURATION_MS = 90000; // First 90 seconds
const SLOW_POLL_INTERVAL_MS = 15000; // 15 seconds (patient)
const SLOW_POLL_DURATION_MS = 90000; // Next 90 seconds
const MAX_POLL_DURATION_MS = FAST_POLL_DURATION_MS + SLOW_POLL_DURATION_MS; // 3 minutes total

let pollIntervalId: number | null = null;
let pollStartTime: number | null = null;
let lastSyncedData: string | null = null;

function log(...args: any[]) {
  if (DEV_MODE) {
    console.log('[StatBlock]', ...args);
  }
}

/**
 * Read monsters from cros.land's localStorage
 */
function getMonstersFromLocalStorage(): any {
  try {
    const monstersJson = localStorage.getItem(STORAGE_KEY_MONSTERS);
    if (!monstersJson) {
      log('No monsters found in localStorage');
      return null;
    }

    const monsters = JSON.parse(monstersJson);
    log('Found monsters in localStorage:', monsters);
    return monsters;
  } catch (error) {
    console.error('[StatBlock] Error reading monsters from localStorage:', error);
    return null;
  }
}

/**
 * Get normalized monster data for change detection
 * Ignores metadata fields that change frequently (timestamps, counts)
 */
function getNormalizedMonsterData(monsters: any): string {
  if (!monsters || typeof monsters !== 'object') {
    return '';
  }

  // Create a copy without metadata fields
  const normalized: any = {};

  for (const key in monsters) {
    // Skip metadata fields that update frequently
    if (key === 'generationCount' || key === 'firstGenerationTime' || key === 'lastGenerationTime') {
      continue;
    }
    normalized[key] = monsters[key];
  }

  return JSON.stringify(normalized);
}

/**
 * Sync monsters to chrome.storage.sync
 * @returns true if data was synced, false if no changes
 */
async function syncMonsters(showNotification = true): Promise<boolean> {
  try {
    const monsters = getMonstersFromLocalStorage();

    if (!monsters) {
      log('No monsters to sync');
      return false;
    }

    // Check if actual monster data has changed (ignore metadata)
    const currentData = getNormalizedMonsterData(monsters);
    if (currentData === lastSyncedData) {
      log('No changes detected, skipping sync');
      return false;
    }

    // Detect if user is on premium or free version
    const isPremium = window.location.href.includes('premium');
    const croslandUrl = isPremium
      ? 'https://cros.land/ai-powered-dnd-5e-monster-statblock-generator-premium/'
      : 'https://cros.land/ai-powered-dnd-5e-monster-statblock-generator/';

    // Save to chrome.storage.local (10MB limit vs sync's 8KB limit)
    await chrome.storage.local.set({
      [STORAGE_KEY_MONSTERS]: monsters,
      [STORAGE_KEY_LAST_SYNC]: Date.now(),
      croslandUrl: croslandUrl,
    });

    lastSyncedData = currentData;
    log('✅ Monsters synced to chrome.storage.local');

    // Show visual feedback
    if (showNotification) {
      showSyncNotification('✅ Monsters synced!');
    }

    return true; // Successfully synced
  } catch (error) {
    console.error('[StatBlock] Error syncing monsters:', error);
    if (showNotification) {
      showSyncNotification('❌ Sync failed', true);
    }
    return false;
  }
}

/**
 * Show a temporary notification on the page
 */
function showSyncNotification(message: string, isError = false): void {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${isError ? '#ef4444' : '#10b981'};
    color: white;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    animation: slideIn 0.3s ease-out;
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Start adaptive polling with quick initial check
 */
function startPolling(): void {
  // Clear any existing poll
  stopPolling();

  log('Starting polling: quick check at 2s, then adaptive (5s for 90s, 15s after)');

  // Immediate sync
  syncMonsters(false);

  // Quick check at 2 seconds (catches instant actions like moving folders)
  setTimeout(async () => {
    const foundChanges = await syncMonsters(false);

    if (foundChanges) {
      log('Quick 2s check found changes - stopping polling early!');
      stopPolling();
      return;
    }

    log('Quick 2s check: no changes yet, continuing polling...');
  }, 2000);

  // Then start adaptive polling at 5 seconds
  pollStartTime = Date.now();

  const poll = async () => {
    const elapsed = Date.now() - (pollStartTime || 0);

    // Stop if max duration reached
    if (elapsed >= MAX_POLL_DURATION_MS) {
      log('Max poll duration (3min) reached, stopping');
      stopPolling();
      return;
    }

    // Sync and check if changes were found
    const foundChanges = await syncMonsters(false);

    if (foundChanges) {
      log('Changes detected - stopping polling early!');
      stopPolling();
      return;
    }

    // Determine next interval based on elapsed time
    const nextInterval = elapsed < FAST_POLL_DURATION_MS
      ? FAST_POLL_INTERVAL_MS  // Fast polling (5s) for first 90s
      : SLOW_POLL_INTERVAL_MS; // Slow polling (15s) after that

    log(`Polling... (${Math.floor(elapsed / 1000)}s elapsed, next check in ${nextInterval / 1000}s)`);

    // Schedule next poll
    pollIntervalId = window.setTimeout(poll, nextInterval);
  };

  // Start adaptive polling at 5 seconds
  pollIntervalId = window.setTimeout(poll, FAST_POLL_INTERVAL_MS);
}

/**
 * Stop polling
 */
function stopPolling(): void {
  if (pollIntervalId !== null) {
    clearTimeout(pollIntervalId);
    pollIntervalId = null;
    pollStartTime = null;
  }
}

/**
 * Detect form submissions
 */
function setupFormDetection(): void {
  // Listen for form submissions (capture phase to catch Vue events)
  document.addEventListener('submit', (_event) => {
    log('Form submission detected, starting sync polling');
    startPolling();
  }, true);

  // Also listen for button clicks that might trigger saves
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    // Check if it's a save/generate button
    const buttonText = target.textContent?.toLowerCase() || '';
    if (
      target.tagName === 'BUTTON' &&
      (buttonText.includes('save') ||
       buttonText.includes('generate') ||
       buttonText.includes('statblock'))
    ) {
      log('Save/Generate button clicked, starting sync polling');
      startPolling();
    }
  }, true);
}

/**
 * Listen for sync requests from popup
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'syncNow') {
    log('Sync requested by popup');
    syncMonsters(false).then((changed) => {
      sendResponse({ success: true, changed });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Indicates async response
  }
});

/**
 * Initialize
 */
function init(): void {
  log('Extension loaded on cros.land');

  // Initial sync on page load (no notification)
  syncMonsters(false);

  // Set up form/button detection
  setupFormDetection();

  log('Monitoring for form submissions and save buttons');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
