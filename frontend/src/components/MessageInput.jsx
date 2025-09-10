import React, { useState } from 'react'

export default function MessageInput({ sendMessage }){
  const [content, setContent] = useState('')
  const handleSend = () => {
    if (content.trim()){
      sendMessage(content.trim())
      setContent('')
    }
  }
  return (
    <div className="message-input">
      <input value={content} onChange={e=>setContent(e.target.value)} placeholder="Type a message" />
      <button onClick={handleSend}>Send</button>
    </div>
  )
}
