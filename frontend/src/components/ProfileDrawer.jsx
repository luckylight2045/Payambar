/* eslint-disable no-empty */
// src/components/ProfileDrawer.jsx
import React, { useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import axios from 'axios';

export default function ProfileDrawer({ open, onClose }) {
  const { user, token, refreshUser, logout } = useAuth();
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const pickFile = () => fileRef.current && fileRef.current.click();

  const onFileChange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { alert('Please choose an image'); return; }
    if (f.size > 6 * 1024 * 1024) { alert('Max 6MB'); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f, f.name);

      const resp = await axios.post('http://localhost:3000/uploads/upload', fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = resp.data || {};
      const publicUrl = data.publicUrl || data.url || (data.key ? `${import.meta.env.VITE_UPLOAD_BASE || ''}/${data.key}` : null);
      if (!publicUrl) throw new Error('Upload returned no url');

      setAvatarPreview(publicUrl);

      // update user avatar
      await axios.patch('http://localhost:3000/users/update', { avatar: publicUrl }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // try refresh auth user
      if (typeof refreshUser === 'function') {
        try { await refreshUser(); } catch {}
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error('avatar upload failed', err);
      alert('Avatar upload failed');
    } finally {
      setUploading(false);
      try { e.target.value = null; } catch {}
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
      background: '#07121a', color: 'var(--text, #e6eef6)',
      padding: 18, zIndex: 1300, boxShadow: '-6px 0 30px rgba(0,0,0,0.6)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Profile</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <img src={avatarPreview || '/placeholder-avatar.png'} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          <button onClick={pickFile} disabled={uploading} style={{
            position: 'absolute', right: -8, bottom: -8, width: 36, height: 36, borderRadius: 10, border: 'none', background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)', color: '#fff', cursor: 'pointer'
          }}>{uploading ? '…' : '✎'}</button>
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>{user?.name ?? user?.username}</div>
          <div style={{ color: '#9aa8b8', marginTop: 6 }}>{user?.email ?? ''}</div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />

      <div style={{ marginTop: 18 }}>
        <button onClick={() => { try { logout(); } catch {} }} style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: 'inherit', border: '1px solid rgba(255,255,255,0.04)' }}>
          Logout
        </button>
      </div>
    </div>
  );
}
