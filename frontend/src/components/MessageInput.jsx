// src/components/MessageInput.jsx
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * MessageInput
 * - sendMessage(content) prop required
 * - Press Enter to send (Shift+Enter inserts newline)
 */
export default function MessageInput({ sendMessage, placeholder = 'Write a message…' }) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);

  // attempt to keep textarea height small and expandable
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [value]);

  const doSend = async () => {
    const text = value?.toString?.().trim?.();
    if (!text) return;
    try {
      setSending(true);
      // allow parent to handle how they want to send (socket or REST)
      await Promise.resolve(sendMessage(text));
      setValue('');
      // reset height
      const el = textareaRef.current;
      if (el) {
        el.style.height = 'auto';
      }
    } catch (err) {
      // parent handles errors usually; still ensure sending flag cleared
      console.error('sendMessage failed', err);
      // you may want to show an inline error here
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // ignore empty
      if (!value || !value.trim()) return;
      doSend();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(255,255,255,0.03)',
          color: 'inherit',
          outline: 'none',
          fontSize: 14,
          lineHeight: 1.4,
          maxHeight: 200,
          overflow: 'auto',
        }}
        disabled={sending}
      />
      <button
        onClick={() => {
          if (!value || !value.trim()) return;
          doSend();
        }}
        disabled={sending}
        style={{
          background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)',
          color: 'white',
          padding: '10px 14px',
          borderRadius: 8,
          border: 'none',
          cursor: sending ? 'default' : 'pointer',
          fontWeight: 600,
          minWidth: 84,
        }}
        aria-label="Send message"
      >
        {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}

MessageInput.propTypes = {
  sendMessage: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};
