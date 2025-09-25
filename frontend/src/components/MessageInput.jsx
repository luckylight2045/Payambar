/* eslint-disable no-empty */
// src/components/MessageInput.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MessageInput
 * Props:
 *  - sendMessage(content) => void | Promise
 *  - placeholder (string)
 *  - conversationId (string) - current conversation id or draft id
 *  - socketRef (ref) - socketRef.current is socket.io instance
 */
export default function MessageInput({
  sendMessage,
  placeholder = 'Write a message…',
  conversationId,
  socketRef,
}) {
  const [value, setValue] = useState('');
  const typingRef = useRef(false);
  const idleTimer = useRef(null);
  const IDLE_TIMEOUT_MS = 1500;

  const safeEmitTyping = useCallback((isTyping) => {
    try {
      if (!socketRef || !socketRef.current) return;
      // conversationId might be a draft id (e.g. 'draft:...') — server expects conversationId present for room events;
      // for typing we still send the conversationId so others in that room (if joined) know.
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
        await sendMessage(content);
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(255,255,255,0.02)',
          color: 'inherit',
          outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={async () => {
          const content = value.trim();
          if (!content) return;
          setValue('');
          clearTyping();
          try {
            await sendMessage(content);
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
        }}
      >
        Send
      </button>
    </div>
  );
}
