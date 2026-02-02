# StatBlock Auto-Fill Chrome Extension

A Chrome extension that syncs D&D monster statblocks from cros.land and auto-fills Roll20 monster sheets.

## Features

### Phase 1: Auto-Sync (Current)
- ✅ Automatically syncs monsters from cros.land localStorage to chrome.storage.sync
- ✅ Event-driven sync (no polling) - triggered when you save monsters
- ✅ Popup shows sync status and monster count
- ✅ Cross-device sync via Chrome's sync storage

### Phase 2: Roll20 Integration (Upcoming)
- 🔜 Auto-fill Roll20 monster sheet forms
- 🔜 Resilient field mapping (survives UI changes)
- 🔜 Visual feedback (highlight filled fields)
- 🔜 Fill summary (✅ filled / ⚠️ missing fields)

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Build the extension (watch mode for development)
npm run dev

# Production build
npm run build

# Type check
npm run type-check
```

### Load the Extension in Chrome

1. Build the extension (`npm run build`)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist/` folder from this project

## Integrating with cros.land

To trigger auto-sync from your statblock generator, dispatch a custom event after saving monsters to localStorage:

```javascript
// After saving to localStorage with key "monsters"
localStorage.setItem('monsters', JSON.stringify(monsterData));

// Dispatch event to trigger extension sync
window.dispatchEvent(new CustomEvent('statblock:updated'));
```

The extension will:
1. Read the monsters from `localStorage.getItem('monsters')`
2. Sync them to `chrome.storage.sync`
3. Show a green notification confirming the sync

## Data Format

Monsters are stored in localStorage under the key `"monsters"` with this structure:

```json
{
  "Uncategorized": [
    {
      "name": "Frost Wyrm Hatchling",
      "type_and_alignment": "Medium dragon, unaligned",
      "armor_class": "17 (natural armor)",
      "hit_points": "60 (8d8 + 24)",
      "speed": "30 ft., fly 60 ft.",
      "attributes": "STR 14 (+2), DEX 16 (+3), CON 18 (+4), INT 2 (-4), WIS 10 (+0), CHA 8 (-1)",
      "saving_throws": "DEX +5, CON +4, WIS +2, CHA +5",
      "skills": "Perception +2, Stealth +5",
      "damage_resistances": "none",
      "damage_immunities": "none",
      "condition_immunities": "none",
      "senses": "Darkvision 60 ft., passive Perception 12",
      "languages": "understands Draconic but can't speak",
      "challenge_rating": "3 (700 XP)",
      "proficiency_bonus": "+2",
      "abilities": [
        {
          "name": "Frost Scales",
          "description": "The Frost Wyrm Hatchling's scales are coated in a layer of ice..."
        }
      ],
      "actions": [
        {
          "name": "Ice Talon Strike",
          "description": "Melee Attack: +6 to hit, dealing 9 (1d10 + 4) slashing damage..."
        }
      ],
      "legendary_actions": [],
      "monsterDescription": "",
      "monsterType": "Random",
      "selectedChallengeRating": "3",
      "caster": false
    }
  ],
  "generationCount": "3",
  "firstGenerationTime": "1768526974842"
}
```

## Project Structure

```
statblock-chrome-extension/
├── src/
│   ├── content/
│   │   └── crosland.ts          # Content script for cros.land (auto-sync)
│   ├── popup/
│   │   ├── popup.html           # Extension popup UI
│   │   ├── popup.css            # Popup styles
│   │   └── popup.ts             # Popup logic (sync status)
│   ├── types/
│   │   └── monster.ts           # TypeScript interfaces for monsters
│   └── utils/                   # Future: form filling utilities
├── public/
│   ├── icon-16.svg              # Extension icon (small)
│   ├── icon-48.svg              # Extension icon (medium)
│   └── icon-128.svg             # Extension icon (large)
├── manifest.json                # Chrome extension manifest (v3)
├── vite.config.ts               # Vite build configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

## Tech Stack

- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Chrome Extension Manifest V3** - Latest extension API
- **chrome.storage.sync** - Cross-device data sync (100KB limit per item)

## Roadmap

- [x] Phase 1: cros.land sync
  - [x] Event-driven localStorage sync
  - [x] Popup UI with sync status
  - [x] Monster count by category
- [ ] Phase 2: Roll20 integration
  - [ ] Detect Roll20 monster sheet forms
  - [ ] Map monster fields to form inputs
  - [ ] Resilient multi-strategy selectors
  - [ ] Visual feedback (highlight filled fields)
  - [ ] Fill summary UI
  - [ ] Handle edge cases gracefully

## License

MIT
