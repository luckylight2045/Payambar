/* eslint-disable no-empty */
// src/components/MessageList.jsx
/* eslint-disable no-unused-vars */
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * MessageList
 * - groups messages by day
 * - shows time as HH:MM
 * - animates newly arrived messages with a small slide/fade animation
 * - supports right-click context menu per-message with "Edit" and "Delete"
 *
 * Props:
 *  - messages: array of message objects (expected chronological ascending)
 *  - currentUserId: string
 *  - participantNameMap: { userId -> displayName }
 *  - currentUserName: optional
 *  - onDeleteMessage(messageId, messageObj) => Promise (provided by parent)
 *  - onEditMessage(messageId, newContent) => Promise<{ok:true}|{ok:false,error}>
 * 
 */


const resolveAttachmentUrl = (m) => {
  console.log('[MessageItem] render message:', m);
  if (!m) return null;
  if (m.publicUrl) return m.publicUrl;
  if (m.attachmentUrl) return m.attachmentUrl;

  const base = import.meta?.env?.VITE_UPLOAD_BASE ?? '';
  if (m.attachmentKey && base) {
    // ensure no duplicate slashes
    return `${base.replace(/\/$/, '')}/${String(m.attachmentKey).replace(/^\//, '')}`;
  }

  // last resort: if server returns 'key' under another name
  if (m.key && base) {
    return `${base.replace(/\/$/, '')}/${String(m.key).replace(/^\//, '')}`;
  }

  return null;
};
export default function MessageList({
  messages = [],
  currentUserId,
  participantNameMap = {},
  onDeleteMessage,
  onEditMessage,
  onReply,
}) {
  const seenKeysRef = useRef(new Set());
  const [newKeys, setNewKeys] = useState(new Set());

  // context menu state for messages
  const [ctxVisible, setCtxVisible] = useState(false);
  const [ctxX, setCtxX] = useState(0);
  const [ctxY, setCtxY] = useState(0);
  const [ctxTargetMessage, setCtxTargetMessage] = useState(null);
  const menuRef = useRef(null);
  const confirmRef = useRef(null);

  // confirm delete popup state
  const [confirmVisible, setConfirmVisible] = useState(false);

  // editing state
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // lightbox state for image preview
// Lightbox / image preview state & handlers
const [lightboxUrl, setLightboxUrl] = useState(null); // string|null
const [lightboxOpen, setLightboxOpen] = useState(false);

const openLightbox = (url) => {
  if (!url) return;
  setLightboxUrl(url);
  setLightboxOpen(true);
  try { document.body.style.overflow = 'hidden'; } catch {}
};

const closeLightbox = () => {
  setLightboxOpen(false);
  setLightboxUrl(null);
  try { document.body.style.overflow = ''; } catch {}
};

// close on ESC
useEffect(() => {
  if (!lightboxOpen) return;
  const onKey = (e) => { if (e.key === 'Escape') closeLightbox(); };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [lightboxOpen]);


// handle ESC to close
useEffect(() => {
  if (!lightboxOpen) return;
  const onKey = (e) => {
    if (e.key === 'Escape') closeLightbox();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [lightboxOpen]);


  // compute deterministic key for a message
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

  // Group messages by day
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

  // Context menu helpers
  const openMessageContextMenu = (e, message) => {
    e.preventDefault();
    // clamp menu into viewport so it doesn't overflow right/bottom edges
    const winW = window.innerWidth || 1024;
    const winH = window.innerHeight || 768;
    const MENU_W = 240;
    const MENU_H = 140;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W > winW) x = Math.max(8, winW - MENU_W - 8);
    if (y + MENU_H > winH) y = Math.max(8, winH - MENU_H - 8);
    setCtxTargetMessage(message);
    setCtxX(x);
    setCtxY(y);
    setConfirmVisible(false);
    setCtxVisible(true);
  };

  const closeMessageContextMenu = () => {
    setCtxVisible(false);
    setCtxTargetMessage(null);
    setConfirmVisible(false);
  };

  // close menu when clicking outside
  useEffect(() => {
    const onDocDown = (ev) => {
      if (!ctxVisible) return;
      // if right-click/contextmenu opened, let menu handle it (avoid closing immediately)
      if (ev.button === 2) return;
  
      const menuNode = menuRef.current;
      const confirmNode = confirmRef.current;
  
      // If neither node exists, just close
      if (!menuNode && !confirmNode) {
        closeMessageContextMenu();
        return;
      }
  
      const target = ev.target;
      const insideMenu = menuNode && menuNode.contains(target);
      const insideConfirm = confirmNode && confirmNode.contains(target);
  
      if (!insideMenu && !insideConfirm) {
        closeMessageContextMenu();
      }
    };
  
    window.addEventListener('mousedown', onDocDown);
    window.addEventListener('touchstart', onDocDown);
    return () => {
      window.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('touchstart', onDocDown);
    };
  }, [ctxVisible]);
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
      } else {
        // parent didn't provide a delete handler — remove menu and warn
        console.warn('[MessageList] onDeleteMessage not provided by parent');
      }
    } catch (e) {
      console.error('[MessageList] onDeleteMessage threw', e && (e.message || e));
    } finally {
      closeMessageContextMenu();
    }
  };

  // --- add copy-to-clipboard helper ---
const copyMessageText = async (message) => {
  if (!message) return;
  const text = message.content ?? '';
  if (!text) {
    // nothing to copy
    closeMessageContextMenu();
    return;
  }

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(String(text));
    } else {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = String(text);
      // avoid scrolling to bottom
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }

    // optional user feedback - small native alert (replace with toast if you have one)
    // alert('Message copied');
  } catch (err) {
    console.error('copy failed', err && (err.message || err));
  } finally {
    closeMessageContextMenu();
  }
};


  // Edit flow
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

  // small inline styles for the menu
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
    minWidth: 180,
    color: 'var(--text, #e6eef6)',
  };
  const menuItemStyle = { padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 };

  // confirm popup style (positioned near same coords)
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

  // Inline CSS for animation & ticks (telegram-like spacing)
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
      .tick-row {
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:4px;
        margin-top:6px;
        font-size:12px;
        color: #9aa8b8;
      }
      .tick-icon { width:18px; height:14px; display:inline-block; vertical-align:middle; }
      .tick-blue { fill: #2b9cff; }
      .tick-gray { fill: rgba(255,255,255,0.44); }
      .edited-label { font-size: 11px; color: #9aa8b8; margin-left:6px; }
      .double-ticks { display:inline-flex; align-items:center; }
      .double-ticks .tick-second { margin-left:-8px; } /* slight overlap like Telegram */
      `}
    </style>
  );

  // helper to check whether the other user has delivered / read this message
  const getDeliveryStateForMessage = (m) => {
    if (!m) return { delivered: false, read: false, sent: false };
    const deliveredArr = Array.isArray(m.deliveredTo) ? m.deliveredTo.map(String) : [];
    const delivered = deliveredArr.length > 0;
    const read = !!(m.isRead || m.readAt);
    const sent = !!m;
    return { delivered, read, sent };
  };

  const resolveAttachmentUrl = (m) => {
    if (!m) return null;
    if (m.publicUrl) return m.publicUrl;
    if (m.attachmentUrl) return m.attachmentUrl;
  
    const base = import.meta?.env?.VITE_UPLOAD_BASE ?? ''; // e.g. https://s3.ir-thr-at1.arvanstorage.ir/payambar
    if (m.attachmentKey && base) {
      // ensure no duplicate slashes
      return `${base.replace(/\/$/, '')}/${String(m.attachmentKey).replace(/^\//, '')}`;
    }
  
    // last resort: if server returns 'key' under another name
    if (m.key && base) {
      return `${base.replace(/\/$/, '')}/${String(m.key).replace(/^\//, '')}`;
    }
  
    return null;
  };



  // single tick SVG
  const SingleTickSvg = ({ className }) => (
    <svg className="tick-icon" viewBox="0 0 16 12" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path className={className} d="M2.2 6.8L5.6 10.2 13.8 2.1 12.4 0.7 5.6 7.5 3 4.9 2.2 6.8z" />
    </svg>
  );

  // double tick composed of two single ticks with slight overlap to mimic Telegram
  const DoubleTicks = ({ colorClass }) => (
    <span className="double-ticks" aria-hidden>
      <SingleTickSvg className={colorClass + ' tick-first'} />
      <span className="tick-second" style={{ display: 'inline-block' }}>
        <SingleTickSvg className={colorClass} />
      </span>
    </span>
  );

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

            // show edited label if backend uses isEdited OR local flag 'edited' set by frontend
            const wasEdited = !!(m.isEdited || m.edited);

            // If this message is being edited, render the edit input
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

            const { delivered, read } = getDeliveryStateForMessage(m);

            return (
              <div
                key={key}
                data-msg-id={m._id ?? m.id ?? key}
                className={`message ${mine ? 'mine' : 'theirs'} ${isNew ? 'msg-new' : ''}`}
                style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}
                onContextMenu={(e) => openMessageContextMenu(e, m)}
              >
                <div style={{ fontSize: 12, color: '#9aa8b8', marginBottom: 4, display: 'flex', gap: 8, alignItems: 'center' }} className="message-meta-compact">
                  <strong style={{ marginRight: 8 }}>{mine ? 'You' : senderName}</strong>
                  <span style={{ color: '#6b7280', fontSize: 11 }}>{m.createdAt ? formatTime(m.createdAt) : ''}</span>
                </div>

                {m.replyTo ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: 8,
                      padding: '6px 8px',
                      marginBottom: 8,
                      borderLeft: '4px solid #ff4d8a',
                      maxWidth: '70%',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}
                    title={m.replyTo.content ?? ''}
                    onClick={() => {
                      // optional: when user clicks the snippet you could focus the input or scroll to original message
                      try { onReply && onReply(m.replyTo); } catch (e) { /* swallow */ }
                    }}
                  >
                    <div style={{ minWidth: 72, flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'inherit' }}>
                      {(
                        (m.replyTo.senderName)
                          ?? (m.replyTo.senderId && typeof m.replyTo.senderId === 'object'
                                ? (m.replyTo.senderId.name || m.replyTo.senderId.username || m.replyTo.senderId.userName)
                                : (m.replyTo.senderId || 'Unknown'))
                      )}
                    </div>

                    <div style={{ fontSize: 13, color: '#9aa8b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {String(m.replyTo.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)}
                      {(m.replyTo.content && String(m.replyTo.content).length > 200) ? '…' : ''}
                    </div>
                  </div>
                ) : null}


                {/* --- Message bubble --- */}
                {/* --- Message bubble (image/video/file support) --- */}
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
  }}
>
  {/* --- Unified attachment + content renderer (single place) --- */}
  {(() => {
  const attUrl = resolveAttachmentUrl(m);
  const type = (m.messageType || '').toLowerCase();
  const filename = m.originalName || m.content || (m.attachmentKey || '').split('/').pop() || '';
  const showCaption = filename && filename !== '' && filename !== (m.content || '');

  // shared wrapper style for the media block so it looks like a single "block"
  const mediaBlockStyle = {
    borderRadius: 12,
    overflow: 'hidden',
    background: mine ? 'transparent' : 'transparent',
    boxShadow: '0 6px 18px rgba(2,6,23,0.25)',
    display: 'inline-block',
  };

  // IMAGE
  if (
    attUrl &&
    (type === 'image' || /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(attUrl))
  ) {
    return (
      <div style={{ marginBottom: (showCaption ? 8 : (m.content ? 8 : 0)) }}>
        <div style={mediaBlockStyle}>
          <img
            src={attUrl}
            alt={filename || 'image'}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 420,
              width: '100%',
              objectFit: 'cover',
            }}
            loading="lazy"
            onClick={() => openLightbox(attUrl)}
            onError={(e) => { try { e.currentTarget.style.display = 'none'; } catch {} }}
          />
        </div>

        {/* Caption / filename block — styled to look like a separate line under the media */}
        {showCaption ? (
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.04)',
            color: 'var(--muted, #9aa8b8)',
            fontSize: 13,
            maxWidth: '100%',
            wordBreak: 'break-word'
          }}>
            {filename}
          </div>
        ) : (m.content && !attUrl ? (
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.content}</div>
        ) : null)}
      </div>
    );
  }

  // VIDEO
  if (
    attUrl &&
    (type === 'video' || /\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(attUrl))
  ) {
    return (
      <div style={{ marginBottom: (showCaption ? 8 : (m.content ? 8 : 0)) }}>
        <div style={mediaBlockStyle}>
          <video
            src={attUrl}
            controls
            style={{ display: 'block', maxWidth: '100%', maxHeight: 480, width: '100%' }}
          />
        </div>

        {showCaption ? (
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.04)',
            color: 'var(--muted, #9aa8b8)',
            fontSize: 13,
            maxWidth: '100%',
            wordBreak: 'break-word'
          }}>
            {filename}
          </div>
        ) : (m.content && !attUrl ? (
          <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.content}</div>
        ) : null)}
      </div>
    );
  }

  // Non-media attachments -> show a download/link block + name
  if (m.messageType && m.messageType !== 'text' && attUrl) {
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: 'rgba(0,0,0,0.04)',
          color: 'var(--muted, #9aa8b8)',
          display: 'inline-flex',
          gap: 10,
          alignItems: 'center'
        }}>
          <a href={attUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            {filename ? `Download ${filename}` : 'Download file'}
          </a>
        </div>
      </div>
    );
  }

  // Final fallback: plain text content
  return (m.content ? <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.content}</div> : null);
})()}



  {/* If there's an attachment but it's not image/video, show a downloadable link */}
  {m.messageType && m.messageType !== 'text' && m.messageType !== 'image' && m.messageType !== 'video' ? (() => {
    const url = resolveAttachmentUrl(m);
    if (url) {
      return (
        <div style={{ marginTop: 8 }}>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Download {m.originalName ?? (m.attachmentKey ?? 'file')}
          </a>
        </div>
      );
    }
    return null;
  })() : null}

  {/* Edited label - show if backend/frontend marked message as edited */}
{wasEdited ? (
  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
    <span className="edited-label">Edited</span>
  </div>
) : null}

</div>

                {mine ? (
                  <div style={{ width: '70%', display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="tick-row" aria-hidden>
                      {read ? (
                        <DoubleTicks colorClass="tick-blue" />
                      ) : delivered ? (
                        <DoubleTicks colorClass="tick-gray" />
                      ) : (
                        <SingleTickSvg className="tick-gray" />
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}

      {ctxVisible && ctxTargetMessage ? (
        <div style={menuStyle} role="menu" aria-hidden={!ctxVisible} ref={menuRef}>
          {/* Reply action available for both mine and theirs */}
          <div
            style={menuItemStyle}
            onClick={() => {
              try { onReply && onReply(ctxTargetMessage); } catch (e) { /* swallow */ }
              closeMessageContextMenu();
            }}
          >
            💬 Reply
          </div>

          <div style={{ height: 6 }} />

          {/* Copy text (only if message has textual content) */}
          {ctxTargetMessage && ctxTargetMessage.content ? (
          <div
            style={menuItemStyle}
            onClick={() => {
              try { copyMessageText(ctxTargetMessage); } catch (e) { /* swallow */ }
            }}
          >
            📋 Copy text
          </div>
        ) : null}

        <div style={{ height: 6 }} />


          {isMessageMine(ctxTargetMessage.senderId) ? (
            <>
              <div style={menuItemStyle} onClick={() => onRequestEdit()}>✏️ Edit message</div>
              <div style={{ height: 6 }} />
              <div style={{ ...menuItemStyle, color: '#ffb4b4' }} onClick={() => onRequestDelete()}>🗑️ Delete message</div>
            </>
          ) : (
            <>
              <div style={{ ...menuItemStyle, color: '#9aa8b8' }}>No other actions</div>
            </>
          )}

          <div style={{ height: 6 }} />
          <div style={{ ...menuItemStyle, color: '#9aa8b8' }} onClick={() => closeMessageContextMenu()}>Close</div>
        </div>
      ) : null}

{/* Lightbox overlay */}
{lightboxOpen && lightboxUrl ? (
  <div
    onClick={(e) => {
      // only close when clicking the backdrop, not the image
      if (e.target === e.currentTarget) closeLightbox();
    }}
    style={{
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: 12000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(2,6,23,0.85)',
      padding: 20,
    }}
    aria-hidden={!lightboxOpen}
  >
    <div
      role="dialog"
      aria-modal="true"
      style={{
        maxWidth: 'calc(100% - 40px)',
        maxHeight: 'calc(100% - 40px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={lightboxUrl}
        alt="preview"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          borderRadius: 12,
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          objectFit: 'contain',
          cursor: 'zoom-out'
        }}
        onClick={(e) => { /* optional: click image to close */ }}
      />
    </div>
  </div>
) : null}


      {/* Confirm delete popup (two-step) */}
      {confirmVisible && ctxTargetMessage ? (
  <div style={confirmStyle} ref={confirmRef}>
    <div style={{ marginBottom: 8 }}>Are you sure you want to delete this message?</div>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button
        onClick={() => { setConfirmVisible(false); closeMessageContextMenu(); }}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.04)',
          background: 'transparent',
          color: '#9aa8b8',
          cursor: 'pointer', // explicit pointer
        }}
      >
        Cancel
      </button>
      <button
        onClick={confirmDelete}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: 'none',
          background: '#ff6b6b',
          color: '#fff',
          cursor: 'pointer', // explicit pointer
        }}
      >
        Yes, delete
      </button>
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
  onReply: PropTypes.func,
};
