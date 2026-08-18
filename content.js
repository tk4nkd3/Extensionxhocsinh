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
          <textarea id="nxhs-fast-input" spellcheck="false" placeholder="Nhập theo cú pháp Họ tên đầy đủ : Các lỗi (tên phải gõ y như trên bảng)\nVD:\nTrần Văn Nam, Phạm Hà Anh : love Ving to V; chia sai động từ\nLê Khánh Vy : interested in phải có be đằng trc +Đỗ Hoài Phong"></textarea>
          <button id="nxhs-process-btn">📋 Xử Lý & Điền (Enter)</button>
        </div>

        <div class="nxhs-instructions">
          <details open>
            <summary>📖 Hướng dẫn gõ tự do siêu tốc</summary>
            <div class="inst-content">
              <ul>
                <li>Cú pháp chuẩn: <strong>Tên học sinh 1, Tên 2 : lỗi 1; lỗi 2</strong></li>
                <li>Tiện ích sẽ tự động nhận diện tên học sinh ở bên trái dấu <strong>:</strong> và gắn các lỗi ở bên phải cho các em đó.</li>
                <li>Nhớ ra thêm học sinh nào cũng mắc lỗi y hệt <strong>sau khi</strong> đã viết lỗi? Gõ thêm <strong>+Tên</strong> ngay trong phần lỗi (VD: <strong>+phong +hà hân</strong>), không cần quay lại sửa trước dấu :.</li>
                <li>Nếu xuống dòng mà <strong>không có dấu :</strong>, hệ thống tự động cộng dồn lỗi cho học sinh ở dòng trên.</li>
                <li>Nhấn <strong>Enter</strong> để tạo dữ liệu dán.</li>
                <li>Ấn <strong>Ctrl + V</strong> ở màn hình Sheets để dán và giữ nguyên gộp ô.</li>
              </ul>
              <div class="inst-example">
                VD:<br>
                Nam, hà anh : love Ving to V; thiếu s<br>
                Vy : interested in phải có be đằng trc +phong +hà hân<br>
                Trí : sue số ít V thêm s
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

    // --- BƯỚC 1: Bảng tra HỌ TÊN ĐẦY ĐỦ ---
    // Chỉ nhận khi phần tên được gõ GIỐNG Y NGUYÊN họ tên trên bảng tính.
    // Không còn đoán theo tên gọi / họ / tên đệm nữa: gõ "mai khanh" sẽ KHÔNG được tính
    // cho em tên "Mai" và em tên "Khanh", mà phải gõ đủ "Nguyễn Thị Mai Khanh".
    // Chỉ bỏ qua hai thứ không ảnh hưởng mặt chữ: viết hoa/thường và khoảng trắng thừa.
    function escapeRegExp(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const normalizeName = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();

    const nameToStudents = new Map(); // họ tên đã chuẩn hoá -> danh sách HS
    for (const s of state.students) {
      const key = normalizeName(s.name);
      if (!key) continue;
      if (!nameToStudents.has(key)) nameToStudents.set(key, []);
      nameToStudents.get(key).push(s); // 2 em trùng y hệt họ tên thì cùng nhận lỗi
    }

    // Các cụm tên đã gõ nhưng không khớp khít HS nào, để cảnh báo lại cho GV
    const unknownNames = new Set();

    // Tách phần tên thành từng cụm theo dấu phân cách rồi tra khớp tuyệt đối từng cụm.
    // reportUnknown: chỉ bật cho phần trước dấu ":" — cụm sau "+" có thể lẫn nội dung lỗi
    // nên không đem ra cảnh báo.
    function collectStudents(text, targetSet, reportUnknown) {
      let matchedAny = false;
      for (const rawChunk of text.split(/[,;/&+]/)) {
        const key = normalizeName(rawChunk);
        if (!key) continue;
        const found = nameToStudents.get(key);
        if (found) {
          for (const s of found) targetSet.add(s);
          matchedAny = true;
        } else if (reportUnknown) {
          unknownNames.add(rawChunk.trim());
        }
      }
      return matchedAny;
    }

    // Gợi ý khi gõ thiếu chữ: tìm HS có họ tên chứa nguyên cụm vừa gõ (theo ranh giới từ).
    // Chỉ dùng để NHẮC lại cho GV, không dùng để gán lỗi — việc gán vẫn phải khớp khít.
    const stripDiacritics = (str) =>
      str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

    function suggestFullNames(chunk) {
      const key = normalizeName(chunk);
      if (!key) return [];
      const matchBy = (transform) => {
        const regex = new RegExp(
          `(?<!\\p{L})${escapeRegExp(transform(key)).replace(/\s+/g, '\\s+')}(?!\\p{L})`,
          'iu'
        );
        return state.students.filter((s) => regex.test(transform(normalizeName(s.name))));
      };
      // Thử khớp nguyên văn trước; không ra thì thử bỏ dấu (GV gõ "mai khanh" không dấu)
      let found = matchBy((v) => v);
      if (found.length === 0) found = matchBy(stripDiacritics);
      return found.map((s) => s.name);
    }

    // --- BƯỚC 2: Phân tích từng dòng ---
    const lines = text.split('\n');
    const studentErrorsMap = new Map(); // Map: row -> { student, errors: Set() }
    let lastMatchedStudents = new Set();
    const notFoundLines = [];

    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;

      let matchedStudents = new Set();
      let namesPart = "";
      let errorsPart = "";

      // Tìm vị trí dấu : đầu tiên
      const colonIndex = rawLine.indexOf(':');
      if (colonIndex !== -1) {
        namesPart = rawLine.substring(0, colonIndex);
        errorsPart = rawLine.substring(colonIndex + 1);
      } else {
        // Không có dấu :, coi như là lỗi cộng dồn cho học sinh của dòng trước đó
        errorsPart = rawLine;
      }

      if (namesPart.trim()) {
        // Dò tìm tất cả học sinh được nhắc đến trong phần bên trái dấu :
        collectStudents(namesPart, matchedStudents, true);
      }

      // Cú pháp "+Tên": nối thêm học sinh dùng chung lỗi ngay trong phần lỗi
      // VD: "Vy : interested in... phải có be đằng trc +phong +hà hân"
      // Lưu ý: chỉ xóa khỏi errorsPart những cụm "+..." THỰC SỰ khớp được với một học
      // sinh có thật. Nếu xóa vô điều kiện mọi cụm "+chữ" sẽ phá hỏng các ký hiệu ngữ
      // pháp tiếng Anh rất hay gặp trong nội dung lỗi (VD: "to + V", "S + V", "have + PII"),
      // vì các cụm đó cũng khớp pattern "+chữ" nhưng không phải tên học sinh.
      const plusNamePattern = /\+\s*([\p{L}][\p{L}\s]*?)(?=[+,;]|$)/gu;
      let plusMatch;
      const plusMatchesToRemove = [];
      while ((plusMatch = plusNamePattern.exec(errorsPart)) !== null) {
        const chunk = plusMatch[1].trim();
        if (!chunk) continue;
        const matchedAny = collectStudents(chunk, matchedStudents, false);
        if (matchedAny) {
          plusMatchesToRemove.push([plusMatch.index, plusMatch[0].length]);
        }
      }
      for (let i = plusMatchesToRemove.length - 1; i >= 0; i--) {
        const [start, len] = plusMatchesToRemove[i];
        errorsPart = errorsPart.slice(0, start) + ' ' + errorsPart.slice(start + len);
      }

      // Kế thừa học sinh từ dòng trước nếu dòng này không nhắc tên ai
      if (matchedStudents.size > 0) {
        lastMatchedStudents = matchedStudents;
      } else {
        matchedStudents = lastMatchedStudents;
      }

      if (matchedStudents.size === 0) {
        notFoundLines.push(rawLine);
        continue;
      }

      // --- BƯỚC 3: Xử lý đoạn text lỗi ---
      let errorText = errorsPart.trim();
      // Bỏ các ký tự dư thừa ở đầu/cuối nếu có
      errorText = errorText.replace(/^[,;:\-\.\?\s]+/, '');
      errorText = errorText.replace(/[,;\-\s]+$/, '');
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
    if ((notFoundLines && notFoundLines.length > 0) || unknownNames.size > 0) {
      let warning = "";
      if (notFoundLines.length > 0) {
        warning = "⚠️ Không tìm thấy HS cho các dòng:\n" + notFoundLines.join("\n");
      }

      // Gợi ý cho các cụm tên gõ không khớp khít họ tên nào trên bảng
      const hints = new Set();
      for (const chunk of unknownNames) {
        const suggestions = suggestFullNames(chunk);
        if (suggestions.length > 0) {
          hints.add(`"${chunk}" chưa đúng — hãy gõ đủ họ tên như trên bảng: ${suggestions.join(' / ')}`);
        } else {
          hints.add(`"${chunk}" không có trong danh sách lớp`);
        }
      }
      if (hints.size > 0) {
        warning += (warning ? "\n\n" : "") + "🔶 " + Array.from(hints).join("\n🔶 ");
      }

      previewText = warning + "\n\n" + previewText;
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

    // Chỉ dùng "input" để cập nhật giá trị ô Name Box, KHÔNG bắn thêm sự kiện "change".
    // Lý do: "change" khiến Sheets nhảy tới ô ngay và chuyển focus sang lưới bảng tính,
    // nên phím Enter giả lập bắn ra sau đó (bên dưới) không còn xác nhận Name Box nữa mà
    // bị lưới bảng tính hiểu là "di chuyển xuống 1 dòng" -> kết quả dán bị lệch xuống
    // đúng 1 dòng so với học sinh mong muốn.
    nameBox.dispatchEvent(new Event('input', { bubbles: true }));

    setTimeout(() => {
      nameBox.value = cellRef; // đảm bảo Sheets không tự đổi giá trị do gợi ý autocomplete
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
