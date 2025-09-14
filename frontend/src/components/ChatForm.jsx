/* eslint-disable no-unused-vars */
// src/components/ChatForm.jsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import useAuth from '../hooks/useAuth';

/**
 * Search-only chat form. Searches server for users whose name starts with query.
 * On click -> create/open private conversation then call onConversationStart(convId).
 */
export default function ChatForm({ onConversationStart }) {
  const { token, user } = useAuth();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!q || q.trim().length === 0) { setResults([]); setError(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q.trim()), 260);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const doSearch = async (term) => {
    setLoading(true); setError(null);
    try {
      // backend supports searchByPrefix at /users/search?q=term
      const res = await axios.get('http://localhost:3000/users/search', { params: { q: term }, headers: { Authorization: `Bearer ${token}` } });
      let data = res.data ?? [];
      if (!Array.isArray(data)) data = data ? [data] : [];
      const mapped = data
        .filter(Boolean)
        .map(u => {
          const id = u._id ?? u.id ?? null;
          const name = u.name ?? u.userName ?? u.username ?? id;
          return { id, name, raw: u };
        })
        .filter(x => x.id);
      setResults(mapped);
    } catch (err) {
      console.error('Search failed', err);
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  };

  async function startConversationWith(userId) {
    if (!userId) return;
    setLoading(true); setError(null);
    try {
      // try direct create/get conversation endpoint
      try {
        const r = await axios.post(`http://localhost:3000/chats/conversations/private/${encodeURIComponent(userId)}`, null, { headers: { Authorization: `Bearer ${token}` } });
        const convId = r?.data?._id ?? r?.data?.conversation?._id ?? r?.data?.conversationId ?? r?.data?._id;
        if (convId) {
          onConversationStart(convId);
          setQ('');
          setResults([]);
          return;
        }
      } catch (e) {
        // ignore and fallback to sending a first message
      }

      // fallback: send tiny message to create conversation
      const fallback = await axios.post(`http://localhost:3000/chats/private/${encodeURIComponent(userId)}/messages`, { content: 'Hi', messageType: 'text' }, { headers: { Authorization: `Bearer ${token}` } });
      const convId = fallback?.data?.conversationId ?? fallback?.data?.conversation?._id ?? fallback?.data?._id;
      if (!convId) throw new Error('No conversation id returned');
      onConversationStart(convId);
      setQ('');
      setResults([]);
    } catch (err) {
      console.error(err);
      setError('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  }

  const onSelectResult = (r) => startConversationWith(r.id);

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
            {results.map(r => (
              <li key={r.id}
                onClick={() => onSelectResult(r)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {(r.name || 'U').slice(0,2).toUpperCase()}
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
