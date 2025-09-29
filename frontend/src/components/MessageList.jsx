/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/components/MessageList.jsx
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function MessageList({
  messages = [],
  currentUserId,
  participantNameMap = {},
  currentUserName,
  onDeleteMessage,
  onEditMessage,
}) {
  const seenKeysRef = useRef(new Set());
  const [newKeys, setNewKeys] = useState(new Set());

  const [ctxVisible, setCtxVisible] = useState(false);
  const [ctxX, setCtxX] = useState(0);
  const [ctxY, setCtxY] = useState(0);
  const [ctxTargetMessage, setCtxTargetMessage] = useState(null);

  const [confirmVisible, setConfirmVisible] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const messageKey = (m, idx) => {
    if (!m) return `missing-${idx}`;
    return m._id ?? m.id ?? (m.createdAt ? `${m.createdAt}-${idx}` : `idx-${idx}`);
  };

  useEffect(() => {
    const keys = [];
    for (let i = 0; i < messages.length; i++) {
      keys.push(messageKey(messages[i], i));
    }

    const newly = [];
    for (const k of keys) {
      if (!seenKeysRef.current.has(k)) {
        newly.push(k);
        seenKeysRef.current.add(k);
      }
    }

    if (newly.length > 0) {
      setNewKeys((prev) => {
        const copy = new Set(prev);
        for (const k of newly) copy.add(k);
        return copy;
      });

      const timeout = setTimeout(() => {
        setNewKeys((prev) => {
          const copy = new Set(prev);
          for (const k of newly) copy.delete(k);
          return copy;
        });
      }, 600);

      return () => clearTimeout(timeout);
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    const initKeys = messages.map((m, i) => messageKey(m, i));
    for (const k of initKeys) seenKeysRef.current.add(k);
  }, []);

  const resolveSenderName = (sender) => {
    if (!sender) return 'Unknown';
    if (typeof sender === 'object') {
      const sid = sender._id?.toString?.() || sender.id;
      if (currentUserId && sid && String(currentUserId) === String(sid)) return 'You';
      if (sender.name) return sender.name;
      if (sender.userName) return sender.userName;
      if (sender.username) return sender.username;
      if (sid && participantNameMap[sid]) return participantNameMap[sid];
      if (sid) return sid.slice(0, 6);
      return 'Unknown';
    }
    const sid = String(sender);
    if (currentUserId && String(currentUserId) === sid) return 'You';
    if (participantNameMap && participantNameMap[sid]) return participantNameMap[sid];
    return sid.slice(0, 6);
  };

  const isMessageMine = (sender) => {
    if (!sender) return false;
    if (typeof sender === 'object') {
      const sid = sender._id?.toString?.() || sender.id;
      return currentUserId && sid && String(currentUserId) === String(sid);
    }
    return currentUserId && String(currentUserId) === String(sender);
  };

  const groups = {};
  for (const m of messages) {
    const d = m.createdAt ? new Date(m.createdAt) : new Date();
    const dayKey = d.toDateString();
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(m);
  }
  const dayKeys = Object.keys(groups).sort((a, b) => new Date(a) - new Date(b));

  const formatDayLabel = (dayKey) => {
    const date = new Date(dayKey);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const openMessageContextMenu = (e, message) => {
    e.preventDefault();
    const padding = 12;
    const menuWidth = 220;
    const menuHeight = 140;
    let x = e.clientX;
    let y = e.clientY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (x + menuWidth + padding > vw) {
      x = Math.max(padding, vw - menuWidth - padding);
    }
    if (y + menuHeight + padding > vh) {
      y = Math.max(padding, vh - menuHeight - padding);
    }

    setCtxTargetMessage(message);
    setCtxX(x);
    setCtxY(y);
    setConfirmVisible(false);
    setCtxVisible(true);

    setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
    }, 0);
  };

  const closeMessageContextMenu = () => {
    setCtxVisible(false);
    setCtxTargetMessage(null);
    setConfirmVisible(false);
    try {
      window.removeEventListener('click', handleOutsideClick);
    } catch {}
  };

  const handleOutsideClick = (ev) => {
    const ex = ctxX;
    const ey = ctxY;
    const menuRect = { left: ex, top: ey, right: ex + 240, bottom: ey + 200 };
    const cx = ev.clientX;
    const cy = ev.clientY;
    if (cx >= menuRect.left && cx <= menuRect.right && cy >= menuRect.top && cy <= menuRect.bottom) {
      return;
    }
    closeMessageContextMenu();
  };

  const onRequestDelete = () => {
    setConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!ctxTargetMessage) {
      closeMessageContextMenu();
      return;
    }
    const id = ctxTargetMessage._id ?? ctxTargetMessage.id;
    try {
      if (onDeleteMessage) {
        await onDeleteMessage(id, ctxTargetMessage);
      }
    } catch (e) {}
    finally {
      closeMessageContextMenu();
    }
  };

  const onRequestEdit = () => {
    if (!ctxTargetMessage) return;
    const mine = isMessageMine(ctxTargetMessage.senderId);
    if (!mine) {
      closeMessageContextMenu();
      return;
    }
    setEditingId(ctxTargetMessage._id ?? ctxTargetMessage.id);
    setEditValue(ctxTargetMessage.content ?? '');
    closeMessageContextMenu();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const newContent = String(editValue || '').trim();
    if (!newContent) {
      return;
    }
    if (onEditMessage) {
      const res = await onEditMessage(editingId, newContent);
      if (res && res.ok) {
        setEditingId(null);
        setEditValue('');
      } else {
        alert('Failed to edit message' + (res && res.error ? `: ${res.error}` : ''));
      }
    } else {
      setMessagesLocalEdit(editingId, newContent);
      setEditingId(null);
      setEditValue('');
    }
  };

  const setMessagesLocalEdit = (messageId, content) => {
    console.warn('local edit happened but parent did not provide onEditMessage');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  };

  const menuStyle = {
    position: 'fixed',
    left: ctxX,
    top: ctxY,
    background: '#0b1420',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
    padding: 8,
    borderRadius: 8,
    zIndex: 9999,
    minWidth: 160,
    color: 'var(--text, #e6eef6)',
  };
  const menuItemStyle = { padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };

  const confirmStyle = {
    position: 'fixed',
    left: ctxX,
    top: ctxY + 44,
    background: '#111827',
    padding: 10,
    borderRadius: 8,
    zIndex: 10000,
    color: '#e6eef6',
    boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
  };

  const styles = (
    <style>
      {`
      .msg-new { animation: msg-in 360ms cubic-bezier(.22,1,.36,1); }
      @keyframes msg-in {
        0% { transform: translateY(8px) scale(.995); opacity: 0; filter: blur(2px); }
        60% { transform: translateY(-2px) scale(1.002); opacity: 1; filter: blur(0); }
        100% { transform: translateY(0) scale(1); opacity: 1; filter: none; }
      }
      .message-meta-compact { display:flex; gap:8px; align-items:center; }
      .msg-edit-input {
        width:100%;
        box-sizing:border-box;
        padding:8px 10px;
        border-radius:8px;
        border:1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        color: inherit;
        font-size:14px;
        resize: vertical;
        min-height:36px;
      }
      .tick {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        margin-left:8px;
        opacity:0.9;
      }
      .tick svg { width:16px; height:12px; vertical-align:middle; }
      .tick.single svg path { stroke:#9aa8b8; }
      .tick.double svg path { stroke:#2b6ef6; }
      `}
    </style>
  );

  const tickNodeFor = (m) => {
    const mine = isMessageMine(m.senderId);
    if (!mine) return null;
    const isRead = !!(m.isRead || m.readAt);
    const isDelivered = !!(m.deliveredAt || m.deliveredTo || m.isDelivered);
    if (isRead) {
      return (
        <span className="tick double" title={`Read ${m.readAt ? new Date(m.readAt).toLocaleString() : ''}`}>
          <svg viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 8l5 5 14-14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 11l5 5 14-14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
          </svg>
        </span>
      );
    }
    if (isDelivered) {
      return (
        <span className="tick single" title={`Delivered ${m.deliveredAt ? new Date(m.deliveredAt).toLocaleString() : ''}`}>
          <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 5l3 3 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    }
    // If neither delivered nor read, show a small hollow circle indicating "sent" (or nothing)
    return (
      <span className="tick single" title="Sent">
        <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
          <circle cx="5" cy="5" r="3" strokeWidth="1.2" fill="none" />
        </svg>
      </span>
    );
  };

  return (
    <div className="message-list" style={{ padding: 8 }}>
      {styles}

      {dayKeys.length === 0 ? (
        <div style={{ color: '#9aa8b8', textAlign: 'center', marginTop: 12 }}>No messages yet</div>
      ) : null}

      {dayKeys.map((dayKey) => (
        <div key={dayKey} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: 12, fontSize: 12, color: '#9aa8b8', fontWeight: 600 }}>
              {formatDayLabel(dayKey)}
            </div>
          </div>

          {groups[dayKey].map((m, i) => {
            const overallIdx = messages.indexOf(m);
            const key = messageKey(m, overallIdx !== -1 ? overallIdx : i);
            const mine = isMessageMine(m.senderId);
            const senderName = resolveSenderName(m.senderId);
            const isNew = newKeys.has(key);
            const messageId = m._id ?? m.id ?? key;

            if (String(editingId) === String(messageId)) {
              return (
                <div key={key} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: 12, color: '#9aa8b8', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }} className="message-meta-compact">
                    <strong style={{ marginRight: 8 }}>{mine ? 'You' : senderName}</strong>
                    <span style={{ color: '#6b7280', fontSize: 11 }}>{m.createdAt ? formatTime(m.createdAt) : ''}</span>
                  </div>

                  <div style={{ maxWidth: '70%' }}>
                    <textarea
                      autoFocus
                      className="msg-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      placeholder="Edit message… (Enter to save, Shift+Enter for newline)"
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                      <button onClick={cancelEdit} style={{ background: 'transparent', color: '#9aa8b8', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>Cancel</button>
                      <button onClick={saveEdit} style={{ background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)', color: '#fff', padding: '6px 10px', borderRadius: 6, border: 'none' }}>Save</button>
                    </div>
                  </div>
                </div>
              );
            }

            const wasEdited = !!(m.isEdited || m.edited);

            return (
              <div
                key={key}
                className={`message ${mine ? 'mine' : 'theirs'} ${isNew ? 'msg-new' : ''}`}
                style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}
                onContextMenu={(e) => openMessageContextMenu(e, m)}
              >
                <div style={{ fontSize: 12, color: '#9aa8b8', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }} className="message-meta-compact">
                  <strong style={{ marginRight: 8 }}>{mine ? 'You' : senderName}</strong>
                  <span style={{ color: '#6b7280', fontSize: 11 }}>{m.createdAt ? formatTime(m.createdAt) : ''}</span>
                </div>

                <div
                  className="body"
                  style={{
                    background: mine ? 'linear-gradient(180deg,#2b6ef6,#1e4fd8)' : '#0f2936',
                    color: mine ? 'white' : 'var(--text, #e6eef6)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    maxWidth: '70%',
                    wordBreak: 'break-word',
                    boxShadow: isNew ? '0 10px 30px rgba(0,0,0,0.12)' : undefined,
                    whiteSpace: 'pre-wrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>{m.content}</div>
                  <div style={{ flexShrink: 0 }}>
                    {tickNodeFor(m)}
                  </div>
                </div>

                {wasEdited ? (
                  <div style={{ fontSize: 11, color: '#9aa8b8', marginTop: 6, marginLeft: 6 }}>
                    Edited
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {ctxVisible && ctxTargetMessage ? (
        <div style={menuStyle} role="menu" aria-hidden={!ctxVisible}>
          {isMessageMine(ctxTargetMessage.senderId) ? (
            <>
              <div style={menuItemStyle} onClick={() => onRequestEdit()}>✏️ Edit message</div>
              <div style={{ height: 6 }} />
              <div style={{ ...menuItemStyle, color: '#ffb4b4' }} onClick={() => onRequestDelete()}>🗑️ Delete message</div>
            </>
          ) : (
            <>
              <div style={{ ...menuItemStyle, color: '#9aa8b8' }}>No actions available</div>
            </>
          )}
          <div style={{ height: 6 }} />
          <div style={{ ...menuItemStyle, color: '#9aa8b8' }} onClick={() => closeMessageContextMenu()}>Close</div>
        </div>
      ) : null}

      {confirmVisible && ctxTargetMessage ? (
        <div style={confirmStyle}>
          <div style={{ marginBottom: 8 }}>Are you sure you want to delete this message?</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => { setConfirmVisible(false); closeMessageContextMenu(); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)', background: 'transparent', color: '#9aa8b8' }}>Cancel</button>
            <button onClick={confirmDelete} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', background: '#ff6b6b', color: '#fff' }}>Yes, delete</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

MessageList.propTypes = {
  messages: PropTypes.array,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  participantNameMap: PropTypes.object,
  currentUserName: PropTypes.string,
  onDeleteMessage: PropTypes.func,
  onEditMessage: PropTypes.func,
};
