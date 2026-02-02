# Privacy Policy for StatBlock Auto-Fill

**Last Updated:** February 2, 2026

## Overview

StatBlock Auto-Fill is a Chrome extension that syncs D&D monster statblocks from https://cros.land and auto-fills Roll20 character sheets. This extension is committed to protecting your privacy.

## Data Collection

**The extension developer does NOT collect any personal information.**

- No analytics or tracking
- No user accounts or authentication
- No data is sent to the extension developer's servers
- No cookies or tracking pixels

**However:** When you use the extension to export monsters to Roll20, that data is sent to Roll20's servers via Roll20's normal auto-save functionality. This is the intended purpose of the extension and only happens when you explicitly click "Export to Roll20".

## Data Storage

All data is stored locally on your device only:

- Monster statblocks are read from https://cros.land's browser localStorage
- Synced monsters are stored in your browser's local storage (`chrome.storage.local`)
- No data is transmitted over the network
- All data remains on your computer

## Permissions Explained

The extension requests the following permissions:

- **storage**: To save synced monster data locally in your browser
- **activeTab**: To detect when you're on a Roll20 character sheet page
- **tabs**: To send monster data to Roll20 tabs for form filling
- **https://cros.land/\***: To read monster data from cros.land's localStorage
- **https://app.roll20.net/\***: To fill character sheet forms on Roll20
- **https://storage.googleapis.com/\***: To access Roll20's character sheet iframes (hosted on Google's CDN)

## Third-Party Sites

The extension interacts with these third-party sites:

- **https://cros.land**: The extension reads monster data from this site's localStorage. No data is sent to cros.land by this extension.
- **Roll20 (https://app.roll20.net)**: When you click "Export to Roll20", the extension fills form fields on Roll20 character sheets. Roll20's auto-save functionality then saves this data to Roll20's servers. This is the intended purpose of the extension and only happens when you explicitly choose to export a monster.

**Important:** By using this extension to export monsters to Roll20, you are choosing to share that monster data with Roll20. The data becomes subject to Roll20's privacy policy and terms of service.

## Data Security

- All synced monster data is stored locally using Chrome's secure storage APIs
- The extension itself makes no network requests to external servers
- The extension operates entirely within your browser
- When you export to Roll20, Roll20's security and privacy policies apply to that data

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please contact:

**Email:** kenji.crosland.public@gmail.com
