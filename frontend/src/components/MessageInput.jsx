/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
/* src/components/MessageInput.jsx */
import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * MessageInput
 * Props:
 *  - sendMessage(content, opts) => void | Promise
 *  - placeholder (string)
 *  - conversationId (string)
 *  - socketRef (ref)
 *  - replyTarget: { _id, id, content, senderId, senderName, ... } | null
 *  - onCancelReply() -> called when user cancels reply preview
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
  const IDLE_TIMEOUT_MS = 1500;

  
  
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [recorderState, setRecorderState] = useState('idle');
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // prepare reply info
  const replySenderName = replyTarget
    ? (replyTarget.senderName
        ?? (replyTarget.senderId && typeof replyTarget.senderId === 'object'
            ? (replyTarget.senderId.name || replyTarget.senderId.username || replyTarget.senderId.userName)
            : (replyTarget.senderId ? String(replyTarget.senderId).slice(0, 6) : 'Unknown')))
    : null;
  const replyIdToSend = replyTarget ? (replyTarget._id ?? replyTarget.id ?? null) : null;

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

    if (!typingRef.current) {
      typingRef.current = true;
      safeEmitTyping(true);
    }
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
        // nothing typed — don't send empty text message
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
    try { window.addEventListener('blur', onBlur); } catch {}
    return () => {
      clearTyping();
      try { window.removeEventListener('blur', onBlur); } catch {}
    };
  }, [clearTyping]);

  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // -------------------
  // File upload logic (presign + PUT)
  // -------------------
  const onPickFileClick = () => {
    try {
      if (fileInputRef.current) fileInputRef.current.click();
    } catch (e) {}
  };

  const uploadFileAndSend = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);

      const resp = await fetch('http://localhost:3000/uploads/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include', // optional: include cookies if your server expects auth via cookie
      });

      if (!resp.ok) {
        throw new Error(`upload endpoint failed (${resp.status})`);
      }

      const data = await resp.json(); // { key, publicUrl }

      const mime = file.type || '';
      const messageType = mime.startsWith('image')
      ? 'image'
      : mime.startsWith('video')
        ? 'video'
        : mime.startsWith('audio')
          ? 'audio'
          : 'file';
      await sendMessage(file.name || '', {
        messageType,
        attachmentKey: data.key,
        originalName: file.name,
        publicUrl: data.publicUrl,
        replyTo: replyIdToSend, // if you support reply
      });

      try { onCancelReply(); } catch (e) { /* swallow */ }
      } catch (err) {
        console.error('File upload/send failed', err && (err.message || err));
        alert('File upload/send failed: ' + (err && (err.message || 'unknown')));
      } finally {
        setUploading(false);
      }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Recording not supported in this browser');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
  
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
  
      mr.onstop = async () => {
        setRecorderState('processing');
        try {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const filename = `voice-${Date.now()}.webm`;
          // convert blob -> file
          const file = new File([blob], filename, { type: 'audio/webm' });
          await uploadFileAndSend(file);
        } catch (err) {
          console.error('sending recorded audio failed', err);
          alert('Failed to send recording');
        } finally {
          // stop tracks
          try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
          setRecorderState('idle');
        }
      };
  
      mr.start();
      setRecorderState('recording');
    } catch (err) {
      console.error('mic access denied or error', err);
      alert('Could not access microphone');
    }
  };
  
  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      mr.stop();
    }
  };  


  const handleFileInputChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // optional: you can add size/type checks here
    uploadFileAndSend(f);
    // reset input so same file can be picked again later
    try { e.target.value = null; } catch {}
  };

  // -------------------
  // Render
  // -------------------
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: replyTarget ? 'column' : 'row',
        alignItems: replyTarget ? 'stretch' : 'center', // IMPORTANT: stretch children in reply mode
        gap: 8,
        width: '100%',
      }}
    >
      {replyTarget ? (
        <div
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>{replySenderName ?? 'Replied'}</div>
            <div style={{ fontSize: 12, color: '#9aa8b8' }}>
              {String(replyTarget.content ?? '').split('\n')[0].slice(0, 200)}
              {(replyTarget.content && String(replyTarget.content).length > 200) ? '…' : ''}
            </div>
          </div>
          <button
            aria-label="Cancel reply"
            onClick={() => onCancelReply()}
            style={{ marginLeft: 12, border: 'none', background: 'transparent', color: '#9aa8b8', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Controls row — always full width so textarea stays normal-sized */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* Left file button */}
        <button
          type="button"
          onClick={onPickFileClick}
          title="Attach image / video"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            alignSelf: 'center', // don't stretch the button
          }}
          disabled={uploading}
        >
          {uploading ? '…' : '📎'}
        </button>

        {/* Left file & record buttons */}
<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
  <button
    type="button"
    onClick={() => {
      if (recorderState === 'idle') startRecording();
      else if (recorderState === 'recording') stopRecording();
    }}
    title={recorderState === 'recording' ? 'Stop recording' : 'Record voice'}
    style={{
      width: 40,
      height: 40,
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.04)',
      background: recorderState === 'recording' ? '#ff4d4d' : 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
    disabled={uploading}
  >
    {recorderState === 'recording' ? '■' : '🎤'}
  </button>
</div>



        {/* Multiline textarea: Shift+Enter => newline, Enter => send */}
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            width: '100%',        // ensure full width when parent is column + stretch
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(255,255,255,0.02)',
            color: 'inherit',
            outline: 'none',
            resize: 'vertical',
            minHeight: 40,
            maxHeight: 200,
            boxSizing: 'border-box',
          }}
        />

        <button
          type="button"
          onClick={async () => {
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
            flexShrink: 0,
          }}
          disabled={uploading}
        >
          Send
        </button>
      </div>
    </div>
  );

}
