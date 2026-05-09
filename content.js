/**
 * Nhận Xét Học Sinh – Content Script (Fast Input Mode)
 * User types: "Trí Hiếu tương lai đơn, a/an/the" -> Extension finds student and formats comment.
 */
(function () {
  'use strict';

  let state = {
    nameCol: 'A',
    commentCol: 'Q',
    startRow: 2,
    students: [],
    lastComment: '',
    isOpen: false,
    historyOpen: false,
  };

  window.addEventListener('load', () => setTimeout(init, 2500));

  function init() {
    loadSettings().then(() => {
      injectSidebar();
      injectToggle();
      loadStudents();
      startCellWatcher();
      listenForSettingsUpdates();
      listenForTabChanges();
    });
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['nameCol', 'commentCol', 'startRow', 'colspan'], (data) => {
        if (data.nameCol) state.nameCol = data.nameCol.toUpperCase();
        if (data.commentCol) state.commentCol = data.commentCol.toUpperCase();
        if (data.startRow) state.startRow = parseInt(data.startRow, 10);
        const colInput = document.getElementById('nxhs-colspan');
        if (colInput && data.colspan) colInput.value = data.colspan;
        resolve();
      });
    });
  }

  function listenForSettingsUpdates() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'settingsUpdated') {
        if (msg.nameCol) state.nameCol = msg.nameCol.toUpperCase();
        if (msg.commentCol) state.commentCol = msg.commentCol.toUpperCase();
        if (msg.startRow) state.startRow = parseInt(msg.startRow, 10);
        loadStudents();
        showStatus('Cài đặt đã cập nhật!', 'success');
      }
    });
  }

  function injectSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'nxhs-sidebar';
    sidebar.innerHTML = `
      <div class="nxhs-header">
        <h2>⚡ Nhận Xét Nhanh</h2>
        <div class="subtitle">Gõ tên HS + lỗi (cách nhau dấu phẩy)</div>
      </div>
      <div class="nxhs-body">
        <div class="nxhs-cell-info" style="margin-bottom:12px;">
          <span class="cell-icon">📍</span>
          <span>Ô đang chọn: <strong class="cell-ref" id="nxhs-cell-ref">--</strong></span>
        </div>

        <div class="nxhs-student-selector">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label>📊 Dữ liệu học sinh:</label>
            <button id="nxhs-reload-students" title="Tải lại danh sách">🔄 Làm mới</button>
          </div>
          <div id="nxhs-student-count" style="font-size:12px; color:#10b981; margin-top:4px; font-weight:600;">
            Đang tải...
          </div>
        </div>

        <div class="nxhs-fast-input-wrap">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:-4px;">
            <label for="nxhs-fast-input" style="font-size:12px; font-weight:600; color:#0f172a;">✏️ Nhập ghi chú tự do:</label>
            <div style="display:flex; align-items:center; gap:6px;" title="Ví dụ: Ô nhận xét gộp từ cột Q đến cột T thì số cột là 4. Nếu không gộp thì để là 1.">
              <span style="font-size:10px; color:#64748b;">Số cột gộp:</span>
              <input type="number" id="nxhs-colspan" value="1" min="1" max="15" style="width:36px; height:20px; font-size:11px; text-align:center; border:1px solid #cbd5e1; border-radius:4px; outline:none; color:#0f172a;">
            </div>
          </div>
          <textarea id="nxhs-fast-input" spellcheck="false" placeholder="Nhập tên học sinh và lỗi lộn xộn thoải mái...\nVD:\nNam, hà anh love Ving to V\nVy interested in phải có be đằng trc, phong, hà hân..."></textarea>
          <button id="nxhs-process-btn">📋 Xử Lý & Điền (Enter)</button>
        </div>

        <div class="nxhs-instructions">
          <details open>
            <summary>📖 Hướng dẫn gõ tự do siêu tốc</summary>
            <div class="inst-content">
              <ul>
                <li>Bạn có thể <strong>copy/paste nguyên xi</strong> đoạn chat hoặc ghi chú lộn xộn của bạn vào đây.</li>
                <li>Tiện ích sẽ <strong>tự động nhận diện tên</strong> các học sinh có trong mỗi câu (dù tên nằm ở đầu, giữa hay cuối câu).</li>
                <li>Nhấn <strong>Enter</strong>. Tiện ích tự động copy dữ liệu.</li>
                <li>Ấn <strong>Ctrl + Shift + V</strong> ở màn hình Sheets để dán (Dùng Shift để giữ nguyên định dạng gộp ô).</li>
              </ul>
              <div class="inst-example">
                VD:<br>
                Nam, hà anh love Ving to V<br>
                Vy interested in phải có be đằng trc, phong, hà hân<br>
                Trí sue số ít V thêm s
              </div>
            </div>
          </details>
        </div>

        <div class="nxhs-status" id="nxhs-status"></div>

        <div id="nxhs-preview">
          <div class="preview-label">📋 Kết quả tạo ra: <span id="nxhs-preview-target" style="color:#6366f1;"></span></div>
          <div class="preview-text" id="nxhs-preview-text"></div>
        </div>
        
        <div class="nxhs-history-header" id="nxhs-history-toggle">
          <h3>🕓 Lịch sử <span id="nxhs-history-count"></span></h3>
          <span class="toggle-arrow" id="nxhs-history-arrow">▼</span>
        </div>
        <div id="nxhs-history-list"></div>
      </div>
      <div class="nxhs-footer">Nhận Xét Học Sinh v2 • Fast Input</div>
    `;
    document.body.appendChild(sidebar);
    bindEvents();
  }

  function bindEvents() {
    const inputEl = document.getElementById('nxhs-fast-input');
    const processBtn = document.getElementById('nxhs-process-btn');
    const reloadBtn = document.getElementById('nxhs-reload-students');
    const historyToggle = document.getElementById('nxhs-history-toggle');
    const colInput = document.getElementById('nxhs-colspan');

    if (colInput) {
      colInput.addEventListener('change', (e) => {
        chrome.storage.local.set({ colspan: e.target.value });
      });
    }

    reloadBtn.addEventListener('click', () => {
      loadStudents();
      showStatus('Đang tải lại danh sách...', 'info');
    });

    processBtn.addEventListener('click', processInput);
    
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processInput();
      }
    });

    historyToggle.addEventListener('click', () => {
      state.historyOpen = !state.historyOpen;
      document.getElementById('nxhs-history-list').classList.toggle('open', state.historyOpen);
      document.getElementById('nxhs-history-arrow').classList.toggle('open', state.historyOpen);
      if (state.historyOpen) loadHistory();
    });
  }

  function processInput() {
    const text = document.getElementById('nxhs-fast-input').value;
    if (!text.trim()) return;

    if (state.students.length === 0) {
      showStatus('Chưa có dữ liệu học sinh! Hãy Làm mới.', 'error');
      return;
    }

    // --- BƯỚC 1: Xây dựng bộ nhận diện tên học sinh (Aliases) ---
    const aliasMap = [];
    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    for (const s of state.students) {
      const name = s.name.toLowerCase().trim();
      const parts = name.split(/\s+/);
      const aliases = [name]; // Full name

      if (parts.length > 1) {
        // Thêm tên gọi (từ cuối cùng) và họ (từ đầu tiên)
        if (!aliases.includes(parts[parts.length - 1])) aliases.push(parts[parts.length - 1]);
        if (!aliases.includes(parts[0])) aliases.push(parts[0]);
      }

      for (const al of aliases) {
        aliasMap.push({
          student: s,
          alias: al,
          regexStr: escapeRegExp(al).replace(/\s+/g, '\\s+') // Chuyển khoảng trắng thành \s+ để bắt được khoảng trống bất kỳ
        });
      }
    }

    // Ưu tiên khớp các cụm tên dài trước (như "Hà Anh" phải được ưu tiên hơn "Hà")
    aliasMap.sort((a, b) => {
      const aWords = a.alias.split(' ').length;
      const bWords = b.alias.split(' ').length;
      if (aWords !== bWords) return bWords - aWords;
      return b.alias.length - a.alias.length;
    });

    // --- BƯỚC 2: Phân tích từng dòng ---
    const lines = text.split('\n');
    const studentErrorsMap = new Map(); // Map: row -> { student, errors: Set() }
    let lastMatchedStudents = new Set();
    const notFoundLines = [];

    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;

      let remainingLine = rawLine;
      let matchedStudents = new Set();

      // Dò tìm tất cả học sinh được nhắc đến trong câu này
      for (const { student, regexStr } of aliasMap) {
        // Regex bắt chính xác từ (word boundary hỗ trợ tiếng Việt)
        const regex = new RegExp(`(^|[^\\p{L}])${regexStr}([^\\p{L}]|$)`, 'igu');
        
        if (regex.test(remainingLine)) {
          matchedStudents.add(student);
          // Xóa tên học sinh khỏi câu nhưng giữ lại khoảng trắng/dấu phẩy xung quanh
          remainingLine = remainingLine.replace(regex, '$1$2');
        }
      }

      // Kế thừa học sinh từ dòng trước nếu dòng này không nhắc tên ai (áp dụng lỗi tiếp cho HS cũ)
      if (matchedStudents.size > 0) {
        lastMatchedStudents = matchedStudents;
      } else {
        matchedStudents = lastMatchedStudents;
      }

      if (matchedStudents.size === 0) {
        notFoundLines.push(rawLine);
        continue;
      }

      // --- BƯỚC 3: Xử lý đoạn text lỗi còn sót lại ---
      let errorText = remainingLine.trim();
      // Bỏ dấu câu dư thừa ở 2 đầu
      errorText = errorText.replace(/^[,;:\-\.\?\s]+/, '');
      errorText = errorText.replace(/[,;\-\s]+$/, '');
      // Xóa các cụm dấu phẩy/chấm phẩy dư thừa do tên bị rút đi (vd: ", , ,")
      errorText = errorText.replace(/[,;]\s*[,;]/g, ',');
      errorText = errorText.replace(/\s{2,}/g, ' ');

      if (!errorText) continue;

      // Phân tách các lỗi bằng dấu ; (nếu có)
      const errorParts = errorText.split(';').map(e => e.trim()).filter(e => e);

      // Ghi nhận lỗi cho tất cả học sinh khớp trong câu này
      for (const student of matchedStudents) {
        if (!studentErrorsMap.has(student.row)) {
          studentErrorsMap.set(student.row, { student: student, errors: new Set() });
        }
        for (const p of errorParts) {
          studentErrorsMap.get(student.row).errors.add(p);
        }
      }
    }

    if (studentErrorsMap.size === 0) {
      showStatus('❌ Không tìm thấy tên HS nào hợp lệ để gán lỗi!', 'error');
      return;
    }

    // --- Bước 4: Cấu trúc dữ liệu và lấy minRow ---
    const parsedData = Array.from(studentErrorsMap.values()).map(data => {
      let comment = "Con chú ý:\n";
      comment += Array.from(data.errors).map(e => "- " + e.charAt(0).toUpperCase() + e.slice(1)).join('\n');
      return { row: data.student.row, name: data.student.name, comment: comment };
    });

    parsedData.sort((a, b) => a.row - b.row);
    const minRow = parsedData[0].row;
    const maxRow = parsedData[parsedData.length - 1].row;

    // --- Bước 5: Điều hướng tới Google Sheets ---
    const targetCell = `${state.commentCol}${minRow}`;
    navigateToCell(targetCell);

    // --- Bước 6: Lấy Font chữ hiện tại từ thanh công cụ của Google Sheets ---
    let fontFamily = 'Arial';
    let fontSize = '10pt';
    try {
      const fontEl = document.querySelector('.docs-fontmenu-font');
      if (fontEl && fontEl.textContent) fontFamily = fontEl.textContent.trim();
      
      const sizeEl = document.querySelector('#docs-fontsize-input-box') || document.querySelector('.goog-toolbar-text-input') || document.querySelector('input[aria-label="Cỡ chữ"]') || document.querySelector('input[aria-label="Font size"]');
      if (sizeEl && sizeEl.value) fontSize = sizeEl.value.trim() + 'pt';
    } catch(e) {}

    const manualColspan = parseInt(document.getElementById('nxhs-colspan').value) || 1;
    const clipboardRows = [];
    const htmlRows = [];

    let htmlContent = `<table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" style="border-collapse:collapse;border:none;font-family:${fontFamily};font-size:${fontSize};">`;

    for (let r = minRow; r <= maxRow; r++) {
      const studentData = parsedData.find(d => d.row === r);
      if (studentData) {
        let c = studentData.comment;
        
        let plainC = c;
        if (plainC.includes('\n') || plainC.includes('"')) {
          plainC = `"${plainC.replace(/"/g, '""')}"`;
        }
        clipboardRows.push(plainC);

        let htmlC = c.replace(/\n/g, '<br>');
        htmlRows.push(`<tr><td colspan="${manualColspan}" style="vertical-align:top; border:none; white-space:normal;">${htmlC}</td></tr>`);
      } else {
        clipboardRows.push("");
        htmlRows.push(`<tr><td colspan="${manualColspan}" style="border:none;"></td></tr>`);
      }
    }

    htmlContent += htmlRows.join('') + '</table>';
    const clipboardText = clipboardRows.join('\n');

    // Hiển thị preview
    document.getElementById('nxhs-preview-target').textContent = `(Gồm ${parsedData.length} HS, Bắt đầu từ ô ${targetCell})`;
    
    let previewText = parsedData.map(d => `[${d.name}]\n${d.comment}`).join('\n\n');
    if (notFoundLines && notFoundLines.length > 0) {
      previewText = "⚠️ Không tìm thấy HS cho các dòng:\n" + notFoundLines.join("\n") + "\n\n" + previewText;
    }
    showPreview(previewText);

    // Ghi vào bộ nhớ tạm
    const blobHtml = new Blob([htmlContent], { type: 'text/html' });
    const blobText = new Blob([clipboardText], { type: 'text/plain' });

    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      })
    ]).then(() => {
      showStatus(`✅ Nhảy tới ${targetCell} & Copy ${parsedData.length} HS (Gộp ${manualColspan} cột). Bấm Ctrl+V!`, 'success');
      if (notFoundLines.length === 0) {
        document.getElementById('nxhs-fast-input').value = ''; 
      }
    }).catch(() => {
      showStatus(`⚠️ Đã nhảy tới ${targetCell}. Hãy bôi đen copy thủ công!`, 'error');
    });

    saveToHistory(text);
  }

  function injectToggle() {
    const btn = document.createElement('button');
    btn.id = 'nxhs-toggle';
    btn.textContent = '⚡ NX';
    btn.title = 'Nhận Xét Nhanh';
    document.body.appendChild(btn);
    btn.addEventListener('click', toggleSidebar);
  }

  function toggleSidebar() {
    state.isOpen = !state.isOpen;
    document.getElementById('nxhs-sidebar').classList.toggle('open', state.isOpen);
    document.getElementById('nxhs-toggle').classList.toggle('open', state.isOpen);
  }

  async function loadStudents() {
    const sheetId = getSheetId();
    if (!sheetId) return;
    
    const gid = getSheetGid();
    const col = state.nameCol;
    const row = state.startRow;
    
    updateStudentCount('Đang tải...');
    
    try {
      const gidParam = gid ? `&gid=${gid}` : '';
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=0&range=${col}${row}:${col}1000${gidParam}`;
      const res = await fetch(url, { credentials: 'include' });
      const text = await res.text();
      
      if (!res.ok) {
        updateStudentCount(`Lỗi HTTP: ${res.status}`); return;
      }
      if (text.includes('<!DOCTYPE html>')) {
        updateStudentCount('Lỗi: Chưa share Public'); return;
      }

      const jsonStr = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      const json = JSON.parse(jsonStr);

      if (json.status === 'error') {
        const errorMsg = json.errors?.[0]?.message || 'Lỗi không xác định từ Google';
        updateStudentCount(`Lỗi API: ${errorMsg}`);
        return;
      }

      if (!json?.table?.rows || json.table.rows.length === 0) {
        state.students = []; 
        updateStudentCount('Dữ liệu Cột A rỗng'); 
        return;
      }

      state.students = json.table.rows
        .map((r, i) => {
          const val = r?.c?.[0]?.v;
          const name = val ? val.toString().trim() : '';
          return { name, row: row + i };
        })
        .filter((s) => s.name.length > 0);

      updateStudentCount(`✅ Đã nhận diện ${state.students.length} học sinh (Cột ${col})`);
    } catch (err) {
      state.students = [];
      updateStudentCount(`Lỗi: ${err.message}`);
    }
  }

  function updateStudentCount(msg) {
    const el = document.getElementById('nxhs-student-count');
    if (el) el.textContent = msg;
  }

  function getSheetId() {
    const m = window.location.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function getSheetGid() {
    const url = new URL(window.location.href);
    // Ưu tiên lấy từ hash (#gid=...) vì Google Sheets dùng hash để cập nhật tab hiện tại
    if (url.hash.includes('gid=')) {
      // url.hash.substring(1) bỏ đi dấu #
      const hashParts = url.hash.substring(1).split('&');
      for (const part of hashParts) {
        if (part.startsWith('gid=')) {
          return part.split('=')[1];
        }
      }
    }
    return url.searchParams.get('gid');
  }

  function listenForTabChanges() {
    let lastGid = getSheetGid();
    setInterval(() => {
      const currentGid = getSheetGid();
      if (currentGid !== lastGid) {
        lastGid = currentGid;
        state.students = [];
        loadStudents();
      }
    }, 1500);
  }

  function navigateToCell(cellRef) {
    const nameBox =
      document.querySelector('#t-name-box') ||
      document.querySelector('.waffle-name-box') ||
      document.querySelector('[aria-label="Name Box"] input') ||
      document.querySelector('[aria-label*="Name Box"]');

    if (!nameBox) return;

    nameBox.focus();
    nameBox.click();
    nameBox.value = cellRef;
    
    nameBox.dispatchEvent(new Event('input', { bubbles: true }));
    nameBox.dispatchEvent(new Event('change', { bubbles: true }));
    
    setTimeout(() => {
      nameBox.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter', keyCode: 13, code: 'Enter', which: 13,
          bubbles: true, cancelable: true,
        })
      );
    }, 50);
  }

  function startCellWatcher() {
    setInterval(() => {
      const cellRef = getActiveCellRef();
      const el = document.getElementById('nxhs-cell-ref');
      if (el && cellRef) el.textContent = cellRef;
    }, 1000);
  }

  function getActiveCellRef() {
    const nameBox =
      document.querySelector('#t-name-box') ||
      document.querySelector('.waffle-name-box') ||
      document.querySelector('[aria-label="Name Box"] input') ||
      document.querySelector('[aria-label*="Name Box"]');
    return nameBox ? nameBox.value || nameBox.textContent || '--' : '--';
  }

  function showPreview(text) {
    const preview = document.getElementById('nxhs-preview');
    document.getElementById('nxhs-preview-text').textContent = text;
    preview.classList.add('visible');
  }

  function showStatus(msg, type) {
    const el = document.getElementById('nxhs-status');
    el.textContent = msg;
    el.className = 'nxhs-status visible ' + type;
    setTimeout(() => el.classList.remove('visible'), 4000);
  }

  function saveToHistory(comment) {
    chrome.storage.local.get(['history'], (data) => {
      const history = data.history || [];
      history.unshift({ comment, time: new Date().toLocaleString('vi-VN') });
      if (history.length > 50) history.length = 50;
      chrome.storage.local.set({ history });
    });
  }

  function loadHistory() {
    chrome.storage.local.get(['history'], (data) => {
      const history = data.history || [];
      const list = document.getElementById('nxhs-history-list');
      const count = document.getElementById('nxhs-history-count');
      count.textContent = history.length ? `(${history.length})` : '';
      if (!history.length) {
        list.innerHTML = '<div style="font-size:12px;color:#475569;padding:8px 0;">Chưa có lịch sử</div>';
        return;
      }
      list.innerHTML = history
        .map(
          (h) => `
        <div class="nxhs-history-item" data-comment="${escapeAttr(h.comment)}">
          <div class="hi-time">${escapeHtml(h.time)}</div>
          <div class="hi-text">${escapeHtml(h.comment)}</div>
        </div>`
        )
        .join('');
      list.querySelectorAll('.nxhs-history-item').forEach((item) => {
        item.addEventListener('click', () => {
          const c = item.getAttribute('data-comment');
          navigator.clipboard.writeText(c).then(() => {
            showStatus('Đã copy lại từ lịch sử!', 'success');
          });
        });
      });
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
