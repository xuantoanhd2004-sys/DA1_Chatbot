const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const http = require("http");
// axios removed - streaming endpoint dùng http.request native

const app = express();
app.use(cors());
app.use(express.json());

// Middleware để xử lý React SPA routing (Fix lỗi người dùng F5 hoặc gõ trực tiếp URL)
app.use((req, res, next) => {
  // Nếu là method GET, có header accept html, và đường dẫn không phải static files
  if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
    const buildPath = path.join(__dirname, "../frontend/build");
    if (fs.existsSync(buildPath)) {
      return res.sendFile(path.join(buildPath, "index.html"));
    }
  }
  next();
});
const DATA_FILE = path.join(__dirname, "data.json");
const USER_FILE = path.join(__dirname, "users.json");

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading data file:", err);
    return [];
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error writing data file:", err);
    return false;
  }
}

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync(USER_FILE)) fs.writeFileSync(USER_FILE, "[]");
  const users = JSON.parse(fs.readFileSync(USER_FILE, "utf-8"));
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
  res.json({ message: "Đăng nhập thành công", username: user.username });
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync(USER_FILE)) fs.writeFileSync(USER_FILE, "[]");
  const users = JSON.parse(fs.readFileSync(USER_FILE, "utf-8"));

  if (users.find(u => u.username === username)) return res.status(400).json({ message: "User đã tồn tại" });

  users.push({ username, password });
  fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
  res.json({ message: "Đăng ký thành công" });
});

app.post("/logout", (req, res) => res.json({ message: "Đã đăng xuất" }));

app.get("/chat/all", (req, res) => {
  const chats = readData();
  const { username } = req.query;
  if (!username) return res.json(chats);
  const userChats = chats.filter(c => c.user === username);
  res.json(userChats);
});

app.get("/chat/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const chat = readData().find((c) => c.id === id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json(chat);
});

app.post("/chat", (req, res) => {
  const chats = readData();
  const newId = Date.now();
  const title = req.body.title && req.body.title.trim() ? req.body.title.trim() : "Cuộc trò chuyện mới";
  const username = req.body.username;
  const newChat = { id: newId, user: username, title, messages: [] };
  chats.push(newChat);
  writeData(chats);
  res.status(201).json(newChat);
});

app.put("/chat/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { title } = req.body;
  const chats = readData();
  const idx = chats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Chat not found" });
  chats[idx].title = title.trim();
  writeData(chats);
  res.json(chats[idx]);
});

app.delete("/chat/:id", (req, res) => {
  const id = parseInt(req.params.id);
  let chats = readData();
  const newChats = chats.filter((c) => c.id !== id);
  writeData(newChats);
  res.json({ success: true });
});

app.post("/chat/:id/message", async (req, res) => {
  const id = parseInt(req.params.id);
  const { from, text } = req.body;
  if (!from || !text) return res.status(400).json({ error: "from and text required" });

  const chats = readData();
  const idx = chats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Chat not found" });

  chats[idx].messages.push({ from, text });

  try {
    const postData = JSON.stringify({
      sender: chats[idx].user || "user",
      message: text
    });

    const botResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 5005,
        path: '/webhooks/rest/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 60000
      };

      const llmReq = http.request(options, (llmRes) => {
        let body = '';
        llmRes.setEncoding('utf8');
        llmRes.on('data', chunk => body += chunk);
        llmRes.on('end', () => resolve(body));
        llmRes.on('error', reject);
      });

      llmReq.on('error', reject);
      llmReq.on('timeout', () => {
        llmReq.destroy();
        reject(new Error('Timeout'));
      });

      llmReq.write(postData);
      llmReq.end();
    });

    if (botResponse) {
      chats[idx].messages.push({ from: "bot", text: botResponse });
    }
  } catch (error) {
    console.error("Lỗi LLM:", error.message);
    chats[idx].messages.push({ from: "bot", text: "Lỗi kết nối Server (5005)." });
  }

  writeData(chats);
  res.json(chats[idx]);
});

app.post("/chat/:id/stream", async (req, res) => {
  const id = parseInt(req.params.id);
  const { from, text } = req.body;
  if (!from || !text) return res.status(400).json({ error: "from and text required" });

  let chats = readData();
  const idx = chats.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Chat not found" });

  const now = Date.now();
  chats[idx].messages.push({ from, text, timestamp: now });
  writeData(chats);

  // Đảm bảo Node.js không tự động đóng kết nối (SSE timeout bug)
  req.setTimeout(0);
  req.socket.setTimeout(0);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let botText = "";
  let llmReq = null; // Để có thể hủy request tới LLM khi client ngắt kết nối

  try {
    // Lấy toàn bộ lịch sử trò chuyện của chat hiện tại để gửi cho AI
    const history = chats[idx].messages.filter(m => m.from === 'user' || m.from === 'bot');

    // ========== BUG FIX: Dùng res.on('close') thay cho req.on('close') ==========
    // Trong Node.js 15.5+, req.on('close') fire ngay khi body được parse xong (NGAY LẬP TỨC!)
    // → llmReq.destroy() chạy → "socket hang up". 
    // res.on('close') chỉ fire khi client THỰC SỰ ngắt kết nối hoặc response kết thúc.
    res.on('close', () => {
      if (!res.writableEnded) {
        console.log("Client closed connection prematurely. Aborting...");
        if (llmReq) llmReq.destroy(); // Hủy request tới LLM server
      }
    });

    console.log(`[STREAM] Gửi request tới LLM Server cho chat ${id}...`);

    // ========== BUG FIX: Dùng http.request native thay cho axios ==========
    // axios với responseType: "stream" bị TREO VĨNH VIỄN khi gọi Python HTTPServer.
    // http.request native hoạt động hoàn hảo (đã test: 41 chunks, 8.3 giây).
    const postData = JSON.stringify({
      sender: chats[idx].user || "user",
      message: text,
      history: history
    });

    await new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 5005,
        path: '/webhooks/rest/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 120000 // 2 phút timeout cho trường hợp Ollama load model lần đầu
      };

      llmReq = http.request(options, (llmRes) => {
        console.log(`[STREAM] LLM Server đã phản hồi (status: ${llmRes.statusCode}), bắt đầu nhận stream...`);

        llmRes.setEncoding('utf8');

        llmRes.on('data', (chunkStr) => {
          if (chunkStr && !res.writableEnded) {
            botText += chunkStr;
            res.write(`data: ${JSON.stringify({ chunk: chunkStr })}\n\n`);
          }
        });

        llmRes.on('end', () => {
          console.log(`[STREAM] Stream hoàn tất cho chat ${id}, độ dài: ${botText.length}`);
          // Lưu câu trả lời vào data
          let updatedChats = readData();
          let uIdx = updatedChats.findIndex((c) => c.id === id);
          if (uIdx !== -1) {
            updatedChats[uIdx].messages.push({ from: "bot", text: botText, timestamp: Date.now() });
            writeData(updatedChats);
          }
          if (!res.writableEnded) {
            res.write(`data: [DONE]\n\n`);
            res.end();
          }
          resolve();
        });

        llmRes.on('error', (err) => {
          console.error(`[STREAM] Stream error cho chat ${id}:`, err.message);
          reject(err);
        });
      });

      llmReq.on('error', (err) => {
        console.error(`[STREAM] Request error cho chat ${id}:`, err.message);
        reject(err);
      });

      llmReq.on('timeout', () => {
        console.error(`[STREAM] Request timeout cho chat ${id}`);
        llmReq.destroy();
        reject(new Error('LLM request timeout'));
      });

      llmReq.write(postData);
      llmReq.end();
    });

  } catch (error) {
    if (error.message && (error.message.includes('aborted') || error.message.includes('destroyed') || error.message.includes('ECONNRESET'))) {
      console.log("Request bị huỷ bởi người dùng (gửi câu mới hoặc đóng trang).");
      return; // Bỏ qua không lưu lỗi vào lịch sử
    }
    console.error("Lỗi Streaming chi tiết:", error.message);
    const errText = "Lỗi kết nối Server (5005). " + error.message;
    let updatedChats = readData();
    let uIdx = updatedChats.findIndex((c) => c.id === id);
    if (uIdx !== -1) {
      updatedChats[uIdx].messages.push({ from: "bot", text: errText });
      writeData(updatedChats);
    }
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ chunk: errText })}\n\n`);
    }
    if (!res.writableEnded) {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
});


const buildPath = path.join(__dirname, "../frontend/build");

if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Lỗi: Chưa tìm thấy giao diện. Hãy chạy lệnh 'npm run build' ở thư mục frontend trước!");
  });
}

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
server.timeout = 0; // Vô hiệu hóa timeout hoàn toàn