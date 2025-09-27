// src/hooks/useConversations.js
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

/**
 * useConversations(token)
 * - manages fetching and refreshing the conversations list
 * - exposes helper actions: refresh, deleteConversation, clearHistory
 *
 * NOTE: This hook does not own UI state like activeConvId/messages; it only loads/manages the list.
 */
export default function useConversations(token) {
  const [conversations, setConversations] = useState([]);

  const fetchConversations = useCallback(async () => {
    if (!token) return [];
    try {
      const res = await axios.get('http://localhost:3000/chats/conversations', { headers: { Authorization: `Bearer ${token}` } });
      const convs = Array.isArray(res.data) ? res.data : [];
      setConversations(convs);
      return convs;
    } catch (err) {
      // don't crash; return empty
      // eslint-disable-next-line no-console
      console.error('[useConversations] fetch failed', err && (err.message || err));
      return [];
    }
  }, [token]);

  useEffect(() => {
    // initial load
    if (!token) {
      setConversations([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded = await fetchConversations();
      if (cancelled) return;
      setConversations(loaded);
    })();
    return () => { cancelled = true; };
  }, [token, fetchConversations]);

  const refresh = useCallback(async () => {
    return await fetchConversations();
  }, [fetchConversations]);

  const deleteConversation = useCallback(async (conversationId) => {
    if (!token || !conversationId) return { ok: false };
    try {
      const res = await axios.delete(`http://localhost:3000/conversations/${encodeURIComponent(conversationId)}`, { headers: { Authorization: `Bearer ${token}` } });
      // update local list conservatively
      setConversations((prev) => (prev || []).filter((c) => String(c._id ?? c.id ?? '') !== String(conversationId)));
      return { ok: true, data: res.data };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[useConversations] delete failed', err && (err.message || err));
      return { ok: false, error: err };
    }
  }, [token]);

  const clearHistory = useCallback(async (conversationId) => {
    if (!token || !conversationId) return { ok: false };
    try {
      const res = await axios.delete(`http://localhost:3000/messages/history/${encodeURIComponent(conversationId)}`, { headers: { Authorization: `Bearer ${token}` } });
      return { ok: true, data: res.data };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[useConversations] clearHistory failed', err && (err.message || err));
      return { ok: false, error: err };
    }
  }, [token]);

  return {
    conversations,
    setConversations, // expose setter so consumers can append drafts etc
    refresh,
    deleteConversation,
    clearHistory,
  };
}
