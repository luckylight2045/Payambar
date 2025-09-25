// src/pages/ChatPage.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import ChatForm from '../components/ChatForm';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import axios from 'axios';

/**
 * ChatPage with improved presence UX:
 *  - uses navigator.onLine to detect local network offline/online
 *  - when offline: immediately clears onlineUsers locally and shows "Connecting..."
 *  - when online: attempts to reconnect socket and waits for server 'online_list' to repopulate presence
 *
 * No backend changes are required for this to improve the UI responsiveness.
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
  --online: #2b9cff;
}
html,body,#root { height:100%; margin:0; font-family: Inter, "Helvetica Neue", Arial, sans-serif; background:var(--bg); color:var(--text); }
.app-container { height:100vh; display:flex; gap:0; overflow:hidden; }
.sidebar { width:320px; min-width:260px; background: linear-gradient(180deg, var(--sidebar-bg), #051218); border-right: 1px solid rgba(255,255,255,0.04); padding:18px; box-sizing:border-box; display:flex; flex-direction:column; }
.sidebar .title { font-size:22px; font-weight:700; margin-bottom:12px; color:var(--text); }
.conversations-list { margin-top:6px; overflow-y:auto; padding-right:6px; flex:1; }
.conv-item { display:flex; gap:12px; align-items:center; padding:10px; border-radius:10px; cursor:pointer; transition: background .12s ease, transform .06s ease; color:var(--text); }
.conv-item:hover { background: rgba(255,255,255,0.02); transform: translateY(-1px); }
.conv-item.selected { background: rgba(255,255,255,0.03); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02); }
.conv-avatar{ position:relative; width:44px; height:44px; border-radius:50%; background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.08)); display:flex; align-items:center; justify-content:center; color:var(--text); font-weight:700; font-size:14px; flex-shrink:0; }
.conv-avatar .online-badge { position:absolute; right:-2px; bottom:-2px; width:12px; height:12px; border-radius:6px; border: 2px solid #071019; background: var(--online); box-shadow: 0 0 6px rgba(43,156,255,0.4); }
.conv-meta { display:flex; flex-direction:column; gap:4px; min-width:0; flex:1; overflow:hidden; }
.conv-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.conv-username { font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:165px; }
.conv-last { font-size:13px; color:var(--muted-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:220px; }
.conv-time { font-size:12px; color:var(--muted); white-space:nowrap; margin-left:6px; }
.chat-main { flex:1; display:flex; flex-direction:column; background: var(--bg-2); overflow:hidden; }
.connecting-banner { background: rgba(255,255,255,0.03); padding:8px 12px; text-align:center; color: var(--muted); font-size:13px; border-bottom: 1px solid rgba(255,255,255,0.02); }
.messages-wrap { padding:18px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; height:100%; }
.empty-state { height:100%; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:16px; }
`;

  const { token, user } = useAuth();
  const socketRef = useSocket({ token });

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [participantNameMap, setParticipantNameMap] = useState({});
  const [draftConversation, setDraftConversation] = useState(null);

  // presence + typing
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [isNetworkOnline, setIsNetworkOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const typingRef = useRef(new Map());
  const [typingRenderState, setTypingRenderState] = useState({});

  const [activeConvId, setActiveConvId] = useState(null); // selected item (draft:id or real)
  const [loadedConvId, setLoadedConvId] = useState(null); // persisted conversation loaded

  const currentUserId = user?.id ?? user?._id ?? user?.__raw?._id ?? null;
  const currentUserName = user?.username ?? user?.name ?? 'You';

  // presence helpers
  const addOnline = useCallback((id) => {
    setOnlineUsers((prev) => {
      const s = new Set(prev);
      s.add(String(id));
      return s;
    });
  }, []);
  const removeOnline = useCallback((id) => {
    setOnlineUsers((prev) => {
      const s = new Set(prev);
      s.delete(String(id));
      return s;
    });
  }, []);

  // typing helpers
  const TYPING_EXPIRE_MS = 6000;
  const addTypingUser = useCallback((convId, userId) => {
    if (!convId || !userId) return;
    if (String(userId) === String(currentUserId)) return;
    const convMap = typingRef.current.get(convId) || new Map();
    const prevTimer = convMap.get(userId);
    if (prevTimer) clearTimeout(prevTimer);
    const t = setTimeout(() => {
      const m = typingRef.current.get(convId);
      if (m) {
        m.delete(userId);
        if (m.size === 0) typingRef.current.delete(convId);
        else typingRef.current.set(convId, m);
      }
      const newRender = {};
      typingRef.current.forEach((m2, k) => { newRender[k] = Array.from(m2.keys()); });
      setTypingRenderState(newRender);
    }, TYPING_EXPIRE_MS);
    convMap.set(userId, t);
    typingRef.current.set(convId, convMap);
    const newRender = {};
    typingRef.current.forEach((m2, k) => { newRender[k] = Array.from(m2.keys()); });
    setTypingRenderState(newRender);
  }, [currentUserId]);

  // participant id helper
  const participantId = (p) => {
    if (!p) return null;
    if (typeof p === 'string') return String(p);
    if (typeof p === 'object') {
      if (p._id) return String(p._id);
      if (p.id) return String(p.id);
    }
    return null;
  };

  // socket listeners
  useEffect(() => {
    const s = socketRef?.current;
    if (!s) return () => {};

    const onOnlineList = (list) => {
      if (!Array.isArray(list)) return;
      setOnlineUsers(new Set(list.map((i) => String(i))));
    };
    const onUserConnected = (payload) => {
      const uid = payload && (payload.userId ?? payload);
      if (!uid) return;
      addOnline(uid);
    };
    const onUserDisconnected = (payload) => {
      const uid = payload && (payload.userId ?? payload);
      if (!uid) return;
      removeOnline(uid);
    };
    const onTyping = (payload) => {
      if (!payload) return;
      const convId = payload.conversationId;
      const userId = payload.userId;
      if (!convId || !userId) return;
      if (payload.isTyping) addTypingUser(convId, userId);
      else {
        const m = typingRef.current.get(convId);
        if (m) {
          const t = m.get(userId);
          if (t) clearTimeout(t);
          m.delete(userId);
          if (m.size === 0) typingRef.current.delete(convId);
          else typingRef.current.set(convId, m);
          const newRender = {};
          typingRef.current.forEach((m2, k) => { newRender[k] = Array.from(m2.keys()); });
          setTypingRenderState(newRender);
        }
      }
    };
    const onReceiveMessage = (message) => {
      if (!message) return;
      setConversations((prev) => {
        const copy = prev.slice();
        const idx = copy.findIndex((c) => String(c._id) === String(message.conversationId));
        if (idx !== -1) {
          copy[idx] = { ...copy[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
          return copy;
        }
        return [{ _id: message.conversationId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...copy];
      });
      if (String(message.conversationId) === String(loadedConvId)) {
        setMessages((prev) => [...prev, message]);
      }
    };
    const onMessageSent = (message) => {
      if (!message) return;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c._id) === String(message.conversationId));
        if (idx !== -1) {
          const item = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
          const copy = prev.slice();
          copy.splice(idx, 1);
          return [item, ...copy];
        }
        return [{ _id: message.conversationId, participants: message.participants ?? [], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...prev];
      });
      if (String(message.conversationId) === String(loadedConvId)) {
        setMessages((prev) => [...prev, message]);
      }
      setActiveConvId(String(message.conversationId));
      setLoadedConvId(String(message.conversationId));
    };

    s.on('online_list', onOnlineList);
    s.on('user_connected', onUserConnected);
    s.on('user_disconnected', onUserDisconnected);
    s.on('typing', onTyping);
    s.on('receive_message', onReceiveMessage);
    s.on('message_sent', onMessageSent);

    return () => {
      try {
        s.off('online_list', onOnlineList);
        s.off('user_connected', onUserConnected);
        s.off('user_disconnected', onUserDisconnected);
        s.off('typing', onTyping);
        s.off('receive_message', onReceiveMessage);
        s.off('message_sent', onMessageSent);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ChatPage] socket off error', e && (e.message || e));
      }
    };
  }, [socketRef, addOnline, removeOnline, addTypingUser, loadedConvId]);

  // network (navigator.onLine) handling: immediate local UX updates
  useEffect(() => {
    const onOffline = () => {
      setIsNetworkOnline(false);
      // immediately clear online presence locally while offline (UX: immediate feedback)
      setOnlineUsers(new Set());
    };
    const onOnline = () => {
      setIsNetworkOnline(true);
      // Try to reconnect socket (the hook also handles this but we call explicitly to be safe)
      try {
        socketRef?.current?.connect?.();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ChatPage] connect attempt failed', e && e.message);
      }
      // when socket reconnects the server should emit `online_list`
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [socketRef]);

  // load conversations initially
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('http://localhost:3000/chats/conversations', { headers: { Authorization: `Bearer ${token}` } });
        const convs = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) {
          setConversations(convs);
          fillParticipantNames(convs);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ChatPage] Failed to load conversations', err && (err.message || err));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    const promises = ids.map((id) => axios.get(`http://localhost:3000/users/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => ({ id, name: r.data?.userName ?? r.data?.name ?? r.data?.username ?? null }))
      .catch(() => ({ id, name: null })));
    const results = await Promise.all(promises);
    setParticipantNameMap((prev) => {
      const copy = { ...prev };
      for (const r of results) {
        copy[r.id] = r.name || r.id.slice(0, 6);
      }
      return copy;
    });
  };

  // load messages for a conversation
  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const res = await axios.get(`http://localhost:3000/chats/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 },
      });
      const msgs = Array.isArray(res.data) ? res.data.slice().reverse() : [];
      setMessages(msgs);
      setLoadedConvId(convId);

      const s = socketRef.current;
      if (s && s.connected) s.emit('join_conversation', { conversationId: convId });

      setTimeout(() => {
        const el = document.getElementById('messages-wrap');
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ChatPage] Failed to load messages', e && (e.message || e));
      alert('Failed to load messages');
    }
  };

  // sending message (socket preferred)
  const sendMessage = async (content) => {
    if (!content || !content.trim()) return;
    const s = socketRef.current;
    if (loadedConvId) {
      if (!s || !s.connected) { alert('Socket not connected'); return; }
      s.emit('send_message', { conversationId: loadedConvId, content, messageType: 'text' });
      return;
    }

    // draft conversation handling
    if (activeConvId && String(activeConvId).startsWith('draft:') && draftConversation) {
      const otherId = draftConversation.userId;
      if (!otherId) return;
      if (s && s.connected) {
        s.emit('send_message', { participantIds: [otherId], content, messageType: 'text' });
        setDraftConversation(null);
        return;
      }
      try {
        const res = await axios.post(`http://localhost:3000/chats/private/${encodeURIComponent(otherId)}`, {
          content, messageType: 'text',
        }, { headers: { Authorization: `Bearer ${token}` } });
        const saved = res.data;
        const convId = saved.conversationId ?? saved.conversation?._id ?? saved._id ?? null;
        if (convId) {
          await refreshConversationsFromServer();
          setDraftConversation(null);
          setActiveConvId(convId);
          await loadMessages(convId);
        } else {
          setMessages((prev) => [...prev, saved]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ChatPage] Failed to send initial message', err && (err.message || err));
        alert('Failed to send message');
      }
      return;
    }

    alert('No conversation selected');
  };

  const refreshConversationsFromServer = async () => {
    if (!token) return null;
    try {
      const res = await axios.get('http://localhost:3000/chats/conversations', { headers: { Authorization: `Bearer ${token}` } });
      const convs = Array.isArray(res.data) ? res.data : [];
      setConversations(convs);
      fillParticipantNames(convs);
      return convs;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ChatPage] Failed to refresh conversations', err && (err.message || err));
      return null;
    }
  };

  // handle starting/selecting conversation
  const handleConversationStart = (payload) => {
    if (!payload) return;
    if (typeof payload === 'string') {
      setActiveConvId(payload);
      setDraftConversation(null);
      loadMessages(payload);
      return;
    }
    if (payload && payload.draft) {
      const otherUserId = payload.userId;
      const otherUserName = payload.userName;
      // check if we already have persisted conversation with that user
      const existing = conversations.find((c) => {
        const parts = c.participants || [];
        return parts.some((p) => participantId(p) && String(participantId(p)) === String(otherUserId));
      });
      if (existing) {
        const existingId = existing._id ?? existing.id ?? existing;
        setActiveConvId(existingId);
        setDraftConversation(null);
        loadMessages(existingId);
        return;
      }
      const draftId = `draft:${otherUserId}`;
      setActiveConvId(draftId);
      setLoadedConvId(null);
      setMessages([]);
      setDraftConversation({ userId: otherUserId, userName: otherUserName });
      setConversations((prev) => {
        if (prev.some((c) => String(c._id) === draftId)) return prev;
        return [...prev, {
          _id: draftId,
          participants: [
            { _id: currentUserId, name: currentUserName },
            { _id: otherUserId, name: otherUserName },
          ],
          name: otherUserName,
          lastMessage: null,
          updatedAt: new Date().toISOString(),
        }];
      });
      return;
    }
    if (payload && payload._id) {
      setActiveConvId(payload._id);
      setDraftConversation(null);
      loadMessages(payload._id);
    }
  };

  // display helpers
  const getOtherNameForConversation = (c) => {
    if (!c) return 'Unknown';
    if (c.name) return c.name;
    const parts = c.participants || [];
    for (const p of parts) {
      const id = participantId(p);
      if (!id) continue;
      if (String(id) === String(currentUserId)) continue;
      if (typeof p === 'object') {
        if (p.name) return p.name;
        if (p.userName) return p.userName;
      }
      return participantNameMap[id] ?? String(id).slice(0, 6);
    }
    if (parts.length === 0 || parts.every((p) => String(participantId(p)) === String(currentUserId))) {
      return 'SavedMessages';
    }
    return 'Unknown';
  };

  const previewForLastMessage = (c) => {
    const m = c.lastMessage ?? null;
    if (m && typeof m === 'object' && m.content) {
      const content = (m.content ?? '').replace(/\s+/g, ' ').trim();
      const prefix = (m.senderId && String((m.senderId._id ?? m.senderId) ?? '') === String(currentUserId)) ? 'You: ' : '';
      const max = 48;
      if (content.length <= max) return prefix + content;
      return prefix + content.slice(0, max).trim() + '…';
    }
    if (c.lastMessageContent) {
      const text = (c.lastMessageContent ?? '').replace(/\s+/g, ' ').trim();
      const prefix = c.lastMessageSender && String(c.lastMessageSender) === String(currentUserId) ? 'You: ' : '';
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

  const formatConversationTime = (isoOrDate) => {
    if (!isoOrDate) return '';
    const d = new Date(isoOrDate);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const isOtherParticipantOnline = (c) => {
    if (!c) return false;
    const parts = c.participants || [];
    for (const p of parts) {
      const id = participantId(p);
      if (!id) continue;
      if (String(id) === String(currentUserId)) continue;
      if (onlineUsers.has(String(id))) return true;
    }
    return false;
  };

  // typing display for current conv
  const convForTyping = loadedConvId || activeConvId || '';
  const typingUsersForCurrent = (typingRenderState[convForTyping] || []).filter((id) => String(id) !== String(currentUserId));
  const typingNames = typingUsersForCurrent.map((id) => participantNameMap[id] ?? id.slice(0, 6));

  // show connecting banner when local network offline OR socket not connected
  const socketConnected = !!(socketRef && socketRef.current && socketRef.current.connected);
  const showConnecting = !isNetworkOnline || !socketConnected;

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
              const isSelected = activeConvId && String(convId) === String(activeConvId);
              const lastMsgPreview = previewForLastMessage(c);
              const lastTime = lastMessageTimeForConv(c);
              const otherOnline = isOtherParticipantOnline(c);

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
                  style={{ cursor: 'pointer' }}
                >
                  <div className="conv-avatar">
                    {(otherName || 'U').slice(0,2).toUpperCase()}
                    {otherOnline ? <span className="online-badge" /> : null}
                  </div>

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
        {showConnecting ? <div className="connecting-banner">Connecting…</div> : null}

        <div className="messages-wrap" id="messages-wrap">
          {loadedConvId ? (
            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              participantNameMap={participantNameMap}
              currentUserName={currentUserName}
            />
          ) : activeConvId && String(activeConvId).startsWith('draft:') ? (
            <>
              <div style={{ padding: 12, color: 'var(--muted)' }}>
                Chat with <strong>{draftConversation?.userName ?? draftConversation?.userId}</strong>
              </div>
              <MessageList
                messages={messages}
                currentUserId={currentUserId}
                participantNameMap={{ ...participantNameMap, [draftConversation?.userId]: draftConversation?.userName }}
                currentUserName={currentUserName}
              />
            </>
          ) : (
            <div className="empty-state">Start a new chat or select a conversation.</div>
          )}
        </div>

        {typingNames.length > 0 && (
          <div style={{ padding: 8, color: 'var(--muted)' }}>
            {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
          </div>
        )}

        {activeConvId ? (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', padding: 12 }}>
            <MessageInput sendMessage={sendMessage} conversationId={loadedConvId || (draftConversation ? `draft:${draftConversation.userId}` : '')} socketRef={socketRef} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
