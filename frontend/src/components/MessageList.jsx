import React from 'react'

export default function MessageList({ messages, currentUserId }){
  return (
    <div className="message-list">
      {messages.map((m, i) => (
        <div key={m._id ?? i} className={`message ${m.senderId === currentUserId ? 'mine' : 'theirs'}`}>
          <div className="meta"><strong>{m.senderId}</strong> <span className="time">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
          <div className="body">{m.content}</div>
        </div>
      ))}
    </div>
  )
}
