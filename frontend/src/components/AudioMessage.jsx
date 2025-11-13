import React, { useRef, useEffect, useState } from 'react';

/** Helper: mm:ss formatting */
function fmtSeconds(s = 0) {
  const sec = Math.max(0, Math.floor(s));
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

/**
 * AudioMessage
 * Props:
 *  - src: string (required) audio url
 *  - title: string (optional) shown in bold, fallback to filename
 *  - filename: string (optional)
 *  - views: number (optional)
 *  - createdAt: iso/string (optional) — small time text
 *  - mine: boolean (optional) to style bubble color
 */
export function AudioMessage({
  src,
  title,
  filename,
  views = 0,
  createdAt = null,
  mine = false,
}) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration || 0);
    const onEnded = () => setPlaying(false);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('ended', onEnded);
    };
  }, [src]);

  // Pause other players when starting
  const handlePlayToggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    try {
      if (playing) {
        a.pause();
        setPlaying(false);
      } else {
        // pause other audio players on page
        document.querySelectorAll('audio[data-chat-player]').forEach((el) => {
          if (el !== a) try { el.pause(); } catch {}
        });
        await a.play();
        setPlaying(true);
      }
    } catch (err) {
      console.warn('audio play failed', err);
      setPlaying(false);
    }
  };

  const titleText = title || filename || '<unknown>';

  const rightTimeText = (() => {
    if (!createdAt) return '';
    try {
      const d = new Date(createdAt);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })();

  // styles (inline so it's easy to drop in)
  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 12,
    background: mine ? 'linear-gradient(180deg,#2b6ef6,#1e4fd8)' : '#0f2936',
    color: mine ? '#fff' : 'var(--text, #e6eef6)',
    maxWidth: 560,
    boxShadow: '0 6px 18px rgba(2,6,23,0.35)',
  };

  const playCircle = {
    width: 44,
    height: 44,
    borderRadius: 44,
    background: playing ? '#ff6b6b' : '#2b6ef6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    color: '#fff',
    fontWeight: 700,
  };

  const metaBlock = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0, // allow ellipsis
  };

  const titleStyle = {
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const subStyle = { fontSize: 12, color: mine ? 'rgba(255,255,255,0.9)' : '#9aa8b8' };

  const rightCol = { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 60 };

  const eyeRow = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#9aa8b8' };

  return (
    <div style={containerStyle}>
      <div style={playCircle} onClick={handlePlayToggle} role="button" aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '■' : '▶'}
      </div>

      <div style={metaBlock}>
        <div style={titleStyle} title={titleText}>{titleText}</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={subStyle}>{fmtSeconds(duration)}</div>
          {filename ? <div style={{ ...subStyle, opacity: 0.9, fontSize: 12 }}>{filename}</div> : null}
        </div>
      </div>

      <div style={rightCol}>
        <div style={eyeRow} aria-hidden>
          {/* Eye icon */}
          <svg width="16" height="12" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4C7 4 3.2 7.2 1.5 10.5 3.2 13.8 7 17 12 17s8.8-3.2 10.5-6.5C20.8 7.2 16.999 4 12 4z" fill="currentColor" opacity="0.16"/>
            <circle cx="12" cy="10.5" r="2.6" fill="currentColor" />
          </svg>
          <div style={{ fontSize: 12 }}>{views ?? 0}</div>
        </div>
        <div style={{ fontSize: 12, color: '#9aa8b8' }}>{rightTimeText}</div>
      </div>

      <audio
        data-chat-player
        ref={audioRef}
        src={src}
        preload="metadata"
        style={{ display: 'none' }}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}
