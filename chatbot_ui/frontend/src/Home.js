import { Link } from "react-router-dom";

export default function Home({ chats, createChat }) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Danh sách cuộc trò chuyện</h2>

      <button onClick={createChat}>Tạo cuộc trò chuyện mới</button>

      <ul>
        {Object.keys(chats).map((id) => (
          <li key={id}>
            <Link to={`/chat/${id}`}>{chats[id].title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
