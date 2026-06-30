// ============================================
// ReclaimFocus v2.0 - Content Keyword Scanner
// ============================================

(() => {
  // Prevent duplicate registration if injected more than once
  if (window.__reclaimFocusKeywordScanner) return;
  window.__reclaimFocusKeywordScanner = true;

  /**
   * Collects all meaningful text from the page:
   * - document.title
   * - All visible text content from the DOM (not just innerText, which misses
   *   elements hidden by scroll, lazy-loading, etc.)
   * - <meta> description / keywords tags
   * - <img> alt text
   * - Structured data (ld+json) headline / name / description
   */
  function collectPageText() {
    const parts = [];

    // 1. Document title
    if (document.title) {
      parts.push(document.title);
    }

    // 2. Meta description and keywords
    const metaTags = document.querySelectorAll(
      'meta[name="description"], meta[name="keywords"], meta[property="og:title"], meta[property="og:description"]'
    );
    metaTags.forEach(meta => {
      const content = meta.getAttribute('content');
      if (content) parts.push(content);
    });

    // 3. Body innerText — take up to 50,000 characters for thorough scanning
    if (document.body) {
      parts.push(document.body.innerText.substring(0, 50000));
    }

    // 4. Image alt text (often contains descriptive keywords)
    document.querySelectorAll('img[alt]').forEach(img => {
      if (img.alt) parts.push(img.alt);
    });

    // 5. Structured data (JSON-LD)
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        const fields = ['headline', 'name', 'description', 'articleBody'];
        fields.forEach(f => {
          if (data[f] && typeof data[f] === 'string') parts.push(data[f].substring(0, 2000));
        });
      } catch (_) { /* skip malformed JSON-LD */ }
    });

    return parts.join(' ');
  }

  /**
   * Checks whether any of the keywords are present in the given text.
   * Uses proper \b word boundaries for multi-word phrases and an
   * includes() fallback for substrings.
   */
  function findKeyword(keywords, text) {
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();

      // Strategy 1: \b word boundary regex (handles most natural language)
      const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp('\\b' + escapedKeyword + '\\b', 'i');

      if (wordBoundaryRegex.test(lowerText)) {
        return keyword;
      }

      // Strategy 2: Plain substring match (catches hyphenated, camelCase, etc.)
      if (lowerText.includes(lowerKeyword)) {
        return keyword;
      }
    }
    return null;
  }

  // Listen for scan requests from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scanPageForKeywords') {
      const keywords = message.keywords || [];
      if (keywords.length === 0) {
        sendResponse({ found: false });
        return true;
      }

      const pageText = collectPageText();
      const match = findKeyword(keywords, pageText);

      if (match) {
        sendResponse({ found: true, keyword: match });
      } else {
        sendResponse({ found: false });
      }
      return true;
    }
  });

  // ========== MutationObserver for dynamically loaded content ==========
  // Many modern pages load content via JS after the initial DOM is ready.
  // We re-scan when significant DOM mutations occur.
  let scanTimeout = null;
  let lastScanTime = 0;
  const SCAN_DEBOUNCE_MS = 2000; // Don't re-scan more than every 2 seconds

  const observer = new MutationObserver(() => {
    const now = Date.now();
    if (now - lastScanTime < SCAN_DEBOUNCE_MS) return;

    clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      lastScanTime = Date.now();
      // Request the background script to re-run the deep scan on this tab
      try {
        chrome.runtime.sendMessage({ action: 'rerunDeepScan' });
      } catch (_) { /* extension context invalidated */ }
    }, 1500);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
