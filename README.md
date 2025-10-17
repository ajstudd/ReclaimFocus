# ReclaimFocus

A Chrome extension that blocks distracting websites and search keywords, redirecting you to productive alternatives.

## Features

- Block distracting websites with custom redirect URLs
- **Block search keywords** across all search engines
- Global redirect for keywords without specific redirects
- Pre-configured blocks for common time-wasters
- Activity logging to track blocked attempts (websites and keywords)
- Statistics on most-blocked sites
- Export/Import configuration
- Dark mode support
- Enable/disable blocking with one click
- Badge notifications for blocked attempts

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the project folder
5. The extension will appear in your toolbar

## Usage

### Basic Setup

Click the extension icon to open the popup. The extension includes default blocks for Facebook, YouTube, Twitter, and Instagram. Enable blocking with the toggle switch.

### Adding Custom Website Blocks

1. Enter a domain to block (e.g., `reddit.com`)
2. Enter a redirect URL (e.g., `https://www.producthunt.com`)
3. Click "Add Site"

### Adding Keyword Blocks

1. Go to the "Blocked Keywords" tab
2. Enter a keyword to block (e.g., `gaming`, `shopping`)
3. Optionally enter a specific redirect URL, or leave empty to use global redirect
4. Click "Add Keyword"

Keywords are blocked across all search engines (Google, Bing, DuckDuckGo, etc.).

### Global Keyword Redirect

Set a default redirect URL for all keywords without specific redirects:

- Default: `about:newtab` (homepage)
- Can be any URL: `https://www.khanacademy.org`, etc.

### Editing Blocks

Click the "Edit" button next to any blocked site or keyword to modify it.

### Activity Logs

View all blocked attempts in the "Activity Logs" tab, including timestamps and statistics. Logs show both website blocks and keyword blocks.

### Configuration Management

Export your configuration as JSON from the Settings tab for backup or sharing. Import previously exported configurations to restore settings. Both websites and keywords are included in exports.

## Technical Details

**Manifest Version**: 3

**Permissions**:

- `storage` - Local data persistence
- `tabs` - Tab management and redirection
- `webNavigation` - URL monitoring
- `declarativeNetRequest` - Request blocking
- `<all_urls>` - Universal website access

**Storage**: Uses `chrome.storage.local` for all data persistence. Logs are limited to 1000 most recent attempts.

## Privacy

All data is stored locally in your browser. No external servers, analytics, or tracking are used.

## License

This extension is provided as-is for personal use.
