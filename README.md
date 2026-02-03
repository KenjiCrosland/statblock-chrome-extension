# StatBlock Auto-Fill Chrome Extension

A Chrome extension that syncs D&D monster statblocks from cros.land and auto-fills Roll20 character sheets.

## Features

### ✅ Phase 1: cros.land Sync (Complete)
- Automatically syncs monsters from cros.land localStorage
- Adaptive polling strategy (quick checks, then slower intervals)
- Early stopping when changes detected
- Stores data in chrome.storage.local (10MB limit)
- Popup shows individual monsters grouped by category
- Accordion UI with monster selection

### ✅ Phase 2: Roll20 Integration (Complete - In Testing)
- Auto-fills Roll20 character sheets in the character-sheet iframe
- Fills basic stats (name, type, AC, HP, speed, senses, etc.)
- Fills ability scores, saving throws, and skills
- Spellcaster support (detects and fills spellcasting ability, DC, attack bonus, caster level)
- Handles repeating sections (traits, actions, legendary actions)
- Intelligent attack parsing (extracts to-hit, damage, range, type from descriptions)
- Skips save-based abilities that aren't attacks (avoids false positives)
- Uses `execCommand` for trusted input events that Roll20's framework accepts
- Helpful error messages guide users to create NPC sheets and handle edge cases

## Current Status

The extension is **complete and ready for use**! Both phases work end-to-end:
- ✅ Syncs monsters from cros.land automatically
- ✅ Displays monsters in organized popup with accordion UI
- ✅ Fills Roll20 character sheets including spellcasters and complex attacks
- ✅ Spellcasting metadata (ability, DC, attack bonus) fills automatically
- ✅ The full spellcasting trait (with spell list) is added to traits section

## Development

### Prerequisites
- Node.js 18+
- npm

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

### Testing

1. **Test sync**: Visit https://cros.land and generate monsters
2. **Test popup**: Click the extension icon to see synced monsters
3. **Test Roll20 fill**:
   - Open a Roll20 character sheet
   - Select a monster in the popup
   - Click "Export [Monster Name] to Roll20"

## How It Works

### Sync from cros.land

The extension uses adaptive polling to detect when monsters are saved:
- Quick check at 2 seconds after page load
- Polls every 5 seconds for the first 90 seconds
- Then polls every 15 seconds
- Stops early if changes are detected

### Roll20 Integration

Roll20's character sheets load in an iframe from `storage.googleapis.com`. The extension:

1. Runs content script in **all frames** on Roll20 pages
2. Targets only the `character-sheet` iframe (not the `headless-sheet-frame`)
3. Waits for `#charsheet` element to load
4. Uses `document.execCommand('insertText')` to simulate real user typing
5. Fills fields sequentially with proper focus/blur events
6. Handles repeating sections by clicking "+Add" buttons

## Data Format

Monsters are stored in localStorage under the key `"monsters"`:

```json
{
  "Uncategorized": [
    {
      "name": "Frost Wyrm Hatchling",
      "type_and_alignment": "Medium dragon, unaligned",
      "armor_class": "17 (natural armor)",
      "hit_points": "82 (11d8 + 33)",
      "speed": "30 ft., fly 60 ft.",
      "attributes": "STR 14 (+2), DEX 16 (+3), CON 18 (+4), INT 2 (-4), WIS 10 (+0), CHA 8 (-1)",
      "saving_throws": "DEX +5, CON +4, WIS +2, CHA +5",
      "skills": "Perception +2, Stealth +5",
      "damage_resistances": "cold",
      "damage_immunities": "none",
      "condition_immunities": "none",
      "senses": "Darkvision 60 ft., passive Perception 12",
      "languages": "understands Draconic but can't speak",
      "challenge_rating": "3 (700 XP)",
      "proficiency_bonus": "+2",
      "abilities": [
        {
          "name": "Frost Scales",
          "description": "The hatchling has resistance to cold damage..."
        }
      ],
      "actions": [
        {
          "name": "Ice Talon Strike",
          "description": "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 9 (1d10 + 4) slashing damage plus 3 (1d6) cold damage."
        }
      ],
      "legendary_actions": []
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
│   │   ├── crosland.ts          # Sync from cros.land localStorage
│   │   └── roll20.ts            # Fill Roll20 character sheets
│   ├── popup/
│   │   ├── popup.html           # Extension popup UI
│   │   ├── popup.css            # Popup styles
│   │   └── popup.ts             # Popup logic
│   ├── types/
│   │   └── monster.ts           # TypeScript interfaces
│   └── utils/
│       └── attack-parser.ts     # Parse attack descriptions
├── public/
│   └── *.svg                    # Extension icons (placeholders)
├── manifest.json                # Chrome extension manifest (v3)
├── vite.config.ts               # Vite build configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

## Tech Stack

- **TypeScript** - Type-safe development
- **Vite** - Fast build tool with watch mode
- **Chrome Extension Manifest V3** - Latest extension API
- **chrome.storage.local** - Local storage (10MB limit)

## Known Issues

- **Form persistence**: Roll20's character sheet uses complex form handling that sometimes doesn't persist programmatically-filled values. We're using `execCommand('insertText')` and proper event sequences to work around this.
- **Timing sensitivity**: Some fields require specific delays to register properly
- **Icons**: Currently using placeholder SVG icons

## Roadmap

- [x] Phase 1: cros.land sync
- [x] Phase 2: Roll20 integration (basic filling works)
- [ ] Refine form filling for 100% persistence
- [ ] Add proper extension icons
- [ ] Support more Roll20 sheet types beyond NPC sheets
- [ ] Better error handling and user feedback

## License

MIT
