/* eslint-disable no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
// put this near the top of MessageList.jsx (after imports, before the component export)
import React, { useEffect, useRef, useState } from 'react';

function formatTimeSec(s = 0) {
  const sec = Math.max(0, Math.floor(s));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function VoicePlayer({ src, isVoiceNote = true, mine = false }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  // update position every 250ms while playing
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

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing]);

  const toggle = () => setPlaying((p) => !p);

  // small waveform: 7 bars whose heights are static-ish but animate while playing
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
    }}>
      <button
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        style={{
          width: 48,
          height: 48,
          borderRadius: 48,
          border: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
          background: mine ? 'linear-gradient(180deg,#2b6ef6,#1e4fd8)' : 'white',
          color: mine ? 'white' : '#0f2936',
          padding: 0,
        }}
      >
        {/* Play triangle / Pause icon */}
        {!playing ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transform: 'translateX(2px)' }}>
            <path d="M5 3v18l15-9L5 3z" fill={mine ? '#fff' : '#0f2936'} />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="5" width="3" height="14" rx="1" fill={mine ? '#fff' : '#0f2936'} />
            <rect x="15" y="5" width="3" height="14" rx="1" fill={mine ? '#fff' : '#0f2936'} />
          </svg>
        )}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 160,
          maxWidth: 360,
        }}>
          {/* waveform */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
            {bars.map((b) => (
              <div
                key={b.key}
                style={{
                  width: 6,
                  height: b.height,
                  borderRadius: 3,
                  background: mine ? 'linear-gradient(180deg,#6fb1ff,#2b6ef6)' : 'rgba(255,255,255,0.85)',
                  opacity: playing ? 1 : 0.5,
                  transformOrigin: 'bottom center',
                  animation: playing ? `voicewave ${0.9 + (b.key * 0.05)}s infinite ease-in-out` : 'none',
                }}
              />
            ))}
          </div>

          {/* progress bar small */}
          <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.12)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              width: dur ? `${Math.min(100, (pos / dur) * 100)}%` : '0%',
              height: '100%',
              background: mine ? 'linear-gradient(90deg,#8cc6ff,#2b6ef6)' : 'rgba(255,255,255,0.9)',
              transition: 'width 200ms linear',
            }} />
          </div>

          <div style={{ minWidth: 58, textAlign: 'right', color: mine ? 'rgba(255,255,255,0.95)' : '#9aa8b8', fontSize: 13 }}>
            {formatTimeSec(pos)} / {formatTimeSec(dur)}
          </div>
        </div>

        {/* hidden native audio element */}
        <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
      </div>

      <style>{`
        @keyframes voicewave {
          0% { transform: scaleY(0.6); opacity:0.7; }
          50% { transform: scaleY(1.05); opacity:1; }
          100% { transform: scaleY(0.6); opacity:0.7; }
        }
      `}</style>
    </div>
  );
}
