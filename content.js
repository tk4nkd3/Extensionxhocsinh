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
    colspan: 1,
    students: [],
    sheetRows: null,      // toàn bộ dòng của tab hiện tại (kể cả dòng đang ẩn)
    rowsReliable: true,   // false khi phải dùng gviz dự phòng (có thể lệch dòng)
    lastComment: '',
    isOpen: false,
    historyOpen: false,
  };

  window.addEventListener('load', () => setTimeout(init, 2500));

  function init() {
    loadSettings().then(() => {
      injectSidebar();
      applySettingsToUI();
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
        if (data.colspan) state.colspan = parseInt(data.colspan, 10) || 1;
        resolve();
      });
    });
  }

  // Đổ cài đặt đã lưu ra giao diện. Phải gọi SAU injectSidebar() vì lúc loadSettings()
  // chạy thì sidebar chưa tồn tại (trước đây số cột gộp vì thế không được nhớ lại).
  function applySettingsToUI() {
    const colInput = document.getElementById('nxhs-colspan');
    if (colInput) colInput.value = state.colspan;
    updateRangeDisplay();
  }

  function listenForSettingsUpdates() {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'settingsUpdated') {
        if (msg.nameCol) state.nameCol = msg.nameCol.toUpperCase();
        if (msg.commentCol) state.commentCol = msg.commentCol.toUpperCase();
        if (msg.startRow) state.startRow = parseInt(msg.startRow, 10);
        updateRangeDisplay();
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
        <div class="nxhs-brand">
          <svg class="nxhs-bolt" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 1.5 3.5 9h4L7 14.5 12.5 7h-4L9 1.5Z"/></svg>
          <h2>Nhận Xét Nhanh</h2>
          <button type="button" id="nxhs-config-toggle" title="Mở phần cấu hình cột tên và cột nhận xét">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5h8M13 5h1M2 11h2M7 11h7"/><circle cx="11.5" cy="5" r="1.6"/><circle cx="5.5" cy="11" r="1.6"/></svg>
            Cấu hình
          </button>
        </div>
        <div class="nxhs-context">
          <svg class="nxhs-ctx-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6h12M6.5 6v7.5"/></svg>
          <span id="nxhs-ctx-count">Đang tải…</span>
          <i class="nxhs-ctx-sep"></i>
          <span>Tên <strong id="nxhs-range-name">--</strong></span>
          <svg class="nxhs-ctx-arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8M9 5l3 3-3 3"/></svg>
          <span>Nhận xét <strong id="nxhs-range-comment">--</strong></span>
        </div>
      </div>

      <div class="nxhs-body">

        <section class="nxhs-step">
          <div class="nxhs-step-head">
            <span class="nxhs-step-num">1</span>
            <span class="nxhs-step-title">Gõ nhận xét</span>
            <label class="nxhs-colspan" title="Ô nhận xét gộp từ cột Q đến cột T thì nhập 4. Nếu không gộp thì để 1.">
              <span>Số cột gộp</span>
              <input type="number" id="nxhs-colspan" value="1" min="1" max="15">
            </label>
          </div>

          <textarea id="nxhs-fast-input" spellcheck="false" placeholder="Trần Văn Nam, Phạm Hà Anh : love + Ving chứ không phải to V; thiếu s ngôi thứ 3
Lê Khánh Vy : interested in phải có be đằng trước +Đỗ Hoài Phong"></textarea>

          <div class="nxhs-syntax">
            <span>Cú pháp <code>Họ tên đầy đủ : lỗi 1; lỗi 2</code></span>
            <button type="button" id="nxhs-open-guide">Xem hướng dẫn</button>
          </div>

          <button id="nxhs-process-btn">
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="9" height="11.5" rx="1.5"/><path d="M6 8.5h4M6 11h2.5"/></svg>
            <span>Xử lý &amp; chép</span>
            <kbd>Enter</kbd>
          </button>

          <div class="nxhs-status" id="nxhs-status"></div>
        </section>

        <section class="nxhs-step2" id="nxhs-step2">
          <div class="nxhs-step2-idle">
            <span class="nxhs-step-num muted">2</span>
            <span>Dán vào bảng — hiện ra sau khi xử lý</span>
          </div>

          <div class="nxhs-result">
            <div class="nxhs-result-head">
              <span class="nxhs-result-check">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>
              </span>
              <span class="nxhs-result-title" id="nxhs-result-title">Đã chép</span>
              <span class="nxhs-result-range" id="nxhs-result-range"></span>
            </div>
            <div class="nxhs-paste">
              <div class="nxhs-paste-keys">Bấm <kbd>Ctrl</kbd><span>+</span><kbd>V</kbd> ngay trên bảng</div>
              <div class="nxhs-paste-sub">Con trỏ đã nhảy sẵn tới ô <strong id="nxhs-result-cell">--</strong></div>
            </div>
            <div class="nxhs-overwrite" id="nxhs-result-warn"></div>
          </div>
        </section>

        <div id="nxhs-preview">
          <div class="preview-label">Xem trước <span id="nxhs-preview-target"></span></div>
          <div class="preview-text" id="nxhs-preview-text"></div>
        </div>

        <div class="nxhs-sections">

          <details class="nxhs-section" id="nxhs-config-section">
            <summary>
              <svg class="s-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6h12M6.5 6v7.5"/></svg>
              <span class="s-title">Cấu hình bảng</span>
              <span class="s-meta" id="nxhs-config-meta"></span>
              <svg class="s-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>
            </summary>
            <div class="nxhs-section-body">
              <button type="button" id="nxhs-autodetect">
                <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
                Tự nhận diện từ bảng
              </button>
              <p class="nxhs-hint nxhs-center">Quét dòng tiêu đề để tìm cột tên và cột nhận xét</p>

              <div class="nxhs-rule"></div>

              <div class="nxhs-field">
                <label>Ô tên học sinh đầu tiên</label>
                <div class="nxhs-field-row">
                  <span class="nxhs-cellbox" id="nxhs-field-name">--</span>
                  <span class="nxhs-field-meta" id="nxhs-student-count">Đang tải…</span>
                  <button type="button" class="nxhs-pick" id="nxhs-pick-name" title="Click vào ô chứa tên học sinh ĐẦU TIÊN trên bảng rồi bấm nút này">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.75"/><path d="M8 .75v2M8 13.25v2M.75 8h2M13.25 8h2"/></svg>
                    Lấy ô <b class="nxhs-pick-ref">--</b>
                  </button>
                </div>
              </div>

              <div class="nxhs-field">
                <label>Ô nhận xét đầu tiên</label>
                <div class="nxhs-field-row">
                  <span class="nxhs-cellbox" id="nxhs-field-comment">--</span>
                  <span class="nxhs-field-meta">Áp dụng cho mọi học sinh</span>
                  <button type="button" class="nxhs-pick" id="nxhs-pick-comment" title="Click vào ô nhận xét của học sinh ĐẦU TIÊN rồi bấm nút này">
                    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2"/><circle cx="8" cy="8" r="5.75"/><path d="M8 .75v2M8 13.25v2M.75 8h2M13.25 8h2"/></svg>
                    Lấy ô <b class="nxhs-pick-ref">--</b>
                  </button>
                </div>
              </div>

              <div class="nxhs-rule"></div>

              <div class="nxhs-field-row nxhs-cellrow">
                <span class="nxhs-hint">Ô đang chọn trên bảng <strong id="nxhs-cell-ref">--</strong></span>
                <button type="button" id="nxhs-reload-students" title="Tải lại danh sách học sinh">
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 8a6 6 0 1 1-1.9-4.4"/><path d="M14 2v4h-4"/></svg>
                  Tải lại
                </button>
              </div>
            </div>
          </details>

          <details class="nxhs-section" id="nxhs-guide-section">
            <summary>
              <svg class="s-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/><path d="M5.5 6h5M5.5 9h3"/></svg>
              <span class="s-title">Hướng dẫn cú pháp</span>
              <svg class="s-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>
            </summary>
            <div class="nxhs-section-body">
              <ul class="nxhs-guide">
                <li>Gõ <b>Họ tên đầy đủ</b> rồi dấu <b>:</b> rồi các lỗi. Tên phải gõ y như trên bảng.</li>
                <li>Nhiều học sinh cùng lỗi: ngăn cách bằng dấu <b>,</b> trước dấu <b>:</b></li>
                <li>Nhiều lỗi: ngăn cách bằng dấu <b>;</b></li>
                <li>Nhớ ra thêm em nữa? Gõ <b>+Họ tên</b> ở <b>cuối dòng</b> lỗi.</li>
                <li>Dòng tiếp theo <b>không có dấu :</b> sẽ cộng dồn lỗi cho các em ở dòng trên.</li>
                <li><b>Enter</b> để xử lý, <b>Shift + Enter</b> để xuống dòng.</li>
              </ul>
              <div class="nxhs-guide-example">Trần Văn Nam, Phạm Hà Anh : love + Ving; thiếu s ngôi thứ 3
Lê Khánh Vy : interested in phải có be +Đỗ Hoài Phong</div>
            </div>
          </details>

          <details class="nxhs-section" id="nxhs-history-toggle">
            <summary>
              <svg class="s-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.75"/><path d="M8 4.75V8l2.25 1.5"/></svg>
              <span class="s-title">Lịch sử</span>
              <span class="s-count" id="nxhs-history-count"></span>
              <svg class="s-chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>
            </summary>
            <div class="nxhs-section-body" id="nxhs-history-list"></div>
          </details>

        </div>
      </div>

      <div class="nxhs-footer">Nhận Xét Học Sinh v2</div>
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
        state.colspan = parseInt(e.target.value, 10) || 1;
        chrome.storage.local.set({ colspan: state.colspan });
      });
    }

    reloadBtn.addEventListener('click', () => {
      loadStudents();
      showStatus('Đang tải lại danh sách...', 'info');
    });

    const pickNameBtn = document.getElementById('nxhs-pick-name');
    const pickCommentBtn = document.getElementById('nxhs-pick-comment');
    const autoDetectBtn = document.getElementById('nxhs-autodetect');
    if (pickNameBtn) pickNameBtn.addEventListener('click', () => pickCellAs('name'));
    if (pickCommentBtn) pickCommentBtn.addEventListener('click', () => pickCellAs('comment'));
    if (autoDetectBtn) autoDetectBtn.addEventListener('click', autoDetectRange);

    processBtn.addEventListener('click', processInput);
    
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processInput();
      }
    });

    // Lịch sử giờ là <details>: chỉ nạp nội dung khi giáo viên thực sự mở ra.
    historyToggle.addEventListener('toggle', () => {
      state.historyOpen = historyToggle.open;
      if (state.historyOpen) loadHistory();
    });

    // Nút "Cấu hình" trên đầu và "Xem hướng dẫn" dưới ô nhập đều chỉ là lối tắt
    // mở đúng mục gấp lại ở cuối thanh, rồi cuộn tới cho thấy.
    const configBtn = document.getElementById('nxhs-config-toggle');
    const guideBtn = document.getElementById('nxhs-open-guide');
    if (configBtn) configBtn.addEventListener('click', () => openSection('nxhs-config-section'));
    if (guideBtn) guideBtn.addEventListener('click', () => openSection('nxhs-guide-section'));

    // Gõ lại nghĩa là nhóm nhận xét cũ đã dán xong -> thu Bước 2 về trạng thái chờ.
    inputEl.addEventListener('input', () => {
      if (inputEl.value.trim()) resetStep2();
    });
  }

  function openSection(id, toggle) {
    const el = document.getElementById(id);
    if (!el) return;
    el.open = toggle ? !el.open : true;
    if (el.open) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ─── Nhận diện vùng dữ liệu: ô tên đầu tiên & ô nhận xét đầu tiên ──────
   * Hai cách:
   *  1. "🔍 Tự nhận diện" – quét vài chục dòng đầu của bảng, dò tiêu đề kiểu
   *     "Họ và tên" / "Nhận xét" để suy ra cột tên, cột nhận xét và dòng bắt đầu.
   *  2. "📌 Lấy ô đang chọn" – lấy thẳng ô giáo viên đang click trên bảng.
   * Cả hai đều ghi vào cùng 3 cài đặt cũ (nameCol / commentCol / startRow) nên
   * popup và phần xử lý phía dưới không phải đổi gì.
   */

  // Name Box có thể hiện "Q2", "Q2:T2" hoặc "Sheet1!Q2" -> luôn lấy ô đầu tiên.
  function parseCellRef(ref) {
    if (!ref) return null;
    const first = String(ref).split(':')[0].split('!').pop().replace(/\$/g, '').trim();
    const m = first.match(/^([A-Za-z]{1,3})(\d+)$/);
    if (!m) return null;
    return { col: m[1].toUpperCase(), row: parseInt(m[2], 10) };
  }

  // 0 -> A, 25 -> Z, 26 -> AA (chỉ dùng khi gviz không trả về tên cột)
  function indexToCol(idx) {
    let s = '';
    let n = idx + 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // Bỏ dấu + viết thường để so tiêu đề ("Họ và tên" -> "ho va ten")
  function normalizeHeader(text) {
    return String(text)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Xếp theo độ ưu tiên: cụm càng cụ thể càng đứng trước.
  const HEADER_NAME_KEYS = [
    'ho va ten', 'ho ten', 'hovaten', 'ten hoc sinh', 'ten hs',
    'student name', 'full name', 'fullname',
    'hoc sinh', 'student', 'ten',
  ];
  const HEADER_COMMENT_KEYS = [
    'nhan xet', 'loi phe', 'danh gia', 'ghi chu',
    'comment', 'remark', 'feedback', 'note',
  ];

  function headerScore(normalizedText, keys) {
    for (let i = 0; i < keys.length; i++) {
      if (normalizedText.includes(keys[i])) return i;
    }
    return -1;
  }

  async function fetchGviz(sheetId, gid, query) {
    try {
      const gidParam = gid ? `&gid=${gid}` : '';
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=0&${query}${gidParam}`;
      const res = await fetch(url, { credentials: 'include' });
      const text = await res.text();
      if (!res.ok || text.includes('<!DOCTYPE html>')) return null;
      const json = JSON.parse(text.replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
      if (json.status === 'error') return null;
      return json;
    } catch (e) {
      return null;
    }
  }

  async function autoDetectRange() {
    const sheetId = getSheetId();
    if (!sheetId) {
      showStatus('Không đọc được ID bảng tính.', 'error');
      return;
    }
    showStatus('🔍 Đang quét bảng tính...', 'info');
    const gid = getSheetGid();

    // Ưu tiên dạng "range=" vì khi đó chỉ số dòng trả về khớp đúng dòng thật trên
    // bảng (dòng đầu tiên = dòng 1). Dạng "select *" chỉ dùng khi range bị từ chối.
    let json = await fetchGviz(sheetId, gid, 'range=A1:BZ40');
    if (!json) json = await fetchGviz(sheetId, gid, 'range=A1:Z40');
    if (!json) json = await fetchGviz(sheetId, gid, 'tq=' + encodeURIComponent('select * limit 40'));

    const rows = (json && json.table && json.table.rows) || [];
    if (!rows.length) {
      showStatus('Không quét được bảng. Kiểm tra sheet đã chia sẻ "Bất kỳ ai có liên kết" chưa.', 'error');
      return;
    }

    const cols = (json.table && json.table.cols) || [];
    const letterOf = (i) => (cols[i] && cols[i].id) ? cols[i].id : indexToCol(i);

    let bestName = null;
    let bestComment = null;
    for (let r = 0; r < rows.length; r++) {
      const cells = (rows[r] && rows[r].c) || [];
      for (let c = 0; c < cells.length; c++) {
        const raw = cells[c] && cells[c].v;
        if (raw === null || raw === undefined) continue;
        const text = normalizeHeader(raw);
        if (!text) continue;

        const ns = headerScore(text, HEADER_NAME_KEYS);
        if (ns >= 0 && (!bestName || ns < bestName.score)) {
          bestName = { score: ns, row: r, col: c, raw: String(raw).trim() };
        }
        const cs = headerScore(text, HEADER_COMMENT_KEYS);
        if (cs >= 0 && (!bestComment || cs < bestComment.score)) {
          bestComment = { score: cs, row: r, col: c, raw: String(raw).trim() };
        }
      }
    }

    if (!bestName) {
      showStatus('Không thấy tiêu đề cột tên học sinh. Hãy dùng nút 📌 để chỉ định thủ công.', 'error');
      return;
    }

    // Dòng bắt đầu = ô có chữ đầu tiên nằm DƯỚI ô tiêu đề (bỏ qua dòng trống xen giữa).
    let startRow = bestName.row + 2; // mặc định: ngay dưới tiêu đề (chỉ số 0 = dòng 1)
    for (let r = bestName.row + 1; r < rows.length; r++) {
      const cell = rows[r] && rows[r].c && rows[r].c[bestName.col];
      const v = cell && cell.v;
      if (v !== null && v !== undefined && String(v).trim()) {
        startRow = r + 1;
        break;
      }
    }

    const patch = { nameCol: letterOf(bestName.col), startRow };
    if (bestComment) patch.commentCol = letterOf(bestComment.col);
    applyRangeSettings(patch);

    let msg = `✅ Tên HS: ${patch.nameCol}${startRow} ("${bestName.raw}")`;
    if (bestComment) {
      showStatus(`${msg} • Nhận xét: ${patch.commentCol}${startRow} ("${bestComment.raw}")`, 'success');
    } else {
      showStatus(`${msg} • ⚠️ Chưa thấy cột nhận xét, hãy dùng nút 📌.`, 'error');
    }
  }

  function pickCellAs(kind) {
    const cell = parseCellRef(getActiveCellRef());
    if (!cell) {
      showStatus('Chưa đọc được ô đang chọn. Click vào một ô trên bảng rồi bấm lại.', 'error');
      return;
    }

    if (kind === 'name') {
      applyRangeSettings({ nameCol: cell.col, startRow: cell.row });
      showStatus(`✅ Tên HS bắt đầu từ ô ${cell.col}${cell.row}.`, 'success');
      return;
    }

    const rowMismatch = cell.row !== state.startRow;
    applyRangeSettings({ commentCol: cell.col });
    if (rowMismatch) {
      showStatus(
        `⚠️ Đã lấy cột nhận xét ${cell.col}, nhưng ô này ở dòng ${cell.row} còn danh sách HS bắt đầu ở dòng ${state.startRow}. Kiểm tra lại ô tên.`,
        'error'
      );
    } else {
      showStatus(`✅ Nhận xét bắt đầu từ ô ${cell.col}${cell.row}.`, 'success');
    }
  }

  function applyRangeSettings(patch) {
    const reloadNeeded = !!(patch.nameCol || patch.startRow);
    if (patch.nameCol) state.nameCol = patch.nameCol.toUpperCase();
    if (patch.commentCol) state.commentCol = patch.commentCol.toUpperCase();
    if (patch.startRow) state.startRow = parseInt(patch.startRow, 10);

    chrome.storage.local.set({
      nameCol: state.nameCol,
      commentCol: state.commentCol,
      startRow: state.startRow,
    });

    // Đẩy sang các tab Sheets khác đang mở (background bỏ qua chính tab này).
    try {
      const sent = chrome.runtime.sendMessage({
        action: 'settingsUpdated',
        nameCol: state.nameCol,
        commentCol: state.commentCol,
        startRow: state.startRow,
      });
      if (sent && typeof sent.catch === 'function') sent.catch(() => {});
    } catch (e) {}

    updateRangeDisplay();
    if (reloadNeeded) loadStudents();
  }

  function updateRangeDisplay() {
    const nameRef = `${state.nameCol}${state.startRow}`;
    const commentRef = `${state.commentCol}${state.startRow}`;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    // Dòng tóm tắt trên header + hai ô trong mục "Cấu hình bảng" luôn khớp nhau.
    set('nxhs-range-name', nameRef);
    set('nxhs-range-comment', commentRef);
    set('nxhs-field-name', nameRef);
    set('nxhs-field-comment', commentRef);
    set('nxhs-config-meta', `${nameRef} → ${commentRef}`);
  }

  /* ─── Bước 2: bảng nhắc dán ─────────────────────────────────────────
   * Trước đây câu "bấm Ctrl+V" chỉ là thông báo tự tắt sau 4 giây. Giờ nó ở lại
   * cho tới khi giáo viên gõ nhóm nhận xét tiếp theo.
   */
  function showResult({ count, targetCell, firstRow, lastRow, gapRows, gapsPreserved }) {
    const step2 = document.getElementById('nxhs-step2');
    if (!step2) return;

    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('nxhs-result-title', `Đã chép ${count} học sinh`);
    set('nxhs-result-range', firstRow === lastRow
      ? `${state.commentCol}${firstRow}`
      : `${state.commentCol}${firstRow} : ${state.commentCol}${lastRow}`);
    set('nxhs-result-cell', targetCell);

    // Khối dán luôn liền mạch, nên các dòng xen giữa cũng bị ghi đè. Nói rõ cho giáo
    // viên biết chúng được giữ nguyên hay đang có nguy cơ mất nội dung cũ.
    const warnEl = document.getElementById('nxhs-result-warn');
    if (warnEl) {
      warnEl.classList.remove('visible', 'safe');
      warnEl.textContent = '';
      if (gapRows && gapRows.length) {
        const shown = gapRows.slice(0, 6).map((r) => `${state.commentCol}${r}`).join(', ');
        const more = gapRows.length > 6 ? ` và ${gapRows.length - 6} ô nữa` : '';
        const icon = gapsPreserved
          ? '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.75"/><path d="M8 7.5v3M8 5.25v.01"/></svg>'
          : '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5 1.5 13.5h13L8 2.5Z"/><path d="M8 6.75v3M8 11.75v.01"/></svg>';
        warnEl.innerHTML = icon + '<div></div>';
        warnEl.lastElementChild.innerHTML = gapsPreserved
          ? `${gapRows.length} dòng xen giữa (<strong>${escapeHtml(shown + more)}</strong>) được giữ nguyên nội dung cũ.`
          : `${gapRows.length} dòng xen giữa (<strong>${escapeHtml(shown + more)}</strong>) sẽ bị dán đè ô trống ` +
            'vì không đọc được nội dung cũ. Bấm <strong>Ctrl + Z</strong> nếu lỡ mất.';
        warnEl.classList.add('visible');
        if (gapsPreserved) warnEl.classList.add('safe');
      }
    }

    step2.classList.add('done');
    step2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetStep2() {
    const step2 = document.getElementById('nxhs-step2');
    if (step2) step2.classList.remove('done');
  }

  async function processInput() {
    const text = document.getElementById('nxhs-fast-input').value;
    if (!text.trim()) return;

    // Bắt đầu đọc lại bảng NGAY từ đầu để lát nữa còn giữ nguyên nhận xét cũ của
    // những em nằm xen giữa mà lần nhập này không nhắc tới (xem Bước 6).
    const freshRowsPromise = fetchSheetRows();

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
      // Chỉ gồm các dòng lỗi, không còn câu mở đầu "Con chú ý:".
      const comment = Array.from(data.errors)
        .map(e => "- " + e.charAt(0).toUpperCase() + e.slice(1))
        .join('\n');
      return { row: data.student.row, name: data.student.name, comment: comment };
    });

    parsedData.sort((a, b) => a.row - b.row);
    const minRow = parsedData[0].row;
    const maxRow = parsedData[parsedData.length - 1].row;

    // --- Bước 5: Điều hướng tới Google Sheets ---
    const targetCell = `${state.commentCol}${minRow}`;
    navigateToCell(targetCell);

    // --- Bước 6: Font chữ cho phần dán ---
    // Font chữ cố định Times New Roman (không lấy theo thanh công cụ nữa).
    // Cỡ chữ vẫn quét từ thanh công cụ Sheets để khớp với phần còn lại của bảng.
    const fontFamily = 'Times New Roman';
    let fontSize = '10pt';
    try {
      const sizeEl = document.querySelector('#docs-fontsize-input-box') || document.querySelector('.goog-toolbar-text-input') || document.querySelector('input[aria-label="Cỡ chữ"]') || document.querySelector('input[aria-label="Font size"]');
      if (sizeEl && sizeEl.value) fontSize = sizeEl.value.trim() + 'pt';
    } catch(e) {}

    const manualColspan = parseInt(document.getElementById('nxhs-colspan').value) || 1;
    const clipboardRows = [];
    const htmlRows = [];
    const gapRowNumbers = [];

    // Khối dán là một vùng LIỀN MẠCH từ dòng em đầu tiên tới em cuối cùng. Những
    // dòng xen giữa (em không được nhắc tên) vẫn bị dán đè, nên phải đọc lại nội
    // dung đang có để ghi lại y nguyên -> không xoá mất nhận xét cũ của các em đó.
    const gapRows = (maxRow - minRow + 1) - parsedData.length;
    const commentIdx = colToIndex(state.commentCol);
    let readExisting = null;
    if (gapRows > 0) {
      // Chỉ cần chờ đọc bảng khi thực sự có dòng xen giữa (nhập 1 em hoặc các em
      // liền nhau thì không phải chờ gì thêm).
      const freshRows = await freshRowsPromise;
      if (freshRows) {
        state.sheetRows = freshRows;
        readExisting = (r) => ((freshRows[r - 1] && freshRows[r - 1][commentIdx]) || '').toString();
      }
    }

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
        // Dòng xen giữa: ghi lại đúng nội dung đang có (nếu đọc được) để không xoá mất.
        gapRowNumbers.push(r);
        const keep = readExisting ? readExisting(r) : '';
        let plainKeep = keep;
        if (plainKeep.includes('\n') || plainKeep.includes('"')) {
          plainKeep = `"${plainKeep.replace(/"/g, '""')}"`;
        }
        clipboardRows.push(plainKeep);
        const htmlKeep = escapeHtml(keep).replace(/\n/g, '<br>');
        htmlRows.push(`<tr><td colspan="${manualColspan}" style="vertical-align:top; border:none; white-space:normal;">${htmlKeep}</td></tr>`);
      }
    }

    htmlContent += htmlRows.join('') + '</table>';
    const clipboardText = clipboardRows.join('\n');

    // Hiển thị preview
    document.getElementById('nxhs-preview-target').textContent = `(Gồm ${parsedData.length} HS, Bắt đầu từ ô ${targetCell})`;
    
    let previewText = parsedData.map(d => `[${d.name}]\n${d.comment}`).join('\n\n');

    const riskWarnings = [];
    if (!state.rowsReliable) {
      riskWarnings.push('⚠️ Đang đọc danh sách ở chế độ dự phòng. Nếu bảng có dòng đang ẩn, vị trí dán có thể lệch dòng — hãy bỏ ẩn dòng rồi bấm 🔄 Làm mới.');
    }
    if (gapRows > 0 && !readExisting) {
      riskWarnings.push(`⚠️ Không đọc được nội dung cũ: ${gapRows} dòng nằm xen giữa sẽ BỊ XOÁ nhận xét khi dán. Hãy nhập lần lượt từng em cho an toàn.`);
    }
    if (riskWarnings.length > 0) {
      previewText = riskWarnings.join('\n') + '\n\n' + previewText;
    }

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
      showResult({
        count: parsedData.length,
        targetCell: targetCell,
        firstRow: minRow,
        lastRow: maxRow,
        gapRows: gapRowNumbers,
        gapsPreserved: !!readExisting,
      });
      if (notFoundLines.length === 0) {
        document.getElementById('nxhs-fast-input').value = '';
      }
    }).catch(() => {
      showStatus(`Đã nhảy tới ${targetCell} nhưng không ghi được vào bộ nhớ tạm. Hãy bôi đen và copy thủ công.`, 'error');
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

  // 0 dựa trên chữ cái cột: A -> 0, Q -> 16, AA -> 26
  function colToIndex(col) {
    const s = String(col || 'A').toUpperCase();
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i) - 64;
      if (code < 1 || code > 26) return 0;
      n = n * 26 + code;
    }
    return n - 1;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function httpGetText(url) {
    return new Promise((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        // KHÔNG bật withCredentials: /export chuyển hướng sang googleusercontent.com,
        // bật cờ này sẽ làm request bị CORS chặn (status 0). Cookie đăng nhập vẫn
        // được gửi kèm vì đây là request cùng origin với trang Sheets.
        xhr.onload = () => resolve(xhr.status === 200 ? xhr.responseText : null);
        xhr.onerror = () => resolve(null);
        xhr.send();
      } catch (e) {
        resolve(null);
      }
    });
  }

  /* Đọc TOÀN BỘ tab đang mở bằng bản xuất CSV. rows[i] ứng với dòng (i + 1).
   *
   * Vì sao không dùng /gviz/tq nữa: gviz BỎ QUA các dòng đang bị ẩn. Danh sách
   * trả về vì thế ngắn hơn bảng thật, và cách tính "dòng = dòng bắt đầu + thứ tự
   * trong mảng" làm mọi học sinh nằm dưới dòng ẩn bị lệch lên đúng số dòng đã ẩn
   * (lớp 31 em, ẩn 1 dòng -> chỉ thấy 30 em, nhận xét của em thứ 15 trở đi rơi
   * vào ô của em ngay phía trên). Bản xuất CSV giữ nguyên cả dòng ẩn nên số dòng
   * luôn khớp với bảng.
   */
  async function fetchSheetRows() {
    const sheetId = getSheetId();
    if (!sheetId) return null;
    const gid = getSheetGid();
    // Giữ nguyên tiền tố /u/<n>/ của tài khoản đang đăng nhập (nếu có).
    let base = location.origin + location.pathname.replace(/\/(edit|view|preview|htmlview)(\/.*)?$/, '');
    if (!/\/spreadsheets\/(u\/\d+\/)?d\/[^/]+$/.test(base)) {
      base = `https://docs.google.com/spreadsheets/d/${sheetId}`;
    }
    const text = await httpGetText(`${base}/export?format=csv${gid ? `&gid=${gid}` : ''}`);
    if (!text || text.slice(0, 300).indexOf('<!DOCTYPE html') !== -1) return null;
    return parseCsv(text);
  }

  async function loadStudents() {
    const sheetId = getSheetId();
    if (!sheetId) return;

    const col = state.nameCol;
    const row = state.startRow;

    updateStudentCount('Đang tải...');

    // Ưu tiên bản xuất CSV: số dòng đọc được khớp đúng với bảng (kể cả dòng ẩn).
    const csvRows = await fetchSheetRows();
    if (csvRows) {
      const idx = colToIndex(col);
      const students = [];
      for (let i = row - 1; i < csvRows.length; i++) {
        const name = ((csvRows[i] && csvRows[i][idx]) || '').toString().trim();
        if (name) students.push({ name, row: i + 1 });
      }
      state.sheetRows = csvRows;
      state.rowsReliable = true;
      state.students = students;
      updateStudentCount(`✅ Đã nhận diện ${students.length} học sinh (Cột ${col})`);
      return;
    }

    // Dự phòng khi không tải được CSV. CẢNH BÁO: gviz bỏ qua dòng ẩn -> có thể lệch dòng.
    state.sheetRows = null;
    state.rowsReliable = false;
    await loadStudentsViaGviz();
  }

  async function loadStudentsViaGviz() {
    const sheetId = getSheetId();
    if (!sheetId) return;

    const gid = getSheetGid();
    const col = state.nameCol;
    const row = state.startRow;

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

      updateStudentCount(
        `⚠️ Đã nhận diện ${state.students.length} học sinh (Cột ${col}) — chế độ dự phòng, ` +
        `nếu bảng đang ẩn dòng thì vị trí dán có thể bị lệch.`
      );
    } catch (err) {
      state.students = [];
      updateStudentCount(`Lỗi: ${err.message}`);
    }
  }

  function updateStudentCount(msg) {
    const el = document.getElementById('nxhs-student-count');
    if (el) el.textContent = msg;

    // Rút gọn lại cho dòng tóm tắt trên header: chỉ cần con số.
    const ctx = document.getElementById('nxhs-ctx-count');
    if (!ctx) return;
    const found = /(\d+)\s*học sinh/.exec(msg);
    const loading = msg.indexOf('Đang tải') === 0;
    ctx.textContent = found ? `${found[1]} học sinh` : (loading ? 'Đang tải…' : 'Chưa có danh sách');
    ctx.classList.toggle('nxhs-ctx-warn', !found && !loading);

    // Đọc hỏng danh sách thì mở sẵn phần cấu hình, vì gần như luôn là sai cột/dòng.
    if (!found && !loading) openSection('nxhs-config-section');
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
      if (!cellRef) return;
      const el = document.getElementById('nxhs-cell-ref');
      if (el) el.textContent = cellRef;
      // Hai nút "Lấy ô ..." hiện luôn tên ô sẽ lấy, nên không còn hai nút giống hệt nhau.
      const cell = parseCellRef(cellRef);
      const label = cell ? `${cell.col}${cell.row}` : '--';
      document.querySelectorAll('#nxhs-sidebar .nxhs-pick-ref').forEach((b) => {
        b.textContent = label;
      });
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