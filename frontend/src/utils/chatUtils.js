// src/utils/chatUtils.js
// Small utilities used by ChatPage and other components.
// Purpose: keep the main page shorter and avoid subtle operator precedence bugs.

export function participantId(p) {
    if (!p) return null;
    if (typeof p === 'string') return String(p);
    if (typeof p === 'object') {
      if (p._id) return String(p._id);
      if (p.id) return String(p.id);
    }
    return null;
  }
  
  /**
   * Safely extract a sender id from a message object without mixing '&&' and '??' operators.
   * Accepts shapes like:
   *  - m.senderId === 'abcd'
   *  - m.senderId === { _id: 'abcd', name: 'Alice' }
   *  - m.senderId === { id: 'abcd' }
   */
  export function extractSenderId(m) {
    if (!m) return '';
    const s = m.senderId;
    if (!s && s !== 0) return '';
    if (typeof s === 'object') {
      // prefer _id, fallback to id, else empty string
      if (s._id !== undefined && s._id !== null) return String(s._id);
      if (s.id !== undefined && s.id !== null) return String(s.id);
      return '';
    }
    return String(s);
  }
  
  export function removeAllDraftsFromList(list) {
    return (list || []).filter((c) => {
      const id = c._id ?? c.id ?? '';
      return !String(id).startsWith('draft:');
    });
  }
  
  /**
   * Remove a draft entry for a given otherUserId from a conversations list.
   * Returns a new array.
   */
  export function removeDraftForUser(list, otherUserId) {
    if (!otherUserId) return list || [];
    return (list || []).filter((c) => {
      const id = c._id ?? c.id ?? '';
      if (!String(id).startsWith('draft:')) return true;
      return String(id) !== `draft:${otherUserId}`;
    });
  }
  
  /**
   * Find draft id for a user if present in list.
   */
  export function findDraftIdForUser(list, otherUserId) {
    if (!otherUserId) return null;
    const found = (list || []).find((c) => {
      const id = c._id ?? c.id ?? '';
      return String(id) === `draft:${otherUserId}`;
    });
    return found ? (found._id ?? found.id) : null;
  }
  
  /**
   * Convert last message object / fields into a short preview, preserving original behavior.
   */
  export function previewForLastMessage(c, currentUserId) {
    const m = c.lastMessage ?? null;
    if (m && typeof m === 'object' && m.content) {
      const content = (m.content ?? '').replace(/\s+/g, ' ').trim();
      const senderId = extractSenderId(m);
      const prefix = senderId && String(senderId) === String(currentUserId) ? 'You: ' : '';
      const max = 48;
      if (content.length <= max) return prefix + content;
      return prefix + content.slice(0, max).trim() + '…';
    }
    if (c.lastMessageContent) {
      const text = (c.lastMessageContent ?? '').replace(/\s+/g, ' ').trim();
      const prefix = c.lastMessageSender && String(c.lastMessageSender) === String(currentUserId) ? 'You: ' : '';
      const max = 48;
      if (text.length <= max) return prefix + text;
      return prefix + text.slice(0, max).trim() + '…';
    }
    return '';
  }
  
  export function lastMessageTimeForConv(c) {
    const m = c.lastMessage ?? null;
    if (m && typeof m === 'object' && m.createdAt) return m.createdAt;
    if (c.lastMessageCreatedAt) return c.lastMessageCreatedAt;
    return c.updatedAt ?? null;
  }
  
  export function formatConversationTime(isoOrDate) {
    if (!isoOrDate) return '';
    const d = new Date(isoOrDate);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  