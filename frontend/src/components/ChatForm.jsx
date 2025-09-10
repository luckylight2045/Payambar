import React, { useState } from 'react'
import axios from 'axios'
import useAuth from '../hooks/useAuth'

export default function ChatForm({ onConversationStart }){
  const [isPrivate, setIsPrivate] = useState(true)
  const [otherUserId, setOtherUserId] = useState('')
  const [participantIds, setParticipantIds] = useState('')
  const [content, setContent] = useState('')
  const { token } = useAuth()

  const handleStartChat = async () => {
    try {
      let response
      if (isPrivate) {
        response = await axios.post(`http://localhost:3000/chats/private/${otherUserId}/messages`, { content, messageType: 'text' }, { headers: { Authorization: `Bearer ${token}` } })
      } else {
        const ids = participantIds.split(',').map(i=>i.trim()).filter(Boolean)
        response = await axios.post('http://localhost:3000/chats/group/messages', { content, messageType: 'text', participantIds: ids }, { headers: { Authorization: `Bearer ${token}` } })
      }

      const conversationId = response.data.conversationId ?? response.data.conversation?._id ?? response.data._id
      if (!conversationId) throw new Error('No conversation id returned')
      onConversationStart(conversationId)
      setContent('')
    } catch (e) {
      console.error(e)
      alert('Failed to start chat')
    }
  }

  return (
    <div className="chat-form">
      <select value={isPrivate ? 'private' : 'group'} onChange={e=>setIsPrivate(e.target.value==='private')}>
        <option value="private">Private</option>
        <option value="group">Group</option>
      </select>
      {isPrivate ? (
        <input placeholder="Other User ID" value={otherUserId} onChange={e=>setOtherUserId(e.target.value)} />
      ) : (
        <input placeholder="Participant IDs (comma-separated)" value={participantIds} onChange={e=>setParticipantIds(e.target.value)} />
      )}
      <input placeholder="First Message" value={content} onChange={e=>setContent(e.target.value)} />
      <button onClick={handleStartChat}>Start and Send</button>
    </div>
  )
}
