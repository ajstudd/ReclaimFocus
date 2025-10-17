const DEFAULT_BLOCKED_SITES = [
  { domain: 'facebook.com', redirect: 'https://www.khanacademy.org' },
  { domain: 'youtube.com', redirect: 'https://www.calm.com' },
  { domain: 'twitter.com', redirect: 'https://www.duolingo.com' },
  { domain: 'instagram.com', redirect: 'https://www.codecademy.com' }
];

const DEFAULT_BLOCKED_KEYWORDS = [];
const DEFAULT_TIME_LIMITED_SITES = [];

const activeTimers = new Map();
const cooldownTimers = new Map();

chrome.runtime.onInstalled.addListener(async () => {
  console.log('ReclaimFocus installed');
  
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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
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
    
    // Check time-limited sites first
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
        
        startTimer(tabId, hostname, timeLimitedSite);
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

// Log blocked attempt
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const timerData = activeTimers.get(tabs[0].id);
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
              isPaused: timerData.isPaused,
              tabId: tabs[0].id
            }
          });
        } else {
          sendResponse({ timerData: null });
        }
      } else {
        sendResponse({ timerData: null });
      }
    });
    return true;
  }
});

chrome.storage.local.get('logs').then(({ logs = [] }) => {
  updateBadge(logs.length);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabActivation(activeInfo.tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cleanupTimer(tabId);
});

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
      
      startTimer(tabId, hostname, timeLimitedSite);
    }
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
}

function startTimer(tabId, domain, siteConfig) {
  if (activeTimers.has(tabId)) {
    const existing = activeTimers.get(tabId);
    if (existing.domain === domain) {
      existing.isPaused = false;
      existing.lastActiveTime = Date.now();
      checkTimer(tabId);
      return;
    }
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
  
  activeTimers.set(tabId, timerData);
  checkTimer(tabId);
}

async function checkTimer(tabId) {
  const timerData = activeTimers.get(tabId);
  if (!timerData || timerData.isPaused) return;
  
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) {
      timerData.isPaused = true;
      return;
    }
    
    const now = Date.now();
    const deltaTime = now - timerData.lastActiveTime;
    timerData.elapsedTime += deltaTime;
    timerData.lastActiveTime = now;
    
    if (timerData.elapsedTime >= timerData.timeLimit) {
      await handleTimeExpired(tabId, timerData);
      return;
    }
    
    setTimeout(() => checkTimer(tabId), 1000);
  } catch (error) {
    cleanupTimer(tabId);
  }
}

async function handleTimeExpired(tabId, timerData) {
  try {
    const cooldownKey = `cooldown_${timerData.domain}`;
    cooldownTimers.set(cooldownKey, {
      expiresAt: Date.now() + timerData.cooldown,
      domain: timerData.domain
    });
    
    setTimeout(() => {
      cooldownTimers.delete(cooldownKey);
    }, timerData.cooldown);
    
    await chrome.tabs.update(tabId, { url: timerData.redirect });
    
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
    
    cleanupTimer(tabId);
  } catch (error) {
    console.error('Error handling time expired:', error);
  }
}

function cleanupTimer(tabId) {
  activeTimers.delete(tabId);
}
