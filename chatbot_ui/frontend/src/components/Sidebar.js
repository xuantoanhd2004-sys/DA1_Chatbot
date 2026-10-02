import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

// Icons
const PlusIcon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const EditIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const LogoutIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>;

export default function Sidebar({ chats, refreshChats, apiBase }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [keyword, setKeyword] = useState("");

  const handleLogout = async () => {
    try {
      await fetch(`${apiBase}/logout`, { method: "POST" });
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem("username");
    window.location.href = "/login";
  };

  const createNew = async () => {
    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Cuộc trò chuyện mới",
          username: localStorage.getItem("username")
        })
      });

      const newChat = await res.json();
      await refreshChats();
      navigate(`/chat/${newChat.id}`);
    } catch (err) {
      console.error("Create chat error", err);
    }
  };

  const deleteChat = async (id, e) => {
    e.preventDefault();
    if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này?")) return;

    try {
      await fetch(`${apiBase}/chat/${id}`, { method: "DELETE" });
      await refreshChats();

      if (location.pathname === `/chat/${id}`) {
        navigate("/");
      }
    } catch (err) {
      console.error("Delete error", err);
    }
  };

  const renameChat = async (id, currentTitle, e) => {
    e.preventDefault();
    const newTitle = prompt("Nhập tên mới cho cuộc trò chuyện:", currentTitle);

    if (newTitle && newTitle.trim() && newTitle.trim() !== currentTitle) {
      fetch(`${apiBase}/chat/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() })
      }).then(() => refreshChats());
    }
  };

  const filteredChats = chats.filter((chat) => {
    if (!keyword.trim()) return true;
    const k = keyword.toLowerCase();
    if (chat.title.toLowerCase().includes(k)) return true;
    return chat.messages?.some((m) => m.text.toLowerCase().includes(k));
  });

  return (
    <div className="sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="sidebar-title" style={{ marginBottom: 0 }}>AI Offline</div>
        <button 
          onClick={handleLogout}
          style={{ 
            background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', 
            padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center'
          }}
          title="Đăng xuất"
        >
          <LogoutIcon />
        </button>
      </div>

      <button className="new-chat-btn" onClick={createNew}>
        <PlusIcon /> Cuộc trò chuyện mới
      </button>

      <div style={{ position: 'relative', marginBottom: 20 }}>
        <div style={{ position: 'absolute', left: 12, top: 10, color: 'rgba(255,255,255,0.4)' }}>
          <SearchIcon />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 10px 10px 36px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.2)",
            color: "#fff",
            fontSize: "14px",
            outline: "none"
          }}
        />
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Lịch sử
      </div>

      <ul className="chat-list">
        {filteredChats.map((chat) => {
          const isActive = location.pathname === `/chat/${chat.id}`;
          return (
            <li key={chat.id} style={{ position: 'relative' }}>
              <Link 
                to={`/chat/${chat.id}`} 
                className={`chat-item ${isActive ? 'active' : ''}`}
                style={{ paddingRight: '60px', display: 'block' }}
              >
                {chat.title}
              </Link>
              
              <div style={{ 
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                display: 'flex', gap: '4px', opacity: isActive ? 1 : 0.4
              }}>
                <button 
                  onClick={(e) => renameChat(chat.id, chat.title, e)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                >
                  <EditIcon />
                </button>
                <button 
                  onClick={(e) => deleteChat(chat.id, e)}
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>
        By: Hoàng Xuân Toàn<br/>Zalo: 0966515025
      </div>
    </div>
  );
}
