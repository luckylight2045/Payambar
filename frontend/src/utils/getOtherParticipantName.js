// helper: /src/utils/getOtherParticipantName.js (or inline in component)
export function getOtherParticipantName(conv, currentUserIdOrName) {
    const parts = conv?.participants || [];
  
    // prefer populated participant objects
    for (const p of parts) {
      if (!p) continue;
      if (typeof p === 'object') {
        const pId = p._id?.toString?.() ?? p.id;
        if (pId && pId === (currentUserIdOrName?.toString?.() ?? currentUserIdOrName)) continue;
        if (p.userName) return p.userName;
        if (p.name) return p.name;
        if (pId) return pId.slice(0, 6);
      }
    }
  
    // fallback to string participants (ids)
    const stringOthers = parts.filter((p) => typeof p === 'string' && p !== currentUserIdOrName);
    if (stringOthers.length) return stringOthers[0].slice(0, 6);
  
    // final fallback
    return conv?.name ?? (conv?._id ? conv._id.toString().slice(0, 6) : 'Unknown');
  }
  