const DEFAULT_BLOCKED_SITES = [
  { domain: 'facebook.com', redirect: 'https://www.khanacademy.org' },
  { domain: 'youtube.com', redirect: 'https://www.calm.com' },
  { domain: 'twitter.com', redirect: 'https://www.duolingo.com' },
  { domain: 'instagram.com', redirect: 'https://www.codecademy.com' }
];

const DEFAULT_BLOCKED_KEYWORDS = [];
const DEFAULT_TIME_LIMITED_SITES = [];

const activeTimers = new Map(); // domain -> timer data (shared across all tabs)
const cooldownTimers = new Map(); // domain -> cooldown data
const activeTabs = new Map(); // domain -> Set of tabIds
const timerIntervals = new Map(); // domain -> setTimeout ID for cleanup

// Restore timers and cooldowns on startup
chrome.runtime.onStartup.addListener(async () => {
  await restoreTimersFromStorage();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('ReclaimFocus installed');
  await restoreTimersFromStorage();
  
  const { blockedSites, blockedKeywords } = await chrome.storage.local.get(['blockedSites', 'blockedKeywords']);
  
  if (!blockedSites || blockedSites.length === 0) {
    await chrome.storage.local.set({
      blockedSites: DEFAULT_BLOCKED_SITES,
      blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
      timeLimitedSites: DEFAULT_TIME_LIMITED_SITES,
      keywordSettings: {
        globalRedirect: 'about:newtab'
      },
      logs: [],
      settings: {
        enabled: true,
        darkMode: false
      }
    });
  } else if (!blockedKeywords) {
    await chrome.storage.local.set({
      blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
      timeLimitedSites: DEFAULT_TIME_LIMITED_SITES,
      keywordSettings: {
        globalRedirect: 'about:newtab'
      }
    });
  }
  
  await updateBlockingRules();
});

// Restore timers from storage after browser restart
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
            saveCooldownsToStorage();
          }, remainingTime);
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

// Save timers to storage for persistence
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

// Save cooldowns to storage for persistence
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    for (const [domain, tabs] of activeTabs.entries()) {
      tabs.delete(tabId);
    }
    
    await checkAndRedirect(tabId, changeInfo.url);
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId === 0) {
    await checkAndRedirect(details.tabId, details.url);
  }
});

// Check if URL is blocked and redirect if necessary
async function checkAndRedirect(tabId, url) {
  try {
    const { blockedSites, blockedKeywords, keywordSettings, timeLimitedSites, settings } = await chrome.storage.local.get([
      'blockedSites', 
      'blockedKeywords', 
      'keywordSettings',
      'timeLimitedSites',
      'settings'
    ]);
    
    if (!settings?.enabled) return;
    
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
    
    if (blockedKeywords && blockedKeywords.length > 0) {
      const keywordMatch = checkKeywordInUrl(url, blockedKeywords, keywordSettings);
      if (keywordMatch) {
        await logKeywordAttempt(url, keywordMatch.keyword);
        
        const redirectUrl = keywordMatch.redirect;
        if (!url.startsWith(redirectUrl)) {
          chrome.tabs.update(tabId, { url: redirectUrl });
        }
        return;
      }
    }
    
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
        chrome.tabs.update(tabId, { url: redirectUrl });
      }
    }
  } catch (error) {
    console.error('Error in checkAndRedirect:', error);
  }
}

// Check if URL contains blocked keywords
function checkKeywordInUrl(url, blockedKeywords, keywordSettings) {
  try {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    
    const searchParamNames = ['q', 'query', 'search', 'text', 'keyword', 'p'];
    
    let searchQuery = '';
    
    for (const param of searchParamNames) {
      if (searchParams.has(param)) {
        searchQuery = searchParams.get(param).toLowerCase();
        break;
      }
    }
    
    if (!searchQuery) {
      const path = urlObj.pathname.toLowerCase();
      const pathMatch = path.match(/\/(search|s|query)\/([^/]+)/);
      if (pathMatch && pathMatch[2]) {
        searchQuery = decodeURIComponent(pathMatch[2]);
      }
    }
    
    if (!searchQuery) return null;
    
    for (const keywordObj of blockedKeywords) {
      const keyword = keywordObj.keyword.toLowerCase();
      if (searchQuery.includes(keyword)) {
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

// Log website blocking attempt
async function logAttempt(url) {
  try {
    const { logs = [] } = await chrome.storage.local.get('logs');
    
    const newLog = {
      url: url,
      type: 'website',
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    logs.unshift(newLog);
    
    if (logs.length > 1000) {
      logs.splice(1000);
    }
    
    await chrome.storage.local.set({ logs });
    
    await updateBadge(logs.length);
  } catch (error) {
    console.error('Error logging attempt:', error);
  }
}

// Log blocked keyword attempt
async function logKeywordAttempt(url, keyword) {
  try {
    const { logs = [] } = await chrome.storage.local.get('logs');
    
    const newLog = {
      url: url,
      type: 'keyword',
      keyword: keyword,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    logs.unshift(newLog);
    
    if (logs.length > 1000) {
      logs.splice(1000);
    }
    
    await chrome.storage.local.set({ logs });
    
    await updateBadge(logs.length);
  } catch (error) {
    console.error('Error logging keyword attempt:', error);
  }
}

// Update extension badge with attempt count
async function updateBadge(count) {
  try {
    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF5252' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
  }
}

// Update declarativeNetRequest rules
async function updateBlockingRules() {
  try {
    const { blockedSites = [] } = await chrome.storage.local.get('blockedSites');
    
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = existingRules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds
      });
    }
    
  } catch (error) {
    console.error('Error updating blocking rules:', error);
  }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRules') {
    updateBlockingRules().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
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
            const minutesRemaining = Math.floor(timeRemaining / 60000);
            const secondsRemaining = Math.floor((timeRemaining % 60000) / 1000);
            
            sendResponse({ 
              timerData: {
                domain: timerData.domain,
                timeRemaining: timeRemaining,
                minutesRemaining: minutesRemaining,
                secondsRemaining: secondsRemaining,
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
});

chrome.storage.local.get('logs').then(({ logs = [] }) => {
  updateBadge(logs.length);
});

// Periodic save to ensure persistence (every 5 seconds)
setInterval(() => {
  if (activeTimers.size > 0) {
    saveTimersToStorage();
  }
}, 5000);

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabActivation(activeInfo.tabId);
});

// Handle tab activation to start or resume timers
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

// Start or resume timer for a domain
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
          existing.lastActiveTime = Date.now(); // Reset to current time to prevent adding browser-closed time
          
          if (wasPaused) {
            checkTimer(domain);
          }
          
          await saveTimersToStorage();
        }
      } catch (error) {
      }
    }
    return;
  }
  
  const timerData = {
    domain: domain,
    timeLimit: siteConfig.timeLimit * 60 * 1000,
    cooldown: siteConfig.cooldown * 60 * 1000,
    redirect: siteConfig.redirect || 'about:newtab',
    startTime: Date.now(),
    lastActiveTime: Date.now(),
    elapsedTime: 0,
    isPaused: false
  };
  
  activeTimers.set(domain, timerData);
  await saveTimersToStorage();
  checkTimer(domain);
}

// Check timer status and update elapsed time
async function checkTimer(domain) {
  const timerData = activeTimers.get(domain);
  if (!timerData) {
    clearTimerInterval(domain);
    return;
  }
  
  try {
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

// Clear timer interval to prevent memory leaks
function clearTimerInterval(domain) {
  if (timerIntervals.has(domain)) {
    clearTimeout(timerIntervals.get(domain));
    timerIntervals.delete(domain);
  }
}

// Handle timer expiration and redirect all tabs
async function handleTimeExpired(domain, timerData) {
  try {
    const cooldownKey = `cooldown_${domain}`;
    cooldownTimers.set(cooldownKey, {
      expiresAt: Date.now() + timerData.cooldown,
      domain: domain
    });
    
    await saveCooldownsToStorage();
    
    setTimeout(() => {
      cooldownTimers.delete(cooldownKey);
      saveCooldownsToStorage();
    }, timerData.cooldown);
    
    const tabs = activeTabs.get(domain) || new Set();
    for (const tabId of tabs) {
      try {
        await chrome.tabs.update(tabId, { url: timerData.redirect });
      } catch (error) {
        console.error(`Error redirecting tab ${tabId}:`, error);
      }
    }
    
    const { logs = [] } = await chrome.storage.local.get('logs');
    const newLog = {
      url: `https://${timerData.domain}`,
      type: 'timelimit',
      domain: timerData.domain,
      timeUsed: Math.floor(timerData.elapsedTime / 1000),
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    logs.unshift(newLog);
    if (logs.length > 1000) {
      logs.splice(1000);
    }
    
    await chrome.storage.local.set({ logs });
    await updateBadge(logs.length);
    
    cleanupTimer(domain);
  } catch (error) {
    console.error('Error handling time expired:', error);
  }
}

// Cleanup timer data for a domain
async function cleanupTimer(domain) {
  clearTimerInterval(domain);
  activeTimers.delete(domain);
  activeTabs.delete(domain);
  await saveTimersToStorage();
}

// Cleanup tab tracking when tab is closed
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
