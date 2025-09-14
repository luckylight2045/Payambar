// src/components/MessageList.jsx
import React, { useEffect, useRef } from 'react';

/**
 * MessageList props:
 * - messages: array
 * - currentUserId: string
 * - currentUserName: optional
 * - participantNameMap: { id -> name }
 */
export default function MessageList({ messages = [], currentUserId, currentUserName = 'You', participantNameMap = {} }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    // auto scroll to bottom
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const resolveSenderName = (senderRaw) => {
    if (!senderRaw) return 'Unknown';
    if (typeof senderRaw === 'object') {
      if (senderRaw.name) return senderRaw.name;
      if (senderRaw.userName) return senderRaw.userName;
      const sid = senderRaw._id ?? senderRaw.id;
      if (sid && participantNameMap[sid]) return participantNameMap[sid];
      return String(sid).slice(0,6);
    }
    const sid = String(senderRaw);
    if (currentUserId && String(currentUserId) === sid) return currentUserName || 'You';
    if (participantNameMap && participantNameMap[sid]) return participantNameMap[sid];
    return sid.slice(0,6);
  };

  const getSenderIdStr = (senderRaw) => {
    if (!senderRaw) return null;
    if (typeof senderRaw === 'object') return String(senderRaw._id ?? senderRaw.id ?? '');
    return String(senderRaw);
  };

  return (
    <div ref={wrapRef} style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflowY: 'auto' }}>
      {messages.map((m, i) => {
        const senderRaw = m.senderId ?? m.sender ?? m.from;
        const senderId = getSenderIdStr(senderRaw);
        const isMine = currentUserId && String(currentUserId) === String(senderId);
        const senderName = resolveSenderName(senderRaw);

        return (
          <div key={m._id ?? i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
            <div style={{ fontSize: 12, color: '#9aa8b8', marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong style={{ marginRight: 8 }}>{senderName}</strong>
              <span style={{ color: '#7f8b98', fontSize: 11 }}>{m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</span>
            </div>

            <div style={{
              background: isMine ? 'linear-gradient(180deg,#2b6ef6,#1e4fd8)' : '#0f2936',
              color: isMine ? 'white' : '#e6eef6',
              padding: '10px 14px',
              borderRadius: 14,
              maxWidth: '70%',
              wordBreak: 'break-word',
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              border: isMine ? 'none' : '1px solid rgba(255,255,255,0.03)'
            }}>
              {m.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
