// src/components/MessageList.jsx
import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * MessageList
 * - groups messages by day
 * - shows time as HH:MM
 * - animates newly arrived messages with a small slide/fade animation
 *
 * Props:
 *  - messages: array of message objects (expected chronological ascending)
 *  - currentUserId: string
 *  - participantNameMap: { userId -> displayName }
 *  - currentUserName: optional
 */
export default function MessageList({
  messages = [],
  currentUserId,
  participantNameMap = {},
}) {
  // For animation: remember which message keys we've already seen
  const seenKeysRef = useRef(new Set());
  const [newKeys, setNewKeys] = useState(new Set());

  // compute deterministic key for a message
  const messageKey = (m, idx) => {
    if (!m) return `missing-${idx}`;
    return m._id ?? m.id ?? (m.createdAt ? `${m.createdAt}-${idx}` : `idx-${idx}`);
  };

  // When messages change, detect newly added keys and mark them for animation
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
      // mark all newly seen messages as "new"
      setNewKeys((prev) => {
        const copy = new Set(prev);
        for (const k of newly) copy.add(k);
        return copy;
      });

      // remove the "new" mark after animation duration
      const timeout = setTimeout(() => {
        setNewKeys((prev) => {
          const copy = new Set(prev);
          for (const k of newly) copy.delete(k);
          return copy;
        });
      }, 600); // animation length + small buffer

      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // On first mount, consider existing messages as seen (no animation)
  useEffect(() => {
    if (messages.length === 0) return;
    const initKeys = messages.map((m, i) => messageKey(m, i));
    for (const k of initKeys) seenKeysRef.current.add(k);
    // no state change required
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // resolve sender name
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

  // Group messages by day (Date.toDateString)
  const groups = {};
  for (const m of messages) {
    const d = m.createdAt ? new Date(m.createdAt) : new Date();
    const dayKey = d.toDateString();
    if (!groups[dayKey]) groups[dayKey] = [];
    groups[dayKey].push(m);
  }

  // Sort day keys ascending (oldest first)
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

  // Inline CSS for the animation and minor styling
  const styles = (
    <style>
      {`
      .msg-new {
        animation: msg-in 360ms cubic-bezier(.22,1,.36,1);
      }
      @keyframes msg-in {
        0% { transform: translateY(8px) scale(.995); opacity: 0; filter: blur(2px); }
        60% { transform: translateY(-2px) scale(1.002); opacity: 1; filter: blur(0); }
        100% { transform: translateY(0) scale(1); opacity: 1; filter: none; }
      }
      /* Slight pop for sender name and time */
      .message-meta-compact { display:flex; gap:8px; align-items:center; }
      `}
    </style>
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
            <div
              style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '6px 10px',
                borderRadius: 12,
                fontSize: 12,
                color: '#9aa8b8',
                fontWeight: 600,
              }}
            >
              {formatDayLabel(dayKey)}
            </div>
          </div>

          {groups[dayKey].map((m, i) => {
            const overallIdx = messages.indexOf(m);
            const key = messageKey(m, overallIdx !== -1 ? overallIdx : i);
            const mine = isMessageMine(m.senderId);
            const senderName = resolveSenderName(m.senderId);
            const isNew = newKeys.has(key);

            return (
              <div
                key={key}
                className={`message ${mine ? 'mine' : 'theirs'} ${isNew ? 'msg-new' : ''}`}
                style={{
                  marginBottom: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                }}
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
                  }}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

MessageList.propTypes = {
  messages: PropTypes.array,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  participantNameMap: PropTypes.object,
  currentUserName: PropTypes.string,
};
