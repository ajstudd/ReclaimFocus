// ============================================
// ReclaimFocus v2.0 - Popup Controller
// ============================================

// ========== SVG ICON UTILITY ==========
const ICONS = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  unlock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>',
  zap: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  refreshCw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  shield: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
};

function icon(name) {
  return ICONS[name] || '';
}

// ========== STATE ==========
let currentSettings = {
  blockedSites: [],
  blockedKeywords: [],
  timeLimitedSites: [],
  redirectSites: [],
  keywordSettings: { globalRedirect: 'about:newtab' },
  logs: [],
  settings: { enabled: true, darkMode: false, deepKeywordScan: false },
  scheduledTasks: []
};

const DEFAULT_REDIRECT_SITES = [];

let editingIndex = null;
let editingKeywordIndex = null;
let editingTimeLimitIndex = null;
let editingTaskIndex = null;
let editingRedirectIndex = null;
let taskCountdownInterval = null;
let timerUpdateInterval = null;

// Common distracting sites for autocomplete
const COMMON_SITES = [
  'facebook.com', 'youtube.com', 'twitter.com', 'x.com', 'instagram.com',
  'reddit.com', 'tiktok.com', 'twitch.tv', 'netflix.com', 'discord.com',
  'snapchat.com', 'pinterest.com', 'tumblr.com', 'linkedin.com', 'amazon.com'
];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadRedirectSites();
  await loadBlockedSites();
  await loadBlockedKeywords();
  await loadTimeLimitedSites();
  await loadScheduledTasks();
  await loadLogs();
  await restoreInputFields();
  setupEventListeners();
  updateStats();
  startTimerUpdates();
  startTaskCountdowns();
});

// ========== LOAD SETTINGS ==========
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      'blockedSites', 'blockedKeywords', 'keywordSettings',
      'timeLimitedSites', 'redirectSites', 'scheduledTasks', 'logs', 'settings'
    ]);
    // Seed default redirect destinations the first time
    let redirectSites = data.redirectSites;
    if (!Array.isArray(redirectSites)) {
      redirectSites = [...DEFAULT_REDIRECT_SITES];
      await chrome.storage.local.set({ redirectSites });
    }
    currentSettings = {
      blockedSites: data.blockedSites || [],
      blockedKeywords: data.blockedKeywords || [],
      keywordSettings: data.keywordSettings || { globalRedirect: 'about:newtab' },
      timeLimitedSites: data.timeLimitedSites || [],
      redirectSites,
      scheduledTasks: data.scheduledTasks || [],
      logs: data.logs || [],
      settings: data.settings || { enabled: true, darkMode: false, deepKeywordScan: false }
    };

    document.getElementById('enableToggle').checked = currentSettings.settings.enabled;

    // global picker is wired after initRedirectPickers runs (see refreshGlobalRedirectPicker)

    const deepScanToggle = document.getElementById('deepKeywordScan');
    if (deepScanToggle) {
      deepScanToggle.checked = currentSettings.settings.deepKeywordScan || false;
    }

    if (currentSettings.settings.darkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('themeIcon').innerHTML = ICONS.sun;
    } else {
      document.getElementById('themeIcon').innerHTML = ICONS.moon;
    }
  } catch (error) {
    showStatus('Error loading settings', 'error');
  }
}

// ========== RESTORE DRAFT INPUTS ==========
async function restoreInputFields() {
  try {
    const { draftInputs } = await chrome.storage.local.get('draftInputs');
    if (!draftInputs) return;

    const fields = {
      domain: draftInputs.domain,
      keyword: draftInputs.keyword,
      timeDomain: draftInputs.timeDomain,
      timeLimit: draftInputs.timeLimit,
      cooldownPeriod: draftInputs.cooldownPeriod,
      taskTime: draftInputs.taskTime,
      taskName: draftInputs.taskName
    };

    for (const [id, value] of Object.entries(fields)) {
      if (value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
      }
    }

    if (draftInputs.taskNotification !== undefined) {
      document.getElementById('taskNotification').checked = draftInputs.taskNotification;
    }
  } catch (error) {
    console.error('Error restoring input fields:', error);
  }
}

// ========== SAVE DRAFTS ==========
async function saveInputDrafts() {
  const getValue = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  const drafts = {
    domain: getValue('domain'),
    keyword: getValue('keyword'),
    timeDomain: getValue('timeDomain'),
    timeLimit: getValue('timeLimit'),
    cooldownPeriod: getValue('cooldownPeriod'),
    taskTime: getValue('taskTime'),
    taskName: getValue('taskName'),
    taskNotification: document.getElementById('taskNotification')?.checked ?? true
  };

  await chrome.storage.local.set({ draftInputs: drafts });
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });

  // Block current site
  document.getElementById('blockCurrentSite').addEventListener('click', blockCurrentSite);

  // Jump to Redirects tab from any inline hint
  document.querySelectorAll('.go-to-redirects-tab').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('redirects');
    });
  });

  // Wire all redirect pickers
  initRedirectPickers();
  // Seed the global picker from stored settings
  setRedirectInPicker('global', currentSettings.keywordSettings.globalRedirect || 'about:newtab');

  // Domain autocomplete
  const domainInput = document.getElementById('domain');
  domainInput.addEventListener('input', handleDomainAutocomplete);
  domainInput.addEventListener('blur', () => {
    setTimeout(() => {
      document.getElementById('domainAutocomplete').classList.remove('visible');
    }, 150);
  });

  // Tab picker buttons (Blocked Sites + Time-Limited)
  document.querySelectorAll('.tab-picker-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTabPicker(btn.dataset.target);
    });
  });
  // Close pickers on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tab-picker-dropdown') && !e.target.closest('.tab-picker-btn')) {
      document.querySelectorAll('.tab-picker-dropdown').forEach(d => d.classList.remove('visible'));
    }
  });

  // Site filter
  document.getElementById('siteFilter').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('#blockedList .blocked-item').forEach(item => {
      const domain = item.querySelector('.blocked-domain').textContent.toLowerCase();
      item.style.display = domain.includes(query) ? '' : 'none';
    });
  });

  // Keyboard shortcut: Ctrl+K to focus filter
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const filter = document.getElementById('siteFilter');
      if (filter) {
        // Switch to blocked sites tab first
        switchTab('blocked-sites');
        filter.focus();
      }
    }
  });

  // Forms
  document.getElementById('addSiteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addSite();
  });

  document.getElementById('addKeywordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addKeyword();
  });

  document.getElementById('globalRedirectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateGlobalRedirect();
  });

  document.getElementById('cancelKeywordEdit').addEventListener('click', cancelKeywordEdit);

  document.getElementById('addTimeLimitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addTimeLimitSite();
  });

  document.getElementById('cancelTimeLimitEdit').addEventListener('click', cancelTimeLimitEdit);

  document.getElementById('addRedirectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addRedirectSite();
  });

  document.getElementById('cancelRedirectEdit').addEventListener('click', cancelRedirectEdit);

  document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addTask();
  });

  document.getElementById('cancelTaskEdit').addEventListener('click', cancelTaskEdit);

  // Toggle & settings
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    currentSettings.settings.enabled = e.target.checked;
    await chrome.storage.local.set({ settings: currentSettings.settings });
    showStatus(e.target.checked ? 'Extension enabled' : 'Extension disabled', 'success');
  });

  document.getElementById('themeToggle').addEventListener('click', async () => {
    currentSettings.settings.darkMode = !currentSettings.settings.darkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('themeIcon').innerHTML = currentSettings.settings.darkMode ? ICONS.sun : ICONS.moon;
    await chrome.storage.local.set({ settings: currentSettings.settings });
  });

  document.getElementById('zenModeToggle').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('zenmode.html') });
  });

  document.getElementById('deepKeywordScan').addEventListener('change', async (e) => {
    currentSettings.settings.deepKeywordScan = e.target.checked;
    await chrome.storage.local.set({ settings: currentSettings.settings });
    showStatus(e.target.checked ? 'Deep scanning enabled' : 'Deep scanning disabled', 'info');
  });

  // Extra time modal buttons
  document.getElementById('grantExtraTime').addEventListener('click', async () => {
    const domain = document.getElementById('extraTimeDomain').textContent;
    await chrome.runtime.sendMessage({ action: 'grantExtraTime', domain });
    document.getElementById('extraTimeModal').style.display = 'none';
    showStatus('Extra time granted!', 'success');
  });

  document.getElementById('denyExtraTime').addEventListener('click', async () => {
    const domain = document.getElementById('extraTimeDomain').textContent;
    await chrome.runtime.sendMessage({ action: 'denyExtraTime', domain });
    document.getElementById('extraTimeModal').style.display = 'none';
  });

  // Settings buttons
  document.getElementById('clearLogs').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all logs?')) await clearLogs();
  });
  document.getElementById('exportLogs').addEventListener('click', exportLogs);
  document.getElementById('exportSettings').addEventListener('click', exportSettings);
  document.getElementById('importSettings').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importSettings);
  document.getElementById('resetSettings').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset to default settings?')) await resetToDefaults();
  });

  // About modal
  const aboutModal = document.getElementById('aboutModal');
  const versionString = `v${chrome.runtime.getManifest().version}`;
  document.getElementById('versionLabel').textContent = versionString;
  document.getElementById('aboutVersion').textContent = versionString;
  document.getElementById('openAbout').addEventListener('click', () => {
    aboutModal.style.display = 'flex';
  });
  document.getElementById('closeAbout').addEventListener('click', () => {
    aboutModal.style.display = 'none';
  });
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.style.display = 'none';
  });

  // Draft saving on inputs
  const draftInputIds = [
    'domain', 'keyword', 'timeDomain', 'timeLimit',
    'cooldownPeriod', 'taskTime', 'taskName'
  ];
  draftInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', saveInputDrafts);
  });
  document.getElementById('taskNotification').addEventListener('change', saveInputDrafts);

  // Listen for extra time prompt from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'showExtraTimePrompt') {
      document.getElementById('extraTimeDomain').textContent = message.domain;
      document.getElementById('extraTimeAmount').textContent = message.extraTimeMinutes || 5;
      document.getElementById('extraTimeModal').style.display = 'flex';
    }
  });
}

// ========== TAB SWITCHING ==========
function switchTab(tabName) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  const activeBtn = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');
  }
  const panel = document.getElementById(tabName);
  if (panel) panel.classList.add('active');
}

// ========== DOMAIN AUTOCOMPLETE ==========
function handleDomainAutocomplete(e) {
  const query = e.target.value.toLowerCase().trim();
  const dropdown = document.getElementById('domainAutocomplete');

  if (query.length < 2) {
    dropdown.classList.remove('visible');
    return;
  }

  const matches = COMMON_SITES.filter(s => s.includes(query));
  if (matches.length === 0) {
    dropdown.classList.remove('visible');
    return;
  }

  dropdown.innerHTML = matches.map(site =>
    `<div class="autocomplete-item" data-domain="${site}">${site}</div>`
  ).join('');
  dropdown.classList.add('visible');

  dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', () => {
      document.getElementById('domain').value = item.dataset.domain;
      dropdown.classList.remove('visible');
    });
  });
}

// ========== TAB PICKER ==========
async function openTabPicker(targetInputId) {
  const dropdownId = targetInputId === 'domain' ? 'domainTabPicker' : 'timeDomainTabPicker';
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  // Toggle if already open
  if (dropdown.classList.contains('visible')) {
    dropdown.classList.remove('visible');
    return;
  }

  // Close other pickers
  document.querySelectorAll('.tab-picker-dropdown').forEach(d => {
    if (d.id !== dropdownId) d.classList.remove('visible');
  });

  try {
    const tabs = await chrome.tabs.query({});
    const seen = new Map(); // domain -> { title, favIconUrl }
    for (const tab of tabs) {
      if (!tab.url) continue;
      try {
        const u = new URL(tab.url);
        if (!/^https?:$/.test(u.protocol)) continue;
        const domain = u.hostname.replace(/^www\./, '');
        if (!seen.has(domain)) {
          seen.set(domain, { title: tab.title || domain, favIconUrl: tab.favIconUrl || '' });
        }
      } catch (_) { /* skip */ }
    }

    if (seen.size === 0) {
      dropdown.innerHTML = '<div class="tab-picker-empty">No open tabs with valid URLs</div>';
    } else {
      dropdown.innerHTML = Array.from(seen.entries()).map(([domain, info]) => `
        <div class="tab-picker-item" data-domain="${domain}">
          ${info.favIconUrl
            ? `<img class="tab-picker-favicon" src="${info.favIconUrl}" alt="">`
            : `<div class="tab-picker-favicon" style="background:var(--border-color);"></div>`}
          <div class="tab-picker-info">
            <div class="tab-picker-domain">${domain}</div>
            <div class="tab-picker-title">${escapeHtml(info.title)}</div>
          </div>
        </div>
      `).join('');

      dropdown.querySelectorAll('.tab-picker-item').forEach(item => {
        item.addEventListener('click', () => {
          const input = document.getElementById(targetInputId);
          if (input) {
            input.value = item.dataset.domain;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          dropdown.classList.remove('visible');
        });
      });
    }

    dropdown.classList.add('visible');
  } catch (e) {
    showStatus('Could not read open tabs', 'error');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ========== BLOCK CURRENT SITE ==========
async function blockCurrentSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
      showStatus('Cannot block this page', 'error');
      return;
    }
    const url = new URL(tab.url);
    const domain = url.hostname.replace(/^www\./, '');
    document.getElementById('domain').value = domain;

    // Reset the redirect picker to default
    resetRedirectPicker('site');

    switchTab('blocked-sites');
    document.getElementById('domain').scrollIntoView({ behavior: 'smooth' });
    showStatus(`Domain "${domain}" filled. Choose redirect and submit.`, 'info');
  } catch (error) {
    showStatus('Error reading current tab', 'error');
  }
}

// ========== BLOCKED SITES ==========
async function loadBlockedSites() {
  const container = document.getElementById('blockedList');

  if (currentSettings.blockedSites.length === 0) {
    container.innerHTML = `<div class="empty-state">${icon('shield')}<p>No blocked sites yet. Add one above!</p></div>`;
    return;
  }

  container.innerHTML = currentSettings.blockedSites.map((site, index) => `
    <div class="blocked-item">
      <div class="blocked-info">
        <div class="blocked-domain">${site.domain}</div>
        <div class="blocked-redirect">${site.redirect}</div>
      </div>
      <div class="blocked-actions">
        <button class="btn btn-secondary btn-small edit-btn" data-index="${index}" title="Edit">${icon('edit')}</button>
        <button class="btn btn-danger btn-small remove-btn" data-index="${index}" title="Remove">${icon('trash')}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', () => editSite(parseInt(button.dataset.index)));
  });
  container.querySelectorAll('.remove-btn').forEach(button => {
    button.addEventListener('click', () => removeSite(parseInt(button.dataset.index)));
  });
}

// ========== REDIRECT PICKER (reusable) ==========
// A picker = <div class="redirect-picker" data-picker="NAME">
//             <select class="rp-select"> ... </select>
//             <div class="rp-custom" hidden>
//               <input class="rp-name">
//               <input class="rp-url">
//             </div>
//           </div>
//
// Special <select> values: "about:newtab", "global" (for keyword picker), "custom",
// otherwise the URL of a saved redirect.

function getPicker(name) {
  return document.querySelector(`.redirect-picker[data-picker="${name}"]`);
}

function initRedirectPickers() {
  rebuildAllRedirectPickerOptions();
  document.querySelectorAll('.redirect-picker').forEach(picker => {
    const select = picker.querySelector('.rp-select');
    const customWrap = picker.querySelector('.rp-custom');
    const urlInput = picker.querySelector('.rp-url');

    select.addEventListener('change', () => {
      if (select.value === 'custom') {
        customWrap.hidden = false;
        urlInput.focus();
      } else {
        customWrap.hidden = true;
      }
    });
  });
}

function rebuildAllRedirectPickerOptions() {
  document.querySelectorAll('.redirect-picker').forEach(picker => {
    rebuildPickerOptions(picker);
  });
}

function rebuildPickerOptions(picker) {
  const select = picker.querySelector('.rp-select');
  if (!select) return;
  const previousValue = select.value;
  const allowEmpty = picker.dataset.allowEmpty === 'true';

  const opts = [];
  if (allowEmpty) {
    const emptyLabel = picker.dataset.emptyLabel || 'Use global redirect';
    opts.push(`<option value="global">${escapeHtml(emptyLabel)}</option>`);
  }
  opts.push('<option value="about:newtab">New Tab</option>');
  for (const entry of currentSettings.redirectSites) {
    const label = entry.name || entry.url;
    opts.push(`<option value="${escapeHtml(entry.url)}">${escapeHtml(label)}</option>`);
  }
  opts.push('<option value="custom">Custom URL...</option>');
  select.innerHTML = opts.join('');

  const stillExists = Array.from(select.options).some(o => o.value === previousValue);
  if (stillExists) {
    select.value = previousValue;
  } else if (allowEmpty) {
    select.value = 'global';
  } else {
    select.value = 'about:newtab';
  }
}

// Returns { url, name, isNew, isEmpty } where:
//   url     – the chosen URL (or '' if isEmpty)
//   name    – display name (only meaningful when isNew)
//   isNew   – true if user typed a brand-new custom URL (caller should save)
//   isEmpty – true if picker is "Use global redirect" (only on allow-empty pickers)
function getRedirectFromPicker(name) {
  const picker = getPicker(name);
  if (!picker) return { url: '', name: '', isNew: false, isEmpty: true };
  const select = picker.querySelector('.rp-select');
  const value = select.value;

  if (value === 'global') return { url: '', name: '', isNew: false, isEmpty: true };

  if (value === 'custom') {
    let url = picker.querySelector('.rp-url').value.trim();
    const displayName = picker.querySelector('.rp-name').value.trim();
    if (!url) return { url: '', name: '', isNew: false, isEmpty: true };
    if (!/^https?:\/\//i.test(url) && !url.startsWith('about:')) {
      url = 'https://' + url;
    }
    try { new URL(url); } catch (e) { return { url: '', name: '', isNew: false, isEmpty: true, invalid: true }; }
    return { url, name: displayName, isNew: true, isEmpty: false };
  }

  return { url: value, name: '', isNew: false, isEmpty: false };
}

// Programmatically set the picker's value (for edit flows). If the URL doesn't
// match a saved redirect, switches the picker to "Custom URL..." mode and prefills.
function setRedirectInPicker(name, url) {
  const picker = getPicker(name);
  if (!picker) return;
  const select = picker.querySelector('.rp-select');
  const customWrap = picker.querySelector('.rp-custom');
  const nameInput = picker.querySelector('.rp-name');
  const urlInput = picker.querySelector('.rp-url');

  nameInput.value = '';
  urlInput.value = '';

  if (!url) {
    select.value = picker.dataset.allowEmpty === 'true' ? 'global' : 'about:newtab';
    customWrap.hidden = true;
    return;
  }

  const hasMatching = Array.from(select.options).some(o => o.value === url);
  if (hasMatching) {
    select.value = url;
    customWrap.hidden = true;
  } else {
    select.value = 'custom';
    urlInput.value = url;
    customWrap.hidden = false;
  }
}

function resetRedirectPicker(name) {
  const picker = getPicker(name);
  if (!picker) return;
  const select = picker.querySelector('.rp-select');
  select.value = picker.dataset.allowEmpty === 'true' ? 'global' : 'about:newtab';
  picker.querySelector('.rp-name').value = '';
  picker.querySelector('.rp-url').value = '';
  picker.querySelector('.rp-custom').hidden = true;
}

// If the picker result represents a brand-new custom URL, save it to redirectSites
// (skipping duplicates). Returns the final URL string.
async function commitNewRedirect(result) {
  if (!result.isNew || !result.url) return result.url;
  if (currentSettings.redirectSites.some(r => r.url === result.url)) return result.url;

  let displayName = result.name;
  if (!displayName) {
    try { displayName = new URL(result.url).hostname.replace(/^www\./, ''); }
    catch (e) { displayName = result.url; }
  }
  currentSettings.redirectSites.push({ name: displayName, url: result.url });
  await chrome.storage.local.set({ redirectSites: currentSettings.redirectSites });
  // loadRedirectSites() (triggered by storage change listener / explicit call) rebuilds all pickers
  return result.url;
}

// ========== REDIRECT DESTINATIONS ==========
async function loadRedirectSites() {
  rebuildAllRedirectPickerOptions();

  const container = document.getElementById('redirectList');
  if (!container) return;

  if (currentSettings.redirectSites.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No saved redirects. Add one above and it will appear in the "Redirect To" dropdown when blocking a site.</p></div>';
    return;
  }

  container.innerHTML = currentSettings.redirectSites.map((entry, index) => `
    <div class="blocked-item">
      <div class="blocked-info">
        <div class="blocked-domain">${escapeHtml(entry.name || entry.url)}</div>
        <div class="blocked-redirect">${escapeHtml(entry.url)}</div>
      </div>
      <div class="blocked-actions">
        <button class="btn btn-secondary btn-small edit-redirect-btn" data-index="${index}" title="Edit">${icon('edit')}</button>
        <button class="btn btn-danger btn-small remove-redirect-btn" data-index="${index}" title="Remove">${icon('trash')}</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.edit-redirect-btn').forEach(btn => {
    btn.addEventListener('click', () => editRedirectSite(parseInt(btn.dataset.index)));
  });
  container.querySelectorAll('.remove-redirect-btn').forEach(btn => {
    btn.addEventListener('click', () => removeRedirectSite(parseInt(btn.dataset.index)));
  });
}

function editRedirectSite(index) {
  const entry = currentSettings.redirectSites[index];
  document.getElementById('redirectName').value = entry.name || '';
  document.getElementById('redirectUrl').value = entry.url;
  editingRedirectIndex = index;

  const submitBtn = document.querySelector('#addRedirectForm button[type="submit"]');
  submitBtn.innerHTML = `${icon('edit')} Update Redirect`;
  submitBtn.classList.replace('btn-primary', 'btn-warning');
  document.getElementById('cancelRedirectEdit').style.display = 'inline-block';
  document.getElementById('redirectName').focus();
}

function cancelRedirectEdit() {
  editingRedirectIndex = null;
  document.getElementById('redirectName').value = '';
  document.getElementById('redirectUrl').value = '';
  const submitBtn = document.querySelector('#addRedirectForm button[type="submit"]');
  submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Redirect`;
  submitBtn.classList.replace('btn-warning', 'btn-primary');
  document.getElementById('cancelRedirectEdit').style.display = 'none';
}

async function addRedirectSite() {
  const nameInput = document.getElementById('redirectName');
  const urlInput = document.getElementById('redirectUrl');
  let url = urlInput.value.trim();
  const name = nameInput.value.trim();

  if (!url) { showStatus('URL is required', 'error'); return; }

  // Auto-prefix protocol if missing
  if (!/^https?:\/\//i.test(url) && !url.startsWith('about:')) {
    url = 'https://' + url;
  }

  try {
    new URL(url);
  } catch (e) {
    showStatus('Invalid URL', 'error');
    return;
  }

  // Derive a display name if none provided
  let displayName = name;
  if (!displayName) {
    try { displayName = new URL(url).hostname.replace(/^www\./, ''); }
    catch (e) { displayName = url; }
  }

  if (editingRedirectIndex !== null) {
    const dup = currentSettings.redirectSites.findIndex((r, i) => r.url === url && i !== editingRedirectIndex);
    if (dup !== -1) { showStatus('Another entry already uses this URL', 'error'); return; }

    const oldUrl = currentSettings.redirectSites[editingRedirectIndex].url;
    currentSettings.redirectSites[editingRedirectIndex] = { name: displayName, url };
    await chrome.storage.local.set({ redirectSites: currentSettings.redirectSites });

    // Re-point any places that referenced the previous URL
    if (oldUrl !== url) {
      let touched = false;
      currentSettings.blockedSites.forEach(s => { if (s.redirect === oldUrl) { s.redirect = url; touched = true; } });
      currentSettings.blockedKeywords.forEach(k => { if (k.redirect === oldUrl) { k.redirect = url; touched = true; } });
      currentSettings.timeLimitedSites.forEach(t => { if (t.redirect === oldUrl) { t.redirect = url; touched = true; } });
      if (currentSettings.keywordSettings.globalRedirect === oldUrl) {
        currentSettings.keywordSettings.globalRedirect = url; touched = true;
      }
      if (touched) {
        await chrome.storage.local.set({
          blockedSites: currentSettings.blockedSites,
          blockedKeywords: currentSettings.blockedKeywords,
          timeLimitedSites: currentSettings.timeLimitedSites,
          keywordSettings: currentSettings.keywordSettings
        });
        await loadBlockedSites();
        await loadBlockedKeywords();
        await loadTimeLimitedSites();
        setRedirectInPicker('global', currentSettings.keywordSettings.globalRedirect);
      }
    }

    cancelRedirectEdit();
    await loadRedirectSites();
    showStatus('Redirect updated', 'success');
    return;
  }

  // Add path
  if (currentSettings.redirectSites.some(r => r.url === url)) {
    showStatus('Redirect already saved', 'error');
    return;
  }
  currentSettings.redirectSites.push({ name: displayName, url });
  await chrome.storage.local.set({ redirectSites: currentSettings.redirectSites });
  nameInput.value = '';
  urlInput.value = '';
  await loadRedirectSites();
  showStatus('Redirect added', 'success');
}

async function removeRedirectSite(index) {
  if (editingRedirectIndex !== null) {
    if (editingRedirectIndex === index) cancelRedirectEdit();
    else if (editingRedirectIndex > index) editingRedirectIndex--;
  }
  currentSettings.redirectSites.splice(index, 1);
  await chrome.storage.local.set({ redirectSites: currentSettings.redirectSites });
  await loadRedirectSites();
  showStatus('Redirect removed', 'success');
}

async function addSite() {
  const domainInput = document.getElementById('domain');

  let domain = domainInput.value.trim().toLowerCase();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');

  const result = getRedirectFromPicker('site');
  if (result.invalid) { showStatus('Invalid redirect URL', 'error'); return; }
  if (!domain || !result.url) {
    showStatus('Please fill in domain and redirect', 'error');
    return;
  }
  const redirect = await commitNewRedirect(result);

  if (editingIndex !== null) {
    const exists = currentSettings.blockedSites.findIndex((s, i) => s.domain === domain && i !== editingIndex);
    if (exists !== -1) { showStatus('Domain already blocked', 'error'); return; }
    currentSettings.blockedSites[editingIndex] = { domain, redirect };
    await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
    await loadBlockedSites();
    cancelEdit();
    chrome.runtime.sendMessage({ action: 'updateRules' });
    showStatus('Site updated', 'success');
  } else {
    if (currentSettings.blockedSites.some(s => s.domain === domain)) {
      showStatus('Domain already blocked', 'error');
      return;
    }
    currentSettings.blockedSites.push({ domain, redirect });
    await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
    await loadBlockedSites();
    domainInput.value = '';
    resetRedirectPicker('site');
    chrome.runtime.sendMessage({ action: 'updateRules' });
    showStatus('Site added', 'success');
  }
}

function editSite(index) {
  const site = currentSettings.blockedSites[index];
  document.getElementById('domain').value = site.domain;
  setRedirectInPicker('site', site.redirect);

  editingIndex = index;
  const submitBtn = document.querySelector('#addSiteForm button[type="submit"]');
  submitBtn.innerHTML = `${icon('edit')} Update Website`;
  submitBtn.classList.replace('btn-primary', 'btn-warning');

  let cancelBtn = document.getElementById('cancelEdit');
  if (!cancelBtn) {
    cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.id = 'cancelEdit';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', cancelEdit);
    submitBtn.parentElement.appendChild(cancelBtn);
  }
  document.getElementById('domain').focus();
}

function cancelEdit() {
  editingIndex = null;
  document.getElementById('domain').value = '';
  resetRedirectPicker('site');
  const submitBtn = document.querySelector('#addSiteForm button[type="submit"]');
  submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Website`;
  submitBtn.classList.replace('btn-warning', 'btn-primary');
  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) cancelBtn.remove();
}

async function removeSite(index) {
  if (editingIndex !== null) {
    if (editingIndex === index) cancelEdit();
    else if (editingIndex > index) editingIndex--;
  }
  currentSettings.blockedSites.splice(index, 1);
  await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
  await loadBlockedSites();
  chrome.runtime.sendMessage({ action: 'updateRules' });
  showStatus('Site removed', 'success');
}

// ========== BLOCKED KEYWORDS ==========
async function loadBlockedKeywords() {
  const container = document.getElementById('keywordList');
  if (currentSettings.blockedKeywords.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No blocked keywords yet.</p></div>';
    return;
  }

  container.innerHTML = currentSettings.blockedKeywords.map((item, index) => {
    const redirectText = item.redirect || '<em>Uses global redirect</em>';
    return `
      <div class="blocked-item">
        <div class="blocked-info">
          <div class="blocked-domain">${item.keyword}</div>
          <div class="blocked-redirect">${redirectText}</div>
        </div>
        <div class="blocked-actions">
          <button class="btn btn-secondary btn-small edit-keyword-btn" data-index="${index}">${icon('edit')}</button>
          <button class="btn btn-danger btn-small remove-keyword-btn" data-index="${index}">${icon('trash')}</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-keyword-btn').forEach(btn => {
    btn.addEventListener('click', () => editKeyword(parseInt(btn.dataset.index)));
  });
  container.querySelectorAll('.remove-keyword-btn').forEach(btn => {
    btn.addEventListener('click', () => removeKeyword(parseInt(btn.dataset.index)));
  });
}

async function addKeyword() {
  const keywordInput = document.getElementById('keyword');
  const keyword = keywordInput.value.trim();

  if (!keyword) { showStatus('Please enter a keyword', 'error'); return; }

  const result = getRedirectFromPicker('keyword');
  if (result.invalid) { showStatus('Invalid redirect URL', 'error'); return; }
  const redirect = result.isEmpty ? '' : await commitNewRedirect(result);

  if (editingKeywordIndex !== null) {
    const exists = currentSettings.blockedKeywords.findIndex((item, idx) =>
      item.keyword.toLowerCase() === keyword.toLowerCase() && idx !== editingKeywordIndex
    );
    if (exists !== -1) { showStatus('Keyword already blocked', 'error'); return; }
    currentSettings.blockedKeywords[editingKeywordIndex] = { keyword, redirect };
    showStatus('Keyword updated', 'success');
    cancelKeywordEdit();
  } else {
    if (currentSettings.blockedKeywords.some(item => item.keyword.toLowerCase() === keyword.toLowerCase())) {
      showStatus('Keyword already blocked', 'error'); return;
    }
    currentSettings.blockedKeywords.push({ keyword, redirect });
    showStatus('Keyword added', 'success');
    keywordInput.value = '';
    resetRedirectPicker('keyword');
  }

  await chrome.storage.local.set({ blockedKeywords: currentSettings.blockedKeywords });
  await loadBlockedKeywords();
}

function editKeyword(index) {
  const item = currentSettings.blockedKeywords[index];
  document.getElementById('keyword').value = item.keyword;
  setRedirectInPicker('keyword', item.redirect || '');
  editingKeywordIndex = index;

  const submitBtn = document.querySelector('#addKeywordForm button[type="submit"]');
  submitBtn.textContent = 'Update Keyword';
  submitBtn.classList.replace('btn-primary', 'btn-warning');
  document.getElementById('cancelKeywordEdit').style.display = 'inline-block';
  document.getElementById('keyword').focus();
}

function cancelKeywordEdit() {
  editingKeywordIndex = null;
  document.getElementById('keyword').value = '';
  resetRedirectPicker('keyword');
  const submitBtn = document.querySelector('#addKeywordForm button[type="submit"]');
  submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Keyword`;
  submitBtn.classList.replace('btn-warning', 'btn-primary');
  document.getElementById('cancelKeywordEdit').style.display = 'none';
}

async function removeKeyword(index) {
  if (editingKeywordIndex !== null) {
    if (editingKeywordIndex === index) cancelKeywordEdit();
    else if (editingKeywordIndex > index) editingKeywordIndex--;
  }
  currentSettings.blockedKeywords.splice(index, 1);
  await chrome.storage.local.set({ blockedKeywords: currentSettings.blockedKeywords });
  await loadBlockedKeywords();
  showStatus('Keyword removed', 'success');
}

async function updateGlobalRedirect() {
  const result = getRedirectFromPicker('global');
  if (result.invalid) { showStatus('Invalid redirect URL', 'error'); return; }
  const url = result.isEmpty ? 'about:newtab' : await commitNewRedirect(result);
  currentSettings.keywordSettings.globalRedirect = url || 'about:newtab';
  await chrome.storage.local.set({ keywordSettings: currentSettings.keywordSettings });
  // Re-render the global picker so a freshly-saved custom URL collapses back into the dropdown
  setRedirectInPicker('global', currentSettings.keywordSettings.globalRedirect);
  showStatus('Global redirect updated', 'success');
}

// ========== TIME-LIMITED SITES ==========
async function loadTimeLimitedSites() {
  const container = document.getElementById('timeLimitedList');
  if (currentSettings.timeLimitedSites.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No time-limited sites configured.</p></div>';
    return;
  }

  // Fetch all timer & cooldown statuses
  let timerStatuses = {};
  let cooldownStatuses = {};
  try {
    const timerResp = await chrome.runtime.sendMessage({ action: 'getAllTimerStatuses' });
    timerStatuses = timerResp?.timers || {};
    const cooldownResp = await chrome.runtime.sendMessage({ action: 'getCooldownStatus' });
    cooldownStatuses = cooldownResp?.cooldowns || {};
  } catch (e) { /* background may not respond yet */ }

  container.innerHTML = currentSettings.timeLimitedSites.map((site, index) => {
    const redirectText = site.redirect || 'about:newtab';
    const domain = site.domain.replace(/^www\./, '');

    // Determine status
    let statusHtml = '';
    const cooldownKey = `cooldown_${domain}`;
    const timerData = timerStatuses[domain];
    const cooldownData = cooldownStatuses[cooldownKey];

    if (cooldownData && cooldownData.remainingMs > 0) {
      const mins = Math.floor(cooldownData.remainingMs / 60000);
      const secs = Math.floor((cooldownData.remainingMs % 60000) / 1000);
      statusHtml = `<div class="site-status site-status--locked" title="Cooldown remaining before you can browse again">${icon('lock')} ${mins}:${String(secs).padStart(2, '0')}</div>`;
    } else if (timerData) {
      const remaining = Math.max(0, timerData.timeRemaining);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      statusHtml = `<div class="site-status site-status--active" title="Time remaining in current browsing session">${icon('clock')} ${mins}:${String(secs).padStart(2, '0')}</div>`;
    } else {
      statusHtml = `<div class="site-status site-status--available" title="Timer hasn't started. You'll get ${site.timeLimit} min when you open this site.">${icon('unlock')} ${site.timeLimit}m</div>`;
    }

    const extraTimeText = site.extraTimeUsed
      ? `<div class="site-status site-status--extra-used">${icon('zap')} Extra time used</div>`
      : '';

    return `
      <div class="blocked-item">
        <div class="blocked-info">
          <div class="blocked-domain">${site.domain}</div>
          <div class="blocked-redirect">Time: ${site.timeLimit}m | Cooldown: ${site.cooldown}m | Extra: ${site.extraTime || 5}m | Redirect: ${redirectText}</div>
          ${statusHtml}${extraTimeText}
        </div>
        <div class="blocked-actions">
          <button class="btn btn-secondary btn-small edit-time-btn" data-index="${index}">${icon('edit')}</button>
          <button class="btn btn-danger btn-small remove-time-btn" data-index="${index}">${icon('trash')}</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-time-btn').forEach(btn => {
    btn.addEventListener('click', () => editTimeLimitSite(parseInt(btn.dataset.index)));
  });
  container.querySelectorAll('.remove-time-btn').forEach(btn => {
    btn.addEventListener('click', () => removeTimeLimitSite(parseInt(btn.dataset.index)));
  });
}

async function addTimeLimitSite() {
  let domain = document.getElementById('timeDomain').value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
  const timeLimit = parseInt(document.getElementById('timeLimit').value);
  const cooldown = parseInt(document.getElementById('cooldownPeriod').value);
  const extraTime = parseInt(document.getElementById('extraTime').value) || 5;

  const result = getRedirectFromPicker('timeLimit');
  if (result.invalid) { showStatus('Invalid redirect URL', 'error'); return; }
  const redirect = result.isEmpty ? '' : await commitNewRedirect(result);

  if (!domain) { showStatus('Please enter a domain', 'error'); return; }
  if (!timeLimit || timeLimit < 1) { showStatus('Valid time limit required', 'error'); return; }
  if (!cooldown || cooldown < 1) { showStatus('Valid cooldown required', 'error'); return; }

  if (editingTimeLimitIndex !== null) {
    const exists = currentSettings.timeLimitedSites.findIndex((item, idx) => item.domain === domain && idx !== editingTimeLimitIndex);
    if (exists !== -1) { showStatus('Domain already configured', 'error'); return; }
    currentSettings.timeLimitedSites[editingTimeLimitIndex] = { domain, timeLimit, cooldown, extraTime, redirect };
    showStatus('Time-limited site updated', 'success');
    cancelTimeLimitEdit();
  } else {
    if (currentSettings.timeLimitedSites.some(item => item.domain === domain)) {
      showStatus('Domain already configured', 'error'); return;
    }
    currentSettings.timeLimitedSites.push({ domain, timeLimit, cooldown, extraTime, redirect });
    showStatus('Time-limited site added', 'success');
  }

  await chrome.storage.local.set({ timeLimitedSites: currentSettings.timeLimitedSites });
  await loadTimeLimitedSites();
  document.getElementById('timeDomain').value = '';
  document.getElementById('timeLimit').value = '';
  document.getElementById('cooldownPeriod').value = '';
  document.getElementById('extraTime').value = '5';
  resetRedirectPicker('timeLimit');
}

function editTimeLimitSite(index) {
  const site = currentSettings.timeLimitedSites[index];
  document.getElementById('timeDomain').value = site.domain;
  document.getElementById('timeLimit').value = site.timeLimit;
  document.getElementById('cooldownPeriod').value = site.cooldown;
  document.getElementById('extraTime').value = site.extraTime || 5;
  setRedirectInPicker('timeLimit', site.redirect || '');
  editingTimeLimitIndex = index;

  const submitBtn = document.querySelector('#addTimeLimitForm button[type="submit"]');
  submitBtn.textContent = 'Update Site';
  submitBtn.classList.replace('btn-primary', 'btn-warning');
  document.getElementById('cancelTimeLimitEdit').style.display = 'inline-block';
  showStatus('Changes apply to next session.', 'info');
}

function cancelTimeLimitEdit() {
  editingTimeLimitIndex = null;
  document.getElementById('timeDomain').value = '';
  document.getElementById('timeLimit').value = '';
  document.getElementById('cooldownPeriod').value = '';
  document.getElementById('extraTime').value = '5';
  resetRedirectPicker('timeLimit');
  const submitBtn = document.querySelector('#addTimeLimitForm button[type="submit"]');
  submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Time Limit`;
  submitBtn.classList.replace('btn-warning', 'btn-primary');
  document.getElementById('cancelTimeLimitEdit').style.display = 'none';
}

async function removeTimeLimitSite(index) {
  const site = currentSettings.timeLimitedSites[index];
  if (!confirm(`Remove time limit for ${site.domain}?`)) return;

  if (editingTimeLimitIndex !== null) {
    if (editingTimeLimitIndex === index) cancelTimeLimitEdit();
    else if (editingTimeLimitIndex > index) editingTimeLimitIndex--;
  }

  const domain = site.domain.replace(/^www\./, '');
  currentSettings.timeLimitedSites.splice(index, 1);
  await chrome.storage.local.set({ timeLimitedSites: currentSettings.timeLimitedSites });

  try {
    await chrome.runtime.sendMessage({ action: 'cleanupTimeLimitedSite', domain });
  } catch (e) { /* ignore */ }

  await loadTimeLimitedSites();
  showStatus('Time-limited site removed', 'success');
}

// ========== TIMER DISPLAY ==========
function startTimerUpdates() {
  updateTimerDisplay();
  timerUpdateInterval = setInterval(updateTimerDisplay, 1000);
}

async function updateTimerDisplay() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTimerStatus' });
    const timerCard = document.getElementById('activeTimerCard');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerDomain = document.getElementById('timerDomain');
    const timerStatusText = document.getElementById('timerStatusText');
    const ringProgress = document.getElementById('timerRingProgress');

    if (response?.timerData) {
      const { domain, minutesRemaining, secondsRemaining, isPaused, timeRemaining, totalTime } = response.timerData;
      timerCard.style.display = 'block';
      timerDomain.textContent = domain;
      timerDisplay.textContent = `${String(minutesRemaining).padStart(2, '0')}:${String(secondsRemaining).padStart(2, '0')}`;

      // Update ring progress
      const circumference = 188.5; // 2 * PI * 30
      const total = totalTime || (minutesRemaining * 60000 + secondsRemaining * 1000);
      const remaining = timeRemaining || (minutesRemaining * 60000 + secondsRemaining * 1000);
      const progress = total > 0 ? (1 - remaining / total) : 0;
      ringProgress.style.strokeDashoffset = circumference * progress;

      // Update card style
      timerCard.className = 'timer-card';
      if (isPaused) {
        timerCard.classList.add('timer-card--paused');
        timerStatusText.textContent = 'Paused';
      } else if (minutesRemaining === 0 && secondsRemaining <= 30) {
        timerCard.classList.add('timer-card--critical');
        timerStatusText.textContent = 'Critical';
      } else if (minutesRemaining < 2) {
        timerCard.classList.add('timer-card--warning');
        timerStatusText.textContent = 'Low Time';
      } else {
        timerCard.classList.add('timer-card--active');
        timerStatusText.textContent = 'Active';
      }
    } else {
      timerCard.style.display = 'none';
    }

    // Cooldown bar
    const cooldownBar = document.getElementById('cooldownBar');
    try {
      const cooldownResp = await chrome.runtime.sendMessage({ action: 'getCooldownStatus' });
      const cooldowns = cooldownResp?.cooldowns || {};
      const entries = Object.values(cooldowns).filter(c => c.remainingMs > 0);

      if (entries.length > 0) {
        const cd = entries[0]; // show first active cooldown
        const mins = Math.floor(cd.remainingMs / 60000);
        const secs = Math.floor((cd.remainingMs % 60000) / 1000);
        document.getElementById('cooldownRemaining').textContent = `${cd.domain} · ${mins}:${String(secs).padStart(2, '0')}`;
        // Progress bar (approximate)
        const totalCooldown = cd.totalCooldownMs || (cd.remainingMs + 1);
        const pct = Math.max(0, Math.min(100, (cd.remainingMs / totalCooldown) * 100));
        document.getElementById('cooldownProgressFill').style.width = pct + '%';
        cooldownBar.style.display = 'flex';
      } else {
        cooldownBar.style.display = 'none';
      }
    } catch (e) {
      cooldownBar.style.display = 'none';
    }

    // Refresh site list statuses periodically
    await loadTimeLimitedSites();
  } catch (error) {
    // Silent: background may be asleep
  }
}

// ========== TASKS ==========
async function loadScheduledTasks() {
  const container = document.getElementById('tasksList');
  if (!currentSettings.scheduledTasks || currentSettings.scheduledTasks.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No scheduled tasks yet. Create one above!</p></div>';
    return;
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  // Primary sort: priority (high first), secondary: scheduled time
  const sorted = [...currentSettings.scheduledTasks].sort((a, b) => {
    const pa = priorityRank[a.priority || 'medium'];
    const pb = priorityRank[b.priority || 'medium'];
    if (pa !== pb) return pa - pb;
    return new Date(a.scheduledTime) - new Date(b.scheduledTime);
  });
  const now = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const todayTasks = sorted.filter(t => { const d = new Date(t.scheduledTime); return d >= now && d <= todayEnd; });
  const upcomingTasks = sorted.filter(t => new Date(t.scheduledTime) > todayEnd);
  const pastTasks = sorted.filter(t => new Date(t.scheduledTime) < now);

  let html = '';

  if (todayTasks.length > 0) {
    html += `<div class="task-group"><h3 class="task-group-title">${icon('calendar')} Today</h3>${todayTasks.map((t, i) => renderTaskCard(t, sorted.indexOf(t))).join('')}</div>`;
  }
  if (upcomingTasks.length > 0) {
    html += `<div class="task-group"><h3 class="task-group-title">${icon('calendar')} Upcoming</h3>${upcomingTasks.map((t, i) => renderTaskCard(t, sorted.indexOf(t))).join('')}</div>`;
  }
  if (pastTasks.length > 0) {
    html += `<div class="task-group"><h3 class="task-group-title">${icon('clock')} Past</h3>${pastTasks.map((t, i) => renderTaskCard(t, sorted.indexOf(t))).join('')}</div>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.edit-task-btn').forEach(btn => {
    btn.addEventListener('click', () => editTask(parseInt(btn.dataset.index)));
  });
  container.querySelectorAll('.remove-task-btn').forEach(btn => {
    btn.addEventListener('click', () => removeTask(parseInt(btn.dataset.index)));
  });
}

function renderTaskCard(task, index) {
  const scheduledDate = new Date(task.scheduledTime);
  const isPast = scheduledDate < new Date();
  const timeRemaining = getTimeRemaining(scheduledDate);
  const priority = task.priority || 'medium';
  const recurrence = task.recurrence || 'none';

  const badgeClass = isPast ? 'task-badge--past' : 'task-badge--scheduled';
  const badgeText = isPast ? 'PAST' : 'SCHEDULED';
  const recurrenceBadge = recurrence !== 'none'
    ? `<span class="task-badge task-badge--recurring">${icon('refreshCw')} ${recurrence}</span>`
    : '';

  return `
    <div class="task-card">
      <div class="task-info">
        <div class="task-name">
          <span class="priority-dot priority-dot--${priority}"></span>
          ${task.name || 'Scheduled Task'}
          <span class="task-badge ${badgeClass}">${badgeText}</span>
          ${recurrenceBadge}
        </div>
        ${task.url ? `<div class="task-url">${task.url}</div>` : ''}
        <div class="task-time">
          ${icon('clock')}
          ${scheduledDate.toLocaleString()}
          ${!isPast ? `<span class="task-countdown ${timeRemaining.urgent ? 'urgent' : ''}">(${timeRemaining.text})</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-small btn-secondary edit-task-btn" data-index="${index}" title="Edit">${icon('edit')}</button>
        <button class="btn btn-small btn-danger remove-task-btn" data-index="${index}" title="Delete">${icon('trash')}</button>
      </div>
    </div>
  `;
}

function getTimeRemaining(scheduledDate) {
  const diffMs = scheduledDate - new Date();
  if (diffMs < 0) return { text: 'Past', urgent: false };
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return { text: `in ${diffMins}m`, urgent: diffMins < 15 };
  if (diffHours < 24) return { text: `in ${diffHours}h ${diffMins % 60}m`, urgent: diffHours < 1 };
  return { text: `in ${diffDays}d ${diffHours % 24}h`, urgent: false };
}

async function addTask() {
  const scheduledTime = document.getElementById('taskTime').value;
  const name = document.getElementById('taskName').value.trim();
  const showNotification = document.getElementById('taskNotification').checked;
  const priority = document.getElementById('taskPriority').value;
  const recurrence = document.getElementById('taskRecurrence').value;

  if (!name) { showStatus('Task name is required', 'error'); return; }
  if (!scheduledTime) { showStatus('Schedule time is required', 'error'); return; }

  const result = getRedirectFromPicker('task');
  if (result.invalid) { showStatus('Invalid URL', 'error'); return; }
  const url = result.isEmpty ? '' : await commitNewRedirect(result);

  const scheduledDate = new Date(scheduledTime);
  if (scheduledDate < new Date()) { showStatus('Cannot schedule in the past', 'error'); return; }

  const task = {
    id: editingTaskIndex !== null ? currentSettings.scheduledTasks[editingTaskIndex].id : Date.now(),
    url: url || '',
    scheduledTime: scheduledDate.toISOString(),
    name: name || 'Scheduled Task',
    showNotification,
    priority,
    recurrence,
    createdAt: editingTaskIndex !== null ? currentSettings.scheduledTasks[editingTaskIndex].createdAt : new Date().toISOString()
  };

  if (editingTaskIndex !== null) {
    currentSettings.scheduledTasks[editingTaskIndex] = task;
    showStatus('Task updated', 'success');
    editingTaskIndex = null;
    document.getElementById('cancelTaskEdit').style.display = 'none';
  } else {
    currentSettings.scheduledTasks.push(task);
    showStatus('Task scheduled', 'success');
  }

  await chrome.storage.local.set({ scheduledTasks: currentSettings.scheduledTasks });
  await chrome.runtime.sendMessage({ action: 'scheduleTask', task });

  // Clear form
  resetRedirectPicker('task');
  document.getElementById('taskTime').value = '';
  document.getElementById('taskName').value = '';
  document.getElementById('taskNotification').checked = true;
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskRecurrence').value = 'none';

  await loadScheduledTasks();
}

function editTask(index) {
  const task = currentSettings.scheduledTasks[index];
  setRedirectInPicker('task', task.url || '');
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskNotification').checked = task.showNotification;
  document.getElementById('taskPriority').value = task.priority || 'medium';
  document.getElementById('taskRecurrence').value = task.recurrence || 'none';

  const date = new Date(task.scheduledTime);
  document.getElementById('taskTime').value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  editingTaskIndex = index;
  document.getElementById('cancelTaskEdit').style.display = 'inline-block';
  switchTab('tasks');
}

async function cancelTaskEdit() {
  editingTaskIndex = null;
  resetRedirectPicker('task');
  document.getElementById('taskTime').value = '';
  document.getElementById('taskName').value = '';
  document.getElementById('taskNotification').checked = true;
  document.getElementById('taskPriority').value = 'medium';
  document.getElementById('taskRecurrence').value = 'none';
  document.getElementById('cancelTaskEdit').style.display = 'none';
}

async function removeTask(index) {
  if (!confirm('Delete this task?')) return;
  const task = currentSettings.scheduledTasks[index];
  await chrome.runtime.sendMessage({ action: 'cancelTask', taskId: task.id });
  currentSettings.scheduledTasks.splice(index, 1);
  await chrome.storage.local.set({ scheduledTasks: currentSettings.scheduledTasks });
  showStatus('Task deleted', 'success');
  await loadScheduledTasks();
  if (editingTaskIndex === index) await cancelTaskEdit();
  else if (editingTaskIndex > index) editingTaskIndex--;
}

function startTaskCountdowns() {
  if (taskCountdownInterval) clearInterval(taskCountdownInterval);
  taskCountdownInterval = setInterval(() => {
    if (document.querySelectorAll('.task-countdown').length > 0) {
      loadScheduledTasks();
    }
  }, 10000); // Every 10 seconds
}

// ========== LOGS ==========
const LOG_TYPE_ICONS = {
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="12" x2="15" y2="12"/></svg>',
  keyword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  timelimit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

function relativeTime(ts) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

async function loadLogs() {
  const container = document.getElementById('logsList');
  if (currentSettings.logs.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No blocked attempts logged yet.</p></div>';
    return;
  }

  container.innerHTML = currentSettings.logs.slice(0, 100).map(log => {
    const type = log.type === 'keyword' ? 'keyword'
      : log.type === 'timelimit' ? 'timelimit'
      : 'website';
    const iconHtml = LOG_TYPE_ICONS[type];
    const absoluteTime = new Date(log.timestamp).toLocaleString();
    const relTime = relativeTime(log.timestamp);

    let title, meta;
    if (type === 'keyword') {
      title = `“${escapeHtml(log.keyword)}”`;
      try { meta = new URL(log.url).hostname.replace(/^www\./, ''); }
      catch (e) { meta = log.url; }
    } else if (type === 'timelimit') {
      const mins = Math.floor((log.timeUsed || 0) / 60);
      title = escapeHtml(log.domain || 'Unknown');
      meta = `Time limit reached · ${mins} min used`;
    } else {
      try {
        const u = new URL(log.url);
        title = u.hostname.replace(/^www\./, '');
        meta = u.pathname + (u.search || '');
        if (meta === '/') meta = 'Homepage';
      } catch (e) {
        title = 'Unknown';
        meta = log.url || '';
      }
    }

    return `
      <div class="log-item" title="${escapeHtml(absoluteTime)}">
        <div class="log-icon log-icon--${type}">${iconHtml}</div>
        <div class="log-body">
          <div class="log-domain">${escapeHtml(title)}</div>
          <div class="log-meta">${escapeHtml(meta)}</div>
        </div>
        <div class="log-time">${relTime}</div>
      </div>
    `;
  }).join('');
}

function updateStats() {
  document.getElementById('totalAttempts').textContent = currentSettings.logs.length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCount = currentSettings.logs.filter(l => new Date(l.timestamp) >= today).length;
  document.getElementById('todayAttempts').textContent = todayCount;
}

async function clearLogs() {
  currentSettings.logs = [];
  await chrome.storage.local.set({ logs: [] });
  await loadLogs();
  updateStats();
  chrome.runtime.sendMessage({ action: 'clearBadge' });
  showStatus('Logs cleared', 'success');
}

function exportLogs() {
  downloadJSON({ logs: currentSettings.logs, exportDate: new Date().toISOString() }, `ReclaimFocus-logs-${Date.now()}.json`);
  showStatus('Logs exported', 'success');
}

function exportSettings() {
  downloadJSON({
    blockedSites: currentSettings.blockedSites,
    blockedKeywords: currentSettings.blockedKeywords,
    keywordSettings: currentSettings.keywordSettings,
    timeLimitedSites: currentSettings.timeLimitedSites,
    redirectSites: currentSettings.redirectSites,
    scheduledTasks: currentSettings.scheduledTasks,
    settings: currentSettings.settings,
    exportDate: new Date().toISOString()
  }, `ReclaimFocus-settings-${Date.now()}.json`);
  showStatus('Settings exported', 'success');
}

async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.blockedSites) { currentSettings.blockedSites = data.blockedSites; await chrome.storage.local.set({ blockedSites: data.blockedSites }); }
    if (data.blockedKeywords) { currentSettings.blockedKeywords = data.blockedKeywords; await chrome.storage.local.set({ blockedKeywords: data.blockedKeywords }); }
    if (data.keywordSettings) { currentSettings.keywordSettings = data.keywordSettings; await chrome.storage.local.set({ keywordSettings: data.keywordSettings }); }
    if (data.timeLimitedSites) { currentSettings.timeLimitedSites = data.timeLimitedSites; await chrome.storage.local.set({ timeLimitedSites: data.timeLimitedSites }); }
    if (data.redirectSites) { currentSettings.redirectSites = data.redirectSites; await chrome.storage.local.set({ redirectSites: data.redirectSites }); }
    if (data.scheduledTasks) { currentSettings.scheduledTasks = data.scheduledTasks; await chrome.storage.local.set({ scheduledTasks: data.scheduledTasks }); }
    if (data.settings) { currentSettings.settings = { ...currentSettings.settings, ...data.settings }; await chrome.storage.local.set({ settings: currentSettings.settings }); }
    await loadSettings(); await loadRedirectSites(); await loadBlockedSites(); await loadBlockedKeywords(); await loadTimeLimitedSites(); await loadScheduledTasks();
    chrome.runtime.sendMessage({ action: 'updateRules' });
    showStatus('Settings imported', 'success');
  } catch (e) {
    showStatus('Invalid import file', 'error');
  }
  event.target.value = '';
}

async function resetToDefaults() {
  currentSettings.blockedSites = [];
  currentSettings.blockedKeywords = [];
  currentSettings.keywordSettings = { globalRedirect: 'about:newtab' };
  currentSettings.timeLimitedSites = [];
  currentSettings.redirectSites = [];
  currentSettings.scheduledTasks = [];
  currentSettings.settings = { enabled: true, darkMode: false, deepKeywordScan: false };

  await chrome.storage.local.set({
    blockedSites: [], blockedKeywords: [], keywordSettings: { globalRedirect: 'about:newtab' },
    timeLimitedSites: [], redirectSites: [], scheduledTasks: [], settings: currentSettings.settings
  });
  await loadSettings(); await loadRedirectSites(); await loadBlockedSites(); await loadBlockedKeywords(); await loadTimeLimitedSites(); await loadScheduledTasks();
  chrome.runtime.sendMessage({ action: 'updateRules' });
  showStatus('Reset to defaults', 'success');
}

// ========== UTILITIES ==========
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showStatus(message, type = 'info') {
  const el = document.getElementById('statusMessage');
  el.textContent = message;
  el.className = `status-message ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ========== STORAGE CHANGE LISTENER ==========
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    if (changes.blockedSites) { currentSettings.blockedSites = changes.blockedSites.newValue || []; await loadBlockedSites(); }
    if (changes.logs) { currentSettings.logs = changes.logs.newValue || []; await loadLogs(); updateStats(); }
    if (changes.scheduledTasks) { currentSettings.scheduledTasks = changes.scheduledTasks.newValue || []; await loadScheduledTasks(); }
    if (changes.redirectSites) { currentSettings.redirectSites = changes.redirectSites.newValue || []; await loadRedirectSites(); }
  }
});

// ========== CLEANUP ==========
window.addEventListener('beforeunload', () => {
  if (timerUpdateInterval) clearInterval(timerUpdateInterval);
  if (taskCountdownInterval) clearInterval(taskCountdownInterval);
});
