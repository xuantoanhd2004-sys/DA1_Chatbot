import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; // It's common to use remark-gfm for tables etc.

// Send icon SVG
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

export default function ChatPage({ apiBase, refreshChats }) {
  const { id } = useParams();
  const chatId = id;
  const [chat, setChat] = useState(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const navigate = useNavigate();
  
  // ========== BUG FIX: Guards chống unmount/re-render ==========
  const isMountedRef = useRef(true);         // Theo dõi component còn sống hay đã bị unmount
  const isStreamingRef = useRef(false);       // Theo dõi đang stream hay không (không gây re-render)
  const pendingRenameRef = useRef(null);      // Lưu tên cần rename sau khi stream xong (tránh refreshChats giữa chừng)

  const loadChat = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/chat/${chatId}`);
      if (!res.ok) {
        if (isMountedRef.current) setChat(null);
        return;
      }
      const data = await res.json();
      // Chỉ set state nếu component còn mounted VÀ không đang stream
      // (tránh loadChat ghi đè lên messages đang được stream)
      if (isMountedRef.current && !isStreamingRef.current) {
        setChat(data);
      }
    } catch (err) {
      console.error("Load chat error", err);
    }
  }, [apiBase, chatId]);

  const prevChatIdRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Chỉ abort request cũ khi chatId THỰC SỰ thay đổi (chuyển sang chat khác)
    if (prevChatIdRef.current !== null && prevChatIdRef.current !== chatId) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      isStreamingRef.current = false;
      setIsLoading(false);
    }
    prevChatIdRef.current = chatId;

    loadChat();
    
    // ========== BUG FIX: Cleanup khi unmount ==========
    return () => {
      isMountedRef.current = false;
      // KHÔNG abort khi unmount do re-render! Chỉ abort khi chatId thực sự đổi (ở trên).
      // Nếu component bị unmount bởi React StrictMode hoặc parent re-render,
      // stream vẫn tiếp tục chạy bình thường.
    };
    // eslint-disable-next-line
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isLoading]);

  if (chat === null) return <div className="empty-state">Không tìm thấy cuộc trò chuyện</div>;

  const sendMessage = async () => {
    if (!input.trim()) return;
    const textToSend = input.trim();
    
    // Lưu tên cần rename (nếu có) để rename SAU khi stream xong
    if (chat.title === "Cuộc trò chuyện mới") {
      pendingRenameRef.current = textToSend.length > 20 ? textToSend.slice(0, 20) + "..." : textToSend;
    }
    
    // Abort request cũ nếu có
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    // Optimistic UI update
    const tempUserMsg = { from: "user", text: textToSend, timestamp: Date.now() };
    setChat(prev => ({ ...prev, messages: [...prev.messages, tempUserMsg] }));
    setInput("");
    setIsLoading(true);
    isStreamingRef.current = true;

    try {
      const response = await fetch(`${apiBase}/chat/${chatId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "user", text: textToSend }),
        signal: currentController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let sseBuffer = "";
      let firstChunkReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        // Chỉ tắt loading khi nhận chunk đầu tiên
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          if (isMountedRef.current) setIsLoading(false);
        }
        
        sseBuffer += decoder.decode(value, { stream: true });
        
        let boundaryIndex;
        while ((boundaryIndex = sseBuffer.indexOf('\n\n')) !== -1) {
          const eventString = sseBuffer.slice(0, boundaryIndex).trim();
          sseBuffer = sseBuffer.slice(boundaryIndex + 2);
          
          if (!eventString) continue;
          
          const lines = eventString.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim(); // 'data: '.length === 6
              if (dataStr === '[DONE]') {
                break;
              }
              if (dataStr) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.chunk !== undefined && parsed.chunk !== "") {
                    // ========== BUG FIX: Dùng functional setState, không phụ thuộc vào closure ==========
                    setChat(prev => {
                      if (!prev) return prev;
                      const newMessages = [...prev.messages];
                      const lastMsg = newMessages[newMessages.length - 1];
                      if (!lastMsg || lastMsg.from !== "bot") {
                        newMessages.push({ from: "bot", text: parsed.chunk, timestamp: Date.now() });
                      } else {
                        newMessages[newMessages.length - 1] = {
                          ...lastMsg,
                          text: lastMsg.text + parsed.chunk
                        };
                      }
                      return { ...prev, messages: newMessages };
                    });
                  }
                } catch (e) {
                  // JSON parse fail - skip
                  console.warn("SSE JSON parse error:", e.message, "data:", dataStr);
                }
              }
            }
          }
        }
      }
      
      // ========== BUG FIX: refreshChats chỉ chạy SAU KHI stream hoàn tất ==========
      // và chỉ khi component còn mounted
      isStreamingRef.current = false;
      
      if (isMountedRef.current) {
        // Rename chat title nếu cần (chỉ gọi API rename, KHÔNG refreshChats ở đây)
        if (pendingRenameRef.current) {
          try {
            await fetch(`${apiBase}/chat/${chatId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: pendingRenameRef.current })
            });
            // Cập nhật title local (tránh gọi refreshChats gây re-render)
            setChat(prev => prev ? { ...prev, title: pendingRenameRef.current } : prev);
          } catch (e) {
            console.error("Rename error:", e);
          }
          pendingRenameRef.current = null;
        }
        
        // Giờ mới an toàn để refresh sidebar
        if (refreshChats) {
          // Dùng setTimeout để tách khỏi current render cycle
          setTimeout(() => {
            if (isMountedRef.current) refreshChats();
          }, 100);
        }
      }
    } catch (err) {
      isStreamingRef.current = false;
      if (err.name !== 'AbortError') {
        console.error("Send message error", err);
        // Hiển thị lỗi cho user
        if (isMountedRef.current) {
          setChat(prev => {
            if (!prev) return prev;
            const newMessages = [...prev.messages];
            newMessages.push({ from: "bot", text: "⚠️ Lỗi kết nối. Vui lòng thử lại.", timestamp: Date.now() });
            return { ...prev, messages: newMessages };
          });
        }
      }
    } finally {
      if (isMountedRef.current && abortControllerRef.current === currentController) {
        setIsLoading(false);
      }
    }
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    // ========== BUG FIX: KHÔNG gọi renameIfDefaultOnFirstMsg() trước sendMessage() nữa ==========
    // rename sẽ được thực hiện BÊN TRONG sendMessage, SAU KHI stream xong
    await sendMessage();
  };

  const onEnter = async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await onSend();
    }
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        {chat?.title}
      </div>

      <div className="chat-messages">
        {chat?.messages.length > 0 && (
          <div className="chat-date-separator">
            ----------- {new Date(chat.messages[0].timestamp || Date.now()).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ----------
          </div>
        )}
        {chat?.messages.map((m, i) => (
          <div key={i} className={`message-wrapper ${m.from === "user" ? "user" : "bot"}`}>
            {m.from === "bot" && (
              <div className="avatar bot">AI</div>
            )}
            <div className={`message ${m.from === "user" ? "user" : "bot"}`}>
              {m.from === "bot" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
              ) : (
                m.text
              )}
              <div className="message-timestamp">
                {new Date(m.timestamp || Date.now()).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {m.from === "user" && (
              <div className="avatar user">
                {localStorage.getItem('username')?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message-wrapper bot">
            <div className="avatar bot">AI</div>
            <div className="typing-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>

      <div className="input-container">
        <input
          className="input-box"
          placeholder="Nhập tin nhắn (Enter để gửi)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onEnter}
        />
        <button 
          className="send-btn" 
          onClick={onSend}
          disabled={isLoading}
        >
          <SendIcon />
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)', padding: '4px 0 12px 0', fontWeight: '500', letterSpacing: '0.5px' }}>
        By: Hoàng Xuân Toàn - Zalo: 0966515025
      </div>
    </div>
  );
}
