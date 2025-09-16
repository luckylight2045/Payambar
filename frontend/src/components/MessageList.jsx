import React from 'react';

/**
 * MessageList
 * Props:
 *  - messages: array of message objects (message.senderId may be string or populated object)
 *  - currentUserId: string id of current user
 *  - currentUserName: optional display name for current user (not used for sender label when it's the current user; "You" is shown instead)
 *  - participantNameMap: { userId -> displayName } (optional)
 */
export default function MessageList({
  messages = [],
  currentUserId,
  participantNameMap = {},
}) {
  const resolveSenderName = (sender) => {
    // If sender is falsy
    if (!sender) return 'Unknown';

    // If sender is an object (populated)
    if (typeof sender === 'object') {
      const sid = sender._id?.toString?.() || sender.id;

      // If it's the current user, always show "You"
      if (currentUserId && sid && String(currentUserId) === String(sid)) {
        return 'You';
      }

      // Prefer common name fields from populated object
      if (sender.name) return sender.name;
      if (sender.userName) return sender.userName;
      if (sender.username) return sender.username;

      // fallback to map if exists
      if (sid && participantNameMap[sid]) return participantNameMap[sid];

      // fallback truncated id
      if (sid) return sid.slice(0, 6);
      return 'Unknown';
    }

    // If sender is a string id
    const sid = String(sender);

    // If it's the current user, always show "You"
    if (currentUserId && String(currentUserId) === sid) {
      return 'You';
    }

    // If we have a name map, use it
    if (participantNameMap && participantNameMap[sid]) return participantNameMap[sid];

    // fallback truncated id
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

  return (
    <div className="message-list" style={{ padding: 8 }}>
      {messages.map((m, i) => {
        const senderRaw = m.senderId;
        const senderName = resolveSenderName(senderRaw);
        const mine = isMessageMine(senderRaw);

        return (
          <div
            key={m._id ?? i}
            className={`message ${mine ? 'mine' : 'theirs'}`}
            style={{
              marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: mine ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{ fontSize: 12, color: '#9aa8b8', marginBottom: 4 }}>
              <strong style={{ marginRight: 8 }}>{senderName}</strong>
              <span style={{ color: '#6b7280', fontSize: 11 }}>
                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}
              </span>
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
              }}
            >
              {m.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
