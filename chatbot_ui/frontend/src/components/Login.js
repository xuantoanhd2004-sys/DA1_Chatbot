import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../App.css";

export default function Login({ apiBase }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const submit = async () => {
    if (!username || !password) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    const res = await fetch(`${apiBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      alert("Sai tài khoản hoặc mật khẩu");
      return;
    }

    const data = await res.json();
    localStorage.setItem("username", data.username);
    window.location.href = "/chat";
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Đăng nhập</h2>

        <input
          placeholder="Tên đăng nhập"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="off"
        />

        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <button onClick={submit}>Đăng nhập</button>

        <p className="auth-switch">
          Chưa có tài khoản?{" "}
          <Link to="/register" style={{ color: '#60a5fa', cursor: 'pointer', fontWeight: 500, textDecoration: 'none', marginLeft: '6px' }}>Đăng ký</Link>
        </p>
      </div>
    </div>
  );
}
