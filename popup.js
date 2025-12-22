let currentSettings = {
  blockedSites: [],
  blockedKeywords: [],
  timeLimitedSites: [],
  keywordSettings: { globalRedirect: 'about:newtab' },
  logs: [],
  settings: { enabled: true, darkMode: false },
  scheduledTasks: []
};

let editingIndex = null;
let editingKeywordIndex = null;
let editingTimeLimitIndex = null;
let editingTaskIndex = null;
let taskCountdownInterval = null;

// Restore draft input fields from storage
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
      
      const timeDomainInput = document.getElementById('timeDomain');
      const timeLimitInput = document.getElementById('timeLimit');
      const cooldownPeriodInput = document.getElementById('cooldownPeriod');
      const timeLimitRedirectInput = document.getElementById('timeLimitRedirect');
      
      if (draftInputs.timeDomain) {
        timeDomainInput.value = draftInputs.timeDomain;
      }
      if (draftInputs.timeLimit) {
        timeLimitInput.value = draftInputs.timeLimit;
      }
      if (draftInputs.cooldownPeriod) {
        cooldownPeriodInput.value = draftInputs.cooldownPeriod;
      }
      if (draftInputs.timeLimitRedirect) {
        timeLimitRedirectInput.value = draftInputs.timeLimitRedirect;
      }
      
      const taskUrlInput = document.getElementById('taskUrl');
      const taskTimeInput = document.getElementById('taskTime');
      const taskNameInput = document.getElementById('taskName');
      const taskNotificationCheckbox = document.getElementById('taskNotification');
      
      if (draftInputs.taskUrl) {
        taskUrlInput.value = draftInputs.taskUrl;
      }
      if (draftInputs.taskTime) {
        taskTimeInput.value = draftInputs.taskTime;
      }
      if (draftInputs.taskName) {
        taskNameInput.value = draftInputs.taskName;
      }
      if (draftInputs.taskNotification !== undefined) {
        taskNotificationCheckbox.checked = draftInputs.taskNotification;
      }
    }
  } catch (error) {
    console.error('Error restoring input fields:', error);
  }
}

// Save draft input values to storage
async function saveInputDrafts() {
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  const timeDomainInput = document.getElementById('timeDomain');
  const timeLimitInput = document.getElementById('timeLimit');
  const cooldownPeriodInput = document.getElementById('cooldownPeriod');
  const timeLimitRedirectInput = document.getElementById('timeLimitRedirect');
  
  const taskUrlInput = document.getElementById('taskUrl');
  const taskTimeInput = document.getElementById('taskTime');
  const taskNameInput = document.getElementById('taskName');
  const taskNotificationCheckbox = document.getElementById('taskNotification');
  
  const drafts = {
    domain: domainInput.value,
    redirect: redirectInput.value,
    keyword: keywordInput.value,
    keywordRedirect: keywordRedirectInput.value,
    timeDomain: timeDomainInput.value,
    timeLimit: timeLimitInput.value,
    cooldownPeriod: cooldownPeriodInput.value,
    timeLimitRedirect: timeLimitRedirectInput.value,
    taskUrl: taskUrlInput.value,
    taskTime: taskTimeInput.value,
    taskName: taskNameInput.value,
    taskNotification: taskNotificationCheckbox.checked
  };
  
  await chrome.storage.local.set({ draftInputs: drafts });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
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

// Load settings from storage
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get([
      'blockedSites', 
      'blockedKeywords',
      'keywordSettings',
      'timeLimitedSites',
      'scheduledTasks',
      'logs', 
      'settings', 
      'draftInputs'
    ]);
    currentSettings = {
      blockedSites: data.blockedSites || [],
      blockedKeywords: data.blockedKeywords || [],
      keywordSettings: data.keywordSettings || { globalRedirect: 'about:newtab' },
      timeLimitedSites: data.timeLimitedSites || [],
      scheduledTasks: data.scheduledTasks || [],
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
    } else {
      document.getElementById('themeToggle').textContent = '🌙';
    }
  } catch (error) {
    showStatus('Error loading settings', 'error');
  }
}

// Load and display blocked sites
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

// Load and display blocked keywords
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

// Load and display activity logs
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
    } else if (log.type === 'timelimit') {
      const timeInMinutes = Math.floor(log.timeUsed / 60);
      displayContent = `
        <div class="log-domain">Time Limit Exceeded: ${log.domain}</div>
        <div class="log-url">Time used: ${timeInMinutes} minutes</div>
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

// Update statistics display
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

// Setup all event listeners for UI elements
function setupEventListeners() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });
  
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
  
  document.getElementById('cancelKeywordEdit').addEventListener('click', () => {
    cancelKeywordEdit();
  });
  
  document.getElementById('addTimeLimitForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addTimeLimitSite();
  });
  
  document.getElementById('cancelTimeLimitEdit').addEventListener('click', () => {
    cancelTimeLimitEdit();
  });
  
  document.getElementById('addTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addTask();
  });
  
  document.getElementById('cancelTaskEdit').addEventListener('click', async () => {
    await cancelTaskEdit();
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
  
  document.getElementById('zenModeToggle').addEventListener('click', () => {
    // Open zen mode in a new tab
    chrome.tabs.create({ url: chrome.runtime.getURL('zenmode.html') });
  });
  
  const domainInput = document.getElementById('domain');
  const redirectInput = document.getElementById('redirect');
  const keywordInput = document.getElementById('keyword');
  const keywordRedirectInput = document.getElementById('keywordRedirect');
  const timeDomainInput = document.getElementById('timeDomain');
  const timeLimitInput = document.getElementById('timeLimit');
  const cooldownPeriodInput = document.getElementById('cooldownPeriod');
  const timeLimitRedirectInput = document.getElementById('timeLimitRedirect');
  
  domainInput.addEventListener('input', saveInputDrafts);
  redirectInput.addEventListener('input', saveInputDrafts);
  keywordInput.addEventListener('input', saveInputDrafts);
  keywordRedirectInput.addEventListener('input', saveInputDrafts);
  timeDomainInput.addEventListener('input', saveInputDrafts);
  timeLimitInput.addEventListener('input', saveInputDrafts);
  cooldownPeriodInput.addEventListener('input', saveInputDrafts);
  timeLimitRedirectInput.addEventListener('input', saveInputDrafts);
  
  const taskUrlInput = document.getElementById('taskUrl');
  const taskTimeInput = document.getElementById('taskTime');
  const taskNameInput = document.getElementById('taskName');
  const taskNotificationCheckbox = document.getElementById('taskNotification');
  
  taskUrlInput.addEventListener('input', saveInputDrafts);
  taskTimeInput.addEventListener('input', saveInputDrafts);
  taskNameInput.addEventListener('input', saveInputDrafts);
  taskNotificationCheckbox.addEventListener('change', saveInputDrafts);
  
  document.getElementById('clearLogs').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      await clearLogs();
    }
  });
  
  document.getElementById('exportLogs').addEventListener('click', exportLogs);
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

// Switch between tabs in the popup
function switchTab(tabName) {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(tabName).classList.add('active');
}

// Add or update a blocked site
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

// Cancel editing a blocked site
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

// Remove a blocked site
async function removeSite(index) {
  // If we're editing this item or an item after it, reset/adjust the editing index
  if (editingIndex !== null) {
    if (editingIndex === index) {
      // Removing the item being edited - cancel edit mode
      cancelEdit();
    } else if (editingIndex > index) {
      // Adjust index since we're removing an item before the one being edited
      editingIndex--;
    }
  }
  
  currentSettings.blockedSites.splice(index, 1);
  await chrome.storage.local.set({ blockedSites: currentSettings.blockedSites });
  
  await loadBlockedSites();
  
  chrome.runtime.sendMessage({ action: 'updateRules' });
  
  showStatus('Site removed successfully', 'success');
}

// Add or update a blocked keyword
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

// Edit an existing blocked keyword
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

// Cancel editing a blocked keyword
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

// Remove a blocked keyword
async function removeKeyword(index) {
  // If we're editing this item or an item after it, reset/adjust the editing index
  if (editingKeywordIndex !== null) {
    if (editingKeywordIndex === index) {
      // Removing the item being edited - cancel edit mode
      cancelKeywordEdit();
    } else if (editingKeywordIndex > index) {
      // Adjust index since we're removing an item before the one being edited
      editingKeywordIndex--;
    }
  }
  
  currentSettings.blockedKeywords.splice(index, 1);
  await chrome.storage.local.set({ blockedKeywords: currentSettings.blockedKeywords });
  
  await loadBlockedKeywords();
  
  showStatus('Keyword removed successfully', 'success');
}

// Update global redirect URL for keywords
async function updateGlobalRedirect() {
  const globalRedirectInput = document.getElementById('globalRedirect');
  const globalRedirect = globalRedirectInput.value.trim() || 'about:newtab';
  
  currentSettings.keywordSettings.globalRedirect = globalRedirect;
  
  await chrome.storage.local.set({ keywordSettings: currentSettings.keywordSettings });
  
  showStatus('Global redirect updated successfully', 'success');
}

// Load and display time-limited sites
async function loadTimeLimitedSites() {
  const container = document.getElementById('timeLimitedList');
  
  if (currentSettings.timeLimitedSites.length === 0) {
    container.innerHTML = '<div class="empty-state">No time-limited sites configured</div>';
    return;
  }
  
  container.innerHTML = currentSettings.timeLimitedSites.map((site, index) => {
    const redirectText = site.redirect ? site.redirect : 'about:newtab';
    return `
      <div class="blocked-item">
        <div class="blocked-info">
          <div class="blocked-domain">${site.domain}</div>
          <div class="blocked-redirect">Time: ${site.timeLimit} min | Cooldown: ${site.cooldown} min | Redirect: ${redirectText}</div>
        </div>
        <div class="blocked-actions">
          <button class="btn btn-secondary btn-small edit-time-btn" data-index="${index}">Edit</button>
          <button class="btn btn-danger btn-small remove-time-btn" data-index="${index}">Remove</button>
        </div>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.edit-time-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      editTimeLimitSite(index);
    });
  });
  
  container.querySelectorAll('.remove-time-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      removeTimeLimitSite(index);
    });
  });
}

// Add or update a time-limited site
async function addTimeLimitSite() {
  const timeDomainInput = document.getElementById('timeDomain');
  const timeLimitInput = document.getElementById('timeLimit');
  const cooldownPeriodInput = document.getElementById('cooldownPeriod');
  const timeLimitRedirectInput = document.getElementById('timeLimitRedirect');
  
  let domain = timeDomainInput.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  domain = domain.replace(/^www\./, '');
  
  const timeLimit = parseInt(timeLimitInput.value);
  const cooldown = parseInt(cooldownPeriodInput.value);
  const redirect = timeLimitRedirectInput.value.trim();
  
  if (!domain) {
    showStatus('Please enter a domain', 'error');
    return;
  }
  
  if (!timeLimit || timeLimit < 1) {
    showStatus('Please enter a valid time limit (minimum 1 minute)', 'error');
    return;
  }
  
  if (!cooldown || cooldown < 1) {
    showStatus('Please enter a valid cooldown period (minimum 1 minute)', 'error');
    return;
  }
  
  if (editingTimeLimitIndex !== null) {
    const existingIndex = currentSettings.timeLimitedSites.findIndex((item, idx) => 
      item.domain === domain && idx !== editingTimeLimitIndex
    );
    
    if (existingIndex !== -1) {
      showStatus('This domain is already configured with time limits', 'error');
      return;
    }
    
    currentSettings.timeLimitedSites[editingTimeLimitIndex] = { domain, timeLimit, cooldown, redirect };
    showStatus('Time-limited site updated successfully', 'success');
    cancelTimeLimitEdit();
  } else {
    const existingIndex = currentSettings.timeLimitedSites.findIndex(
      item => item.domain === domain
    );
    
    if (existingIndex !== -1) {
      showStatus('This domain is already configured with time limits', 'error');
      return;
    }
    
    currentSettings.timeLimitedSites.push({ domain, timeLimit, cooldown, redirect });
    showStatus('Time-limited site added successfully', 'success');
  }
  
  await chrome.storage.local.set({ timeLimitedSites: currentSettings.timeLimitedSites });
  
  await loadTimeLimitedSites();
  
  timeDomainInput.value = '';
  timeLimitInput.value = '';
  cooldownPeriodInput.value = '';
  timeLimitRedirectInput.value = '';
  
  chrome.storage.local.set({ draftInputs: { timeDomain: '', timeLimit: '', cooldownPeriod: '', timeLimitRedirect: '' } });
}

// Edit an existing time-limited site
function editTimeLimitSite(index) {
  const site = currentSettings.timeLimitedSites[index];
  
  document.getElementById('timeDomain').value = site.domain;
  document.getElementById('timeLimit').value = site.timeLimit;
  document.getElementById('cooldownPeriod').value = site.cooldown;
  document.getElementById('timeLimitRedirect').value = site.redirect || '';
  
  editingTimeLimitIndex = index;
  
  const submitBtn = document.querySelector('#addTimeLimitForm button[type="submit"]');
  submitBtn.textContent = 'Update Site';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-warning');
  
  const cancelBtn = document.getElementById('cancelTimeLimitEdit');
  cancelBtn.style.display = 'inline-block';
  
  showStatus('Changes will apply to the next session. Current timer (if active) is unaffected.', 'info');
  
  document.getElementById('timeDomain').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Cancel editing a time-limited site
function cancelTimeLimitEdit() {
  editingTimeLimitIndex = null;
  
  const timeDomainInput = document.getElementById('timeDomain');
  const timeLimitInput = document.getElementById('timeLimit');
  const cooldownPeriodInput = document.getElementById('cooldownPeriod');
  const timeLimitRedirectInput = document.getElementById('timeLimitRedirect');
  
  timeDomainInput.value = '';
  timeLimitInput.value = '';
  cooldownPeriodInput.value = '';
  timeLimitRedirectInput.value = '';
  
  const submitBtn = document.querySelector('#addTimeLimitForm button[type="submit"]');
  submitBtn.textContent = 'Add Site';
  submitBtn.classList.remove('btn-warning');
  submitBtn.classList.add('btn-primary');
  
  const cancelBtn = document.getElementById('cancelTimeLimitEdit');
  cancelBtn.style.display = 'none';
  
  chrome.storage.local.set({ draftInputs: { timeDomain: '', timeLimit: '', cooldownPeriod: '', timeLimitRedirect: '' } });
}

// Remove a time-limited site
async function removeTimeLimitSite(index) {
  const site = currentSettings.timeLimitedSites[index];
  const domain = site.domain.replace(/^www\./, '');
  
  if (!confirm(`Remove time limit for ${site.domain}? This will stop any active timer and clear cooldown.`)) {
    return;
  }
  
  // If we're editing this item or an item after it, reset/adjust the editing index
  if (editingTimeLimitIndex !== null) {
    if (editingTimeLimitIndex === index) {
      // Removing the item being edited - cancel edit mode
      cancelTimeLimitEdit();
    } else if (editingTimeLimitIndex > index) {
      // Adjust index since we're removing an item before the one being edited
      editingTimeLimitIndex--;
    }
  }
  
  currentSettings.timeLimitedSites.splice(index, 1);
  await chrome.storage.local.set({ timeLimitedSites: currentSettings.timeLimitedSites });
  
  try {
    await chrome.runtime.sendMessage({
      action: 'cleanupTimeLimitedSite',
      domain: domain
    });
  } catch (error) {
    console.error('Error cleaning up timer:', error);
  }
  
  await loadTimeLimitedSites();
  
  showStatus('Time-limited site removed successfully', 'success');
}

// Clear all activity logs
async function clearLogs() {
  currentSettings.logs = [];
  await chrome.storage.local.set({ logs: [] });
  await loadLogs();
  updateStats();
  
  chrome.runtime.sendMessage({ action: 'clearBadge' });
  
  showStatus('Logs cleared successfully', 'success');
}

// Export logs to JSON file
function exportLogs() {
  const data = {
    logs: currentSettings.logs,
    exportDate: new Date().toISOString()
  };
  
  downloadJSON(data, `ReclaimFocus-logs-${Date.now()}.json`);
  showStatus('Logs exported successfully', 'success');
}

// Export settings to JSON file
function exportSettings() {
  const data = {
    blockedSites: currentSettings.blockedSites,
    blockedKeywords: currentSettings.blockedKeywords,
    keywordSettings: currentSettings.keywordSettings,
    timeLimitedSites: currentSettings.timeLimitedSites,
    settings: currentSettings.settings,
    exportDate: new Date().toISOString()
  };
  
  downloadJSON(data, `ReclaimFocus-settings-${Date.now()}.json`);
  showStatus('Settings exported successfully', 'success');
}

// Import settings from JSON file
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
    
    if (data.timeLimitedSites) {
      currentSettings.timeLimitedSites = data.timeLimitedSites;
      await chrome.storage.local.set({ timeLimitedSites: data.timeLimitedSites });
      await loadTimeLimitedSites();
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

// Reset all settings to defaults
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
  currentSettings.timeLimitedSites = [];
  currentSettings.settings = { enabled: true, darkMode: false };
  
  await chrome.storage.local.set({
    blockedSites: defaultSites,
    blockedKeywords: [],
    keywordSettings: { globalRedirect: 'about:newtab' },
    timeLimitedSites: [],
    settings: currentSettings.settings
  });
  
  await loadSettings();
  await loadBlockedSites();
  await loadBlockedKeywords();
  await loadTimeLimitedSites();
  
  chrome.runtime.sendMessage({ action: 'updateRules' });
  
  showStatus('Reset to default settings', 'success');
}

// Download data as JSON file
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Show status message to user
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.style.display = 'block';
  
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 3000);
}

// Listen for storage changes
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

let timerUpdateInterval = null;

// Start polling for timer updates
function startTimerUpdates() {
  updateTimerDisplay();
  timerUpdateInterval = setInterval(updateTimerDisplay, 1000);
}

// Update timer display in popup
async function updateTimerDisplay() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTimerStatus' });
    
    const timerCard = document.getElementById('activeTimerCard');
    const timerDisplay = document.getElementById('timerDisplay');
    const timerDomain = document.getElementById('timerDomain');
    const timerStatusText = document.getElementById('timerStatusText');
    
    if (response.timerData) {
      const { domain, minutesRemaining, secondsRemaining, isPaused } = response.timerData;
      
      timerCard.style.display = 'block';
      timerDomain.textContent = domain;
      
      const formattedTime = `${String(minutesRemaining).padStart(2, '0')}:${String(secondsRemaining).padStart(2, '0')}`;
      timerDisplay.textContent = formattedTime;
      
      if (isPaused) {
        timerCard.style.background = 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)';
        timerStatusText.textContent = 'Paused';
      } else {
        if (minutesRemaining === 0 && secondsRemaining <= 30) {
          timerCard.style.background = 'linear-gradient(135deg, #ef5350 0%, #e53935 100%)';
          timerStatusText.textContent = 'Critical';
        } else if (minutesRemaining < 2) {
          timerCard.style.background = 'linear-gradient(135deg, #ff7043 0%, #f4511e 100%)';
          timerStatusText.textContent = 'Low Time';
        } else {
          timerCard.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
          timerStatusText.textContent = 'Active';
        }
      }
    } else {
      timerCard.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating timer display:', error);
  }
}

window.addEventListener('beforeunload', () => {
  if (timerUpdateInterval) {
    clearInterval(timerUpdateInterval);
  }
  if (taskCountdownInterval) {
    clearInterval(taskCountdownInterval);
  }
});

// ========== TASK SCHEDULING FUNCTIONS ==========

// Load and display scheduled tasks
async function loadScheduledTasks() {
  const container = document.getElementById('tasksList');
  
  if (!currentSettings.scheduledTasks || currentSettings.scheduledTasks.length === 0) {
    container.innerHTML = '<p class="empty-state">No scheduled tasks yet. Create one above!</p>';
    return;
  }
  
  // Sort by scheduled time
  const sortedTasks = [...currentSettings.scheduledTasks].sort((a, b) => 
    new Date(a.scheduledTime) - new Date(b.scheduledTime)
  );
  
  container.innerHTML = sortedTasks.map((task, index) => {
    const scheduledDate = new Date(task.scheduledTime);
    const now = new Date();
    const isPast = scheduledDate < now;
    const timeRemaining = getTimeRemaining(scheduledDate);
    
    return `
      <div class="task-card">
        <div class="task-info">
          <div class="task-name">
            ${task.name || 'Scheduled Task'}
            ${isPast ? '<span class="task-badge past">PAST</span>' : '<span class="task-badge">SCHEDULED</span>'}
          </div>
          <div class="task-url">${task.url}</div>
          <div class="task-time">
            <span class="task-time-icon">⏰</span>
            ${scheduledDate.toLocaleString()}
            ${!isPast ? `<span class="task-countdown ${timeRemaining.urgent ? 'urgent' : ''}">(${timeRemaining.text})</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="btn btn-small btn-secondary edit-task-btn" data-index="${index}" title="Edit Task">✏️</button>
          <button class="btn btn-small btn-danger remove-task-btn" data-index="${index}" title="Delete Task">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Attach event listeners
  container.querySelectorAll('.edit-task-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      editTask(index);
    });
  });
  
  container.querySelectorAll('.remove-task-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      removeTask(index);
    });
  });
}

// Get time remaining until scheduled time
function getTimeRemaining(scheduledDate) {
  const now = new Date();
  const diffMs = scheduledDate - now;
  
  if (diffMs < 0) {
    return { text: 'Past', urgent: false };
  }
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  let text;
  let urgent = false;
  
  if (diffMins < 60) {
    text = `in ${diffMins}m`;
    urgent = diffMins < 15;
  } else if (diffHours < 24) {
    text = `in ${diffHours}h ${diffMins % 60}m`;
    urgent = diffHours < 1;
  } else {
    text = `in ${diffDays}d ${diffHours % 24}h`;
  }
  
  return { text, urgent };
}

// Add or update a scheduled task
async function addTask() {
  const urlInput = document.getElementById('taskUrl');
  const timeInput = document.getElementById('taskTime');
  const nameInput = document.getElementById('taskName');
  const notificationCheckbox = document.getElementById('taskNotification');
  
  const url = urlInput.value.trim();
  const scheduledTime = timeInput.value;
  const name = nameInput.value.trim();
  const showNotification = notificationCheckbox.checked;
  
  if (!url || !scheduledTime) {
    showStatus('Please fill in URL and time', 'error');
    return;
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    showStatus('Please enter a valid URL', 'error');
    return;
  }
  
  const scheduledDate = new Date(scheduledTime);
  const now = new Date();
  
  if (scheduledDate < now) {
    showStatus('Cannot schedule tasks in the past', 'error');
    return;
  }
  
  const task = {
    id: editingTaskIndex !== null ? currentSettings.scheduledTasks[editingTaskIndex].id : Date.now(),
    url,
    scheduledTime: scheduledDate.toISOString(),
    name: name || 'Scheduled Task',
    showNotification,
    createdAt: editingTaskIndex !== null ? currentSettings.scheduledTasks[editingTaskIndex].createdAt : new Date().toISOString()
  };
  
  if (editingTaskIndex !== null) {
    currentSettings.scheduledTasks[editingTaskIndex] = task;
    showStatus('Task updated successfully', 'success');
    editingTaskIndex = null;
    document.getElementById('cancelTaskEdit').style.display = 'none';
  } else {
    currentSettings.scheduledTasks.push(task);
    showStatus('Task scheduled successfully', 'success');
  }
  
  await chrome.storage.local.set({ scheduledTasks: currentSettings.scheduledTasks });
  
  // Create or update the alarm
  await chrome.runtime.sendMessage({ 
    action: 'scheduleTask', 
    task 
  });
  
  // Clear form
  urlInput.value = '';
  timeInput.value = '';
  nameInput.value = '';
  notificationCheckbox.checked = true;
  
  // Clear draft inputs from storage
  const { draftInputs } = await chrome.storage.local.get('draftInputs');
  if (draftInputs) {
    draftInputs.taskUrl = '';
    draftInputs.taskTime = '';
    draftInputs.taskName = '';
    draftInputs.taskNotification = true;
    await chrome.storage.local.set({ draftInputs });
  }
  
  await loadScheduledTasks();
}

// Edit a scheduled task
function editTask(index) {
  const task = currentSettings.scheduledTasks[index];
  
  document.getElementById('taskUrl').value = task.url;
  document.getElementById('taskName').value = task.name;
  document.getElementById('taskNotification').checked = task.showNotification;
  
  // Convert ISO string to datetime-local format
  const date = new Date(task.scheduledTime);
  const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  document.getElementById('taskTime').value = localDateTime;
  
  editingTaskIndex = index;
  document.getElementById('cancelTaskEdit').style.display = 'inline-block';
  
  // Switch to tasks tab and scroll to form
  switchTab('tasks');
  document.getElementById('addTaskForm').scrollIntoView({ behavior: 'smooth' });
}

// Cancel task editing
async function cancelTaskEdit() {
  editingTaskIndex = null;
  document.getElementById('taskUrl').value = '';
  document.getElementById('taskTime').value = '';
  document.getElementById('taskName').value = '';
  document.getElementById('taskNotification').checked = true;
  document.getElementById('cancelTaskEdit').style.display = 'none';
  
  // Clear draft inputs from storage
  const { draftInputs } = await chrome.storage.local.get('draftInputs');
  if (draftInputs) {
    draftInputs.taskUrl = '';
    draftInputs.taskTime = '';
    draftInputs.taskName = '';
    draftInputs.taskNotification = true;
    await chrome.storage.local.set({ draftInputs });
  }
}

// Remove a scheduled task
async function removeTask(index) {
  if (!confirm('Are you sure you want to delete this task?')) {
    return;
  }
  
  const task = currentSettings.scheduledTasks[index];
  
  // Cancel the alarm
  await chrome.runtime.sendMessage({ 
    action: 'cancelTask', 
    taskId: task.id 
  });
  
  currentSettings.scheduledTasks.splice(index, 1);
  await chrome.storage.local.set({ scheduledTasks: currentSettings.scheduledTasks });
  
  showStatus('Task deleted', 'success');
  await loadScheduledTasks();
  
  if (editingTaskIndex === index) {
    await cancelTaskEdit();
  } else if (editingTaskIndex > index) {
    editingTaskIndex--;
  }
}

// Start countdown updates for tasks
function startTaskCountdowns() {
  if (taskCountdownInterval) {
    clearInterval(taskCountdownInterval);
  }
  
  taskCountdownInterval = setInterval(() => {
    const countdowns = document.querySelectorAll('.task-countdown');
    if (countdowns.length > 0) {
      loadScheduledTasks();
    }
  }, 30000); // Update every 30 seconds
}
