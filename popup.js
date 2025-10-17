let currentSettings = {
  blockedSites: [],
  blockedKeywords: [],
  keywordSettings: { globalRedirect: 'about:newtab' },
  logs: [],
  settings: { enabled: true, darkMode: false }
};

let editingIndex = null;
let editingKeywordIndex = null;

async function restoreInputFields() {
  try {
    const { draftInputs } = await chrome.storage.local.get('draftInputs');
    
    if (draftInputs) {
      const domainInput = document.getElementById('domain');
      const redirectInput = document.getElementById('redirect');
      const keywordInput = document.getElementById('keyword');
      const keywordRedirectInput = document.getElementById('keywordRedirect');
      
      if (draftInputs.domain) {
        domainInput.value = draftInputs.domain;
      }
      if (draftInputs.redirect) {
        redirectInput.value = draftInputs.redirect;
      }
      if (draftInputs.keyword) {
        keywordInput.value = draftInputs.keyword;
      }
      if (draftInputs.keywordRedirect) {
        keywordRedirectInput.value = draftInputs.keywordRedirect;
      }
    }
  } catch (error) {
    console.error('Error restoring input fields:', error);
  }
}

async function saveInputDrafts() {
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  
  const drafts = {
    domain: domainInput.value,
    redirect: redirectInput.value,
    keyword: keywordInput.value,
    keywordRedirect: keywordRedirectInput.value
  };
  
  await chrome.storage.local.set({ draftInputs: drafts });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadBlockedSites();
  await loadBlockedKeywords();
  await loadLogs();
  await restoreInputFields();
  setupEventListeners();
  updateStats();
});

async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      'blockedSites', 
      'blockedKeywords',
      'keywordSettings',
      'logs', 
      'settings', 
      'draftInputs'
    ]);
    currentSettings = {
      blockedSites: data.blockedSites || [],
      blockedKeywords: data.blockedKeywords || [],
      keywordSettings: data.keywordSettings || { globalRedirect: 'about:newtab' },
      logs: data.logs || [],
      settings: data.settings || { enabled: true, darkMode: false }
    };
    
    document.getElementById('enableToggle').checked = currentSettings.settings.enabled;
    
    const globalRedirectInput = document.getElementById('globalRedirect');
    if (globalRedirectInput) {
      globalRedirectInput.value = currentSettings.keywordSettings.globalRedirect || 'about:newtab';
    }
    
    if (currentSettings.settings.darkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('themeToggle').textContent = '☀️';
    }
  } catch (error) {
    showStatus('Error loading settings', 'error');
  }
}

async function loadBlockedSites() {
  const container = document.getElementById('blockedList');
  
  if (currentSettings.blockedSites.length === 0) {
    container.innerHTML = '<p class="empty-state">No blocked sites yet. Add one above!</p>';
    return;
  }
  
  container.innerHTML = currentSettings.blockedSites.map((site, index) => `
    <div class="blocked-item">
      <div class="blocked-info">
        <div class="blocked-domain">${site.domain}</div>
        <div class="blocked-redirect">${site.redirect}</div>
      </div>
      <div class="blocked-actions">
        <button class="btn btn-secondary btn-small edit-btn" data-index="${index}">Edit</button>
        <button class="btn btn-danger btn-small remove-btn" data-index="${index}">Remove</button>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      editSite(index);
    });
  });
  
  container.querySelectorAll('.remove-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      removeSite(index);
    });
  });
}

async function loadBlockedKeywords() {
  const container = document.getElementById('keywordList');
  
  if (currentSettings.blockedKeywords.length === 0) {
    container.innerHTML = '<p class="empty-state">No blocked keywords yet. Add one above!</p>';
    return;
  }
  
  container.innerHTML = currentSettings.blockedKeywords.map((item, index) => {
    const redirectText = item.redirect || `<em>Uses global redirect</em>`;
    return `
      <div class="blocked-item">
        <div class="blocked-info">
          <div class="blocked-domain">${item.keyword}</div>
          <div class="blocked-redirect">${redirectText}</div>
        </div>
        <div class="blocked-actions">
          <button class="btn btn-secondary btn-small edit-keyword-btn" data-index="${index}">Edit</button>
          <button class="btn btn-danger btn-small remove-keyword-btn" data-index="${index}">Remove</button>
        </div>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.edit-keyword-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      editKeyword(index);
    });
  });
  
  container.querySelectorAll('.remove-keyword-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      removeKeyword(index);
    });
  });
}

async function loadLogs() {
  const container = document.getElementById('logsList');
  
  if (currentSettings.logs.length === 0) {
    container.innerHTML = '<p class="empty-state">No blocked attempts logged yet.</p>';
    return;
  }
  
  container.innerHTML = currentSettings.logs.slice(0, 50).map(log => {
    const date = new Date(log.timestamp);
    const formattedDate = date.toLocaleString();
    
    let displayContent;
    if (log.type === 'keyword') {
      displayContent = `
        <div class="log-domain">Keyword: "${log.keyword}"</div>
        <div class="log-url">${log.url}</div>
      `;
    } else {
      const domain = new URL(log.url).hostname;
      displayContent = `
        <div class="log-domain">${domain}</div>
        <div class="log-url">${log.url}</div>
      `;
    }
    
    return `
      <div class="log-item">
        ${displayContent}
        <div class="log-time">${formattedDate}</div>
      </div>
    `;
  }).join('');
}

function updateStats() {
  const totalAttempts = currentSettings.logs.length;
  document.getElementById('totalAttempts').textContent = totalAttempts;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayAttempts = currentSettings.logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= today;
  }).length;
  
  document.getElementById('todayAttempts').textContent = todayAttempts;
}

function setupEventListeners() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });
  
  // Add site form
  document.getElementById('addSiteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addSite();
  });
  
  // Add keyword form
  document.getElementById('addKeywordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addKeyword();
  });
  
  document.getElementById('globalRedirectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateGlobalRedirect();
  });
  
  document.getElementById('cancelKeywordEdit').addEventListener('click', () => {
    cancelKeywordEdit();
  });
  
  document.getElementById('enableToggle').addEventListener('change', async (e) => {
    currentSettings.settings.enabled = e.target.checked;
    await chrome.storage.local.set({ settings: currentSettings.settings });
    showStatus(e.target.checked ? 'Extension enabled' : 'Extension disabled', 'success');
  });
  
  document.getElementById('themeToggle').addEventListener('click', async () => {
    currentSettings.settings.darkMode = !currentSettings.settings.darkMode;
    document.body.classList.toggle('dark-mode');
    document.getElementById('themeToggle').textContent = currentSettings.settings.darkMode ? '☀️' : '🌙';
    await chrome.storage.local.set({ settings: currentSettings.settings });
  });
  
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  
  domainInput.addEventListener('input', saveInputDrafts);
  redirectInput.addEventListener('input', saveInputDrafts);
  keywordInput.addEventListener('input', saveInputDrafts);
  keywordRedirectInput.addEventListener('input', saveInputDrafts);
  
  // Clear logs
  document.getElementById('clearLogs').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      await clearLogs();
    }
  });
  
  // Export logs
  document.getElementById('exportLogs').addEventListener('click', exportLogs);
  
  // Export settings
  document.getElementById('exportSettings').addEventListener('click', exportSettings);
  
  document.getElementById('importSettings').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  document.getElementById('importFile').addEventListener('change', importSettings);
  
  document.getElementById('resetSettings').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset to default settings?')) {
      await resetToDefaults();
    }
  });
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');
}

async function addSite() {
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  
  let domain = domainInput.value.trim().toLowerCase();
  const redirect = redirectInput.value.trim();
  
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  domain = domain.replace(/\/.*$/, '');
  
  if (!domain || !redirect) {
    showStatus('Please fill in all fields', 'error');
    return;
  }
  
  if (editingIndex !== null) {
    const existingIndex = currentSettings.blockedSites.findIndex((site, idx) => 
      site.domain === domain && idx !== editingIndex
    );
    
    if (existingIndex !== -1) {
      showStatus('This domain is already blocked', 'error');
      return;
    }
    
    currentSettings.blockedSites[editingIndex] = { domain, redirect };
    await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
    
    await loadBlockedSites();
    cancelEdit();
    
    chrome.runtime.sendMessage({ action: 'updateRules' });
    
    showStatus('Site updated successfully', 'success');
  } else {
    if (currentSettings.blockedSites.some(site => site.domain === domain)) {
      showStatus('This domain is already blocked', 'error');
      return;
    }
    
    currentSettings.blockedSites.push({ domain, redirect });
    await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
    
    await loadBlockedSites();
    domainInput.value = '';
    redirectInput.value = '';
    
    await chrome.storage.local.set({ draftInputs: { domain: '', redirect: '' } });
    
    chrome.runtime.sendMessage({ action: 'updateRules' });
    
    showStatus('Site added successfully', 'success');
  }
}

// Edit an existing blocked site
function editSite(index) {
  const site = currentSettings.blockedSites[index];
  
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  const submitBtn = document.querySelector('#addSiteForm button[type="submit"]');
  const formTitle = document.querySelector('#blocked-sites .section h2');
  
  domainInput.value = site.domain;
  redirectInput.value = site.redirect;
  
  editingIndex = index;
  
  submitBtn.textContent = 'Update Website';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-warning');
  
  formTitle.textContent = 'Edit Blocked Website';
  
  const cancelBtn = document.getElementById('cancelEdit');
  if (!cancelBtn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cancelEdit';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Cancel';
    btn.addEventListener('click', cancelEdit);
    submitBtn.parentElement.appendChild(btn);
  }
  
  domainInput.focus();
  domainInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingIndex = null;
  
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  const submitBtn = document.querySelector('#addSiteForm button[type="submit"]');
  const formTitle = document.querySelector('#blocked-sites .section h2');
  const cancelBtn = document.getElementById('cancelEdit');
  
  domainInput.value = '';
  redirectInput.value = '';
  
  submitBtn.textContent = 'Add Website';
  submitBtn.classList.remove('btn-warning');
  submitBtn.classList.add('btn-primary');
  
  formTitle.textContent = 'Add Blocked Website';
  
  if (cancelBtn) {
    cancelBtn.remove();
  }
  
  chrome.storage.local.set({ draftInputs: { domain: '', redirect: '' } });
}

async function removeSite(index) {
  currentSettings.blockedSites.splice(index, 1);
  await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
  
  await loadBlockedSites();
  
  chrome.runtime.sendMessage({ action: 'updateRules' });
  
  showStatus('Site removed successfully', 'success');
}

async function addKeyword() {
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  
  const keyword = keywordInput.value.trim();
  const redirect = keywordRedirectInput.value.trim();
  
  if (!keyword) {
    showStatus('Please enter a keyword', 'error');
    return;
  }
  
  if (editingKeywordIndex !== null) {
    const existingIndex = currentSettings.blockedKeywords.findIndex((item, idx) => 
      item.keyword.toLowerCase() === keyword.toLowerCase() && idx !== editingKeywordIndex
    );
    
    if (existingIndex !== -1) {
      showStatus('This keyword is already blocked', 'error');
      return;
    }
    
    currentSettings.blockedKeywords[editingKeywordIndex] = { keyword, redirect };
    showStatus('Keyword updated successfully', 'success');
    cancelKeywordEdit();
  } else {
    const existingIndex = currentSettings.blockedKeywords.findIndex(
      item => item.keyword.toLowerCase() === keyword.toLowerCase()
    );
    
    if (existingIndex !== -1) {
      showStatus('This keyword is already blocked', 'error');
      return;
    }
    
    currentSettings.blockedKeywords.push({ keyword, redirect });
    showStatus('Keyword added successfully', 'success');
    
    keywordInput.value = '';
    keywordRedirectInput.value = '';
  }
  
  await chrome.storage.local.set({ 
    blockedKeywords: currentSettings.blockedKeywords,
    draftInputs: { keyword: '', keywordRedirect: '' }
  });
  
  await loadBlockedKeywords();
}

function editKeyword(index) {
  const item = currentSettings.blockedKeywords[index];
  
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  const submitBtn = document.querySelector('#addKeywordForm button[type="submit"]');
  const formTitle = document.querySelector('#blocked-keywords .section h2');
  const cancelBtn = document.getElementById('cancelKeywordEdit');
  
  keywordInput.value = item.keyword;
  keywordRedirectInput.value = item.redirect || '';
  
  editingKeywordIndex = index;
  
  submitBtn.textContent = 'Update Keyword';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-warning');
  
  formTitle.textContent = 'Edit Blocked Keyword';
  cancelBtn.style.display = 'inline-block';
  
  keywordInput.focus();
  keywordInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelKeywordEdit() {
  editingKeywordIndex = null;
  
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  const submitBtn = document.querySelector('#addKeywordForm button[type="submit"]');
  const formTitle = document.querySelector('#blocked-keywords .section h2');
  const cancelBtn = document.getElementById('cancelKeywordEdit');
  
  keywordInput.value = '';
  keywordRedirectInput.value = '';
  
  submitBtn.textContent = 'Add Keyword';
  submitBtn.classList.remove('btn-warning');
  submitBtn.classList.add('btn-primary');
  
  formTitle.textContent = 'Add Blocked Keyword';
  cancelBtn.style.display = 'none';
  
  chrome.storage.local.set({ draftInputs: { keyword: '', keywordRedirect: '' } });
}

async function removeKeyword(index) {
  currentSettings.blockedKeywords.splice(index, 1);
  await chrome.storage.local.set({ blockedKeywords: currentSettings.blockedKeywords });
  
  await loadBlockedKeywords();
  
  showStatus('Keyword removed successfully', 'success');
}

async function updateGlobalRedirect() {
  const globalRedirectInput = document.getElementById('globalRedirect');
  const globalRedirect = globalRedirectInput.value.trim() || 'about:newtab';
  
  currentSettings.keywordSettings.globalRedirect = globalRedirect;
  
  await chrome.storage.local.set({ keywordSettings: currentSettings.keywordSettings });
  
  showStatus('Global redirect updated successfully', 'success');
}

// Clear all logs
async function clearLogs() {
  currentSettings.logs = [];
  await chrome.storage.local.set({ logs: [] });
  await loadLogs();
  updateStats();
  
  chrome.runtime.sendMessage({ action: 'clearBadge' });
  
  showStatus('Logs cleared successfully', 'success');
}

// Export logs as JSON
function exportLogs() {
  const data = {
    logs: currentSettings.logs,
    exportDate: new Date().toISOString()
  };
  
  downloadJSON(data, `ReclaimFocus-logs-${Date.now()}.json`);
  showStatus('Logs exported successfully', 'success');
}

function exportSettings() {
  const data = {
    blockedSites: currentSettings.blockedSites,
    blockedKeywords: currentSettings.blockedKeywords,
    keywordSettings: currentSettings.keywordSettings,
    settings: currentSettings.settings,
    exportDate: new Date().toISOString()
  };
  
  downloadJSON(data, `ReclaimFocus-settings-${Date.now()}.json`);
  showStatus('Settings exported successfully', 'success');
}

async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.blockedSites) {
      currentSettings.blockedSites = data.blockedSites;
      await chrome.storage.local.set({ blockedSites: data.blockedSites });
      await loadBlockedSites();
      chrome.runtime.sendMessage({ action: 'updateRules' });
    }
    
    if (data.blockedKeywords) {
      currentSettings.blockedKeywords = data.blockedKeywords;
      await chrome.storage.local.set({ blockedKeywords: data.blockedKeywords });
      await loadBlockedKeywords();
    }
    
    if (data.keywordSettings) {
      currentSettings.keywordSettings = data.keywordSettings;
      await chrome.storage.local.set({ keywordSettings: data.keywordSettings });
    }
    
    if (data.settings) {
      currentSettings.settings = { ...currentSettings.settings, ...data.settings };
      await chrome.storage.local.set({ settings: currentSettings.settings });
      await loadSettings();
    }
    
    showStatus('Settings imported successfully', 'success');
  } catch (error) {
    showStatus('Error importing settings: Invalid file', 'error');
  }
  
  event.target.value = '';
}

async function resetToDefaults() {
  const defaultSites = [
    { domain: 'facebook.com', redirect: 'https://www.khanacademy.org' },
    { domain: 'youtube.com', redirect: 'https://www.calm.com' },
    { domain: 'twitter.com', redirect: 'https://www.duolingo.com' },
    { domain: 'instagram.com', redirect: 'https://www.codecademy.com' }
  ];
  
  currentSettings.blockedSites = defaultSites;
  currentSettings.blockedKeywords = [];
  currentSettings.keywordSettings = { globalRedirect: 'about:newtab' };
  currentSettings.settings = { enabled: true, darkMode: false };
  
  await chrome.storage.local.set({
    blockedSites: defaultSites,
    blockedKeywords: [],
    keywordSettings: { globalRedirect: 'about:newtab' },
    settings: currentSettings.settings
  });
  
  await loadSettings();
  await loadBlockedSites();
  await loadBlockedKeywords();
  
  chrome.runtime.sendMessage({ action: 'updateRules' });
  
  showStatus('Reset to default settings', 'success');
}

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
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local') {
    if (changes.blockedSites) {
      currentSettings.blockedSites = changes.blockedSites.newValue || [];
      await loadBlockedSites();
    }
    if (changes.logs) {
      currentSettings.logs = changes.logs.newValue || [];
      await loadLogs();
      updateStats();
    }
  }
});
