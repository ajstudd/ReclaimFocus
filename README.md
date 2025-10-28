# ReclaimFocus

A Chrome extension that blocks distracting websites and search keywords, redirecting you to productive alternatives. Now featuring **Zen Mode** - a full-screen meditation experience for mental clarity and focus.

## Features

- **🧘 Zen Mode** - Immersive meditation environment with starry sky and ambient music
- Block distracting websites with custom redirect URLs
- **Block search keywords** across all search engines
- **Time-limited website access** with pause/resume and cooldown periods
- Global redirect for keywords without specific redirects
- Pre-configured blocks for common time-wasters
- Activity logging to track blocked attempts (websites, keywords, and time limits)
- Statistics on most-blocked sites
- Export/Import configuration
- Dark mode support
- Enable/disable blocking with one click
- Badge notifications for blocked attempts

## Zen Mode

Transform your browser into a peaceful sanctuary for meditation and mental clarity.

### What You Get

- **Starry Night Sky**: Hundreds of twinkling stars with realistic glow effects
- **Shooting Stars**: Occasional meteors for added tranquility
- **Ambient Music**: Multi-layered soundscape with breathing rhythms
- **Inspirational Quotes**: Messages promoting discipline, optimism, and mindfulness
- **Volume Control**: Adjust or mute audio as needed
- **Keyboard Shortcuts**: ESC to exit, F11 for fullscreen

### How to Use Zen Mode

1. Click the **🧘** button in the extension popup
2. A full-screen zen experience opens in a new tab
3. Press **F11** for true fullscreen immersion
4. Meditate, breathe, and recenter yourself
5. Press **ESC** to exit when ready

Perfect for meditation breaks, stress relief, or transitioning between tasks.

## Installation

### From Source

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

### Time-Limited Website Access

Control how long you can access specific websites:

1. Go to the "Time Limited" tab
2. Enter a domain (e.g., `twitter.com`)
3. Set time limit in minutes (how long you can use the site)
4. Set cooldown period in minutes (how long before you can access again)
5. Optionally set a redirect URL
6. Click "Add Site"

**Key Features**:

- **Compact timer display** shown in extension popup (Time Limited tab)
- Timer updates every second with MM:SS countdown
- Timer changes color as time runs out (purple → orange → red)
- Timer pauses when you switch tabs or minimize browser
- Timer resumes when you return to the tab
- After time expires, site enters cooldown period
- During cooldown, all access attempts are blocked
- Perfect for limiting social media or entertainment sites

**Timer Visual States** (in extension popup):

- 🟣 **Purple**: Normal countdown (> 2 minutes left) - Active
- 🟠 **Orange**: Warning (< 2 minutes left) - Low Time
- 🔴 **Red**: Critical (< 30 seconds left) - Critical
- 🟠 **Orange**: Paused (tab inactive) - Paused

**How to View Timer**: Click extension icon → Go to "Time Limited" tab → Timer appears at top when active

### Editing Blocks

Click the "Edit" button next to any blocked site or keyword to modify it.

### Activity Logs

View all blocked attempts in the "Activity Logs" tab, including timestamps and statistics. Logs show:

- Website blocks
- Keyword blocks
- Time limit exceeded events (with time used)

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
