/**
 * Settings popup logic – saves class info to chrome.storage.local
 * No API key needed (checklist mode).
 */
(function () {
  'use strict';

  const nameColInput  = document.getElementById('nameCol');
  const commentColInput = document.getElementById('commentCol');
  const startRowInput = document.getElementById('startRow');
  const btnSave       = document.getElementById('btnSave');
  const statusMsg     = document.getElementById('statusMsg');

  // Load saved settings
  chrome.storage.local.get(['nameCol', 'commentCol', 'startRow'], (data) => {
    if (data.nameCol)  nameColInput.value  = data.nameCol;
    if (data.commentCol) commentColInput.value = data.commentCol;
    if (data.startRow) startRowInput.value  = data.startRow;
  });

  // Save
  btnSave.addEventListener('click', () => {
    const nameCol  = (nameColInput.value.trim() || 'A').toUpperCase();
    const commentCol = (commentColInput.value.trim() || 'Q').toUpperCase();
    const startRow = parseInt(startRowInput.value, 10) || 2;

    chrome.storage.local.set({ nameCol, commentCol, startRow }, () => {
      showStatus('✅ Đã lưu thành công!', 'success');
      btnSave.classList.add('saved');
      btnSave.textContent = '✅ Đã lưu!';

      setTimeout(() => {
        btnSave.classList.remove('saved');
        btnSave.textContent = '💾 Lưu cài đặt';
      }, 2000);

      chrome.runtime.sendMessage({
        action: 'settingsUpdated',
        nameCol,
        commentCol,
        startRow,
      });
    });
  });

  function showStatus(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = 'status-msg ' + type;
    setTimeout(() => {
      statusMsg.textContent = '';
      statusMsg.className = 'status-msg';
    }, 3000);
  }
})();
