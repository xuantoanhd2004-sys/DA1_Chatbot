import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import urllib.request
import traceback
import sys

# Khắc phục lỗi in Emoji ra Windows Terminal
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL_NAME = "qwen3:4b" # Nâng cấp lên Qwen3 4B (thông minh hơn nhiều, vẫn nhẹ ~3GB VRAM)

# (chat_history đã được xử lý bởi server.js, không cần lưu ở đây nữa)

class WebhookHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/webhooks/rest/webhook':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_json = json.loads(post_data.decode('utf-8'))
                
                user_message = req_json.get("message", "")
                chat_history = req_json.get("history", [])
                
                # CHỈ GIỮ 4 TIN NHẮN GẦN NHẤT ĐỂ TĂNG TỐC ĐỘ (giảm Prompt Eval time từ 90s -> 2s)
                chat_history = chat_history[-4:] if len(chat_history) > 4 else chat_history
                
                # Tạo dải tin nhắn gửi cho Ollama với system prompt xịn
                messages = [
                    {"role": "system", "content": "Bạn là một AI siêu trí tuệ. Hãy giải đáp mọi thắc mắc của người dùng. CHÚ Ý QUAN TRỌNG VỀ NGÔN NGỮ: Người dùng thường xuyên dùng từ lóng, viết tắt tiếng Việt trên mạng (ví dụ: 't' hay 'tao' nghĩa là người dùng, 'm' hay 'mày' nghĩa là bạn - tức là AI). Nếu người dùng hỏi 'mày là ai' hay 'thông tin về mày', tức là họ đang hỏi thông tin về BẠN (AI) chứ không phải hỏi định nghĩa từ vựng. Hãy trả lời ngắn gọn, đi thẳng vào vấn đề. TUYỆT ĐỐI KHÔNG tự đặt câu hỏi thay cho người dùng, KHÔNG giả lập hội thoại của người dùng, chỉ trả lời phần của bạn. /no_think"}
                ]
                
                # Nạp toàn bộ lịch sử trò chuyện vào bộ nhớ của AI
                for msg in chat_history:
                    # Chuyển đổi định dạng từ from/text sang role/content của Ollama
                    if msg.get("text"):
                        role = "assistant" if msg.get("from") == "bot" else "user"
                        messages.append({"role": role, "content": msg.get("text")})
                
                # Thêm tin nhắn hiện tại nếu nó chưa nằm ở cuối lịch sử
                if user_message and (not messages or messages[-1].get("content") != user_message):
                    messages.append({"role": "user", "content": user_message})
                
                # keep_alive="3m" = giữ model trong VRAM 3 phút sau lần chat cuối
                # num_ctx=2048 = Giới hạn context để không ngốn RAM và VRAM, TĂNG TỐC ĐỘ PHẢN HỒI GẤP 10 LẦN
                ollama_req = {
                    "model": MODEL_NAME,
                    "messages": messages,
                    "stream": True,
                    "keep_alive": "3m",
                    "options": {
                        "num_ctx": 2048
                    }
                }
                
                req = urllib.request.Request(OLLAMA_URL, data=json.dumps(ollama_req).encode('utf-8'), headers={'Content-Type': 'application/json'})
                
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Connection', 'close')
                self.end_headers()
                self.wfile.flush()
                
                full_bot_reply = ""
                is_thinking = False
                has_finished_thinking = False
                
                try:
                    with urllib.request.urlopen(req) as response:
                        for line in response:
                            if line:
                                data = json.loads(line.decode('utf-8'))
                                msg = data.get("message", {})
                                
                                content = msg.get("content", "")
                                thinking = msg.get("thinking", "")
                                
                                chunk = ""
                                if thinking:
                                    if not is_thinking:
                                        chunk += "🧠 **SUY NGHĨ:**\n\n"
                                        is_thinking = True
                                    # Thêm 2 dấu cách trước \n để Markdown tự động xuống dòng
                                    chunk += thinking.replace("\n", "  \n")
                                    
                                if content:
                                    if is_thinking and not has_finished_thinking:
                                        chunk += "\n\n---\n🎯 **TRẢ LỜI:**\n\n"
                                        has_finished_thinking = True
                                    chunk += content

                                if chunk:
                                    full_bot_reply += chunk
                                    encoded_chunk = chunk.encode('utf-8')
                                    self.wfile.write(encoded_chunk)
                                    self.wfile.flush()
                                if data.get("done"):
                                    break
                except Exception as e:
                    if isinstance(e, (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
                        return # Bỏ qua, thoát hàm để urllib đóng kết nối với Ollama ngay lập tức
                    err_msg = "\n[Lỗi kết nối tới AI]"
                    try:
                        self.wfile.write(err_msg.encode('utf-8'))
                        self.wfile.flush()
                    except:
                        pass
                
                # Không cần lưu vào chat_history ở đây nữa vì server.js sẽ tự động lưu!

                
            except Exception as e:
                import traceback
                traceback.print_exc()
                self.send_response(500)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

from http.server import ThreadingHTTPServer

def run(server_class=ThreadingHTTPServer, handler_class=WebhookHandler, port=5005):
    server_address = ('0.0.0.0', port)
    httpd = server_class(server_address, handler_class)
    print(f"============================================================")
    print(f"🚀 LLM Chat Server (có bộ nhớ) đang chạy tại port {port}...")
    print(f"🔗 Kết nối tới Local AI: {OLLAMA_URL} (Model: {MODEL_NAME})")
    print(f"============================================================")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
