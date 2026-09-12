# 📝 Nhận Xét Học Sinh Siêu Tốc (Chrome Extension v3.0)

Một tiện ích mở rộng (Chrome Extension) tối ưu hóa thời gian dành riêng cho Giáo viên tiếng Anh. Giúp xử lý và tự động điền hàng loạt ghi chú, nhận xét viết tay "lộn xộn" vào đúng tên từng học sinh trên Google Sheets chỉ trong vòng 1 giây.

![Banner](https://img.shields.io/badge/Version-3.0-blue)
![Platform](https://img.shields.io/badge/Platform-Google_Chrome-green)

---

## ✨ Tính Năng Nổi Bật

- 🔍 **Tự Nhận Diện Vùng Dữ Liệu:** Bấm một nút, tiện ích quét dòng tiêu đề của bảng để tìm ra cột tên học sinh, cột nhận xét và dòng bắt đầu — không phải tự gõ tay. Hoặc click thẳng vào ô trên bảng rồi bấm **Lấy ô**.
- 🎯 **Khớp Họ Tên Chính Xác Tuyệt Đối:** Chỉ nhận khi gõ đủ họ tên y như trên bảng, nên hai em tên gần giống nhau ("Nguyễn Thị Mai" và "Nguyễn Thị Mai Khanh") không bao giờ bị gán nhầm. Gõ thiếu thì tiện ích gợi ý lại đúng họ tên, kể cả khi gõ không dấu.
- ⚡ **Gán Một Lỗi Cho Nhiều Em:** Liệt kê nhiều học sinh trước dấu `:`, hoặc gõ thêm `+Họ tên` ở cuối dòng lỗi khi chợt nhớ ra em nữa.
- 🛡️ **Không Xoá Mất Nhận Xét Cũ:** Khối dán là một vùng liền mạch, nên tiện ích đọc lại bảng và ghi y nguyên nội dung của những dòng xen giữa — nhận xét sẵn có của các em không bị dán đè thành ô trống.
- 🪄 **Giữ Nguyên Định Dạng Gộp Ô (Colspan):** Cấu hình số cột gộp, khi dán (`Ctrl+V`) cấu trúc gộp ô của Google Sheets không bị phá vỡ.
- 🖋️ **Font Times New Roman:** Nội dung dán vào luôn là Times New Roman, cỡ chữ đi theo bảng.
- 🧭 **Giao Diện Hai Bước:** Bước 1 gõ, Bước 2 dán. Lời nhắc `Ctrl + V` ở lại trên màn hình kèm ô đích cho tới khi bạn gõ nhóm tiếp theo, không còn là thông báo chớp tắt.
- 🕒 **Lưu Lịch Sử:** Theo dõi 50 lần xử lý gần nhất, bấm vào là chép lại được.

---

## 🛠️ Hướng Dẫn Cài Đặt (Cho Đồng Nghiệp)

Tiện ích này chạy cục bộ dưới dạng `Unpacked Extension`. Vui lòng làm theo các bước sau:

1. Bấm vào nút xanh **Code** ở trang GitHub này ➡ Chọn **Download ZIP**.
2. Giải nén file vừa tải về ra một thư mục cố định trên máy tính (VD: `D:\NhanXetHocSinh`).
3. Mở trình duyệt Chrome, truy cập vào đường dẫn: `chrome://extensions/`
4. Bật công tắc **Developer mode** (Chế độ dành cho nhà phát triển) ở góc phải trên cùng màn hình.
5. Bấm vào nút **Load unpacked** (Tải tiện ích đã giải nén) ➡ Chọn đúng thư mục vừa giải nén ở bước 2.
6. Xong! Biểu tượng tiện ích đã sẵn sàng hoạt động.

> Mỗi lần cập nhật code mới, nhớ bấm **Reload** (⟳) ở thẻ tiện ích rồi **F5** lại trang Google Sheets.

---

## 📖 Hướng Dẫn Sử Dụng Nhanh

1. Mở trang tính Google Sheets chứa danh sách học sinh *(Lưu ý: Sheet phải được cấp quyền **"Bất kỳ ai có liên kết"** — Anyone with the link).*
2. Bấm nút tia sét **⚡ NX** ở mép phải màn hình để mở thanh nhập liệu (tiện ích khởi động sau khoảng 2–3 giây).
3. Mở mục **Cấu hình bảng** ➡ bấm **Tự nhận diện từ bảng**. Kiểm tra dòng tóm tắt trên đầu thanh phải hiện đúng, VD: `16 học sinh · Tên A2 → Nhận xét Q2`.
4. Chỉnh **Số cột gộp** nếu ô nhận xét đang gộp nhiều cột (VD: gộp từ Q đến T thì nhập `4`).
5. Gõ nhận xét vào ô **Bước 1**, rồi nhấn **Enter**.
6. Tiện ích chép sẵn dữ liệu và nhảy con trỏ tới đúng ô. **Bước 2** hiện ra, bạn chỉ việc bấm **`Ctrl + V`** ngay trên bảng.

---

## ⌨️ Cú Pháp Nhập Liệu

```
Họ tên đầy đủ 1, Họ tên đầy đủ 2 : lỗi 1; lỗi 2
```

| Ký hiệu | Ý nghĩa |
|---|---|
| `:` | Ngăn cách phần **tên** (bên trái) với phần **lỗi** (bên phải) |
| `,` `;` `/` `&` | Ngăn cách nhiều học sinh ở phần tên |
| `;` | Ngăn cách nhiều lỗi ở phần lỗi, mỗi lỗi thành một gạch đầu dòng |
| `+Họ tên` | Thêm học sinh dùng chung lỗi, đặt ở **cuối dòng** |
| *(dòng không có `:`)* | Cộng dồn lỗi cho nhóm học sinh của dòng ngay trên |
| `Enter` / `Shift + Enter` | Xử lý / xuống dòng |

**Ví dụ:**

```
Trần Văn Nam, Phạm Hà Anh : love + Ving chứ không phải to V; thiếu s ngôi thứ 3
chia sai thì quá khứ đơn
Lê Khánh Vy : interested in phải có be đằng trước +Đỗ Hoài Phong
```

Dòng 2 cộng thêm lỗi cho **cả Nam và Hà Anh**. Dòng 3 gán lỗi cho **cả Vy và Phong**.

Kết quả điền vào ô nhận xét của từng em:

```
- Love Ving chứ không phải to V
- Thiếu s ngôi thứ 3
- Chia sai thì quá khứ đơn
```

> ⚠️ **Tên phải gõ y như trên bảng.** Bảng ghi `Trần Văn Nam` thì gõ `nam` hay `văn nam` đều không được tính — chỉ được khác nhau về viết hoa/thường và khoảng trắng thừa. Gõ thiếu thì đọc phần **Xem trước** để thấy gợi ý họ tên đúng.

---

## 💻 Kỹ Thuật Sử Dụng

- Manifest V3 API
- Đọc danh sách qua bản xuất CSV của trang tính (`/export?format=csv`), dự phòng bằng Google Visualization API (Gviz Tq)
- ClipboardItem API (Bơm thẳng dữ liệu HTML/Plain Text vào bộ nhớ tạm để vượt rào Google Sheets)
- Vanilla JavaScript & CSS3 Modular — không cần build, không cần cài thêm gì

---
*Phát triển nhằm mục đích tối giản hóa gánh nặng hành chính cho giáo viên.*
