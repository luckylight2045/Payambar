import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Link } from 'react-router-dom';
import ChatForm from '../components/ChatForm.jsx';
import MessageList from '../components/MessageList.jsx';
import MessageInput from '../components/MessageInput.jsx';

function ChatPage() {
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      query: { userId: user?.id },
    });
    setSocket(newSocket);

    newSocket.on('receive_message', (message) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
      // Add to local conversations if new
      if (!conversations.includes(message.conversationId)) {
        setConversations((prev) => [...prev, message.conversationId]);
      }
    });

    return () => newSocket.disconnect();
  }, [user, conversationId, conversations]);

  const loadMessages = async (convId) => {
    try {
      const response = await axios.get(
        `http://localhost:3000/chats/conversations/${convId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(response.data);
      setConversationId(convId);
    } catch (error) {
      console.error('Failed to load messages', error);
      alert('Failed to load messages');
    }
  };

  const sendMessage = (content) => {
    const messageData = {
      conversationId,
      senderId: user.id,
      content,
      messageType: 'TEXT',
    };
    socket.emit('send_message', messageData);
    setMessages((prev) => [...prev, messageData]);
  };

  const handleConversationStart = (newConvId) => {
    setConversations((prev) => [...new Set([...prev, newConvId])]);
    loadMessages(newConvId);
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/4 p-4 bg-gray-100">
        <h2 className="text-xl mb-4">Chats</h2>
        <ChatForm onConversationStart={handleConversationStart} />
        <h3 className="text-lg mt-4 mb-2">Known Conversations</h3>
        <ul className="space-y-2">
          {conversations.map((conv) => (
            <li
              key={conv}
              onClick={() => loadMessages(conv)}
              className="p-2 bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
            >
              Conversation {conv}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <input
            type="text"
            placeholder="Enter Conversation ID"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            className="w-full p-2 mb-2 border rounded"
          />
          <button
            onClick={() => loadMessages(conversationId)}
            className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Load Conversation
          </button>
        </div>
        <Link to="/profile" className="block mt-4 text-blue-500">Profile</Link>
      </div>
      <div className="w-3/4 flex flex-col">
        {conversationId ? (
          <>
            <MessageList messages={messages} />
            <MessageInput sendMessage={sendMessage} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p>Start a new chat or load a conversation ID</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;