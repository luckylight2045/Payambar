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

  const messagesWrapRef = useRef(null);

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

  const emittedReceivedRef = useRef({});
  const emittedUpToRef = useRef({});

  const emitMessagesReceivedForConversation = useCallback((convId, opts = {}) => {
    const s = socketRef?.current;
    if (!s || !convId) return;
    try {
      const convKey = String(convId);
      emittedReceivedRef.current[convKey] = emittedReceivedRef.current[convKey] || new Set();
      const already = emittedReceivedRef.current[convKey];

      if (Array.isArray(opts.messageIds) && opts.messageIds.length > 0) {
        const newIds = opts.messageIds.filter(Boolean).map(String).filter((id) => !already.has(id));
        if (newIds.length === 0) return;
        s.emit('messages_received', { messageIds: newIds, conversationId: convKey });
        newIds.forEach((id) => already.add(id));
        return;
      }

      if (opts.upToMessageId) {
        const lastUpTo = emittedUpToRef.current[convKey];
        if (lastUpTo && String(lastUpTo) === String(opts.upToMessageId)) return;
        s.emit('messages_received', { upToMessageId: String(opts.upToMessageId), conversationId: convKey });
        emittedUpToRef.current[convKey] = String(opts.upToMessageId);
        return;
      }

      if (opts.messageId) {
        const id = String(opts.messageId);
        if (already.has(id)) return;
        s.emit('messages_received', { messageId: id, conversationId: convKey });
        already.add(id);
      }
    } catch (e) {}
  }, [socketRef]);

  const findConversationIndexForMessage = useCallback((list, message) => {
    if (!Array.isArray(list)) return -1;
    const messageParticipantIds = new Set();
    if (Array.isArray(message.participants)) {
      for (const p of message.participants) {
        const pid = utilParticipantId(p) ?? (p && String(p));
        if (pid) messageParticipantIds.add(String(pid));
      }
    }
    const sid = utilParticipantId(message.senderId) ?? (message.senderId && String(message.senderId));
    if (sid) messageParticipantIds.add(String(sid));

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const cid = String(c._id ?? c.id ?? '');
      if (cid.startsWith('draft:') || cid.startsWith('pending:')) {
        const maybeOther = cid.replace(/^draft:|^pending:/, '');
        if (messageParticipantIds.has(maybeOther)) return i;
      }
      const parts = c.participants || [];
      for (const p of parts) {
        const pid = utilParticipantId(p) ?? (p && String(p));
        if (pid && messageParticipantIds.has(String(pid))) {
          if (String(pid) === String(currentUserId)) continue;
          return i;
        }
      }
    }
    return -1;
  }, [currentUserId]);

  const deriveOtherNameFromMessage = useCallback((message) => {
    try {
      if (!message) return null;
      const parts = Array.isArray(message.participants) ? message.participants : [];
      for (const p of parts) {
        const pid = utilParticipantId(p) ?? (typeof p === 'string' ? p : null);
        if (!pid) continue;
        if (String(pid) === String(currentUserId)) continue;
        if (typeof p === 'object') {
          return p.name ?? p.userName ?? p.username ?? String(pid).slice(0, 6);
        }
        return String(pid).slice(0, 6);
      }
      const sidCandidate = utilParticipantId(message.senderId) ?? (message.senderId && String(message.senderId));
      if (sidCandidate && String(sidCandidate) !== String(currentUserId)) {
        if (typeof message.senderId === 'object') {
          return message.senderId.name ?? message.senderId.userName ?? message.senderId.username ?? String(sidCandidate).slice(0, 6);
        }
        if (participantNameMap && participantNameMap[sidCandidate]) return participantNameMap[sidCandidate];
        return String(sidCandidate).slice(0, 6);
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [currentUserId, participantNameMap]);

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
        const copy = (prev || []).slice();
        const idx = copy.findIndex((c) => String(c._id) === String(message.conversationId));
        if (idx !== -1) {
          copy[idx] = { ...copy[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
          return copy;
        }

        const matchIdx = findConversationIndexForMessage(copy, message);
        if (matchIdx !== -1) {
          const matched = { ...copy[matchIdx] };
          matched._id = message.conversationId;
          matched.lastMessage = message;
          matched.updatedAt = message.createdAt ?? new Date().toISOString();
          if (!matched.name) matched.name = deriveOtherNameFromMessage(message) ?? matched.name;
          const newCopy = copy.slice();
          newCopy.splice(matchIdx, 1, matched);
          return newCopy;
        }

        const participantsFallback = (() => {
          if (Array.isArray(message.participants) && message.participants.length > 0) return message.participants;
          const arr = [];
          if (message.senderId) arr.push(message.senderId);
          if (currentUserId) arr.push(currentUserId);
          const uniq = Array.from(new Set(arr.map((x) => (typeof x === 'object' ? (x._id ?? x.id ?? String(x)) : String(x)))));
          return uniq;
        })();

        const derivedName = deriveOtherNameFromMessage(message);

        return [{
          _id: message.conversationId,
          participants: participantsFallback,
          name: derivedName || (message.name ?? null),
          lastMessage: message,
          updatedAt: message.createdAt ?? new Date().toISOString()
        }, ...copy];
      });

      try {
        const parts = message.participants ?? [];
        for (const p of parts) {
          const pid = utilParticipantId(p);
          if (!pid) continue;
          setConversations((prev) => removeDraftForUser(prev, pid));
        }
      } catch (e) {}

      if (String(message.conversationId) === String(loadedConvId)) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const onMessageSent = (message) => {
      if (!message) return;
      const convId = String(message.conversationId);

      setConversations((prev) => {
        const idx = (prev || []).findIndex((c) => String(c._id) === convId);
        if (idx !== -1) {
          const item = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt ?? new Date().toISOString() };
          const copy = prev.slice();
          copy.splice(idx, 1);
          return [item, ...copy];
        }

        if (activeConvId && (String(activeConvId).startsWith('draft:') || String(activeConvId).startsWith('pending:'))) {
          const otherUserId = String(activeConvId).replace(/^draft:|^pending:/, '');
          const newCopy = (prev || []).slice();
          const matchIdx = newCopy.findIndex((c) => String(c._id ?? '') === String(activeConvId));
          if (matchIdx !== -1) {
            const matched = { ...newCopy[matchIdx] };
            matched._id = message.conversationId;
            matched.lastMessage = message;
            matched.updatedAt = message.createdAt ?? new Date().toISOString();
            if (!matched.name) matched.name = deriveOtherNameFromMessage(message) ?? matched.name ?? (matched.participants && matched.participants[1] && matched.participants[1].name) ?? null;
            newCopy.splice(matchIdx, 1);
            return [matched, ...newCopy];
          } else {
            if (draftConversation && String(draftConversation.userId) === String(otherUserId)) {
              const matched = {
                _id: message.conversationId,
                participants: [
                  { _id: currentUserId, name: currentUserName },
                  { _id: draftConversation.userId, name: draftConversation.userName },
                ],
                name: draftConversation.userName,
                lastMessage: message,
                updatedAt: message.createdAt ?? new Date().toISOString(),
              };
              return [matched, ...(prev || [])];
            }
          }
        }

        const copyPrev = (prev || []).slice();
        const matchIdx2 = findConversationIndexForMessage(copyPrev, message);
        if (matchIdx2 !== -1) {
          const matched = { ...copyPrev[matchIdx2] };
          matched._id = message.conversationId;
          matched.lastMessage = message;
          matched.updatedAt = message.createdAt ?? new Date().toISOString();
          if (!matched.name) matched.name = deriveOtherNameFromMessage(message) ?? matched.name;
          const newCopy = copyPrev.slice();
          newCopy.splice(matchIdx2, 1);
          return [matched, ...newCopy];
        }

        const participantsFallback = (() => {
          if (Array.isArray(message.participants) && message.participants.length > 0) return message.participants;
          const arr = [];
          if (message.senderId) arr.push(message.senderId);
          if (currentUserId) arr.push(currentUserId);
          const uniq = Array.from(new Set(arr.map((x) => (typeof x === 'object' ? (x._id ?? x.id ?? String(x)) : String(x)))));
          return uniq;
        })();

        const derivedName = deriveOtherNameFromMessage(message);

        return [{
          _id: message.conversationId,
          participants: participantsFallback,
          name: derivedName || (message.name ?? null),
          lastMessage: message,
          updatedAt: message.createdAt ?? new Date().toISOString()
        }, ...(prev || [])];
      });

      setMessages((prev) => {
        if (!prev) return [message];
        const tempIdx = prev.findIndex((m) => m.isLocal && m.content === message.content);
        if (tempIdx !== -1) {
          const copy = prev.slice();
          copy[tempIdx] = message;
          return copy;
        }
        if (String(loadedConvId) === convId) {
          return [...prev, message];
        }
        if (activeConvId && (String(activeConvId).startsWith('draft:') || String(activeConvId).startsWith('pending:'))) {
          const otherUserId = String(activeConvId).replace(/^draft:|^pending:/, '');
          const participantIds = (message.participants || []).map((p) => utilParticipantId(p) ?? (p && String(p)));
          const senderId = utilParticipantId(message.senderId) ?? (message.senderId && String(message.senderId));
          if (participantIds.includes(String(otherUserId)) || String(senderId) === String(otherUserId) || (message.participants && message.participants.length === 0 && draftConversation && String(draftConversation.userId) === String(otherUserId))) {
            return [message];
          }
        }
        return prev;
      });

      try {
        const parts = message.participants ?? [];
        for (const p of parts) {
          const pid = utilParticipantId(p);
          if (!pid) continue;
          setConversations((prev) => removeDraftForUser(prev, pid));
        }
      } catch (e) {}

      setActiveConvId(String(message.conversationId));
      setLoadedConvId(String(message.conversationId));

      try {
        const convId = String(message.conversationId);
        if (convId) {
          loadMessages(convId).catch(() => {});
        }
      } catch (e) {}
    };

    const onMessageDelivered = (payload) => {
      if (!payload || !payload.conversationId) return;
      const recipientId = payload.recipientId ?? null;
      setMessages((prev) => {
        if (!prev || prev.length === 0) return prev;
        const copy = prev.slice();
        if (Array.isArray(payload.messageIds) && payload.messageIds.length > 0) {
          for (const id of payload.messageIds) {
            for (let i = 0; i < copy.length; i++) {
              const m = copy[i];
              const midLocal = m._id ?? m.id;
              if (String(midLocal) === String(id)) {
                const deliveredTo = Array.isArray(m.deliveredTo) ? Array.from(new Set([...m.deliveredTo.map(String), String(recipientId)])) : [String(recipientId)];
                copy[i] = { ...m, deliveredTo, deliveredAt: payload.deliveredAt ?? m.deliveredAt, isRead: payload.isRead ?? m.isRead };
              }
            }
          }
        } else if (payload.messageId) {
          for (let i = 0; i < copy.length; i++) {
            const m = copy[i];
            const midLocal = m._id ?? m.id;
            if (String(midLocal) === String(payload.messageId)) {
              const deliveredTo = Array.isArray(m.deliveredTo) ? Array.from(new Set([...m.deliveredTo.map(String), String(recipientId)])) : [String(recipientId)];
              copy[i] = { ...m, deliveredTo, deliveredAt: payload.deliveredAt ?? m.deliveredAt, isRead: payload.isRead ?? m.isRead };
              break;
            }
          }
        } else if (payload.upToMessageId) {
          const upToId = payload.upToMessageId;
          const upToMsg = copy.find((m) => String(m._id ?? m.id ?? '') === String(upToId));
          if (upToMsg && upToMsg.createdAt) {
            const cutoff = new Date(upToMsg.createdAt).getTime();
            for (let i = 0; i < copy.length; i++) {
              const m = copy[i];
              const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0;
              if (ts <= cutoff) {
                const deliveredTo = Array.isArray(m.deliveredTo) ? Array.from(new Set([...m.deliveredTo.map(String), String(recipientId)])) : [String(recipientId)];
                copy[i] = { ...m, deliveredTo, deliveredAt: payload.deliveredAt ?? m.deliveredAt, isRead: payload.isRead ?? m.isRead };
              }
            }
          }
        }
        return copy;
      });
    };

    const onMessagesDelivered = (payload) => {
      onMessageDelivered(payload);
    };

    s.on('online_list', onOnlineList);
    s.on('user_connected', onUserConnected);
    s.on('user_disconnected', onUserDisconnected);
    s.on('typing', onTyping);
    s.on('receive_message', onReceiveMessage);
    s.on('message_sent', onMessageSent);
    s.on('message_delivered', onMessageDelivered);
    s.on('messages_delivered', onMessagesDelivered);

    return () => {
      try {
        s.off('online_list', onOnlineList);
        s.off('user_connected', onUserConnected);
        s.off('user_disconnected', onUserDisconnected);
        s.off('typing', onTyping);
        s.off('receive_message', onReceiveMessage);
        s.off('message_sent', onMessageSent);
        s.off('message_delivered', onMessageDelivered);
        s.off('messages_delivered', onMessagesDelivered);
      } catch (e) {
        console.warn('[ChatPage] socket off error', e && (e.message || e));
      }
    };
  }, [socketRef, addOnline, removeOnline, addTypingUser, loadedConvId, setConversations, currentUserId, deriveOtherNameFromMessage, participantNameMap, findConversationIndexForMessage, activeConvId, draftConversation, currentUserName]);

  useEffect(() => {
    const onOffline = () => {
      setIsNetworkOnline(false);
      setOnlineUsers(new Set());
    };
    const onOnline = () => {
      setIsNetworkOnline(true);
      try { socketRef?.current?.connect?.(); } catch (e) { console.warn('[ChatPage] connect attempt failed', e && e.message); }
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

  async function loadMessages(convId) {
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

      try {
        if (msgs && msgs.length > 0) {
          const candidateIds = msgs
            .filter((m) => {
              const sid = utilParticipantId(m.senderId) ?? (m.senderId && String(m.senderId)) ?? null;
              if (!sid) return false;
              if (String(sid) === String(currentUserId)) return false;
              const delivered = Array.isArray(m.deliveredTo) ? m.deliveredTo.map(String) : [];
              return !delivered.includes(String(currentUserId));
            })
            .map((m) => String(m._id ?? m.id ?? ''))
            .filter(Boolean);

          if (candidateIds.length > 0) {
            emitMessagesReceivedForConversation(convId, { messageIds: candidateIds });
          } else {
            const lastOther = [...msgs].reverse().find((m) => {
              const sid = utilParticipantId(m.senderId) ?? (m.senderId && String(m.senderId)) ?? null;
              return sid && String(sid) !== String(currentUserId);
            });
            if (lastOther) {
              emitMessagesReceivedForConversation(convId, { upToMessageId: String(lastOther._id ?? lastOther.id ?? '') });
            }
          }
        }
      } catch (e) {}
    } catch (e) {
      console.error('[ChatPage] Failed to load messages', e && (e.message || e));
      alert('Failed to load messages');
    }
  }

  useEffect(() => {
    if (!loadedConvId || !messages || messages.length === 0) return;
    try {
      const candidateIds = messages
        .filter((m) => {
          const sid = utilParticipantId(m.senderId) ?? (m.senderId && String(m.senderId)) ?? null;
          if (!sid) return false;
          if (String(sid) === String(currentUserId)) return false;
          const delivered = Array.isArray(m.deliveredTo) ? m.deliveredTo.map(String) : [];
          return !delivered.includes(String(currentUserId));
        })
        .map((m) => String(m._id ?? m.id ?? ''))
        .filter(Boolean);

      if (candidateIds.length > 0) {
        emitMessagesReceivedForConversation(loadedConvId, { messageIds: candidateIds });
      } else {
        const lastOther = [...messages].reverse().find((m) => {
          const sid = utilParticipantId(m.senderId) ?? (m.senderId && String(m.senderId)) ?? null;
          return sid && String(sid) !== String(currentUserId);
        });
        if (lastOther) {
          emitMessagesReceivedForConversation(loadedConvId, { upToMessageId: String(lastOther._id ?? lastOther.id ?? '') });
        }
      }
    } catch (e) {}
  }, [loadedConvId, messages, emitMessagesReceivedForConversation, currentUserId]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && loadedConvId && messages && messages.length > 0) {
        const candidateIds = messages
          .filter((m) => {
            const sid = utilParticipantId(m.senderId) ?? (m.senderId && String(m.senderId)) ?? null;
            if (!sid) return false;
            if (String(sid) === String(currentUserId)) return false;
            const delivered = Array.isArray(m.deliveredTo) ? m.deliveredTo.map(String) : [];
            return !delivered.includes(String(currentUserId));
          })
          .map((m) => String(m._id ?? m.id ?? ''))
          .filter(Boolean);
        if (candidateIds.length > 0) {
          emitMessagesReceivedForConversation(loadedConvId, { messageIds: candidateIds });
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [loadedConvId, messages, emitMessagesReceivedForConversation, currentUserId]);

  useEffect(() => {
    const el = document.getElementById('messages-wrap') || messagesWrapRef.current;
    if (!el) return () => {};
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        try {
          const threshold = 150;
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
          if (nearBottom && loadedConvId && messages && messages.length > 0) {
            const candidateIds = messages
              .filter((m) => {
                const sid = utilParticipantId(m.senderId) ?? (m.senderId && String(m.senderId)) ?? null;
                if (!sid) return false;
                if (String(sid) === String(currentUserId)) return false;
                const delivered = Array.isArray(m.deliveredTo) ? m.deliveredTo.map(String) : [];
                return !delivered.includes(String(currentUserId));
              })
              .map((m) => String(m._id ?? m.id ?? ''))
              .filter(Boolean);
            if (candidateIds.length > 0) {
              emitMessagesReceivedForConversation(loadedConvId, { messageIds: candidateIds });
            }
          }
        } catch (e) {}
        ticking = false;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadedConvId, messages, emitMessagesReceivedForConversation, currentUserId]);

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

      const tempId = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const pendingId = `pending:${otherId}`;
      const tempMsg = {
        _id: tempId,
        content,
        senderId: currentUserId,
        conversationId: pendingId,
        participants: [
          { _id: currentUserId, name: currentUserName },
          ...(String(otherId) === String(currentUserId) ? [] : [{ _id: otherId, name: draftConversation.userName }]),
        ],
        createdAt: new Date().toISOString(),
        deliveredTo: [],
        isLocal: true,
      };

      setMessages((prev) => [...(prev || []), tempMsg]);

      setConversations((prev) => {
        const cleaned = removeAllDraftsFromList(prev || []);
        const exists = (cleaned || []).some((c) => String(c._id) === pendingId || (Array.isArray(c.participants) && c.participants.some((p) => String(utilParticipantId(p) ?? p) === String(otherId))));
        if (exists) return cleaned;
        return [
          ...(cleaned || []),
          {
            _id: pendingId,
            participants: (String(otherId) === String(currentUserId))
              ? [{ _id: currentUserId, name: currentUserName }]
              : [
                  { _id: currentUserId, name: currentUserName },
                  { _id: otherId, name: draftConversation.userName },
                ],
            name: String(otherId) === String(currentUserId) ? 'SavedMessages' : draftConversation.userName,
            lastMessage: tempMsg,
            updatedAt: new Date().toISOString(),
          },
        ];
      });

      setActiveConvId(pendingId);

      if (s && s.connected) {
        if (String(otherId) === String(currentUserId)) {
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
              setMessages((prev) => {
                const copy = (prev || []).slice();
                const tidx = copy.findIndex((m) => m.isLocal && m._id === tempId);
                if (tidx !== -1) {
                  copy[tidx] = saved;
                  return copy;
                }
                return [...copy, saved];
              });
            }
            return;
          } catch (err) {
            console.error('[ChatPage] Failed to send initial self-message via HTTP', err?.response?.data ?? err?.message ?? err);
            setMessages((prev) => (prev || []).filter((m) => !(m.isLocal && m._id === tempId)));
            setConversations((prev) => (prev || []).filter((c) => String(c._id ?? c.id ?? '') !== pendingId));
            if (String(activeConvId) === pendingId) {
              setActiveConvId(null);
              setLoadedConvId(null);
              setDraftConversation(null);
            }
            alert('Failed to send message');
            return;
          }
        } else {
          s.emit('send_message', { participantIds: [otherId], content, messageType: 'text' });
          return;
        }
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
          setMessages((prev) => {
            const copy = (prev || []).slice();
            const tidx = copy.findIndex((m) => m.isLocal && m.content === content);
            if (tidx !== -1) {
              copy[tidx] = saved;
              return copy;
            }
            return [...copy, saved];
          });
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

    if (payload && payload.saved) {
      const otherUserId = currentUserId;
      setActiveConvId(`draft:${otherUserId}`);
      setLoadedConvId(null);
      setMessages([]);
      setDraftConversation({ userId: otherUserId, userName: currentUserName });
      setConversations((prev) => {
        const cleaned = removeAllDraftsFromList(prev || []);
        const draftId = `draft:${otherUserId}`;
        if (cleaned.some((c) => String(c._id) === draftId)) return cleaned;
        return [...cleaned, {
          _id: draftId,
          participants: [
            { _id: currentUserId, name: currentUserName }
          ],
          name: 'SavedMessages',
          lastMessage: null,
          updatedAt: new Date().toISOString(),
        }];
      });
      return;
    }

    if (payload && payload.draft) {
      const otherUserId = payload.userId;
      const otherUserName = payload.userName;

      if (String(otherUserId) === String(currentUserId)) {
        const draftId = `draft:${otherUserId}`;
        setActiveConvId(draftId);
        setLoadedConvId(null);
        setMessages([]);
        setDraftConversation({ userId: otherUserId, userName: otherUserName ?? currentUserName });
        setConversations((prev) => {
          const cleaned = removeAllDraftsFromList(prev);
          if (cleaned.some((c) => String(c._id) === draftId)) return cleaned;
          return [...cleaned, {
            _id: draftId,
            participants: [
              { _id: currentUserId, name: currentUserName },
            ],
            name: 'SavedMessages',
            lastMessage: null,
            updatedAt: new Date().toISOString(),
          }];
        });
        return;
      }

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
      loadMessages(payload._1d ?? payload._id ?? payload.id ?? payload);
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
    const convId = conv._1d ?? conv._id ?? conv.id ?? '';
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
    if (!newContent || String(newContent).trim().length === 0) {
      return { ok: false, error: 'content required' };
    }
    if (!loadedConvId) {
      setMessages((prev) => (prev || []).map((m) => {
        if (String(m._id ?? m.id ?? '') === String(messageId)) {
          return { ...m, content: newContent, edited: true, updatedAt: new Date().toISOString() };
        }
        return m;
      }));
      return { ok: true };
    }

    try {
      const res = await axios.patch(
        `http://localhost:3000/messages/${encodeURIComponent(messageId)}`,
        { content: newContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const serverData = res?.data;

      const wasEdited = !!(serverData && (
        (typeof serverData.modifiedCount === 'number' && serverData.modifiedCount > 0) ||
        (typeof serverData.modified === 'number' && serverData.modified > 0) ||
        (typeof serverData.nModified === 'number' && serverData.nModified > 0) ||
        (typeof serverData.matchedCount === 'number' && serverData.matchedCount > 0) ||
        (typeof serverData === 'object' && Object.keys(serverData).length > 0)
      ));

      setMessages((prev) => (prev || []).map((m) => {
        if (String(m._id ?? m.id ?? '') === String(messageId)) {
          return { ...m, content: newContent, edited: wasEdited ? true : (m.edited || false), updatedAt: new Date().toISOString() };
        }
        return m;
      }));

      if (wasEdited) {
        setConversations((prev) => (prev || []).map((c) => {
          if (String(c._id ?? c.id ?? '') === String(loadedConvId)) {
            const lm = c.lastMessage ?? null;
            const lmId = lm ? (lm._id ?? lm.id ?? null) : null;
            if (String(lmId) === String(messageId)) {
              const newLast = { ...(lm || {}), content: newContent, updatedAt: new Date().toISOString() };
              return { ...c, lastMessage: newLast };
            }
          }
          return c;
        }));
      }

      return { ok: true, edited: !!wasEdited };
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

        <ChatForm onConversationStart={handleConversationStart} conversations={conversations} setConversations={setConversations} currentUserId={currentUserId} />

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

        <div className="messages-wrap" id="messages-wrap" ref={messagesWrapRef}>
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
                {String(draftConversation?.userId) === String(currentUserId) ? (
                  <>Saved messages</>
                ) : (
                  <>Chat with <strong>{draftConversation?.userName ?? draftConversation?.userId}</strong></>
                )}
              </div>
              <MessageList
                messages={messages}
                currentUserId={currentUserId}
                participantNameMap={{ ...(draftConversation?.userId ? { [draftConversation.userId]: draftConversation.userName } : {}), ...participantNameMap }}
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
            <MessageInput sendMessage={sendMessage} conversationId={loadedConvId || (draftConversation ? `draft:${draftConversation.userId}` : (activeConvId || ''))} socketRef={socketRef} />
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
