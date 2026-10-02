# TÀI LIỆU DỰ ÁN AI CHATBOT OFFLINE (LOCAL AI)

Tài liệu này dùng để lưu trữ toàn bộ cơ chế hoạt động và cách sử dụng dự án Chatbot Offline. Các AI sau này khi đọc file này sẽ hiểu ngay cấu trúc dự án để giúp bạn sửa lỗi hoặc nâng cấp tính năng.

---

## 1. TỔNG QUAN DỰ ÁN
Đây là một dự án **AI chạy hoàn toàn Offline** (Local LLM) bằng sức mạnh phần cứng (GPU/CPU) của máy tính cá nhân. Dữ liệu trò chuyện không bị gửi ra ngoài Internet, đảm bảo bảo mật tuyệt đối 100%.
- **Bộ não AI (Model):** Qwen 4B (4 tỷ tham số) thông qua nền tảng Ollama.
- **Backend AI (Python):** Giao tiếp với Ollama và xử lý luồng hội thoại.
- **Web Frontend & API (Node.js + React):** Giao diện người dùng và hệ thống quản lý tài khoản/lịch sử chat.

---

## 2. CÁCH KHỞI ĐỘNG HỆ THỐNG
Dự án đã được tự động hóa hoàn toàn. Bạn chỉ cần:
1. Mở file `ai_engine/start_all.py`
2. Chạy file này bằng Python.
Hệ thống sẽ tự động bật ngầm Ollama, bật AI Server (Port 5005) và bật Web Server (Port 5000).

---

## 3. CƠ CHẾ HOẠT ĐỘNG (Dành cho AI Dev đọc)

### A. Hệ thống LLM Server (`ai_engine/llm_server.py`)
- Lắng nghe tại `0.0.0.0:5005`.
- Làm nhiệm vụ nhận chuỗi lịch sử chat từ Web, nạp thêm **System Prompt** (định hình tính cách AI) rồi gửi cho Ollama (`127.0.0.1:11434`).
- Đang ép giới hạn **Context Window = 2048 tokens** (Trí nhớ ngắn hạn) để tiết kiệm VRAM và tăng tốc độ xử lý.
- Xử lý luồng (Stream) từng chữ từ Ollama trả về cho Web Server.

### B. Hệ thống Web Server (`chatbot_ui/backend/server.js`)
- Lắng nghe tại `0.0.0.0:5000`.
- Làm 2 nhiệm vụ chính:
  1. **Cung cấp API:** Lưu trữ tài khoản (`users.json`) và lịch sử chat (`data.json`). Làm cầu nối trung gian gọi sang Python (Port 5005) bằng `http.request` native (tránh lỗi timeout của axios).
  2. **Phục vụ giao diện (Static Files):** Trả về bản build tĩnh của React nằm ở thư mục `chatbot_ui/frontend/build`.

### C. Hệ thống Giao diện React (`chatbot_ui/frontend`)
- Khai báo biến môi trường thông minh: `` const apiBase = `http://${window.location.hostname}:5000`; ``. Cơ chế này tự động phát hiện IP của người dùng, giúp điện thoại ở ngoài truy cập vào không bị lỗi.

---

## 4. CÁCH TRUY CẬP TỪ ĐIỆN THOẠI (MẠNG LAN / 4G)
Vì Web Server lắng nghe trên `0.0.0.0:5000` và Frontend dùng `window.location.hostname`, dự án này **hỗ trợ truy cập từ mọi thiết bị khác 100%** miễn là cùng mạng nội bộ.

**Cách 1: Ở nhà (Dùng chung WiFi)**
- Mở bảng lệnh Terminal gõ `ipconfig` lấy IPv4 (VD: `192.168.1.10`).
- Mở điện thoại gõ: `http://192.168.1.10:5000`

**Cách 2: Mang Laptop ra ngoài (Không có WiFi chung)**
- Bật **Phát WiFi (Mobile Hotspot)** từ điện thoại.
- Cho Laptop bắt WiFi của điện thoại.
- Gõ `ipconfig` lấy IP mới (VD: `172.20.10.4`).
- Lấy điện thoại gõ IP mới: `http://172.20.10.4:5000`. (Sử dụng AI siêu xịn mà không tốn dung lượng 4G).

*⚠️ YÊU CẦU QUAN TRỌNG: Phải mở cổng 5000 ở Tường lửa (Firewall) của Windows bằng lệnh Powershell (Quyền Admin):*
`New-NetFirewallRule -DisplayName "Mo Cong 5000 Cho Chatbot" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow`

---

## 5. CÁCH CẬP NHẬT GIAO DIỆN SAU KHI SỬA CODE
Vì Web Server Node.js phục vụ thư mục `build`, nên nếu sau này bạn (hoặc AI) sửa bất kỳ file giao diện nào trong thư mục `chatbot_ui/frontend/src/` (ví dụ sửa màu sắc, thêm logo...), bạn **BẮT BUỘC** phải biên dịch lại giao diện bằng cách:
1. Mở Terminal (Ctrl + `).
2. Di chuyển vào thư mục frontend: `cd "d:\DA\DA1\My Chatbot\chatbot_ui\frontend"`
3. Chạy lệnh: **`npm run build`**
Đợi lệnh chạy xong thì code mới sẽ lập tức được áp dụng cho toàn bộ điện thoại và máy tính!

---

## 6. MỘT SỐ KIẾN THỨC BỔ SUNG VỀ AI (Q&A)

**Q: Tại sao thỉnh thoảng AI trả lời câu đầu tiên rất chậm?**
A: Do mô hình Qwen nặng vài GB, lần đầu tiên hỏi nó cần 10-30 giây để tải toàn bộ não bộ từ Ổ cứng (HDD/SSD) lên Bộ nhớ Card đồ họa (VRAM). Các câu hỏi sau sẽ được trả lời ngay lập tức.

**Q: Tại sao Web Server báo cáo AI trả về 7000 ký tự, nhưng đáp án chỉ có 10 chữ?**
A: Con AI này có cơ chế **Chain of Thought (Tư duy theo chuỗi)**. Trong 7000 ký tự đó, có tới 6950 ký tự là nó đang "lẩm bẩm tự kỷ" suy luận trong đầu (Phần `🧠 SUY NGHĨ`). Chỉ có 50 ký tự cuối cùng là đáp án chốt hạ (`🎯 TRẢ LỜI`). Mã nguồn LLM Server đã gộp cả 2 phần này truyền về giao diện.

**Q: Nhiều máy tính/điện thoại truy cập chat cùng lúc được không?**
A: Hoàn toàn được. Web sẽ tải mượt mà cho tất cả. Tuy nhiên, nếu 2 người ấn nút Gửi câu hỏi vào cùng 1 tích tắc, Card đồ họa sẽ bắt 1 người "xếp hàng" chờ. Nó sẽ trả lời người 1 xong rồi mới dồn sức trả lời người 2 (vì chỉ có 1 Card đồ họa).

**Q: Tại sao file nhật ký `llm_server.log` lại trống trơn?**
A: Đó là chủ đích của lập trình viên. LLM Server (Python) đóng vai trò cày ải rất nặng, nó được code để **im lặng làm việc ngầm**, không `print()` bất kỳ thứ gì ra màn hình để tránh giật lag. Việc in báo cáo độ dài được giao cho Web Server (Node.js) làm.
