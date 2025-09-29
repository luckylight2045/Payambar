/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/pages/ChatPage.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import useSocket from '../hooks/useSocket';
import ChatForm from '../components/ChatForm';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import axios from 'axios';

import useConversations from '../hooks/useConversations';
import ContextMenu from '../components/ContextMenu';
import {
  participantId as utilParticipantId,
  removeAllDraftsFromList,
  removeDraftForUser,
  previewForLastMessage,
  lastMessageTimeForConv,
  formatConversationTime,
} from '../utils/chatUtils';

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

  const { conversations, setConversations, refresh, deleteConversation, clearHistory } = useConversations(token);

  const [messages, setMessages] = useState([]);
  const [participantNameMap, setParticipantNameMap] = useState({});
  const [draftConversation, setDraftConversation] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [isNetworkOnline, setIsNetworkOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const typingRef = useRef(new Map());
  const [typingRenderState, setTypingRenderState] = useState({});

  const [activeConvId, setActiveConvId] = useState(null);
  const [loadedConvId, setLoadedConvId] = useState(null);

  const currentUserId = user?.id ?? user?._id ?? user?.__raw?._id ?? null;
  const currentUserName = user?.username ?? user?.name ?? 'You';

  const [ctxVisible, setCtxVisible] = useState(false);
  const [ctxX, setCtxX] = useState(0);
  const [ctxY, setCtxY] = useState(0);
  const [ctxTargetConv, setCtxTargetConv] = useState(null);

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

  const inferParticipantsFromMessage = (message) => {
    const parts = Array.isArray(message?.participants) ? message.participants.slice() : [];
    if (parts.length > 0) return parts;
    if (Array.isArray(message?.participantIds) && message.participantIds.length > 0) {
      const inferred = message.participantIds.map((id) => (typeof id === 'object' ? id : { _id: id }));
      if (inferred.length > 0) {
        // Ensure current user appears too
        if (!inferred.some((p) => String(utilParticipantId(p)) === String(currentUserId))) {
          inferred.push({ _id: currentUserId });
        }
        return inferred;
      }
    }
    const inferred = [];
    if (message?.senderId) inferred.push({ _id: message.senderId });
    if (draftConversation && typeof draftConversation.userId === 'string') {
      const draftOther = draftConversation.userId;
      if (!inferred.some((p) => String(utilParticipantId(p)) === String(draftOther))) {
        inferred.push({ _id: draftOther });
      }
      if (!inferred.some((p) => String(utilParticipantId(p)) === String(currentUserId))) {
        inferred.push({ _id: currentUserId });
      }
      return inferred;
    }
    if (inferred.length === 1) {
      if (String(inferred[0]._id) !== String(currentUserId)) {
        inferred.push({ _id: currentUserId });
      }
    }
    return inferred;
  };

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

      const participants = inferParticipantsFromMessage(message);
      setConversations((prev) => {
        const copy = (prev || []).slice();
        const idx = copy.findIndex((c) => String(c._id) === String(message.conversationId));
        if (idx !== -1) {
          copy[idx] = { ...copy[idx], lastMessage: message, participants, updatedAt: message.createdAt ?? new Date().toISOString() };
          return copy;
        }
        return [{ _id: message.conversationId, participants, lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...copy];
      });

      try {
        const parts = participants || [];
        for (const p of parts) {
          const pid = utilParticipantId(p);
          if (!pid) continue;
          setConversations((prev) => removeDraftForUser(prev, pid));
        }
      } catch (e) {}

      if (String(message.conversationId) === String(loadedConvId)) {
        setMessages((prev) => [...prev, message]);
        try {
          socketRef?.current?.emit('messages_received', { messageIds: [String(message._id ?? message.id ?? '')] });
        } catch (e) {}
      }
    };

    const onMessageSent = (message) => {
      if (!message) return;
      const participants = inferParticipantsFromMessage(message);

      setConversations((prev) => {
        const idx = (prev || []).findIndex((c) => String(c._id) === String(message.conversationId));
        if (idx !== -1) {
          const item = { ...prev[idx], lastMessage: message, participants, updatedAt: message.createdAt ?? new Date().toISOString() };
          const copy = prev.slice();
          copy.splice(idx, 1);
          return [item, ...copy];
        }
        return [{ _id: message.conversationId, participants, lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() }, ...(prev || [])];
      });

      try {
        const parts = participants || [];
        for (const p of parts) {
          const pid = utilParticipantId(p);
          if (!pid) continue;
          setConversations((prev) => removeDraftForUser(prev, pid));
        }
      } catch (e) {}

      if (String(message.conversationId) === String(loadedConvId)) {
        setMessages((prev) => [...prev, message]);
      } else if (activeConvId && String(activeConvId).startsWith('draft:')) {
        const draftUid = draftConversation?.userId ?? String(activeConvId).replace(/^draft:/, '');
        const partsFlat = (participants || []).map((p) => utilParticipantId(p) || (typeof p === 'string' ? p : null)).filter(Boolean);
        const otherMatch = partsFlat.some((id) => String(id) === String(draftUid));
        if (otherMatch || (String(message.senderId) === String(currentUserId) && String(message.conversationId))) {
          setMessages((prev) => [...prev, message]);
        }
      }

      if (draftConversation) {
        const draftUid = String(draftConversation.userId);
        const partsFlat = (participants || []).map((p) => utilParticipantId(p) || (typeof p === 'string' ? p : null)).filter(Boolean);
        if (partsFlat.some((id) => String(id) === draftUid) || (String(message.senderId) === String(currentUserId) && partsFlat.length === 0)) {
          setConversations((prev) => removeDraftForUser(prev, draftUid));
          setDraftConversation(null);
        }
      }

      setActiveConvId(String(message.conversationId));
      setLoadedConvId(String(message.conversationId));
    };

    const onMessageDelivered = (payload) => {
      if (!payload || !payload.messageId) return;
      const mid = String(payload.messageId);
      const deliveredAt = payload.deliveredAt ?? new Date().toISOString();
      setMessages((prev) => (prev || []).map((m) => {
        const id = String(m._id ?? m.id ?? '');
        if (id === mid) {
          return { ...m, deliveredAt };
        }
        return m;
      }));
      setConversations((prev) => (prev || []).map((c) => {
        const lm = c.lastMessage ?? null;
        const lmId = lm ? String(lm._id ?? lm.id ?? '') : null;
        if (lmId === mid) {
          const newLast = { ...(lm || {}), deliveredAt };
          return { ...c, lastMessage: newLast };
        }
        return c;
      }));
    };

    const onMessageRead = (payload) => {
      if (!payload || !payload.messageId) return;
      const mid = String(payload.messageId);
      const readAt = payload.readAt ?? new Date().toISOString();
      setMessages((prev) => (prev || []).map((m) => {
        const id = String(m._id ?? m.id ?? '');
        if (id === mid) {
          return { ...m, readAt, isRead: true };
        }
        return m;
      }));
      setConversations((prev) => (prev || []).map((c) => {
        const lm = c.lastMessage ?? null;
        const lmId = lm ? String(lm._id ?? lm.id ?? '') : null;
        if (lmId === mid) {
          const newLast = { ...(lm || {}), readAt, isRead: true };
          return { ...c, lastMessage: newLast };
        }
        return c;
      }));
    };

    s.on('online_list', onOnlineList);
    s.on('user_connected', onUserConnected);
    s.on('user_disconnected', onUserDisconnected);
    s.on('typing', onTyping);
    s.on('receive_message', onReceiveMessage);
    s.on('message_sent', onMessageSent);
    s.on('message_delivered', onMessageDelivered);
    s.on('message_read', onMessageRead);

    return () => {
      try {
        s.off('online_list', onOnlineList);
        s.off('user_connected', onUserConnected);
        s.off('user_disconnected', onUserDisconnected);
        s.off('typing', onTyping);
        s.off('receive_message', onReceiveMessage);
        s.off('message_sent', onMessageSent);
        s.off('message_delivered', onMessageDelivered);
        s.off('message_read', onMessageRead);
      } catch (e) {
        console.warn('[ChatPage] socket off error', e && (e.message || e));
      }
    };
  }, [socketRef, addOnline, removeOnline, addTypingUser, loadedConvId, setConversations, currentUserId, activeConvId, draftConversation]);

  useEffect(() => {
    const onOffline = () => {
      setIsNetworkOnline(false);
      setOnlineUsers(new Set());
    };
    const onOnline = () => {
      setIsNetworkOnline(true);
      try {
        socketRef?.current?.connect();
      } catch (e) {
        console.warn('[ChatPage] connect attempt failed', e && e.message);
      }
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [socketRef]);

  const fillParticipantNames = async (convs) => {
    if (!Array.isArray(convs) || convs.length === 0) return;
    const idsToFetch = new Set();
    for (const c of convs) {
      const parts = c.participants || [];
      for (const p of parts) {
        const id = utilParticipantId(p);
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

  useEffect(() => {
    fillParticipantNames(conversations);
  }, [conversations]);

  const getLastMessageId = (c) => {
    if (!c) return null;
    const lm = c.lastMessage ?? c.lastMessageContent ?? null;
    if (!lm) return null;
    if (typeof lm === 'string') return lm;
    if (typeof lm === 'object') return lm._id ?? lm.id ?? null;
    return null;
  };

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

      if (socketRef?.current && socketRef.current.connected && msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        const lastId = String(last._id ?? last.id ?? '');
        if (lastId) {
          try {
            socketRef.current.emit('messages_received', { conversationId: convId, upToMessageId: lastId });
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error('[ChatPage] Failed to load messages', e && (e.message || e));
      alert('Failed to load messages');
    }
  };

  const sendMessage = async (content) => {
    if (!content || !content.trim()) return;
    const s = socketRef.current;
    if (loadedConvId) {
      if (!s || !s.connected) { alert('Socket not connected'); return; }
      s.emit('send_message', { conversationId: loadedConvId, content, messageType: 'text' });
      return;
    }

    if (activeConvId && String(activeConvId).startsWith('draft:') && draftConversation) {
      const otherId = draftConversation.userId;
      if (!otherId) return;
      if (s && s.connected) {
        s.emit('send_message', { participantIds: [otherId], content, messageType: 'text' });
        return;
      }
      try {
        const res = await axios.post(`http://localhost:3000/chats/private/${encodeURIComponent(otherId)}`, {
          content, messageType: 'text',
        }, { headers: { Authorization: `Bearer ${token}` } });
        const saved = res.data;
        const convId = saved.conversationId ?? saved.conversation?._id ?? saved._id ?? null;
        if (convId) {
          await refresh();
          setDraftConversation(null);
          setActiveConvId(convId);
          await loadMessages(convId);
        } else {
          setMessages((prev) => [...prev, saved]);
        }
      } catch (err) {
        console.error('[ChatPage] Failed to send initial message', err && (err.message || err));
        alert('Failed to send message');
      }
      return;
    }

    alert('No conversation selected');
  };

  const refreshConversationsFromServer = async () => {
    if (!token) return null;
    const convs = await refresh();
    return convs;
  };

  const handleConversationStart = (payload) => {
    if (!payload) return;
    if (typeof payload === 'string') {
      setConversations((prev) => removeAllDraftsFromList(prev));
      setActiveConvId(payload);
      setDraftConversation(null);
      loadMessages(payload);
      return;
    }

    if (payload && payload.draft) {
      const otherUserId = payload.userId;
      const otherUserName = payload.userName;
      const existing = (conversations || []).find((c) => {
        const parts = c.participants || [];
        return parts.some((p) => utilParticipantId(p) && String(utilParticipantId(p)) === String(otherUserId));
      });
      if (existing) {
        const existingId = existing._id ?? existing.id ?? existing;
        setConversations((prev) => removeAllDraftsFromList(prev));
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
        const cleaned = removeAllDraftsFromList(prev);
        if (cleaned.some((c) => String(c._id) === draftId)) return cleaned;
        return [...cleaned, {
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
      setConversations((prev) => removeAllDraftsFromList(prev));
      setActiveConvId(payload._id);
      setDraftConversation(null);
      loadMessages(payload._id ?? payload.id ?? payload);
    }
  };

  const getOtherNameForConversation = (c) => {
    if (!c) return 'Unknown';
    if (c.name) return c.name;
    const parts = c.participants || [];
    for (const p of parts) {
      const id = utilParticipantId(p);
      if (!id) continue;
      if (String(id) === String(currentUserId)) continue;
      if (typeof p === 'object') {
        if (p.name) return p.name;
        if (p.userName) return p.userName;
      }
      return participantNameMap[id] ?? String(id).slice(0, 6);
    }
    if (parts.length === 0 || parts.every((p) => String(utilParticipantId(p)) === String(currentUserId))) {
      return 'SavedMessages';
    }
    return 'Unknown';
  };

  const isOtherParticipantOnline = (c) => {
    if (!c) return false;
    const parts = c.participants || [];
    for (const p of parts) {
      const id = utilParticipantId(p);
      if (!id) continue;
      if (String(id) === String(currentUserId)) continue;
      if (onlineUsers.has(String(id))) return true;
    }
    return false;
  };

  const convForTyping = loadedConvId || activeConvId || '';
  const typingUsersForCurrent = (typingRenderState[convForTyping] || []).filter((id) => String(id) !== String(currentUserId));
  const typingNames = typingUsersForCurrent.map((id) => participantNameMap[id] ?? id.slice(0, 6));

  const socketConnected = !!(socketRef && socketRef.current && socketRef.current.connected);
  const showConnecting = !isNetworkOnline || !socketConnected;

  const openContextMenu = (e, conv) => {
    e.preventDefault();
    setCtxTargetConv(conv);
    setCtxX(e.clientX);
    setCtxY(e.clientY);
    setCtxVisible(true);
  };

  const closeContextMenu = () => {
    setCtxVisible(false);
    setCtxTargetConv(null);
  };

  const handleClearHistory = async () => {
    const conv = ctxTargetConv;
    if (!conv) return;
    const convId = conv._id ?? conv.id ?? '';
    if (String(convId).startsWith('draft:')) {
      setMessages([]);
      return;
    }
    const result = await clearHistory(convId);
    if (result.ok) {
      setConversations((prev) => (prev || []).map((c) => {
        if (String(c._id ?? c.id ?? '') === String(convId)) {
          return { ...c, lastMessage: null };
        }
        return c;
      }));
      if (String(loadedConvId) === String(convId)) {
        setMessages([]);
      }
    } else {
      alert('Failed to clear history');
    }
  };

  const handleDeleteConversation = async () => {
    const conv = ctxTargetConv;
    if (!conv) return;
    const convId = conv._id ?? conv.id ?? '';
    if (String(convId).startsWith('draft:')) {
      const otherUserId = String(convId).replace(/^draft:/, '');
      setConversations((prev) => removeDraftForUser(prev, otherUserId));
      if (String(activeConvId) === String(convId)) {
        setActiveConvId(null);
        setLoadedConvId(null);
        setMessages([]);
        setDraftConversation(null);
      }
      closeContextMenu();
      return;
    }
    const res = await deleteConversation(convId);
    if (res.ok) {
      setConversations((prev) => (prev || []).filter((c) => String(c._id ?? c.id ?? '') !== String(convId)));
      if (String(activeConvId) === String(convId)) {
        setActiveConvId(null);
        setLoadedConvId(null);
        setMessages([]);
      }
    } else {
      alert('Failed to delete conversation');
    }
  };

  const handleDeleteMessage = async (messageId, messageObj) => {
    if (!messageId) return;
    if (!loadedConvId) {
      setMessages((prev) => (prev || []).filter((m) => String(m._id ?? m.id ?? '') !== String(messageId)));
      return;
    }

    try {
      const res = await axios.delete(
        `http://localhost:3000/messages/${encodeURIComponent(messageId)}/${encodeURIComponent(loadedConvId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const deletedCount = res?.data?.deletedCount ?? (res?.data ? 1 : 0);

      if (deletedCount > 0) {
        setMessages((prev) => (prev || []).filter((m) => String(m._id ?? m.id ?? '') !== String(messageId)));

        setConversations((prev) => (prev || []).map((c) => {
          if (String(c._id ?? c.id ?? '') === String(loadedConvId)) {
            const lm = c.lastMessage ?? c.lastMessageContent ?? null;
            const lastMsgId = (typeof lm === 'object' && lm) ? (lm._id ?? lm.id ?? null) : (typeof lm === 'string' ? lm : null);
            if (String(lastMsgId) === String(messageId)) {
              return { ...c, lastMessage: null };
            }
          }
          return c;
        }));
      } else {
        alert('No message removed');
      }
    } catch (err) {
      console.error('[ChatPage] delete message failed', err?.response?.data ?? err?.message ?? err);
      alert('Failed to delete message');
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    if (!messageId) return { ok: false, error: 'no id' };
    if (newContent === null || newContent === undefined) return { ok: false, error: 'content required' };
    const normalizedNew = String(newContent);

    const origMsg = (messages || []).find((m) => String(m._id ?? m.id ?? '') === String(messageId));
    const origContent = origMsg ? String(origMsg.content ?? '') : null;

    if (origContent !== null && String(origContent) === normalizedNew) {
      return { ok: true, edited: false };
    }

    if (!loadedConvId) {
      setMessages((prev) => (prev || []).map((m) => {
        if (String(m._id ?? m.id ?? '') === String(messageId)) {
          return { ...m, content: normalizedNew, isEdited: true, updatedAt: new Date().toISOString() };
        }
        return m;
      }));
      return { ok: true };
    }

    try {
      const res = await axios.patch(
        `http://localhost:3000/messages/${encodeURIComponent(messageId)}`,
        { content: normalizedNew },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages((prev) => (prev || []).map((m) => {
        if (String(m._id ?? m.id ?? '') === String(messageId)) {
          return { ...m, content: normalizedNew, isEdited: true, updatedAt: new Date().toISOString() };
        }
        return m;
      }));

      setConversations((prev) => (prev || []).map((c) => {
        if (String(c._id ?? c.id ?? '') === String(loadedConvId)) {
          const lm = c.lastMessage ?? null;
          const lmId = lm ? (lm._id ?? lm.id ?? null) : null;
          if (String(lmId) === String(messageId)) {
            const newLast = { ...(lm || {}), content: normalizedNew, isEdited: true, updatedAt: new Date().toISOString() };
            return { ...c, lastMessage: newLast };
          }
        }
        return c;
      }));

      return { ok: true };
    } catch (err) {
      console.error('[ChatPage] edit message failed', err?.response?.data ?? err?.message ?? err);
      return { ok: false, error: err?.response?.data ?? err?.message };
    }
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
              const isSelected = activeConvId && String(convId) === String(activeConvId);
              const lastMsgPreview = previewForLastMessage(c, currentUserId);
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
                  onContextMenu={(e) => openContextMenu(e, c)}
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
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
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
                onDeleteMessage={handleDeleteMessage}
                onEditMessage={handleEditMessage}
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

      <ContextMenu
        visible={ctxVisible}
        x={ctxX}
        y={ctxY}
        isDraft={ctxTargetConv ? String((ctxTargetConv._id ?? ctxTargetConv.id ?? '')).startsWith('draft:') : false}
        onClose={closeContextMenu}
        onClearHistory={handleClearHistory}
        onDeleteConversation={handleDeleteConversation}
      />
    </div>
  );
}
