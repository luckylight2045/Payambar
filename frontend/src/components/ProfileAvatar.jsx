/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
// src/components/ProfileAvatar.jsx
import React, { useRef, useState } from 'react';

/**
 * ProfileAvatar
 * Props:
 *  - user: { avatar?: string, name?: string, ... }
 *  - apiBase?: string (optional base URL for your API, default '')
 *  - onUserUpdated(updatedUser) => void (optional) — call parent to refresh user state
 */
export default function ProfileAvatar({ user = {}, apiBase = '', onUserUpdated = () => {} }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(user.avatar || '');
  const fileRef = useRef(null);

  const pickFile = () => {
    if (fileRef.current) fileRef.current.click();
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // 1) Upload to your upload endpoint
      const fd = new FormData();
      fd.append('file', file, file.name);

      const resp = await fetch(`${apiBase}/uploads/upload`, {
        method: 'POST',
        body: fd,
        credentials: 'include', // include cookies if you use cookie auth
      });

      if (!resp.ok) {
        throw new Error('Upload failed: ' + resp.status);
      }
      const data = await resp.json(); // expected { key, publicUrl }

      const publicUrl = data.publicUrl || data.url || data.key;
      if (!publicUrl) throw new Error('Upload did not return a publicUrl');

      // show preview immediately
      setPreview(publicUrl);

      // 2) Save avatar in user profile
      const updResp = await fetch(`${apiBase}/users/update`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar: publicUrl }),
      });

      if (!updResp.ok) {
        // optional: revert preview or show error
        throw new Error('Save profile failed: ' + updResp.status);
      }

      const updatedUser = await updResp.json();
      // Callback so parent can refresh user context/state
      try { onUserUpdated(updatedUser); } catch {}

      alert('Avatar updated');
    } catch (err) {
      console.error(err);
      alert('Failed to update avatar: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // optional: validate type/size
    handleFile(f);
    try { e.target.value = null; } catch (e) {}
  };

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <img
          src={preview || '/placeholder-avatar.png'}
          alt={user.name || 'avatar'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.04)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.4)'
          }}
        />
        <button
          onClick={pickFile}
          title="Change avatar"
          style={{
            position: 'absolute',
            right: -6,
            bottom: -6,
            width: 36,
            height: 36,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(180deg,#2b6ef6,#1e4fd8)',
            color: '#fff',
            cursor: uploading ? 'wait' : 'pointer'
          }}
          disabled={uploading}
        >
          {uploading ? '…' : '✎'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>{user.name ?? 'You'}</div>
        <div style={{ color: '#9aa8b8', fontSize: 13 }}>
          {preview ? 'Profile picture set' : 'No profile picture'}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />
    </div>
  );
}
