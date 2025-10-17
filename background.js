const DEFAULT_BLOCKED_SITES = [
  { domain: 'facebook.com', redirect: 'https://www.khanacademy.org' },
  { domain: 'youtube.com', redirect: 'https://www.calm.com' },
  { domain: 'twitter.com', redirect: 'https://www.duolingo.com' },
  { domain: 'instagram.com', redirect: 'https://www.codecademy.com' }
];

chrome.runtime.onInstalled.addListener(async () => {
  console.log('ReclaimFocus installed');
  
  const { blockedSites } = await chrome.storage.local.get('blockedSites');
  
  if (!blockedSites || blockedSites.length === 0) {
    await chrome.storage.local.set({
      blockedSites: DEFAULT_BLOCKED_SITES,
      logs: [],
      settings: {
        enabled: true,
        darkMode: false
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
    const { blockedSites, settings } = await chrome.storage.local.get(['blockedSites', 'settings']);
    
    if (!settings?.enabled) return;
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

// Log blocked attempt
async function logAttempt(url) {
  try {
    const { logs = [] } = await chrome.storage.local.get('logs');
    
    const newLog = {
      url: url,
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
