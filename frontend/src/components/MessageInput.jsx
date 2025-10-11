/* eslint-disable no-empty */
/* src/components/MessageInput.jsx */
import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MessageInput
 * Props:
 *  - sendMessage(content, opts) => void | Promise
 *  - placeholder (string)
 *  - conversationId (string) - current conversation id or draft id
 *  - socketRef (ref) - socketRef.current is socket.io instance
 *  - replyTarget: { _id, id, content, senderName, senderId } | null
 *  - onCancelReply() => void
 */
export default function MessageInput({
  sendMessage,
  placeholder = 'Write a message…',
  conversationId,
  socketRef,
  replyTarget = null,
  onCancelReply = () => {},
}) {
  const [value, setValue] = useState('');
  const typingRef = useRef(false);
  const idleTimer = useRef(null);
  const textareaRef = useRef(null);
  const IDLE_TIMEOUT_MS = 1500;

  // derived reply info
  const replySenderName = replyTarget
    ? (replyTarget.senderName
        ?? (replyTarget.senderId && typeof replyTarget.senderId === 'object'
            ? (replyTarget.senderId.name || replyTarget.senderId.username || replyTarget.senderId.userName)
            : (replyTarget.senderId ? String(replyTarget.senderId).slice(0, 6) : 'Unknown')))
    : null;

  const replyIdToSend = replyTarget ? (replyTarget._id ?? replyTarget.id ?? null) : null;
  const replyPreview = replyTarget ? String(replyTarget.content ?? '').replace(/\s+/g, ' ').trim() : '';

  const safeEmitTyping = useCallback((isTyping) => {
    try {
      if (!socketRef || !socketRef.current) return;
      socketRef.current.emit('typing', { conversationId, isTyping: !!isTyping });
    } catch (err) {
      // don't crash on emit errors
      // eslint-disable-next-line no-console
      console.warn('typing emit failed', err && (err.message || err));
    }
  }, [socketRef, conversationId]);

  // called whenever user types
  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);

    // announce typing if not already announced
    if (!typingRef.current) {
      typingRef.current = true;
      safeEmitTyping(true);
    }
    // restart idle timer
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      typingRef.current = false;
      safeEmitTyping(false);
      idleTimer.current = null;
    }, IDLE_TIMEOUT_MS);
  };

  // clear typing state and timers, emit false if needed
  const clearTyping = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    if (typingRef.current) {
      typingRef.current = false;
      safeEmitTyping(false);
    }
  }, [safeEmitTyping]);

  // send message on Enter (not Shift+Enter)
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const content = value.trim();
      if (!content) {
        setValue('');
        clearTyping();
        return;
      }
      setValue('');
      clearTyping();
      try {
        await sendMessage(content, { replyTo: replyIdToSend });
        try { onCancelReply(); } catch {}
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('sendMessage failed', err && (err.message || err));
      }
    }
  };

  // emit false on blur / unmount
  useEffect(() => {
    const onBlur = () => clearTyping();
    try {
      window.addEventListener('blur', onBlur);
    } catch {}
    return () => {
      clearTyping();
      try {
        window.removeEventListener('blur', onBlur);
      } catch {}
    };
  }, [clearTyping]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // small helpers
  const truncated = (text, max = 180) => {
    if (!text) return '';
    if (text.length <= max) return text;
    return text.slice(0, max).trim() + '…';
  };

  // Icons (inline SVG)
  const ReplyIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1C15.5 14.8 18.9 15.6 22 20c-2-7-6-11-12-11z" />
    </svg>
  );
  const PaperclipIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="currentColor" d="M21.44 11.05l-8.49 8.49a5 5 0 11-7.07-7.07l8.48-8.49a3.5 3.5 0 114.95 4.95L9.83 17.37a2.5 2.5 0 11-3.54-3.54L16.3 3.85" stroke="none" />
    </svg>
  );
  const EmojiIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm-3.5 8a1.25 1.25 0 11.001 2.501A1.25 1.25 0 018.5 10zm7 6.5a4.5 4.5 0 01-9 0h9zM15.5 10a1.25 1.25 0 11.001 2.501A1.25 1.25 0 0115.5 10z" />
    </svg>
  );

  return (
    <div style={{ width: '100%' }}>
      {/* Reply preview header (when replying) */}
      {replyTarget ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.02)',
          }}
          role="region"
          aria-label="Reply preview"
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
            <div style={{ color: '#7fb1ff', marginTop: 2, flexShrink: 0 }}>
              <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ReplyIcon />
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7fb1ff', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Reply to {replySenderName ?? 'Unknown'}
              </div>
              <div style={{ fontSize: 13, color: '#cfe6ff', opacity: 0.95, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {truncated(replyPreview, 200)}
              </div>
            </div>
          </div>

          <button
            aria-label="Cancel reply"
            onClick={() => {
              try { onCancelReply(); } catch {}
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#9aa8b8',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 6,
            }}
            title="Cancel reply"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Input row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Left paperclip (optional action) */}
        <button
          type="button"
          aria-label="Attach file"
          style={{
            border: 'none',
            background: 'transparent',
            color: '#9aa8b8',
            padding: '8px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => { /* hook up attachment if desired */ }}
        >
          <PaperclipIcon />
        </button>

        <textarea
  ref={textareaRef}
  value={value}
  onChange={handleChange}
  onKeyDown={handleKeyDown}
  placeholder={placeholder}
  rows={2}
  style={{
    flex: 1,
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.04)',
    background: 'rgba(255,255,255,0.02)',
    color: 'inherit',
    outline: 'none',
    minHeight: 40,
    boxSizing: 'border-box',
    resize: 'vertical' // allow the user to manually resize if desired
  }}
  aria-label="Message input"
/>

        {/* Emoji / Send group */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            aria-label="Insert emoji"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#9aa8b8',
              padding: '8px 10px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => { /* optional emoji picker */ }}
          >
            <EmojiIcon />
          </button>

          <button
            type="button"
            onClick={async () => {
              const content = value.trim();
              if (!content) return;
              setValue('');
              clearTyping();
              try {
                await sendMessage(content, { replyTo: replyIdToSend });
                try { onCancelReply(); } catch {}
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('sendMessage failed', err && (err.message || err));
              }
            }}
            style={{
              background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)',
              color: '#fff',
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
