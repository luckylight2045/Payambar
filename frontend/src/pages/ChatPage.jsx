import React, { useState, useCallback } from 'react'
import useAuth from '../hooks/useAuth'
import useSocket from '../hooks/useSocket'
import ChatForm from '../components/ChatForm'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'
import axios from 'axios'

export default function ChatPage(){
  const { token, user } = useAuth()
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])

  const onReceiveMessage = useCallback((message) => {
    if (message.conversationId === conversationId) {
      setMessages(prev => [...prev, message])
    } else {
      setConversations(prev => {
        if (prev.includes(message.conversationId)) return prev
        return [message.conversationId, ...prev]
      })
    }
  }, [conversationId])

  const onMessageSent = useCallback((message) => {
    if (message.conversationId === conversationId) setMessages(prev => [...prev, message])
  }, [conversationId])

  const socketRef = useSocket({ token, onReceiveMessage, onMessageSent })

  const loadMessages = async (convId) => {
    if (!convId) return
    try {
      const res = await axios.get(`http://localhost:3000/chats/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${token}` }, params: { limit: 50 } })
      const msgs = Array.isArray(res.data) ? res.data.slice().reverse() : []
      setMessages(msgs)
      setConversationId(convId)
      const socket = socketRef.current
      if (socket && socket.connected) socket.emit('join_conversation', { conversationId: convId })
    } catch (e) {
      console.error(e)
      alert('Failed to load messages')
    }
  }

  const sendMessage = (content) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      alert('Socket not connected')
      return
    }
    socket.emit('send_message', { conversationId, content, messageType: 'text' })
  }

  const handleConversationStart = (newConvId) => {
    setConversations(prev => [newConvId, ...prev.filter(c=>c!==newConvId)])
    loadMessages(newConvId)
  }

  return (
    <div className="flex h-screen">
      <div className="sidebar">
        <h2>Chats</h2>
        <ChatForm onConversationStart={handleConversationStart} />
        <h3>Known Conversations</h3>
        <ul>
          {conversations.map(c=> (
            <li key={c} onClick={() => loadMessages(c)}>Conversation {c}</li>
          ))}
        </ul>
      </div>
      <div className="main">
        {conversationId ? (
          <>
            <MessageList messages={messages} currentUserId={user?.id} />
            <MessageInput sendMessage={sendMessage} />
          </>
        ) : (
          <div className="empty">Start a new chat or load a conversation</div>
        )}
      </div>
    </div>
  )
}
