import React, { useState } from 'react';

function MessageInput({ sendMessage }) {
  const [content, setContent] = useState('');

  const handleSend = () => {
    if (content.trim()) {
      sendMessage(content);
      setContent('');
    }
  };

  return (
    <div className="p-4 bg-white border-t flex">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 p-2 border rounded"
      />
      <button
        onClick={handleSend}
        className="ml-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Send
      </button>
    </div>
  );
}

export default MessageInput;