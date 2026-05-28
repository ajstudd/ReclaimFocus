// ============================================
// ReclaimFocus v2.0 - Content Keyword Scanner
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanPageForKeywords') {
    const keywords = message.keywords || [];
    if (keywords.length === 0) {
      sendResponse({ found: false });
      return true;
    }

    // Basic text extraction from body, limiting to first 10,000 characters to prevent lag
    const bodyText = document.body.innerText.substring(0, 10000).toLowerCase();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // Unicode-safe word boundary check
      const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp("(?:^|[\\s,;.!?\"'()\\[\\]{}])" + escapedKeyword + "(?:$|[\\s,;.!?\"'()\\[\\]{}])", 'i');

      if (regex.test(bodyText) || bodyText.includes(lowerKeyword)) {
        sendResponse({ found: true, keyword: keyword });
        return true;
      }
    }
    
    sendResponse({ found: false });
    return true;
  }
});
