# 📝 Nhận Xét Học Sinh Siêu Tốc (Chrome Extension v2.0)

Một tiện ích mở rộng (Chrome Extension) tối ưu hóa thời gian dành riêng cho Giáo viên tiếng Anh. Giúp xử lý và tự động điền hàng loạt ghi chú, nhận xét viết tay "lộn xộn" vào đúng tên từng học sinh trên Google Sheets chỉ trong vòng 1 giây.

![Banner](https://img.shields.io/badge/Version-2.0-blue)
![Platform](https://img.shields.io/badge/Platform-Google_Chrome-green)

---

## ✨ Tính Năng Nổi Bật

- 🧠 **Phân Tích Ngôn Ngữ Tự Nhiên (NLP):** 
  - Không cần gõ đúng cú pháp cứng nhắc.
  - Hệ thống tự động bóc tách tên học sinh và lỗi trong câu (Hỗ trợ gõ tên viết tắt, tên có dấu cách như "Hà Anh", "Minh Hùng"...).
  - Tự động gán 1 lỗi cho nhiều học sinh nếu được liệt kê cùng lúc (VD: *"Nam, hà anh, vy sai to V"*).
- 🪄 **Giữ Nguyên Định Dạng Gộp Ô (Colspan):** Hỗ trợ tự cấu hình số Cột Gộp. Khi dán (`Ctrl+V`), Google Sheets sẽ không bị phá vỡ cấu trúc gộp ô.
- 🎨 **Đồng Bộ Font Chữ Tự Động:** Thông minh quét qua thanh công cụ của Google Sheets để sao chép y hệt `Font Family` và `Font Size` hiện tại, giúp dữ liệu dán vào trông hoàn toàn tự nhiên.
- 🌞 **Giao Diện Light Theme Chuyên Nghiệp:** Thanh Sidebar thiết kế hiện đại, mượt mà, tối ưu không gian cho dân văn phòng và nhà trường.
- 🕒 **Lưu Lịch Sử & Hoàn Tác:** Theo dõi những lần xử lý gần nhất trong bộ nhớ đệm (Local Storage).

---

## 🛠️ Hướng Dẫn Cài Đặt (Cho Đồng Nghiệp)

Tiện ích này chạy cục bộ dưới dạng `Unpacked Extension`. Vui lòng làm theo các bước sau:

1. Bấm vào nút xanh **Code** ở trang GitHub này ➡ Chọn **Download ZIP**.
2. Giải nén file vừa tải về ra một thư mục cố định trên máy tính (VD: `D:\NhanXetHocSinh`).
3. Mở trình duyệt Chrome, truy cập vào đường dẫn: `chrome://extensions/`
4. Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển) ở góc phải trên cùng màn hình.
5. Bấm vào nút **Load unpacked** (Tải tiện ích đã giải nén) ➡ Chọn đúng thư mục vừa giải nén ở bước 2.
6. Xong! Biểu tượng tiện ích đã sẵn sàng hoạt động.

---

## 📖 Hướng Dẫn Sử Dụng Nhanh

1. Mở trang tính Google Sheets chứa danh sách điểm/nhận xét của học sinh *(Lưu ý: Sheet phải được cấp quyền "Bất kỳ ai có liên kết" - Anyone with the link).*
2. Sẽ có một nút bấm nhỏ hình tia sét **⚡ NX** bên cạnh viền màn hình, bấm vào đó để mở thanh nhập liệu.
3. Chép toàn bộ ghi chú (nháp) của bạn dán vào ô **Nhập ghi chú tự do**.
   - *Ví dụ mẫu:*
     > Trang mìn ving? <br>
     > Hà it is right up you street, thái an, trinh, hân, bee, minh hùng minh phong<br>
     > Trí sue số ít V thêm s<br>
     > Hân help sbd (to)V
4. Chỉnh **Số cột gộp** nếu ô đích của bạn đang gộp nhiều cột (VD: gộp từ Q đến T thì nhập `4`).
5. Nhấn **Enter**. Hệ thống sẽ tự phân giải, bay ngay đến dòng của em đầu tiên.
6. Bạn chỉ việc nhấn **`Ctrl + V`** (Dán). Toàn bộ lời nhận xét đẹp đẽ đã được điền vào đúng dòng tương ứng!

---

## 💻 Kỹ Thuật Sử Dụng

- Manifest V3 API
- Google Visualization API (Gviz Tq)
- ClipboardItem API (Bơm thẳng dữ liệu HTML/Plain Text vào bộ nhớ tạm để vượt rào Google Sheets)
- Vanilla JavaScript & CSS3 Modular

---
*Phát triển nhằm mục đích tối giản hóa gánh nặng hành chính cho giáo viên.*
