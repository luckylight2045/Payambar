import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.jsx';

function ChatForm({ onConversationStart }) {
  const [isPrivate, setIsPrivate] = useState(true);
  const [otherUserId, setOtherUserId] = useState('');
  const [participantIds, setParticipantIds] = useState('');
  const [content, setContent] = useState('');
  const { token } = useAuth();

  const handleStartChat = async () => {
    try {
      let response;
      if (isPrivate) {
        response = await axios.post(`http://localhost:3000/chats/private/${otherUserId}/messages`, {
          content,
          messageType: 'text',
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        const ids = participantIds.split(',').map(id => id.trim());
        response = await axios.post('http://localhost:3000/chats/group/messages', {
          content,
          messageType: 'TEXT',
          participantIds: ids,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      const { conversationId } = response.data;
      onConversationStart(conversationId);
      setContent('');
    } catch (error) {
      console.error('Failed to start chat', error);
      alert('Failed to start chat');
    }
  };

  return (
    <div className="p-4 bg-gray-100">
      <h3 className="text-lg mb-2">Start New Chat</h3>
      <select
        value={isPrivate ? 'private' : 'group'}
        onChange={(e) => setIsPrivate(e.target.value === 'private')}
        className="w-full p-2 mb-2 border rounded"
      >
        <option value="private">Private</option>
        <option value="group">Group</option>
      </select>
      {isPrivate ? (
        <input
          type="text"
          placeholder="Other User ID"
          value={otherUserId}
          onChange={(e) => setOtherUserId(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
      ) : (
        <input
          type="text"
          placeholder="Participant IDs (comma-separated)"
          value={participantIds}
          onChange={(e) => setParticipantIds(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
        />
      )}
      <input
        type="text"
        placeholder="First Message"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full p-2 mb-2 border rounded"
      />
      <button
        onClick={handleStartChat}
        className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Start and Send
      </button>
    </div>
  );
}

export default ChatForm;