/**
 * Background service worker – relay messages between popup ↔ content script
 */

// Listen for messages from popup (settings page)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    // Forward settings update to all open Google Sheets tabs
    chrome.tabs.query({ url: 'https://docs.google.com/spreadsheets/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          nameCol: message.nameCol,
          commentCol: message.commentCol,
          startRow: message.startRow
        }).catch(() => {
          // Tab might not have content script loaded yet — ignore
        });
      });
    });
    sendResponse({ ok: true });
  }
  // Keep the message channel open for async responses
  return true;
});

// When the extension icon is clicked on a non-Sheets page, open settings
chrome.action.onClicked.addListener((tab) => {
  // The popup will handle this via default_popup
});
