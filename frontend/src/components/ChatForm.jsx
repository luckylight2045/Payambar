// src/components/ChatForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import useAuth from '../hooks/useAuth';

export default function ChatForm({ onConversationStart, conversations = [] }) {
  const { token } = useAuth();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!q || q.trim().length === 0) {
      setResults([]);
      setError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q.trim()), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const doSearch = async (term) => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await axios.get('http://localhost:3000/users/search', {
        params: { q: term },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      let data = res?.data ?? [];
      if (!Array.isArray(data)) data = data ? [data] : [];
      const mapped = data
        .filter(Boolean)
        .map((u) => {
          const id = u._id || u.id || (u._id && u._id.toString && u._id.toString()) || null;
          const name = u.name || u.userName || u.username || id;
          return { id, name, raw: u };
        })
        .filter((x) => x.id);
      setResults(mapped);
    } catch (err) {
      console.error('Search error', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  // helper to normalize participant id (handles string or object)
  const participantId = (p) => {
    if (!p) return null;
    if (typeof p === 'string') return String(p);
    if (typeof p === 'object') {
      // mongoose populated doc or similar
      if (p._id) return String(p._id);
      if (p.id) return String(p.id);
      // fallback if _id is an object with toString
      if (p._id && typeof p._id.toString === 'function') return p._id.toString();
      return null;
    }
    return null;
  };

  // Start or reuse private conversation without sending a message
  const startConversationWith = async (userId, userName) => {
    setLoading(true);
    setError(null);
    try {
      // Check if it's already in our conversations (by participants)
      const exists = conversations.find((c) => {
        const parts = c.participants || [];
        return parts.some((p) => {
          const pid = participantId(p);
          return pid && String(pid) === String(userId);
        });
      });

      if (exists) {
        // normalize conv id
        const convId = exists._id ?? exists.id ?? (exists._id && exists._id.toString && exists._id.toString()) ?? null;
        if (convId) {
          onConversationStart(String(convId));
          setQ('');
          setResults([]);
          return;
        }
      }

      // Otherwise: do NOT create backend conversation yet.
      // Inform parent to open a draft conversation (frontend-only).
      onConversationStart({ draft: true, userId, userName });
      setQ('');
      setResults([]);
    } catch (err) {
      console.error('Failed to open conversation', err);
      setError('Failed to open conversation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-form" style={{ marginBottom: 12 }}>
      <input
        placeholder="Search people by username"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.06)',
          background: 'transparent',
          color: 'inherit',
        }}
      />
      <div style={{ marginTop: 8 }}>
        {loading && <div style={{ fontSize: 13, color: '#9aa8b8' }}>Searching…</div>}
        {error && !loading && <div style={{ fontSize: 13, color: '#ffb4b4' }}>{error}</div>}
        {!loading && results.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0 0', maxHeight: 200, overflowY: 'auto' }}>
            {results.map((r) => (
              <li
                key={r.id}
                onClick={() => startConversationWith(r.id, r.name)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  transition: 'background .08s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {(r.name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#9aa8b8' }}>{r.id}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
