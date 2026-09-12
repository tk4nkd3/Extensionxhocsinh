/**
 * Background service worker – relay messages between popup ↔ content script
 */

// Listen for messages from popup (settings page) or from a content script that
// just detected the data range on its own sheet
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    // Tab gốc (nếu người gửi là content script) đã tự cập nhật rồi, gửi lại sẽ
    // khiến nó tải lại danh sách lần hai và đè mất thông báo đang hiển thị.
    const senderTabId = sender && sender.tab ? sender.tab.id : null;

    // Forward settings update to all open Google Sheets tabs
    chrome.tabs.query({ url: 'https://docs.google.com/spreadsheets/*' }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id === senderTabId) return;
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
