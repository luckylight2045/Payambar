// src/components/SidebarMenu.jsx
import React, { useState } from 'react';
import ProfileDrawer from './ProfileDrawer';
import useAuth from '../hooks/useAuth';

/**
 * SidebarMenu - minimal Telegram-style left menu with avatar + "My Profile"
 *
 * Usage: render <SidebarMenu /> somewhere in your top-level layout (App.jsx) so it sits above left column.
 */
export default function SidebarMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); // menu open
  const [profileOpen, setProfileOpen] = useState(false); // profile drawer

  return (
    <>
      {/* Menu button / header block (you probably have something similar) */}
      <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => setOpen((s) => !s)}
          aria-label="Open menu"
          style={{
            width: 44, height: 44, borderRadius: 8, border: 'none',
            background: 'transparent', color: 'inherit', cursor: 'pointer'
          }}
        >
          ☰
        </button>

        {/* small avatar that also opens profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={user?.avatar || '/placeholder-avatar.png'}
            alt="me"
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
            onClick={() => { setProfileOpen(true); setOpen(false); }}
          />
        </div>
      </div>

      {/* Hidden left menu overlay */}
      {open ? (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: 320,
          background: '#0b1420', color: 'var(--text, #e6eef6)',
          zIndex: 1200, boxShadow: '2px 0 18px rgba(0,0,0,0.6)', padding: 16
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <img src={user?.avatar || '/placeholder-avatar.png'} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <div style={{ fontWeight: 700 }}>{user?.name ?? user?.username}</div>
              <div style={{ color: '#9aa8b8', fontSize: 13 }}>{user?.email || ''}</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button onClick={() => { setProfileOpen(true); setOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
              👤 My Profile
            </button>

            {/* other menu items (add as needed) */}
            <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', marginTop: 6 }}>
              ⚙️ Settings
            </button>
            <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', marginTop: 6 }}>
              🌙 Night mode
            </button>
          </div>

          <div style={{ position: 'absolute', right: 12, top: 12 }}>
            <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      ) : null}

      {/* Profile drawer */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
