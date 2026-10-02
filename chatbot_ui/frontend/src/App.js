import React, { useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatPage from "./components/ChatPage";
import Login from "./components/Login";
import Register from "./components/Register";
import "./App.css";

const apiBase = `http://${window.location.hostname}:5000`;

export default function App() {
  const [chats, setChats] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState(
    localStorage.getItem("username")
  );

  // ========== BUG FIX: useCallback để refreshChats có reference ổn định ==========
  // Không gây re-render ChatPage mỗi khi App re-render
  const refreshChats = useCallback(async () => {
    const u = localStorage.getItem("username");
    if (!u) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/chat/all?username=${u}`);
      const data = await res.json();
      setChats(data);
    } catch (err) {
      console.error("Refresh chats error:", err);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const u = localStorage.getItem("username");
      if (u !== username) {
        setUsername(u);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [username]);

  useEffect(() => {
    refreshChats();
  }, [username, refreshChats]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login apiBase={apiBase} />} />
        <Route path="/login" element={<Login apiBase={apiBase} />} />
        <Route path="/register" element={<Register apiBase={apiBase} />} />
        <Route path="/chat/*" element={
          username ? (
            <div className="app">
              <Sidebar chats={chats} refreshChats={refreshChats} apiBase={apiBase} />
              <Routes>
                <Route path="/" element={
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    Chọn một cuộc trò chuyện hoặc tạo mới để bắt đầu
                  </div>
                } />
                <Route path=":id" element={<ChatPage apiBase={apiBase} refreshChats={refreshChats} />} />
              </Routes>
            </div>
          ) : (
            <Navigate to="/" />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}
