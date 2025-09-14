// src/components/MessageInput.jsx
import React, { useState } from 'react';

export default function MessageInput({ sendMessage }) {
  const [content, setContent] = useState('');
  const handleSend = () => {
    if (content.trim()) {
      sendMessage(content.trim());
      setContent('');
    }
  };
  return (
    <div className="message-input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type a message" style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: 'inherit' }} />
      <button onClick={handleSend} style={{ background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)', color: 'white', padding: '8px 12px', borderRadius: 8, border: 'none' }}>Send</button>
    </div>
  );
}
