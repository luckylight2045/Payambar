import React from 'react';

function MessageList({ messages }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      {messages.map((msg, index) => (
        <div key={index} className="mb-2">
          <strong>{msg.senderId}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}

export default MessageList;