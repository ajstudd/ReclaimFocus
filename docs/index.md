# Privacy Policy for ReclaimFocus

**Last Updated**: October 20, 2025

## Overview

ReclaimFocus is a Chrome extension designed to help users stay focused by blocking distracting websites, keywords, and providing time-limited access to sites. We are committed to protecting your privacy.

## Data Collection

**We do NOT collect, store, or transmit any personal data to external servers.**

### What Data is Stored Locally

All data is stored locally on your device using Chrome's storage API (`chrome.storage.local`). This data never leaves your computer and includes:

1. **Blocked Sites List**: Domains you choose to block and their redirect URLs
2. **Blocked Keywords List**: Keywords you choose to block in search engines
3. **Time-Limited Sites**: Domains with time limits, cooldown periods, and redirect URLs
4. **Activity Logs**: Local logs of blocked attempts (timestamps, URLs, keywords)
5. **Timer Data**: Active timer states, elapsed time, pause states
6. **Settings**: Your preferences (dark mode, extension enabled/disabled)

### Permissions Used

- **`storage`**: Store your configuration and timer data locally on your device
- **`tabs`**: Access tab information to redirect blocked sites and manage timers
- **`webNavigation`**: Detect when you navigate to blocked sites or search for blocked keywords
- **`<all_urls>`**: Check if visited URLs match your blocked sites or time-limited sites across all domains
- **`declarativeNetRequest`**: Block navigation to restricted sites efficiently

### Data Usage

- All data is used **exclusively** for the functionality of the extension
- No data is shared with third parties
- No analytics or tracking is performed
- No advertisements are displayed
- No user behavior is monitored beyond what you configure

### Data Control

You have complete control over your data:

- **Export**: You can export all your data as JSON at any time
- **Import**: You can import previously exported configurations
- **Delete**: You can clear all data by removing the extension
- **Modify**: You can edit or remove any blocked sites, keywords, or time limits at any time

### Data Security

- All data is stored locally using Chrome's secure storage API
- No network requests are made to external servers
- No data leaves your device
- Extension operates entirely offline

### Third-Party Services

This extension does NOT use any third-party services, analytics, or tracking tools.

### Children's Privacy

This extension does not knowingly collect any information from children under 13 years of age.

### Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last Updated" date above.

### Contact

If you have questions about this privacy policy, please contact:

- GitHub Issues: https://github.com/ajstudd/ReclaimFocus/issues
- Email: [Your email address]

### Open Source

ReclaimFocus is open source. You can review the entire codebase at:
https://github.com/ajstudd/ReclaimFocus

---

**Summary**: ReclaimFocus stores all data locally on your device and does not collect, transmit, or share any personal information. Your privacy is completely protected.
