# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that syncs D&D monster statblocks from cros.land's localStorage and auto-fills Roll20 character sheets. Built with TypeScript + Vite.

**Current Status:**
- Phase 1 complete (cros.land sync with adaptive polling)
- Phase 2 complete but in testing (Roll20 integration works end-to-end, refining form persistence)

## Commands

### Development
```bash
npm install              # Install dependencies
npm run dev              # Build in watch mode (auto-rebuild on changes)
npm run build            # Production build
npm run type-check       # TypeScript type checking (no output)
```

### Testing the Extension
1. Run `npm run build` to create the `dist/` folder
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the `dist/` folder
5. Visit https://cros.land to test auto-sync

## Architecture

### Data Flow

**Phase 1: cros.land Sync**
```
cros.land page
  └─> User saves monsters to localStorage['monsters']
  └─> Content script (crosland.ts) uses adaptive polling:
      - Quick check at 2 seconds after page load
      - Polls every 5 seconds for first 90 seconds
      - Then polls every 15 seconds
      - Stops early if changes detected
  └─> Reads localStorage['monsters']
  └─> Syncs to chrome.storage.local['monsters'] (10MB limit)
  └─> Shows green notification on page
  └─> Popup (popup.ts) displays individual monsters grouped by category
```

**Phase 2: Roll20 Integration**
```
Roll20 character sheet page
  └─> Loads in iframe from storage.googleapis.com (cross-origin)
  └─> Content script (roll20.ts) runs in all frames
  └─> Waits for #charsheet element to load
  └─> User selects monster in popup
  └─> Popup sends message to content script
  └─> Content script (only character-sheet frame responds, not headless-sheet-frame)
  └─> Fills fields using document.execCommand('insertText') for trusted input
  └─> Handles repeating sections (traits, actions, legendary actions)
  └─> Parses attack descriptions to extract structured data
```

### Key Files

- **manifest.json** - Extension manifest (Manifest V3)
  - Content scripts for `https://cros.land/*` and Roll20 domains
  - Host permissions include `storage.googleapis.com` for Roll20 iframes
  - `all_frames: true` for Roll20 to access character sheet iframes
  - Permissions: `storage`, `activeTab`, `tabs`

- **src/content/crosland.ts** - Content script for cros.land
  - Adaptive polling strategy (2s → 5s intervals → 15s intervals)
  - Early stopping when changes detected
  - Reads from `localStorage['monsters']`
  - Writes to `chrome.storage.local['monsters']` (10MB limit)
  - Shows toast notifications on the page

- **src/content/roll20.ts** - Content script for Roll20
  - Runs in all frames on `app.roll20.net` and `storage.googleapis.com`
  - Targets only `character-sheet` iframe (not `headless-sheet-frame`)
  - Waits for `#charsheet` element before filling
  - Uses `document.execCommand('insertText')` for trusted input events
  - Fills basic stats, ability scores, saves, skills
  - Handles repeating sections (traits, actions, legendary actions)
  - Sequential filling with proper focus/blur events and delays

- **src/popup/*** - Extension popup UI
  - Shows individual monsters grouped by category
  - Accordion UI (only one category open at a time)
  - First category expanded by default
  - Monster selection updates button to "Export [Monster Name] to Roll20"
  - Sends messages to Roll20 content script to trigger filling

- **src/types/monster.ts** - TypeScript types
  - `Monster` interface matches cros.land data format
  - `MonsterCollection` allows string metadata alongside Monster arrays
  - See README.md for full data format example

- **src/utils/attack-parser.ts** - Parsing utilities
  - `parseAttackDescription()` - Extracts to-hit, damage, range from attack text
  - `parseAttributes()` - Parses ability scores from attribute string
  - `parseSavingThrows()` - Extracts saving throw bonuses
  - `parseSkills()` - Maps skill names to Roll20 field names

### Build System

- **Vite** - Bundles TypeScript to JavaScript
  - Entry points: `content-crosland.ts`, `content-roll20.ts`, `popup.ts`
  - Output: `dist/content-crosland.js`, `dist/content-roll20.js`, `dist/popup.js`

- **vite-plugin-static-copy** - Copies static files to dist/
  - Copies: manifest.json, popup.html, popup.css, icons

## Design Constraints

### Roll20 Form Filling Challenges

**Iframe Architecture Discovery:**
- Roll20 character sheets load in an iframe from `storage.googleapis.com` (cross-origin)
- There are TWO iframes: `character-sheet` (visible) and `headless-sheet-frame` (background)
- Must target ONLY the `character-sheet` frame to avoid conflicts
- Required `all_frames: true` in manifest.json and `storage.googleapis.com` in host_permissions

**Form Persistence:**
- Roll20's character sheet uses complex form handling that doesn't always persist programmatically-filled values
- Solution: `document.execCommand('insertText')` creates trusted input events that the framework accepts
- Requires proper event sequence: focus → select → execCommand → blur
- Sequential filling with delays (30ms after input, 20ms after blur) for reliability
- All `fillField()` calls must be awaited (no parallel filling)

**Repeating Sections:**
- Traits, actions, and legendary actions use repeating fieldsets
- Must click "+Add" buttons to create new rows before filling
- Each row has unique IDs generated by Roll20's framework

### No Automation Beyond Field Filling
- Extension fills form fields ONLY
- User must manually click Submit/Save in Roll20
- Never auto-submit forms
- Auto-clicking is limited to +Add buttons for repeating sections

### Storage Limits
- Switched from `chrome.storage.sync` (8KB per item) to `chrome.storage.local` (10MB total)
- Current implementation stores all monsters in one key
- Local storage provides sufficient space for typical use cases

## Integration with cros.land

The extension uses adaptive polling to detect when monsters are saved to localStorage:

1. Quick check at 2 seconds after page load (catches immediate generations)
2. Polls every 5 seconds for the first 90 seconds (active generation period)
3. Then polls every 15 seconds (background monitoring)
4. Stops early if changes are detected

This approach works without requiring changes to cros.land's code and handles both immediate and delayed monster generation gracefully.

## Roll20 Implementation Details

### How Form Filling Works

**1. Iframe Detection and Targeting:**
```typescript
// Wait for character sheet iframe to load
async function waitForCharsheet(): Promise<boolean> {
  // Only run in the character-sheet frame, not headless-sheet-frame
  if (window.name !== 'character-sheet') return false;

  // Wait for #charsheet element to be present
  for (let i = 0; i < 50; i++) {
    if (document.querySelector('#charsheet')) return true;
    await sleep(100);
  }
  return false;
}
```

**2. Field Filling with Trusted Input Events:**
```typescript
async function fillTextField(selector: string, value: string): Promise<boolean> {
  const field = document.querySelector<HTMLInputElement>(selector);
  if (!field) return false;

  field.focus();
  field.select();
  document.execCommand('insertText', false, value); // Trusted input event
  await sleep(30);
  field.blur();
  await sleep(20);
  return true;
}
```

**3. Attack Parsing:**
The extension intelligently parses attack descriptions like:
- "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (1d10 + 4) slashing damage plus 3 (1d6) cold damage."

Extracts:
- Attack type (Melee/Ranged)
- To-hit bonus (+6)
- Range (5 ft.)
- Primary damage (1d10 + 4, slashing)
- Secondary damage (1d6, cold)

**4. Repeating Sections:**
For traits, actions, and legendary actions:
1. Click the "+Add" button to create a new row
2. Wait for the new fieldset to appear in the DOM
3. Fill the name and description fields
4. For attacks, also fill damage, to-hit, range fields

### Known Issues and Current Challenges

**Form Persistence:**
- Some fields visually fill but don't always persist when the form is saved
- This is due to Roll20's complex form handling not always recognizing programmatic changes
- The `execCommand('insertText')` approach significantly improved reliability
- Still refining timing and event sequences for 100% persistence

**Timing Sensitivity:**
- Some fields require specific delays (30ms after input, 20ms after blur) to register properly
- Too fast = fields don't persist; too slow = poor UX
- Current delays work for most fields but may need per-field tuning

**Message Listener:**
- CRITICAL: Content script must listen for messages from popup
- Must check `window.name === 'character-sheet'` to avoid responding from headless frame
- Both frames receive the message, only character-sheet should respond

## Common Tasks

### Adding a new field to the Monster type
1. Update `src/types/monster.ts` interface
2. No changes needed in sync logic (it copies everything)
3. Add field mapping in `src/content/roll20.ts` if filling to Roll20
4. Update parsers in `src/utils/attack-parser.ts` if needed

### Debugging sync issues (cros.land)
1. Open Chrome DevTools on cros.land
2. Check Console for `[StatBlock]` logs
3. Check `chrome.storage.local` in DevTools → Application → Storage → Extension Storage
4. Verify localStorage has data: `localStorage.getItem('monsters')`
5. Check popup to see if monsters are displayed

### Debugging Roll20 form filling
1. Open Chrome DevTools on Roll20 character sheet page
2. Check Console for errors (look for cross-origin issues, selector failures)
3. Verify you're in the correct frame:
   ```javascript
   window.name // Should be "character-sheet"
   document.querySelector('#charsheet') // Should exist
   ```
4. Manually test field selectors in console:
   ```javascript
   document.querySelector('input[name="attr_npc_name"]')
   ```
5. Check for both frames (character-sheet and headless-sheet-frame):
   ```javascript
   // From main page
   Array.from(document.querySelectorAll('iframe')).map(f => f.name)
   ```
6. Monitor which frame is responding to messages (add console.logs in message listener)

### Testing the extension locally
1. Make changes to source files
2. If `npm run dev` is running, it auto-rebuilds
3. Click "Reload" button on extension card in `chrome://extensions/`
4. **Important:** Refresh both the cros.land page AND Roll20 page to reload content scripts
5. Check DevTools Console for errors in all contexts (background, popup, content scripts)

## TypeScript Configuration

- **Target:** ES2020
- **Module:** ESNext with bundler resolution
- **Strict mode:** Enabled
- **Types:** `@types/chrome` for extension APIs

The build output is modern ES modules, which Chrome extension content scripts and popups support natively.
