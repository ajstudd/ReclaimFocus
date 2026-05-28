// ============================================
// ReclaimFocus v2.0 - Background Service Worker
// ============================================

const DEFAULT_BLOCKED_SITES = [
  { domain: 'facebook.com', redirect: 'https://www.khanacademy.org' },
  { domain: 'youtube.com', redirect: 'https://www.calm.com' },
  { domain: 'twitter.com', redirect: 'https://www.duolingo.com' },
  { domain: 'instagram.com', redirect: 'https://www.codecademy.com' }
];

const DEFAULT_BLOCKED_KEYWORDS = [];
const DEFAULT_TIME_LIMITED_SITES = [];
const DEFAULT_REDIRECT_SITES = [];

const activeTimers = new Map();     // domain -> timer data
const cooldownTimers = new Map();   // cooldown_domain -> cooldown data
const activeTabs = new Map();       // domain -> Set of tabIds
const timerIntervals = new Map();   // domain -> setTimeout ID
const extraTimePromptPending = new Map(); // domain -> { timeout, siteConfig }
const pendingToasts = new Map();    // tabId -> { type, from, to, label }

// ========== STARTUP ==========
chrome.runtime.onStartup.addListener(async () => {
  await restoreTimersFromStorage();
  await restoreScheduledTasks();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('ReclaimFocus v2.0 installed');
  await restoreTimersFromStorage();
  await restoreScheduledTasks();

  const { blockedSites, blockedKeywords } = await chrome.storage.local.get(['blockedSites', 'blockedKeywords']);

  if (!blockedSites || blockedSites.length === 0) {
    await chrome.storage.local.set({
      blockedSites: DEFAULT_BLOCKED_SITES,
      blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
      timeLimitedSites: DEFAULT_TIME_LIMITED_SITES,
      redirectSites: DEFAULT_REDIRECT_SITES,
      keywordSettings: { globalRedirect: 'about:newtab' },
      logs: [],
      settings: { enabled: true, darkMode: false, deepKeywordScan: false }
    });
  } else if (!blockedKeywords) {
    await chrome.storage.local.set({
      blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
      timeLimitedSites: DEFAULT_TIME_LIMITED_SITES,
      redirectSites: DEFAULT_REDIRECT_SITES,
      keywordSettings: { globalRedirect: 'about:newtab' }
    });
  } else {
    // Backfill redirectSites for existing installs that pre-date this feature
    const { redirectSites } = await chrome.storage.local.get('redirectSites');
    if (!Array.isArray(redirectSites)) {
      await chrome.storage.local.set({ redirectSites: DEFAULT_REDIRECT_SITES });
    }
  }

  await updateBlockingRules();
});

// ========== TIMER PERSISTENCE ==========
async function restoreTimersFromStorage() {
  try {
    const { persistedTimers, persistedCooldowns } = await chrome.storage.local.get(['persistedTimers', 'persistedCooldowns']);

    if (persistedCooldowns) {
      for (const [key, cooldownData] of Object.entries(persistedCooldowns)) {
        if (Date.now() < cooldownData.expiresAt) {
          cooldownTimers.set(key, cooldownData);
          const remainingTime = cooldownData.expiresAt - Date.now();
          setTimeout(() => {
            cooldownTimers.delete(key);
            // Reset extraTimeUsed for this domain
            resetExtraTimeUsed(cooldownData.domain);
            saveCooldownsToStorage();
          }, remainingTime);
        } else {
          // Cooldown expired while browser was closed; reset extra time
          resetExtraTimeUsed(cooldownData.domain);
        }
      }
    }

    if (persistedTimers) {
      for (const [domain, timerData] of Object.entries(persistedTimers)) {
        activeTimers.set(domain, timerData);
        timerData.isPaused = true;
      }
    }
  } catch (error) {
    console.error('Error restoring timers:', error);
  }
}

async function saveTimersToStorage() {
  try {
    const timersObj = {};
    for (const [domain, timerData] of activeTimers.entries()) {
      timersObj[domain] = timerData;
    }
    await chrome.storage.local.set({ persistedTimers: timersObj });
  } catch (error) {
    console.error('Error saving timers:', error);
  }
}

async function saveCooldownsToStorage() {
  try {
    const cooldownsObj = {};
    for (const [key, cooldownData] of cooldownTimers.entries()) {
      cooldownsObj[key] = cooldownData;
    }
    await chrome.storage.local.set({ persistedCooldowns: cooldownsObj });
  } catch (error) {
    console.error('Error saving cooldowns:', error);
  }
}

// ========== EXTRA TIME RESET ==========
async function resetExtraTimeUsed(domain) {
  try {
    const { timeLimitedSites } = await chrome.storage.local.get('timeLimitedSites');
    if (!timeLimitedSites) return;

    const cleanDomain = domain.replace(/^www\./, '');
    let changed = false;
    for (const site of timeLimitedSites) {
      if (site.domain.replace(/^www\./, '') === cleanDomain && site.extraTimeUsed) {
        site.extraTimeUsed = false;
        changed = true;
      }
    }
    if (changed) {
      await chrome.storage.local.set({ timeLimitedSites });
    }
  } catch (e) {
    console.error('Error resetting extra time:', e);
  }
}

// ========== TAB LISTENERS ==========
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    for (const [domain, tabs] of activeTabs.entries()) {
      tabs.delete(tabId);
    }
    await checkAndRedirect(tabId, changeInfo.url);
  }
  if (changeInfo.status === 'complete' && tab?.url) {
    // Deep keyword scan needs a loaded DOM
    await runDeepKeywordScan(tabId, tab.url);
    // Show queued toast (if any)
    if (pendingToasts.has(tabId)) {
      const info = pendingToasts.get(tabId);
      pendingToasts.delete(tabId);
      showRedirectToast(tabId, info);
    }
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId === 0) {
    await checkAndRedirect(details.tabId, details.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabActivation(activeInfo.tabId);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  for (const [domain, tabs] of activeTabs.entries()) {
    tabs.delete(tabId);
    if (tabs.size === 0) {
      const timerData = activeTimers.get(domain);
      if (timerData) {
        timerData.isPaused = true;
        await saveTimersToStorage();
        clearTimerInterval(domain);
      }
    }
  }
});

// ========== MAIN CHECK & REDIRECT ==========
async function checkAndRedirect(tabId, url) {
  try {
    const { blockedSites, blockedKeywords, keywordSettings, timeLimitedSites, settings } = await chrome.storage.local.get([
      'blockedSites', 'blockedKeywords', 'keywordSettings', 'timeLimitedSites', 'settings'
    ]);

    if (!settings?.enabled) return;

    // Time-limited sites
    if (timeLimitedSites && timeLimitedSites.length > 0) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace(/^www\./, '');

      const timeLimitedSite = timeLimitedSites.find(site => {
        const siteDomain = site.domain.replace(/^www\./, '');
        return hostname === siteDomain || hostname.endsWith('.' + siteDomain);
      });

      if (timeLimitedSite) {
        const cooldownKey = `cooldown_${hostname}`;
        const cooldownData = cooldownTimers.get(cooldownKey);

        if (cooldownData && Date.now() < cooldownData.expiresAt) {
          const redirectUrl = timeLimitedSite.redirect || 'about:newtab';
          queueRedirectToast(tabId, { type: 'cooldown', label: `${hostname} is in cooldown` });
          chrome.tabs.update(tabId, { url: redirectUrl });
          return;
        }

        if (!activeTabs.has(hostname)) {
          activeTabs.set(hostname, new Set());
        }
        activeTabs.get(hostname).add(tabId);

        startTimer(hostname, timeLimitedSite);
        return;
      }
    }

    // Keyword blocking
    if (blockedKeywords && blockedKeywords.length > 0) {
      const keywordMatch = checkKeywordInUrl(url, blockedKeywords, keywordSettings);
      if (keywordMatch) {
        await logKeywordAttempt(url, keywordMatch.keyword);
        const redirectUrl = keywordMatch.redirect;
        if (!url.startsWith(redirectUrl)) {
          queueRedirectToast(tabId, { type: 'keyword', label: `Keyword "${keywordMatch.keyword}" detected` });
          chrome.tabs.update(tabId, { url: redirectUrl });
        }
        return;
      }

      // Deep scan is handled separately on tabs.onUpdated (status==='complete')
    }

    // Blocked sites
    if (!blockedSites || blockedSites.length === 0) return;

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    const blockedSite = blockedSites.find(site => {
      const blockedDomain = site.domain.replace(/^www\./, '');
      return hostname === blockedDomain || hostname.endsWith('.' + blockedDomain);
    });

    if (blockedSite) {
      await logAttempt(url);
      const redirectUrl = blockedSite.redirect || 'https://www.khanacademy.org';
      if (!url.startsWith(redirectUrl)) {
        queueRedirectToast(tabId, { type: 'blocked', label: `${blockedSite.domain} is on your blocked list` });
        chrome.tabs.update(tabId, { url: redirectUrl });
      }
    }
  } catch (error) {
    console.error('Error in checkAndRedirect:', error);
  }
}

// ========== REDIRECT TOAST (subtle in-page notification) ==========
// Queue a toast to be shown after the destination page loads.
function queueRedirectToast(tabId, info) {
  pendingToasts.set(tabId, info);
}

// Render the toast inside the target page via injected script (Shadow DOM isolated).
async function showRedirectToast(tabId, info) {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !tab.url) return;
    if (!/^https?:/i.test(tab.url)) return; // can't inject into chrome://, about:, etc.

    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectToastFunc,
      args: [info]
    });
  } catch (e) {
    // page closed, permission denied, etc.
  }
}

// This function runs in the page context. Keep it self-contained.
function injectToastFunc(info) {
  if (document.getElementById('__rf_toast_host__')) return;

  const host = document.createElement('div');
  host.id = '__rf_toast_host__';
  host.style.cssText = 'all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const accent = info.type === 'blocked' ? '#e05248'
    : info.type === 'timelimit' ? '#5848B9'
    : info.type === 'cooldown' ? '#e05248'
    : info.type === 'keyword' ? '#f3b01e'
    : '#5848B9';

  const icon = info.type === 'timelimit' || info.type === 'cooldown'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    : info.type === 'keyword'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .t {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: rgba(20, 22, 32, 0.92);
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        font-size: 12.5px;
        line-height: 1.35;
        max-width: 320px;
        opacity: 0;
        transform: translateY(8px);
        animation: rfin 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        pointer-events: auto;
      }
      .t.out {
        animation: rfout 220ms ease forwards;
      }
      .ico {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: ${accent};
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ico svg { width: 14px; height: 14px; color: #fff; }
      .body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .title { font-weight: 600; font-size: 12px; letter-spacing: 0.1px; }
      .msg { color: rgba(255,255,255,0.72); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
      @keyframes rfin {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes rfout {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(8px); }
      }
    </style>
    <div class="t" id="t">
      <div class="ico">${icon}</div>
      <div class="body">
        <div class="title">ReclaimFocus</div>
        <div class="msg" id="msg"></div>
      </div>
    </div>
  `;

  shadow.getElementById('msg').textContent = info.label || 'Redirected';
  document.documentElement.appendChild(host);

  setTimeout(() => {
    const t = shadow.getElementById('t');
    if (t) t.classList.add('out');
    setTimeout(() => host.remove(), 240);
  }, 3200);
}

// ========== DEEP KEYWORD SCAN (page content) ==========
async function runDeepKeywordScan(tabId, url) {
  try {
    if (!url || !/^https?:/.test(url)) return;

    const { blockedKeywords, keywordSettings, settings } = await chrome.storage.local.get([
      'blockedKeywords', 'keywordSettings', 'settings'
    ]);
    if (!settings?.enabled || !settings?.deepKeywordScan) return;
    if (!blockedKeywords || blockedKeywords.length === 0) return;

    // Inject content script (idempotent: re-injection is fine)
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content_keyword_scanner.js']
      });
    } catch (e) {
      // Injection blocked on chrome://, extension pages, etc.
      return;
    }

    const keywords = blockedKeywords.map(k => k.keyword);
    chrome.tabs.sendMessage(tabId, { action: 'scanPageForKeywords', keywords }, (response) => {
      if (chrome.runtime.lastError) return; // tab closed, no listener, etc.
      if (response?.found) {
        const kObj = blockedKeywords.find(
          k => k.keyword.toLowerCase() === response.keyword.toLowerCase()
        );
        const redirect = kObj?.redirect || keywordSettings?.globalRedirect || 'about:newtab';
        logKeywordAttempt(url, response.keyword);
        queueRedirectToast(tabId, { type: 'keyword', label: `Keyword "${response.keyword}" found on page` });
        chrome.tabs.update(tabId, { url: redirect });
      }
    });
  } catch (error) {
    console.error('Deep scan error:', error);
  }
}

// ========== HARDENED KEYWORD CHECKING ==========
function checkKeywordInUrl(url, blockedKeywords, keywordSettings) {
  try {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;

    // Expanded search parameter names
    const searchParamNames = [
      'q', 'query', 'search', 'text', 'keyword', 'p',
      'search_query', 'oq', 'qs', 'va', 'w', 'searchTerm',
      'term', 'kw', 'find', 'as_q'
    ];

    let searchQuery = '';

    // Check URL search params (decoded)
    for (const param of searchParamNames) {
      if (searchParams.has(param)) {
        try {
          searchQuery = decodeURIComponent(searchParams.get(param)).toLowerCase();
        } catch (e) {
          searchQuery = searchParams.get(param).toLowerCase();
        }
        break;
      }
    }

    // Check URL hash fragments (SPA support)
    if (!searchQuery && urlObj.hash) {
      try {
        const hashParams = new URLSearchParams(urlObj.hash.substring(1));
        for (const param of searchParamNames) {
          if (hashParams.has(param)) {
            searchQuery = decodeURIComponent(hashParams.get(param)).toLowerCase();
            break;
          }
        }
      } catch (e) { /* malformed hash */ }
    }

    // Check path-based search patterns
    if (!searchQuery) {
      const path = urlObj.pathname.toLowerCase();
      const pathMatch = path.match(/\/(search|s|query)\/([^/]+)/);
      if (pathMatch && pathMatch[2]) {
        try {
          searchQuery = decodeURIComponent(pathMatch[2]);
        } catch (e) {
          searchQuery = pathMatch[2];
        }
      }
    }

    // Fallback: full path for known search engines
    if (!searchQuery) {
      const searchEngines = ['google.', 'bing.com', 'duckduckgo.com', 'yahoo.com',
                             'baidu.com', 'yandex.', 'ecosia.org', 'startpage.com'];
      if (searchEngines.some(se => urlObj.hostname.includes(se))) {
        try {
          searchQuery = decodeURIComponent(urlObj.pathname + urlObj.search).toLowerCase();
        } catch (e) {
          searchQuery = (urlObj.pathname + urlObj.search).toLowerCase();
        }
      }
    }

    if (!searchQuery) return null;

    for (const keywordObj of blockedKeywords) {
      const keyword = keywordObj.keyword.toLowerCase();
      // Unicode-safe word boundary matching
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp("(?:^|[\\s,;.!?\"'()\\[\\]{}])" + escapedKeyword + "(?:$|[\\s,;.!?\"'()\\[\\]{}])", 'i');

      if (regex.test(searchQuery) || searchQuery.includes(keyword)) {
        const redirect = keywordObj.redirect || keywordSettings?.globalRedirect || 'about:newtab';
        return { keyword: keywordObj.keyword, redirect };
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking keyword in URL:', error);
    return null;
  }
}

// ========== LOGGING ==========
async function logAttempt(url) {
  try {
    const { logs = [] } = await chrome.storage.local.get('logs');
    logs.unshift({ url, type: 'website', timestamp: new Date().toISOString(), id: Date.now() });
    if (logs.length > 1000) logs.splice(1000);
    await chrome.storage.local.set({ logs });
    await updateBadge(logs.length);
  } catch (error) {
    console.error('Error logging attempt:', error);
  }
}

async function logKeywordAttempt(url, keyword) {
  try {
    const { logs = [] } = await chrome.storage.local.get('logs');
    logs.unshift({ url, type: 'keyword', keyword, timestamp: new Date().toISOString(), id: Date.now() });
    if (logs.length > 1000) logs.splice(1000);
    await chrome.storage.local.set({ logs });
    await updateBadge(logs.length);
  } catch (error) {
    console.error('Error logging keyword attempt:', error);
  }
}

async function updateBadge(count) {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#5848B9' }); // match primary
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// ========== BLOCKING RULES ==========
async function updateBlockingRules() {
  try {
    const { blockedSites = [] } = await chrome.storage.local.get('blockedSites');
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ruleIds });
    }
  } catch (error) {
    console.error('Error updating blocking rules:', error);
  }
}

// ========== TAB ACTIVATION ==========
async function handleTabActivation(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;

    const { timeLimitedSites, settings } = await chrome.storage.local.get(['timeLimitedSites', 'settings']);
    if (!settings?.enabled || !timeLimitedSites || timeLimitedSites.length === 0) return;

    const urlObj = new URL(tab.url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    const timeLimitedSite = timeLimitedSites.find(site => {
      const siteDomain = site.domain.replace(/^www\./, '');
      return hostname === siteDomain || hostname.endsWith('.' + siteDomain);
    });

    if (timeLimitedSite) {
      const cooldownKey = `cooldown_${hostname}`;
      const cooldownData = cooldownTimers.get(cooldownKey);

      if (cooldownData && Date.now() < cooldownData.expiresAt) {
        const redirectUrl = timeLimitedSite.redirect || 'about:newtab';
        queueRedirectToast(tabId, { type: 'cooldown', label: `${hostname} is in cooldown` });
        chrome.tabs.update(tabId, { url: redirectUrl });
        return;
      }

      if (!activeTabs.has(hostname)) {
        activeTabs.set(hostname, new Set());
      }
      activeTabs.get(hostname).add(tabId);

      startTimer(hostname, timeLimitedSite);
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
}

// ========== TIMER CORE ==========
async function startTimer(domain, siteConfig) {
  if (activeTimers.has(domain)) {
    const existing = activeTimers.get(domain);
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      try {
        const urlObj = new URL(tabs[0].url);
        const hostname = urlObj.hostname.replace(/^www\./, '');
        if (hostname === domain) {
          const wasPaused = existing.isPaused;
          existing.isPaused = false;
          existing.lastActiveTime = Date.now();
          if (wasPaused) checkTimer(domain);
          await saveTimersToStorage();
        }
      } catch (error) { /* ignore */ }
    }
    return;
  }

  const timerData = {
    domain,
    timeLimit: siteConfig.timeLimit * 60 * 1000,
    cooldown: siteConfig.cooldown * 60 * 1000,
    redirect: siteConfig.redirect || 'about:newtab',
    startTime: Date.now(),
    lastActiveTime: Date.now(),
    elapsedTime: 0,
    isPaused: false,
    extraTime: (siteConfig.extraTime || 5) * 60 * 1000,
    extraTimeUsed: siteConfig.extraTimeUsed || false
  };

  activeTimers.set(domain, timerData);
  await saveTimersToStorage();
  checkTimer(domain);
}

async function checkTimer(domain) {
  const timerData = activeTimers.get(domain);
  if (!timerData) {
    clearTimerInterval(domain);
    return;
  }

  try {
    // If the extension is disabled, pause the timer (preserve elapsed time, do not advance)
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings?.enabled) {
      if (!timerData.isPaused) {
        timerData.isPaused = true;
        await saveTimersToStorage();
      }
      const timeoutId = setTimeout(() => checkTimer(domain), 2000);
      timerIntervals.set(domain, timeoutId);
      return;
    }

    const allTabs = await chrome.tabs.query({});
    const tabs = activeTabs.get(domain) || new Set();

    let isAnyTabActive = false;
    let hasAnyTabWithDomain = false;

    for (const tab of allTabs) {
      if (tabs.has(tab.id)) {
        hasAnyTabWithDomain = true;
        if (tab.active) {
          isAnyTabActive = true;
          break;
        }
      }
    }

    if (!hasAnyTabWithDomain) {
      timerData.isPaused = true;
      await saveTimersToStorage();
      clearTimerInterval(domain);
      return;
    }

    if (!isAnyTabActive) {
      if (!timerData.isPaused) {
        timerData.isPaused = true;
        await saveTimersToStorage();
      }
      const timeoutId = setTimeout(() => checkTimer(domain), 1000);
      timerIntervals.set(domain, timeoutId);
      return;
    }

    if (timerData.isPaused) {
      timerData.isPaused = false;
      timerData.lastActiveTime = Date.now();
      await saveTimersToStorage();
      const timeoutId = setTimeout(() => checkTimer(domain), 1000);
      timerIntervals.set(domain, timeoutId);
      return;
    }

    const now = Date.now();
    const deltaTime = now - timerData.lastActiveTime;
    timerData.elapsedTime += deltaTime;
    timerData.lastActiveTime = now;

    if (timerData.elapsedTime >= timerData.timeLimit) {
      // Check if extra time can be offered
      if (!timerData.extraTimeUsed && !extraTimePromptPending.has(domain)) {
        // Pause the timer and send prompt
        timerData.isPaused = true;
        await saveTimersToStorage();

        // Send extra time prompt to popup
        try {
          chrome.runtime.sendMessage({
            action: 'showExtraTimePrompt',
            domain: domain,
            extraTimeMinutes: Math.round(timerData.extraTime / 60000)
          });
        } catch (e) { /* popup may not be open */ }

        // Set a timeout: if no response in 15 seconds, deny automatically
        const timeout = setTimeout(async () => {
          extraTimePromptPending.delete(domain);
          await handleTimeExpired(domain, timerData);
        }, 15000);

        extraTimePromptPending.set(domain, { timeout, siteConfig: timerData });
        return;
      }

      await handleTimeExpired(domain, timerData);
      return;
    }

    await saveTimersToStorage();
    const timeoutId = setTimeout(() => checkTimer(domain), 1000);
    timerIntervals.set(domain, timeoutId);
  } catch (error) {
    console.error('Error checking timer:', error);
    cleanupTimer(domain);
  }
}

function clearTimerInterval(domain) {
  if (timerIntervals.has(domain)) {
    clearTimeout(timerIntervals.get(domain));
    timerIntervals.delete(domain);
  }
}

async function handleTimeExpired(domain, timerData) {
  try {
    const cooldownKey = `cooldown_${domain}`;
    cooldownTimers.set(cooldownKey, {
      expiresAt: Date.now() + timerData.cooldown,
      totalCooldownMs: timerData.cooldown,
      domain: domain
    });

    await saveCooldownsToStorage();

    setTimeout(() => {
      cooldownTimers.delete(cooldownKey);
      resetExtraTimeUsed(domain);
      saveCooldownsToStorage();
    }, timerData.cooldown);

    // Redirect all tabs
    const tabs = activeTabs.get(domain) || new Set();
    for (const tabId of tabs) {
      try {
        queueRedirectToast(tabId, { type: 'timelimit', label: `Time's up on ${domain}` });
        await chrome.tabs.update(tabId, { url: timerData.redirect });
      } catch (error) {
        console.error(`Error redirecting tab ${tabId}:`, error);
      }
    }

    // Log
    const { logs = [] } = await chrome.storage.local.get('logs');
    logs.unshift({
      url: `https://${timerData.domain}`,
      type: 'timelimit',
      domain: timerData.domain,
      timeUsed: Math.floor(timerData.elapsedTime / 1000),
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    if (logs.length > 1000) logs.splice(1000);
    await chrome.storage.local.set({ logs });
    await updateBadge(logs.length);

    cleanupTimer(domain);
  } catch (error) {
    console.error('Error handling time expired:', error);
  }
}

async function cleanupTimer(domain) {
  clearTimerInterval(domain);
  activeTimers.delete(domain);
  activeTabs.delete(domain);
  await saveTimersToStorage();
}

// ========== MESSAGE HANDLERS ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRules') {
    updateBlockingRules().then(() => sendResponse({ success: true })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message.action === 'clearBadge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'getTimerStatus') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const urlObj = new URL(tabs[0].url);
          const hostname = urlObj.hostname.replace(/^www\./, '');
          const timerData = activeTimers.get(hostname);
          if (timerData) {
            const timeRemaining = Math.max(0, timerData.timeLimit - timerData.elapsedTime);
            sendResponse({
              timerData: {
                domain: timerData.domain,
                timeRemaining,
                totalTime: timerData.timeLimit,
                minutesRemaining: Math.floor(timeRemaining / 60000),
                secondsRemaining: Math.floor((timeRemaining % 60000) / 1000),
                isPaused: timerData.isPaused
              }
            });
          } else {
            sendResponse({ timerData: null });
          }
        } catch (error) {
          sendResponse({ timerData: null });
        }
      } else {
        sendResponse({ timerData: null });
      }
    });
    return true;
  }

  // NEW: Get all timer statuses for all domains
  if (message.action === 'getAllTimerStatuses') {
    const timers = {};
    for (const [domain, timerData] of activeTimers.entries()) {
      const timeRemaining = Math.max(0, timerData.timeLimit - timerData.elapsedTime);
      timers[domain] = {
        domain: timerData.domain,
        timeRemaining,
        totalTime: timerData.timeLimit,
        isPaused: timerData.isPaused
      };
    }
    sendResponse({ timers });
    return true;
  }

  // NEW: Get cooldown statuses
  if (message.action === 'getCooldownStatus') {
    const cooldowns = {};
    for (const [key, data] of cooldownTimers.entries()) {
      cooldowns[key] = {
        domain: data.domain,
        expiresAt: data.expiresAt,
        totalCooldownMs: data.totalCooldownMs || 0,
        remainingMs: Math.max(0, data.expiresAt - Date.now())
      };
    }
    sendResponse({ cooldowns });
    return true;
  }

  // NEW: Grant extra time
  if (message.action === 'grantExtraTime') {
    const domain = message.domain;
    const pending = extraTimePromptPending.get(domain);
    if (pending) {
      clearTimeout(pending.timeout);
      extraTimePromptPending.delete(domain);
    }

    const timerData = activeTimers.get(domain);
    if (timerData) {
      timerData.timeLimit += timerData.extraTime;
      timerData.extraTimeUsed = true;
      timerData.isPaused = false;
      timerData.lastActiveTime = Date.now();

      // Persist extraTimeUsed in storage
      chrome.storage.local.get('timeLimitedSites', (data) => {
        const sites = data.timeLimitedSites || [];
        const cleanDomain = domain.replace(/^www\./, '');
        for (const site of sites) {
          if (site.domain.replace(/^www\./, '') === cleanDomain) {
            site.extraTimeUsed = true;
          }
        }
        chrome.storage.local.set({ timeLimitedSites: sites });
      });

      saveTimersToStorage();
      checkTimer(domain);
    }
    sendResponse({ success: true });
    return true;
  }

  // NEW: Deny extra time
  if (message.action === 'denyExtraTime') {
    const domain = message.domain;
    const pending = extraTimePromptPending.get(domain);
    if (pending) {
      clearTimeout(pending.timeout);
      extraTimePromptPending.delete(domain);
    }

    const timerData = activeTimers.get(domain);
    if (timerData) {
      timerData.extraTimeUsed = true;
      handleTimeExpired(domain, timerData);
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'cleanupTimeLimitedSite') {
    const domain = message.domain;
    clearTimerInterval(domain);
    activeTimers.delete(domain);
    activeTabs.delete(domain);
    cooldownTimers.delete(`cooldown_${domain}`);
    saveTimersToStorage();
    saveCooldownsToStorage();
    sendResponse({ success: true });
    return true;
  }

  // Task scheduling
  if (message.action === 'scheduleTask') {
    scheduleTaskAlarm(message.task)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'cancelTask') {
    cancelTaskAlarm(message.taskId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// ========== BADGE INIT ==========
chrome.storage.local.get('logs').then(({ logs = [] }) => {
  updateBadge(logs.length);
});

// Periodic save (every 5 seconds)
setInterval(() => {
  if (activeTimers.size > 0) saveTimersToStorage();
}, 5000);

// ========== TASK SCHEDULING ==========
async function restoreScheduledTasks() {
  try {
    const { scheduledTasks } = await chrome.storage.local.get('scheduledTasks');
    if (scheduledTasks && scheduledTasks.length > 0) {
      const now = new Date();
      const activeTasks = [];

      for (const task of scheduledTasks) {
        const scheduledDate = new Date(task.scheduledTime);
        if (scheduledDate < now) {
          // Handle recurring tasks that are past due
          if (task.recurrence && task.recurrence !== 'none') {
            const nextTime = calculateNextOccurrence(task.scheduledTime, task.recurrence);
            const newTask = { ...task, scheduledTime: nextTime };
            await scheduleTaskAlarm(newTask);
            activeTasks.push(newTask);
          }
          continue;
        }
        await scheduleTaskAlarm(task);
        activeTasks.push(task);
      }

      if (activeTasks.length !== scheduledTasks.length) {
        await chrome.storage.local.set({ scheduledTasks: activeTasks });
      }
    }
  } catch (error) {
    console.error('Error restoring scheduled tasks:', error);
  }
}

async function scheduleTaskAlarm(task) {
  try {
    const scheduledDate = new Date(task.scheduledTime);
    if (scheduledDate > new Date()) {
      await chrome.alarms.create(`task_${task.id}`, { when: scheduledDate.getTime() });
    }
  } catch (error) {
    console.error('Error scheduling task alarm:', error);
  }
}

async function cancelTaskAlarm(taskId) {
  try {
    await chrome.alarms.clear(`task_${taskId}`);
  } catch (error) {
    console.error('Error cancelling task alarm:', error);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('task_')) {
    const taskId = parseInt(alarm.name.replace('task_', ''));
    await executeScheduledTask(taskId);
  }
});

async function executeScheduledTask(taskId) {
  try {
    const { scheduledTasks } = await chrome.storage.local.get('scheduledTasks');
    if (!scheduledTasks) return;

    const taskIndex = scheduledTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = scheduledTasks[taskIndex];

    // Show notification (priority drives urgency: high=2, medium=1, low=0)
    if (task.showNotification) {
      const priorityMap = { high: 2, medium: 1, low: 0 };
      const notifPriority = priorityMap[task.priority] ?? 1;
      await chrome.notifications.create(`task_${taskId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `ReclaimFocus: ${task.name}`,
        message: task.url ? `Opening: ${task.url}` : task.name,
        priority: notifPriority,
        requireInteraction: task.priority === 'high'
      });
    }

    // Open URL if provided
    if (task.url) {
      await chrome.tabs.create({ url: task.url, active: true });
    }

    // Handle recurrence
    if (task.recurrence && task.recurrence !== 'none') {
      const nextTime = calculateNextOccurrence(task.scheduledTime, task.recurrence);
      const newTask = { ...task, id: Date.now(), scheduledTime: nextTime };
      scheduledTasks.push(newTask);
      await scheduleTaskAlarm(newTask);
    }

    // Remove the executed task
    scheduledTasks.splice(taskIndex, 1);
    await chrome.storage.local.set({ scheduledTasks });
  } catch (error) {
    console.error('Error executing scheduled task:', error);
  }
}

function calculateNextOccurrence(currentTime, recurrence) {
  const date = new Date(currentTime);

  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekdays':
      do {
        date.setDate(date.getDate() + 1);
      } while (date.getDay() === 0 || date.getDay() === 6); // Skip weekends
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    default:
      date.setDate(date.getDate() + 1);
  }

  return date.toISOString();
}