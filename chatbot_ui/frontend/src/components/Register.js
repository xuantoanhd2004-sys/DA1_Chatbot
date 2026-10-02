import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../App.css";

export default function Register({ apiBase }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const navigate = useNavigate();

  const submit = async () => {
    if (!username || !password || !rePassword) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (password !== rePassword) {
      alert("Mật khẩu nhập lại không khớp");
      return;
    }

    const res = await fetch(`${apiBase}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      alert("User đã tồn tại");
      return;
    }

    alert("Đăng ký thành công");
    navigate("/login");
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Đăng ký</h2>

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

        <input
          type="password"
          placeholder="Nhập lại mật khẩu"
          value={rePassword}
          onChange={e => setRePassword(e.target.value)}
          autoComplete="new-password"
        />

        <button onClick={submit}>Đăng ký</button>

        <p className="auth-switch">
          Đã có tài khoản?{" "}
          <Link to="/login" style={{ color: '#60a5fa', cursor: 'pointer', fontWeight: 500, textDecoration: 'none', marginLeft: '6px' }}>Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
