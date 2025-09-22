// src/pages/ChatPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import ChatForm from '../components/ChatForm';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import axios from 'axios';

/**
 * ChatPage - full file
 * - MessageInput is shown only when a conversation (or draft conversation) is selected.
 * - All other behavior (conversations list, drafts, socket handlers) unchanged.
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
.conv-item.selected { background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02); }
.conv-avatar{ width:44px; height:44px; border-radius:50%; background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.08)); display:flex; align-items:center; justify-content:center; color:var(--text); font-weight:700; font-size:14px; flex-shrink:0; }
.conv-meta { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1; overflow:hidden; }
.conv-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.conv-username { font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:165px; }
.conv-last { font-size:13px; color:var(--muted-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px; }
.conv-time { font-size:12px; color:var(--muted); white-space:nowrap; margin-left:6px; }
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
.empty-state { height:100%; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:16px; }
.messages-wrap::-webkit-scrollbar, .conversations-list::-webkit-scrollbar { width:10px; }
.messages-wrap::-webkit-scrollbar-thumb, .conversations-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius:8px; }
`;

  const { token, user } = useAuth();
  const [conversationId, setConversationId] = useState(''); // persisted conversation id currently open
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]); // server provided order (descending by updatedAt)
  const [participantNameMap, setParticipantNameMap] = useState({});
  const [draftConversation, setDraftConversation] = useState(null); // { userId, userName } or null
  const [selectedConvId, setSelectedConvId] = useState(null); // id string (persisted _id or draft:<userId>)

  const currentUserId = user?.id ?? user?._id ?? user?.__raw?._id ?? null;
  const currentUserName = user?.username ?? user?.name ?? 'You';

  // helper: normalize participant id (handles string or object)
  const participantId = (p) => {
    if (!p) return null;
    if (typeof p === 'string') return String(p);
    if (typeof p === 'object') {
      if (p._id) return String(p._id);
      if (p.id) return String(p.id);
      if (p._id && typeof p._id.toString === 'function') return p._id.toString();
    }
    return null;
  };

  const participantDisplayName = (p) => {
    if (!p) return null;
    if (typeof p === 'object') {
      return p.userName ?? p.name ?? p.username ?? null;
    }
    return participantNameMap[String(p)] ?? null;
  };

  const getOtherNameForConversation = (c) => {
    if (!c) return 'Unknown';
    if (c.name) return c.name;
    const parts = c.participants || [];
    for (const p of parts) {
      const id = participantId(p);
      if (!id) continue;
      if (currentUserId && String(id) === String(currentUserId)) continue;
      const display = participantDisplayName(p);
      if (display) return display;
      if (typeof p === 'object') {
        if (p.name) return p.name;
        if (p.userName) return p.userName;
      }
      return String(id).slice(0, 6);
    }
    if (parts.length === 0 || parts.every(p => String(participantId(p)) === String(currentUserId))) {
      return 'SavedMessages';
    }
    return 'Unknown';
  };

  const removeDrafts = (keepDraftId = null) => {
    setConversations(prev => prev.filter(c => {
      const id = String(c._id ?? c.id ?? '');
      if (!id.startsWith('draft:')) return true;
      if (keepDraftId && id === keepDraftId) return true;
      return false;
    }));
  };

  const refreshConversationsFromServer = async () => {
    if (!token) return;
    try {
      const res = await axios.get('http://localhost:3000/chats/conversations', { headers: { Authorization: `Bearer ${token}` } });
      const convs = Array.isArray(res.data) ? res.data : [];
      setConversations(convs);
      fillParticipantNames(convs);
      return convs;
    } catch (err) {
      console.error('Failed to refresh conversations from server', err);
      return null;
    }
  };

  // SOCKET callbacks
  const onReceiveMessage = useCallback((message) => {
    if (!message || !message.conversationId) return;
    const convId = String(message.conversationId);

    if (conversationId && String(convId) === String(conversationId)) {
      setMessages(prev => [...prev, message]);
    }

    setConversations(prev => {
      const idx = prev.findIndex(c => String(c._id) === convId);
      if (idx !== -1) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
        return copy;
      }
      return [...prev, { _id: convId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }];
    });

    (async () => {
      const exists = conversations.find(c => String(c._id) === convId);
      if (!exists) {
        await refreshConversationsFromServer();
      }
    })();
  }, [conversationId, conversations]);

  const onMessageSent = useCallback((message) => {
    if (!message || !message.conversationId) return;
    const convId = String(message.conversationId);

    if (conversationId && String(convId) === String(conversationId)) {
      setMessages(prev => [...prev, message]);
    }

    // reorder to top because we sent a message
    setConversations(prev => {
      const copy = prev.slice();
      const idx = copy.findIndex(c => String(c._id) === convId);
      if (idx !== -1) {
        const item = { ...copy[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
        copy.splice(idx, 1);
        return [item, ...copy];
      }
      return [{ _id: convId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...copy];
    });

    if (selectedConvId && String(selectedConvId).startsWith('draft:')) {
      const draftUserId = String(selectedConvId).replace(/^draft:/, '');
      const participants = message.participants ?? [];
      const matchesDraft = participants.some(p => String(p) === draftUserId) || message.conversationId;
      if (matchesDraft) {
        (async () => {
          await refreshConversationsFromServer();
          removeDrafts();
          setSelectedConvId(convId);
          setConversationId(convId);
          setDraftConversation(null);
        })();
        return;
      }
    }

    setSelectedConvId(convId);
  }, [conversationId, selectedConvId]);

  const socketRef = useSocket({
    token,
    onReceiveMessage,
    onMessageSent,
  });

  // Load messages
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
      setDraftConversation(null);
      setSelectedConvId(convId);
      removeDrafts();

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

  // Send message
  const sendMessage = async (content) => {
    if (!content || !content.trim()) return;
    const socket = socketRef.current;

    if (conversationId) {
      if (!socket || !socket.connected) { alert('Socket not connected'); return; }
      socket.emit('send_message', { conversationId, content, messageType: 'text' });
      return;
    }

    if (draftConversation) {
      const otherId = draftConversation.userId;
      if (socket && socket.connected) {
        socket.emit('send_message', { participantIds: [otherId], content, messageType: 'text' });
        return;
      }

      try {
        const res = await axios.post(`http://localhost:3000/chats/private/${encodeURIComponent(otherId)}`, {
          content,
          messageType: 'text',
        }, { headers: { Authorization: `Bearer ${token}` } });

        const saved = res.data;
        const convId = saved.conversationId ?? saved.conversation?._id ?? saved._id ?? null;
        if (convId) {
          await refreshConversationsFromServer();
          removeDrafts();
          setSelectedConvId(convId);
          await loadMessages(convId);
        } else {
          setMessages(prev => [...prev, saved]);
        }
        setDraftConversation(null);
        return;
      } catch (err) {
        console.error('Failed to send initial message', err);
        alert('Failed to send message');
      }
      return;
    }

    alert('No conversation selected');
  };

  // Open conversation / start
  const handleConversationStart = (payload) => {
    if (typeof payload === 'string') {
      removeDrafts();
      setSelectedConvId(String(payload));
      loadMessages(payload);
      return;
    }

    if (payload && payload.draft) {
      const otherUserId = payload.userId;
      const otherUserName = payload.userName;

      const existing = conversations.find((c) => {
        const parts = c.participants || [];
        return parts.some((p) => {
          const pid = participantId(p);
          return pid && String(pid) === String(otherUserId);
        });
      });

      if (existing) {
        removeDrafts();
        setSelectedConvId(existing._id ?? existing.id ?? String(existing._id));
        loadMessages(existing._id ?? existing.id ?? String(existing._id));
        return;
      }

      setConversationId('');
      setMessages([]);
      setDraftConversation({ userId: otherUserId, userName: otherUserName });

      const draftId = `draft:${otherUserId}`;

      setConversations(prev => {
        const filtered = prev.filter(c => !String(c._id).startsWith('draft:'));
        if (prev.some(c => String(c._id) === draftId)) {
          const existingDraft = prev.find(c => String(c._id) === draftId);
          return [...filtered, existingDraft];
        }
        return [...filtered, { _id: draftId, participants: [otherUserId], name: otherUserName, lastMessage: null, updatedAt: new Date().toISOString() }];
      });

      setSelectedConvId(draftId);
      return;
    }

    if (payload && payload._id) {
      removeDrafts();
      const convId = payload._id;
      setDraftConversation(null);
      setSelectedConvId(convId);
      loadMessages(convId);
      return;
    }
  };

  // initial fetch
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
  }, [token]);

  // resolve participant names for fallback
  const fillParticipantNames = async (convs) => {
    if (!Array.isArray(convs) || convs.length === 0) return;
    const idsToFetch = new Set();
    for (const c of convs) {
      const parts = c.participants || [];
      for (const p of parts) {
        const id = participantId(p);
        if (!id) continue;
        if (String(id) === String(currentUserId)) continue;
        if (!participantNameMap[id]) idsToFetch.add(id);
      }
    }
    if (idsToFetch.size === 0) return;
    const ids = Array.from(idsToFetch);
    const promises = ids.map(id => axios.get(`http://localhost:3000/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => ({ id, name: r.data?.userName ?? r.data?.name ?? r.data?.username ?? null }))
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

  // helpers for preview/time
  const formatConversationTime = (isoOrDate) => {
    if (!isoOrDate) return '';
    const d = new Date(isoOrDate);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const previewForLastMessage = (c) => {
    const m = c.lastMessage ?? null;
    if (m && (typeof m === 'object') && ('content' in m)) {
      const content = (m.content ?? '').replace(/\s+/g, ' ').trim();
      const senderIsMe = (() => {
        const sid = m.senderId ? (typeof m.senderId === 'object' ? (m.senderId._id ?? m.senderId.id) : m.senderId) : null;
        return sid && String(sid) === String(currentUserId);
      })();
      const senderName = (() => {
        if (!m.senderId) return null;
        if (typeof m.senderId === 'object') return m.senderId.name ?? m.senderId.userName ?? null;
        return participantNameMap[String(m.senderId)] ?? null;
      })();
      const prefix = senderIsMe ? 'You: ' : (senderName ? `${senderName}: ` : '');
      const max = 48;
      if (content.length <= max) return prefix + content;
      return prefix + content.slice(0, max).trim() + '…';
    }

    if (c.lastMessageContent) {
      const senderIsMe = c.lastMessageSender && String(c.lastMessageSender) === String(currentUserId);
      const prefix = senderIsMe ? 'You: ' : (c.lastMessageSenderName ? `${c.lastMessageSenderName}: ` : '');
      const text = (c.lastMessageContent ?? '').replace(/\s+/g, ' ').trim();
      const max = 48;
      if (text.length <= max) return prefix + text;
      return prefix + text.slice(0, max).trim() + '…';
    }

    return '';
  };

  const lastMessageTimeForConv = (c) => {
    const m = c.lastMessage ?? null;
    if (m && typeof m === 'object' && m.createdAt) return m.createdAt;
    if (c.lastMessageCreatedAt) return c.lastMessageCreatedAt;
    return c.updatedAt ?? null;
  };

  return (
    <div className="app-container">
      <style id="chat-page-inline-styles" dangerouslySetInnerHTML={{ __html: css }} />

      <div className="sidebar">
        <div className="title">Chats</div>
        <ChatForm onConversationStart={handleConversationStart} conversations={conversations} setConversations={setConversations} />
        <h3 style={{ color: 'var(--muted)', marginTop: 8 }}>Known Conversations</h3>
        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--muted)' }}>No conversations yet — start a new chat or search.</div>
          ) : null}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {conversations.map((c) => {
              const convId = c._id ?? c.id;
              const isDraft = String(convId).startsWith('draft:');
              const otherName = (c.name && String(c.name).trim().length > 0) ? c.name : getOtherNameForConversation(c);
              const isSelected = selectedConvId && String(convId) === String(selectedConvId);

              const lastMsgPreview = previewForLastMessage(c);
              const lastTime = lastMessageTimeForConv(c);

              return (
                <li
                  key={convId}
                  className={`conv-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (isDraft) {
                      const userId = String(convId).replace(/^draft:/, '');
                      handleConversationStart({ draft: true, userId, userName: otherName });
                    } else {
                      handleConversationStart(convId);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                  }}
                >
                  <div className="conv-avatar">{(otherName || 'U').slice(0,2).toUpperCase()}</div>
                  <div className="conv-meta">
                    <div className="conv-top">
                      <div className="conv-username" title={otherName || 'Unknown'}>{otherName || 'Unknown'}</div>
                      <div className="conv-time">{formatConversationTime(lastTime)}</div>
                    </div>
                    <div className="conv-last" title={c.lastMessage?.content ?? c.lastMessageContent ?? ''}>
                      {lastMsgPreview}
                    </div>
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
          ) : draftConversation ? (
            <>
              <div style={{ padding: 12, color: 'var(--muted)' }}>
                Chat with <strong>{draftConversation.userName || draftConversation.userId}</strong>
              </div>
              <MessageList
                messages={messages}
                currentUserId={currentUserId}
                participantNameMap={{ ...participantNameMap, [draftConversation.userId]: draftConversation.userName }}
                currentUserName={currentUserName}
              />
            </>
          ) : (
            <div className="empty-state">Start a new chat or select a conversation.</div>
          )}
        </div>

        {/* Chat footer is shown only when a conversation/draft is selected */}
        {selectedConvId ? (
          <div className="chat-footer">
            <div style={{ flex: 1 }}>
              <MessageInput sendMessage={sendMessage} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
