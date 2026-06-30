// ============================================
// ReclaimFocus – Redirect Interstitial Logic
// ============================================

(() => {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason') || 'blocked';
  const label  = params.get('label')  || 'You were redirected';
  const target = params.get('target') || 'about:newtab';
  const from   = params.get('from')   || '';

  const COUNTDOWN = 4;

  // ── Accent colors per reason (match extension's oklch palette) ──
  const glowColors = {
    blocked:   'oklch(50% 0.2 28 / 0.15)',
    keyword:   'oklch(70% 0.15 72 / 0.15)',
    cooldown:  'oklch(50% 0.2 28 / 0.15)',
    timelimit: 'oklch(45% 0.16 255 / 0.15)'
  };

  const accentColors = {
    blocked:   'oklch(50% 0.2 28)',
    keyword:   'oklch(70% 0.15 72)',
    cooldown:  'oklch(50% 0.2 28)',
    timelimit: 'oklch(45% 0.16 255)'
  };

  // Apply accent
  const root = document.documentElement.style;
  root.setProperty('--accent', accentColors[reason] || accentColors.blocked);
  root.setProperty('--accent-glow', glowColors[reason] || glowColors.blocked);
  root.setProperty('--countdown-duration', COUNTDOWN + 's');

  // ── Reason pill ──
  const pillEl = document.getElementById('reasonPill');
  const pillLabels = {
    blocked:   'Site Blocked',
    keyword:   'Keyword Detected',
    cooldown:  'Cooldown Active',
    timelimit: 'Time Limit Reached'
  };
  const pillIcons = {
    blocked:   '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    keyword:   '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    cooldown:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    timelimit: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  };
  pillEl.className = 'reason-pill ' + reason;
  pillEl.innerHTML = (pillIcons[reason] || pillIcons.blocked) + ' ' + (pillLabels[reason] || 'Blocked');

  // ── Title ──
  const titles = {
    blocked:   'This site is blocked',
    keyword:   'Blocked keyword detected',
    cooldown:  'This site is in cooldown',
    timelimit: 'Your time limit is up'
  };
  document.getElementById('title').textContent = titles[reason] || 'Reclaim Focus Protected You';

  // ── Message ──
  document.getElementById('message').textContent = label;

  // ── Meta (from / to) ──
  const metaEl = document.getElementById('meta');
  let metaHtml = '';

  if (from) {
    let fromDisplay = from;
    try { fromDisplay = new URL(from).hostname.replace(/^www\./, ''); } catch (_) {}
    metaHtml += '<div class="meta-row"><span class="meta-label">From</span><span class="meta-value">' + escapeHtml(fromDisplay) + '</span></div>';
  }

  if (target && target !== 'about:newtab') {
    let targetDisplay = target;
    try { targetDisplay = new URL(target).hostname.replace(/^www\./, ''); } catch (_) {}
    metaHtml += '<div class="meta-row"><span class="meta-label">To</span><span class="meta-value">' + escapeHtml(targetDisplay) + '</span></div>';
  } else {
    metaHtml += '<div class="meta-row"><span class="meta-label">To</span><span class="meta-value">New Tab</span></div>';
  }

  metaEl.innerHTML = metaHtml;

  // ── Countdown ──
  let remaining = COUNTDOWN;
  const secondsEl = document.getElementById('seconds');
  let redirected = false;

  const interval = setInterval(function () {
    remaining--;
    if (remaining < 0) remaining = 0;
    secondsEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(interval);
      doRedirect();
    }
  }, 1000);

  // ── Continue Now button ──
  document.getElementById('continueBtn').addEventListener('click', function () {
    clearInterval(interval);
    doRedirect();
  });

  // ── Redirect via background script (handles about:newtab reliably) ──
  function doRedirect() {
    if (redirected) return;
    redirected = true;

    document.getElementById('countdown').textContent = 'Redirecting…';
    document.getElementById('progressFill').style.animation = 'none';
    document.getElementById('progressFill').style.width = '0';

    // Try background message first (most reliable, handles about:newtab)
    try {
      chrome.runtime.sendMessage({
        action: 'completeRedirect',
        target: target
      }, function () {
        // If background didn't respond, fallback to direct navigation
        if (chrome.runtime.lastError) {
          fallbackNavigate();
        }
      });
    } catch (e) {
      fallbackNavigate();
    }

    // Safety net: if nothing happens after 1 second, force navigate
    setTimeout(fallbackNavigate, 1000);
  }

  function fallbackNavigate() {
    if (target === 'about:newtab' || target === 'about:blank') {
      // Can't navigate to about: pages from extension page, try via tabs API
      try {
        chrome.tabs.getCurrent(function (tab) {
          if (tab) chrome.tabs.update(tab.id, { url: target });
        });
      } catch (_) {
        window.location.href = 'about:blank';
      }
    } else {
      window.location.href = target;
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
