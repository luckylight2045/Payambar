// src/components/ContextMenu.jsx
import React, { useEffect, useRef } from 'react';

/**
 * ContextMenu
 * Props:
 *  - visible (bool)
 *  - x, y (pixel coords)
 *  - onClose() => void
 *  - onClearHistory() => Promise
 *  - onDeleteConversation() => Promise
 *  - isDraft (bool)
 *
 * Simple, pretty context menu for right-click actions on conversations.
 */
export default function ContextMenu({
  visible,
  x = 0,
  y = 0,
  onClose = () => {},
  onClearHistory = () => {},
  onDeleteConversation = () => {},
  isDraft = false,
}) {
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) onClose();
    }
    if (visible) {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('scroll', onClose, true);
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const style = {
    position: 'fixed',
    left: x,
    top: y,
    background: '#0b1420',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
    padding: 8,
    borderRadius: 8,
    zIndex: 9999,
    minWidth: 180,
    color: 'var(--text, #e6eef6)',
  };

  const itemStyle = {
    padding: '8px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const divider = { height: 1, background: 'rgba(255,255,255,0.02)', margin: '6px 0' };

  return (
    <div ref={ref} style={style} role="menu" aria-hidden={!visible}>
      <div
        style={itemStyle}
        onClick={async () => {
          try {
            await onClearHistory();
          } finally {
            onClose();
          }
        }}
      >
        🧹 Clear history
      </div>

      <div style={divider} />

      <div
        style={{ ...itemStyle, color: isDraft ? '#9aa8b8' : 'var(--text)' }}
        onClick={async () => {
          try {
            await onDeleteConversation();
          } finally {
            onClose();
          }
        }}
      >
        🗑️ {isDraft ? 'Remove draft' : 'Delete conversation'}
      </div>
    </div>
  );
}
