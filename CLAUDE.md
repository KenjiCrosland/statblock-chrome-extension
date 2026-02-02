# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that syncs D&D monster statblocks from cros.land's localStorage and will eventually auto-fill Roll20 monster sheets. Built with TypeScript + Vite.

**Current Status:** Phase 1 complete (cros.land sync). Phase 2 (Roll20 integration) is upcoming.

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

### Data Flow (Phase 1 - Current)

```
cros.land page
  └─> User saves monsters to localStorage['monsters']
  └─> Site dispatches CustomEvent('statblock:updated')
  └─> Content script (crosland.ts) catches event
  └─> Reads localStorage['monsters']
  └─> Syncs to chrome.storage.sync['monsters']
  └─> Shows green notification on page
  └─> Popup (popup.ts) displays sync status
```

### Key Files

- **manifest.json** - Extension manifest (Manifest V3)
  - Content script injected into `https://cros.land/*`
  - Popup UI for sync status
  - Permissions: `storage`, `https://cros.land/*`

- **src/content/crosland.ts** - Content script for cros.land
  - Listens for `statblock:updated` custom events
  - Reads from `localStorage['monsters']`
  - Writes to `chrome.storage.sync['monsters']`
  - Shows toast notifications on the page
  - No polling - purely event-driven

- **src/popup/*** - Extension popup UI
  - Shows last sync time (relative format)
  - Displays total monster count
  - Lists categories with counts
  - Auto-updates when storage changes

- **src/types/monster.ts** - TypeScript types
  - `Monster` interface matches cros.land data format
  - `MonsterCollection` is the localStorage structure
  - See README.md for full data format example

### Build System

- **Vite** - Bundles TypeScript to JavaScript
  - Entry points: `content-crosland.ts`, `popup.ts`
  - Output: `dist/content-crosland.js`, `dist/popup.js`

- **vite-plugin-static-copy** - Copies static files to dist/
  - Copies: manifest.json, popup.html, popup.css, icons

## Design Constraints

### Resilience to UI Changes
When implementing Phase 2 (Roll20 integration), form filling MUST:
- Use multiple selector strategies (ID → name → data-attr → label proximity)
- Never crash if a field is missing
- Best-effort filling - skip missing fields gracefully
- Log what was filled vs. what was skipped

### No Automation Beyond Field Filling
- Extension fills form fields ONLY
- User must manually click Submit/Save in Roll20
- Never auto-submit forms
- Never auto-click buttons (except the monster selector dropdown)

### Storage Limits
- `chrome.storage.sync` has a 100KB limit per item
- Current implementation stores all monsters in one key
- If users exceed 100KB, we'll need to split by category

## Integration with cros.land

The cros.land statblock generator must dispatch a custom event after saving:

```javascript
// After updating localStorage
localStorage.setItem('monsters', JSON.stringify(monsterData));

// Trigger extension sync
window.dispatchEvent(new CustomEvent('statblock:updated'));
```

The extension listens for this event instead of polling, making it efficient and responsive.

## Phase 2 Implementation Notes (Roll20 Integration)

When implementing Roll20 form filling:

1. **Add a new content script** in manifest.json for Roll20 domains
2. **Create resilient field mappers** in `src/utils/`:
   - Parse monster data into field values
   - Map to Roll20 form fields using fallback selectors
   - Return filling results (success/failure per field)

3. **Create UI for monster selection**:
   - Inject a dropdown or panel into Roll20's monster sheet page
   - Load monsters from `chrome.storage.sync`
   - Show list grouped by category
   - On selection, fill the form

4. **Visual feedback**:
   - Highlight filled fields (green border?)
   - Show summary: "✅ 12 filled / ⚠️ 3 missing"
   - Use non-intrusive styling

5. **Testing strategy**:
   - Since we don't know Roll20's current form structure, inspect the page first
   - Create selector strategies based on actual HTML
   - Test with multiple monster types (especially legendary actions, spellcasters)

## Common Tasks

### Adding a new field to the Monster type
1. Update `src/types/monster.ts` interface
2. No changes needed in sync logic (it copies everything)
3. When implementing Roll20 filling, map the new field

### Debugging sync issues
1. Open Chrome DevTools on cros.land
2. Check Console for `[StatBlock]` logs
3. Check `chrome.storage.sync` in DevTools → Application → Storage
4. Verify localStorage has data: `localStorage.getItem('monsters')`
5. Manually trigger sync: `window.dispatchEvent(new CustomEvent('statblock:updated'))`

### Testing the extension locally
1. Make changes to source files
2. If `npm run dev` is running, it auto-rebuilds
3. Click "Reload" button on extension card in `chrome://extensions/`
4. Refresh the cros.land page to reload content script
5. Check DevTools Console for errors

## TypeScript Configuration

- **Target:** ES2020
- **Module:** ESNext with bundler resolution
- **Strict mode:** Enabled
- **Types:** `@types/chrome` for extension APIs

The build output is modern ES modules, which Chrome extension content scripts and popups support natively.
