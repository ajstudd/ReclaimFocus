const DEFAULT_BLOCKED_SITES = [
  { domain: 'facebook.com', redirect: 'https://www.khanacademy.org' },
  { domain: 'youtube.com', redirect: 'https://www.calm.com' },
  { domain: 'twitter.com', redirect: 'https://www.duolingo.com' },
  { domain: 'instagram.com', redirect: 'https://www.codecademy.com' }
];

const DEFAULT_BLOCKED_KEYWORDS = [];

chrome.runtime.onInstalled.addListener(async () => {
  console.log('ReclaimFocus installed');
  
  const { blockedSites, blockedKeywords } = await chrome.storage.local.get(['blockedSites', 'blockedKeywords']);
  
  if (!blockedSites || blockedSites.length === 0) {
    await chrome.storage.local.set({
      blockedSites: DEFAULT_BLOCKED_SITES,
      blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
      keywordSettings: {
        globalRedirect: 'about:newtab' // Default to homepage/new tab
      },
      logs: [],
      settings: {
        enabled: true,
        darkMode: false
      }
    });
  } else if (!blockedKeywords) {
    // Add keyword support to existing installations
    await chrome.storage.local.set({
      blockedKeywords: DEFAULT_BLOCKED_KEYWORDS,
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
    const { blockedSites, blockedKeywords, keywordSettings, settings } = await chrome.storage.local.get([
      'blockedSites', 
      'blockedKeywords', 
      'keywordSettings', 
      'settings'
    ]);
    
    if (!settings?.enabled) return;
    
    // Check for keyword blocking in search URLs
    if (blockedKeywords && blockedKeywords.length > 0) {
      const keywordMatch = checkKeywordInUrl(url, blockedKeywords, keywordSettings);
      if (keywordMatch) {
        await logKeywordAttempt(url, keywordMatch.keyword);
        
        const redirectUrl = keywordMatch.redirect;
        if (!url.startsWith(redirectUrl)) {
          chrome.tabs.update(tabId, { url: redirectUrl });
        }
        return; // Exit early if keyword is blocked
      }
    }
    
    // Check for website blocking
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
    
    // Common search parameter names across search engines
    const searchParamNames = ['q', 'query', 'search', 'text', 'keyword', 'p'];
    
    let searchQuery = '';
    
    // Try to find search query in URL parameters
    for (const param of searchParamNames) {
      if (searchParams.has(param)) {
        searchQuery = searchParams.get(param).toLowerCase();
        break;
      }
    }
    
    // If no query found in params, check the URL path (for some search engines)
    if (!searchQuery) {
      const path = urlObj.pathname.toLowerCase();
      // Extract query from paths like /search/keyword or /s/keyword
      const pathMatch = path.match(/\/(search|s|query)\/([^/]+)/);
      if (pathMatch && pathMatch[2]) {
        searchQuery = decodeURIComponent(pathMatch[2]);
      }
    }
    
    if (!searchQuery) return null;
    
    // Check if any blocked keyword matches
    for (const keywordObj of blockedKeywords) {
      const keyword = keywordObj.keyword.toLowerCase();
      if (searchQuery.includes(keyword)) {
        // Use keyword-specific redirect or global redirect
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
});

chrome.storage.local.get('logs').then(({ logs = [] }) => {
  updateBadge(logs.length);
});
