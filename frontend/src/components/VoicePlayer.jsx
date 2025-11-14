/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
// src/components/VoicePlayer.jsx
import React, { useEffect, useRef, useState } from 'react';

function formatTimeSec(s = 0) {
  const sec = Math.max(0, Math.floor(s));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * VoicePlayer
 * Props:
 *  - src: string (required)
 *  - mine: boolean (optional) - layout/color tweak for sent messages
 *  - compact: boolean (optional) - smaller layout (for voice notes)
 *  - skipSeconds: number (optional) - how many seconds to skip when pressing rewind/forward (default 15)
 */
export default function VoicePlayer({ src, mine = false, compact = true, skipSeconds = 15 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime || 0);
    const onLoaded = () => setDur(a.duration || 0);
    const onEnd = () => { setPlaying(false); setPos(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('ended', onEnd);
    };
  }, [src]);

  // Play/pause effect (pauses other audio elements)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      document.querySelectorAll('audio[data-chat-player]').forEach((el) => {
        if (el !== a) try { el.pause(); } catch {}
      });
      a.play().catch(() => setPlaying(false));
    } else {
      try { a.pause(); } catch {}
    }
  }, [playing]);

  const toggle = () => setPlaying((p) => !p);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v || 0));

  const seekTo = (seconds) => {
    const a = audioRef.current;
    if (!a) return;
    const newPos = clamp(seconds, 0, a.duration || dur || Infinity);
    try { a.currentTime = newPos; } catch (e) {}
    setPos(newPos);
  };

  const skipBackward = () => {
    const a = audioRef.current;
    if (!a) return;
    seekTo((a.currentTime || pos) - Number(skipSeconds));
  };

  const skipForward = () => {
    const a = audioRef.current;
    if (!a) return;
    seekTo((a.currentTime || pos) + Number(skipSeconds));
  };

  const onSeekClick = (evt) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
    const target = x * a.duration;
    seekTo(target);
  };

  // generate small bars for waveform look
  const bars = new Array(7).fill(0).map((_, i) => {
    const base = [0.9, 0.6, 1, 0.5, 0.8, 0.7, 0.55][i] || 0.7;
    const height = Math.round(base * 28) + 6;
    return { key: i, height };
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: compact ? 8 : 12,
      borderRadius: 14,
      background: mine ? 'linear-gradient(135deg,#2b6ef6,#1e4fd8)' : 'rgba(255,255,255,0.02)',
      color: mine ? '#fff' : '#e6eef6',
      maxWidth: 520,
      minWidth: compact ? 160 : 220,
      boxShadow: mine ? '0 10px 30px rgba(43,110,246,0.12)' : '0 6px 20px rgba(0,0,0,0.12)',
    }}>
      {/* rewind */}
      <button
        onClick={skipBackward}
        title={`Back ${skipSeconds}s`}
        style={{
          width: 36, height: 36, borderRadius: 12, border: 'none', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: mine ? '#e6eef6' : '#9aa8b8',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M11 18V6l-8 6 8 6zM21 18V6l-8 6 8 6z" fill={mine ? '#e6eef6' : '#9aa8b8'} />
        </svg>
      </button>

      {/* play / pause */}
      <button
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          width: compact ? 46 : 52,
          height: compact ? 46 : 52,
          borderRadius: 50,
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: playing ? (mine ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.06)') : (mine ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'),
          color: mine ? '#fff' : '#0f2936',
          flexShrink: 0,
        }}
      >
        {!playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 3v18l15-9L5 3z" fill={mine ? '#fff' : '#0f2936'} />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="5" width="3" height="14" rx="1" fill={mine ? '#fff' : '#0f2936'} />
            <rect x="15" y="5" width="3" height="14" rx="1" fill={mine ? '#fff' : '#0f2936'} />
          </svg>
        )}
      </button>

      {/* waveform + progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', paddingLeft: 6, paddingRight: 6 }}>
            {bars.map((b) => (
              <div key={b.key} style={{
                width: 4,
                height: b.height,
                borderRadius: 3,
                background: mine ? 'linear-gradient(180deg,#8cc6ff,#2b6ef6)' : 'rgba(255,255,255,0.85)',
                opacity: playing ? 1 : 0.6,
                transformOrigin: 'bottom center',
                animation: playing ? `vpw ${0.9 + (b.key * 0.05)}s infinite ease-in-out` : 'none'
              }} />
            ))}
          </div>

          <div style={{ flex: 1, height: 8, borderRadius: 8, background: 'rgba(0,0,0,0.12)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }} onClick={onSeekClick}>
            <div style={{ width: dur ? `${Math.min(100, (pos / dur) * 100)}%` : '0%', height: '100%', background: mine ? 'linear-gradient(90deg,#8cc6ff,#2b6ef6)' : 'rgba(255,255,255,0.9)', transition: seeking ? 'none' : 'width 120ms linear' }} />
          </div>

          <div style={{ minWidth: 64, textAlign: 'right', color: mine ? 'rgba(255,255,255,0.95)' : '#9aa8b8', fontSize: 13 }}>
            {formatTimeSec(pos)} / {formatTimeSec(dur)}
          </div>
        </div>
      </div>

      {/* forward */}
      <button
        onClick={skipForward}
        title={`Forward ${skipSeconds}s`}
        style={{
          width: 36, height: 36, borderRadius: 12, border: 'none', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: mine ? '#e6eef6' : '#9aa8b8',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M3 6v12l8.5-6L3 6zm10 0v12l8.5-6L13 6z" fill={mine ? '#e6eef6' : '#9aa8b8'} />
        </svg>
      </button>

      <audio data-chat-player ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />

      <style>{`
        @keyframes vpw {
          0% { transform: scaleY(0.6); opacity:0.6; }
          50% { transform: scaleY(1.05); opacity:1; }
          100% { transform: scaleY(0.6); opacity:0.6; }
        }
      `}</style>
    </div>
  );
}
