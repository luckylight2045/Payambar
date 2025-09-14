// src/pages/ChatPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import ChatForm from '../components/ChatForm';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import axios from 'axios';

/**
 * ChatPage - keeps the same style you liked.
 * Important: do not change inline CSS block unless you want visual changes.
 */

export default function ChatPage() {
  const css = `
:root{
  --bg:#071019;
  --bg-2:#0b1220;
  --sidebar-bg:#071720;
  --panel:#091421;
  --muted:#9aa8b8;
  --muted-2:#7f8b98;
  --text:#e6eef6;
  --accent:#2b6ef6;
  --bubble-other:#0f2936;
  --bubble-other-border: rgba(255,255,255,0.03);
  --bubble-mine: linear-gradient(180deg,#2b6ef6,#1e4fd8);
  --input-bg: rgba(255,255,255,0.03);
  --input-border: rgba(255,255,255,0.06);
  --placeholder: rgba(255,255,255,0.40);
}
html,body,#root { height:100%; margin:0; font-family: Inter, "Helvetica Neue", Arial, sans-serif; background:var(--bg); color:var(--text); }
.app-container { height:100vh; display:flex; gap:0; overflow:hidden; }
.sidebar { width:320px; min-width:260px; background: linear-gradient(180deg, var(--sidebar-bg), #051218); border-right: 1px solid rgba(255,255,255,0.04); padding:18px; box-sizing:border-box; display:flex; flex-direction:column; }
.sidebar .title { font-size:22px; font-weight:700; margin-bottom:12px; color:var(--text); }
.chat-form { display:flex; flex-direction:column; gap:10px; margin-bottom:18px; }
.chat-form select, .chat-form input, .chat-form textarea { background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text); padding:10px 12px; border-radius:8px; outline:none; }
.chat-form input::placeholder, .chat-form textarea::placeholder { color: var(--placeholder); }
.chat-form button { background: var(--accent); color: white; padding:8px 12px; border-radius:8px; border: none; cursor:pointer; font-weight:600; box-shadow: 0 6px 18px rgba(43,110,246,0.12); }
.conversations-list { margin-top:6px; overflow-y:auto; padding-right:6px; flex:1; }
.conv-item { display:flex; gap:12px; align-items:center; padding:10px; border-radius:10px; cursor:pointer; transition: background .12s ease, transform .06s ease; color:var(--text); }
.conv-item:hover { background: rgba(255,255,255,0.02); transform: translateY(-1px); }
.conv-avatar{ width:44px; height:44px; border-radius:50%; background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.08)); display:flex; align-items:center; justify-content:center; color:var(--text); font-weight:700; font-size:14px; flex-shrink:0; }
.conv-meta { display:flex; flex-direction:column; gap:4px; min-width:0; }
.conv-username { font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }
.conv-last { font-size:13px; color:var(--muted-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }
.chat-main { flex:1; display:flex; flex-direction:column; background: var(--bg-2); overflow:hidden; }
.messages-wrap { padding:18px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; height:100%; }
.message-row { display:flex; flex-direction:column; max-width:100%; }
.message-row.mine { align-items:flex-end; }
.message-row.theirs { align-items:flex-start; }
.message-meta { display:flex; gap:8px; align-items:center; font-size:12px; color:var(--muted); margin-bottom:6px; }
.msg-bubble { padding:10px 14px; max-width:70%; word-wrap:break-word; line-height:1.35; border-radius:14px; box-shadow: 0 1px 0 rgba(0,0,0,0.2) inset; }
.msg-bubble.mine { background: var(--bubble-mine); color: white; border-radius: 16px 16px 4px 16px; }
.msg-bubble.theirs { background: var(--bubble-other); color: var(--text); border: 1px solid var(--bubble-other-border); border-radius: 16px 16px 16px 4px; }
.chat-footer { border-top: 1px solid rgba(255,255,255,0.03); padding:12px; display:flex; align-items:center; gap:12px; background: linear-gradient(180deg, rgba(255,255,255,0.01), transparent); }
.message-input { display:flex; align-items:center; gap:8px; width:100%; }
.message-input input { flex:1; padding:10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.04); color:var(--text); border-radius:12px; outline:none; }
.message-input input::placeholder { color: var(--placeholder); }
.message-input button { background: var(--accent); color: white; padding:10px 14px; border-radius:8px; border:none; cursor:pointer; }
.empty-state { height:100%; display:flex; alignItems:center; justifyContent:center; color:var(--muted); font-size:16px; }
`;

  const { token, user } = useAuth();
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [participantNameMap, setParticipantNameMap] = useState({});
  const socketRef = useSocket({ token });

  const currentUserId = user?.id ?? user?._id ?? user?.__raw?._id ?? null;
  const currentUserName = user?.username ?? user?.name ?? 'You';

  const onReceiveMessage = useCallback((message) => {
    if (!message || !message.conversationId) return;
    if (message.conversationId === conversationId) {
      setMessages(prev => [...prev, message]);
    } else {
      setConversations(prev => {
        const idx = prev.findIndex(c => String(c._id) === String(message.conversationId));
        if (idx !== -1) {
          const item = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
          const copy = prev.slice();
          copy.splice(idx, 1);
          return [item, ...copy];
        }
        return [{ _id: message.conversationId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...prev];
      });
    }
  }, [conversationId]);

  const onMessageSent = useCallback((message) => {
    if (!message) return;
    if (message.conversationId === conversationId) setMessages(prev => [...prev, message]);
    setConversations(prev => {
      const idx = prev.findIndex(c => String(c._id) === String(message.conversationId));
      if (idx !== -1) {
        const item = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
        const copy = prev.slice();
        copy.splice(idx, 1);
        return [item, ...copy];
      }
      return [{ _id: message.conversationId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...prev];
    });
  }, [conversationId]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    s.on('receive_message', onReceiveMessage);
    s.on('message_sent', onMessageSent);
    return () => {
      s.off('receive_message', onReceiveMessage);
      s.off('message_sent', onMessageSent);
    };
  }, [socketRef, onReceiveMessage, onMessageSent]);

  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await axios.get(`http://localhost:3000/chats/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 },
      });
      const msgs = Array.isArray(res.data) ? res.data.slice().reverse() : [];
      setMessages(msgs);
      setConversationId(convId);

      const socket = socketRef.current;
      if (socket && socket.connected) socket.emit('join_conversation', { conversationId: convId });

      setTimeout(() => {
        const el = document.getElementById('messages-wrap');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    } catch (e) {
      console.error('Failed to load messages', e);
      alert('Failed to load messages');
    }
  };

  const sendMessage = (content) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      alert('Socket not connected');
      return;
    }
    socket.emit('send_message', { conversationId, content, messageType: 'text' });
  };

  const handleConversationStart = (newConvId) => {
    setConversations(prev => [{ _id: newConvId, participants: [], lastMessage: null, updatedAt: new Date().toISOString() }, ...prev.filter(c => c._id !== newConvId)]);
    loadMessages(newConvId);
  };

  // fetch conversations when token present
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchConversations = async () => {
      try {
        const res = await axios.get('http://localhost:3000/chats/conversations', { headers: { Authorization: `Bearer ${token}` } });
        const convs = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) {
          setConversations(convs);
          fillParticipantNames(convs);
        }
      } catch (err) {
        console.error('Failed to load conversations', err);
      }
    };
    fetchConversations();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fillParticipantNames = async (convs) => {
    if (!Array.isArray(convs) || convs.length === 0) return;
    const idsToFetch = new Set();
    for (const c of convs) {
      const parts = c.participants || [];
      for (const p of parts) {
        if (typeof p === 'string') {
          if (String(p) === String(currentUserId)) continue;
          if (!participantNameMap[p]) idsToFetch.add(p);
        } else if (typeof p === 'object') {
          const id = p._id ?? p.id;
          if (!id) continue;
          if (String(id) === String(currentUserId)) continue;
          if (!participantNameMap[String(id)]) idsToFetch.add(String(id));
        }
      }
    }
    if (idsToFetch.size === 0) return;
    const ids = Array.from(idsToFetch);
    const promises = ids.map(id => axios.get(`http://localhost:3000/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => ({ id, name: r.data?.userName ?? r.data?.name ?? null }))
      .catch(() => ({ id, name: null }))
    );
    const results = await Promise.all(promises);
    setParticipantNameMap(prev => {
      const copy = { ...prev };
      for (const r of results) {
        if (r.name) copy[r.id] = r.name;
        else copy[r.id] = r.id.slice(0,6);
      }
      return copy;
    });
  };

  // derive other participant name for conversation
  const getOtherNameForConversation = (c) => {
    if (!c) return 'Unknown';
    if (c.name) return c.name;
    const parts = c.participants || [];
    for (const p of parts) {
      if (!p) continue;
      if (typeof p === 'object') {
        const id = p._id ?? p.id;
        if (String(id) === String(currentUserId)) continue;
        return p.userName ?? p.name ?? String(id).slice(0,6);
      }
      if (typeof p === 'string') {
        if (String(p) === String(currentUserId)) continue;
        return participantNameMap[p] ?? String(p).slice(0,6);
      }
    }
    return 'SavedMessage';
  };

  return (
    <div className="app-container">
      <style id="chat-page-inline-styles" dangerouslySetInnerHTML={{ __html: css }} />

      <div className="sidebar">
        <div className="title">Chats</div>
        <ChatForm onConversationStart={handleConversationStart} />
        <h3 style={{ color: 'var(--muted)', marginTop: 8 }}>Known Conversations</h3>
        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--muted)' }}>No conversations yet — start a new chat or search.</div>
          ) : null}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {conversations.map((c) => {
              const convId = c._id ?? c.id;
              const otherName = getOtherNameForConversation(c);
              return (
                <li key={convId} className="conv-item" onClick={() => loadMessages(convId)} style={{ cursor: 'pointer' }}>
                  <div className="conv-avatar">{(otherName || 'U').slice(0,2).toUpperCase()}</div>
                  <div className="conv-meta">
                    <div className="conv-username">{otherName || 'Unknown'}</div>
                    <div className="conv-last">{c.lastMessage ? (c.lastMessage.content ?? '') : ''}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="chat-main">
        <div className="messages-wrap" id="messages-wrap">
          {conversationId ? (
            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              participantNameMap={participantNameMap}
              currentUserName={currentUserName}
            />
          ) : (
            <div className="empty-state">Start a new chat or select a conversation.</div>
          )}
        </div>

        <div className="chat-footer">
          <div style={{ flex: 1 }}>
            <MessageInput sendMessage={sendMessage} />
          </div>
        </div>
      </div>
    </div>
  );
}
