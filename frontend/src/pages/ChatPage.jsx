// src/pages/ChatPage.jsx
import React, { useState, useCallback, useEffect } from 'react';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import ChatForm from '../components/ChatForm';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import axios from 'axios';

/**
 * ChatPage
 *
 * - Clicking a conversation selects/highlights it but DOES NOT reorder the list.
 * - Conversations are reordered ONLY when the local user sends a message (onMessageSent).
 * - Incoming messages update lastMessage in place but do NOT change ordering.
 * - Messages in the chat pane are grouped by day (MessageList handles grouping).
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

  // ---------------- SOCKET CALLBACKS ----------------
  // Receive message: update lastMessage in-place (NO reordering)
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
      // unknown conversation -> append to end
      return [...prev, { _id: convId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }];
    });
  }, [conversationId]);

  // Message sent by local user: reorder conversation to top
  const onMessageSent = useCallback((message) => {
    if (!message || !message.conversationId) return;
    const convId = String(message.conversationId);

    if (conversationId && String(convId) === String(conversationId)) {
      setMessages(prev => [...prev, message]);
    }

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

    // If user was on a draft that corresponds to this message, switch UI to real conversation and highlight it
    if (selectedConvId && String(selectedConvId).startsWith('draft:')) {
      const draftUserId = String(selectedConvId).replace(/^draft:/, '');
      if (message.participants && message.participants.some(p => String(p) === draftUserId)) {
        setSelectedConvId(convId);
        setConversationId(convId);
        setDraftConversation(null);
      }
    } else {
      // Select the conversation we just sent to (UX: keep it selected)
      setSelectedConvId(convId);
    }
  }, [conversationId, selectedConvId]);

  const socketRef = useSocket({
    token,
    onReceiveMessage,
    onMessageSent,
  });

  // ---------------- Load messages ----------------
  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await axios.get(`http://localhost:3000/chats/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 },
      });
      // server gives newest-first; convert to chronological ascending for display
      const msgs = Array.isArray(res.data) ? res.data.slice().reverse() : [];
      setMessages(msgs);
      setConversationId(convId);
      setDraftConversation(null);
      setSelectedConvId(convId);

      const socket = socketRef.current;
      if (socket && socket.connected) socket.emit('join_conversation', { conversationId: convId });

      // pre-resolve participant names for this conversation
      const found = conversations.find(c => String(c._id) === String(convId));
      if (found) fillParticipantNames([found]);

      setTimeout(() => {
        const el = document.getElementById('messages-wrap');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    } catch (e) {
      console.error('Failed to load messages', e);
      alert('Failed to load messages');
    }
  };

  // ---------------- Send message ----------------
  const sendMessage = async (content) => {
    if (!content || !content.trim()) return;
    const socket = socketRef.current;

    // Persisted conversation -> socket.emit (this will trigger onMessageSent)
    if (conversationId) {
      if (!socket || !socket.connected) { alert('Socket not connected'); return; }
      socket.emit('send_message', { conversationId, content, messageType: 'text' });
      return;
    }

    // Draft conversation -> create via socket or REST (socket preferred)
    if (draftConversation) {
      const otherId = draftConversation.userId;

      if (socket && socket.connected) {
        socket.emit('send_message', { participantIds: [otherId], content, messageType: 'text' });
        // onMessageSent will handle reordering & selection
        return;
      }

      // fallback REST create/send
      try {
        const res = await axios.post(`http://localhost:3000/chats/private/${encodeURIComponent(otherId)}`, {
          content,
          messageType: 'text',
        }, { headers: { Authorization: `Bearer ${token}` } });

        const saved = res.data;
        const convId = saved.conversationId ?? saved.conversation?._id ?? saved._id ?? null;
        if (convId) {
          // since local user sent, move new conv to top
          setConversations(prev => {
            const filtered = prev.filter(c => String(c._id) !== `draft:${otherId}` && String(c._id) !== String(convId));
            return [{ _id: convId, participants: saved.participants ?? [otherId], lastMessage: saved, updatedAt: saved.createdAt ?? new Date().toISOString() }, ...filtered];
          });
          await loadMessages(convId);
        } else {
          setMessages(prev => [...prev, saved]);
        }
        setDraftConversation(null);
        setSelectedConvId(convId ?? null);
      } catch (err) {
        console.error('Failed to send initial message', err);
        alert('Failed to send message');
      }
      return;
    }

    alert('No conversation selected');
  };

  // ---------------- Open conversation (click) ----------------
  // Clicking selects/highlights & opens messages but DOES NOT reorder conversation list.
  const handleConversationStart = (payload) => {
    if (typeof payload === 'string') {
      setSelectedConvId(String(payload));
      loadMessages(payload);
      return;
    }

    if (payload && payload.draft) {
      const otherUserId = payload.userId;
      const otherUserName = payload.userName;

      // if persisted conv exists, open that instead
      const existing = conversations.find(c => {
        const parts = c.participants || [];
        return parts.some(p => String(participantId(p)) === String(otherUserId));
      });

      if (existing) {
        setSelectedConvId(String(existing._id ?? existing.id));
        loadMessages(String(existing._id ?? existing.id));
        return;
      }

      // open frontend-only draft and append to end (do not reorder)
      setConversationId('');
      setMessages([]);
      setDraftConversation({ userId: otherUserId, userName: otherUserName });
      const draftId = `draft:${otherUserId}`;
      setConversations(prev => {
        if (prev.some(c => String(c._id) === draftId)) return prev;
        return [...prev, { _id: draftId, participants: [otherUserId], name: otherUserName, lastMessage: null, updatedAt: new Date().toISOString() }];
      });
      setSelectedConvId(draftId);
      return;
    }

    if (payload && payload._id) {
      setSelectedConvId(String(payload._id));
      loadMessages(String(payload._id));
      return;
    }
  };

  // ---------------- Load known conversations at mount ----------------
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetchConversations = async () => {
      try {
        const res = await axios.get('http://localhost:3000/chats/conversations', { headers: { Authorization: `Bearer ${token}` } });
        const convs = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) {
          // server should already sort by updatedAt desc; we respect server order
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

  // ---------------- Resolve participant names ----------------
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

              return (
                <li
                  key={convId}
                  className="conv-item"
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
                    background: isSelected ? 'rgba(255,255,255,0.02)' : undefined,
                  }}
                >
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

        <div className="chat-footer">
          <div style={{ flex: 1 }}>
            <MessageInput sendMessage={sendMessage} />
          </div>
        </div>
      </div>
    </div>
  );
}
