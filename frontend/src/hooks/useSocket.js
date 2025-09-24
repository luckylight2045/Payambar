// src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * useSocket({
 *   token,
 *   onReceiveMessage,
 *   onMessageSent,
 *   onUserConnected,
 *   onUserDisconnected,
 *   onTyping,
 *   onOnlineList,
 * })
 *
 * Returns:
 *  { socketRef, isConnected, isConnecting, networkOk }
 *
 * Behavior:
 * - Connect only when token present, page visible, and network probe OK.
 * - Aggressively disconnect on offline / pagehide / visibility hidden to avoid stale sockets.
 * - Exposes connection booleans for UI ("Connecting..." banner).
 *
 * Env (Vite): VITE_SOCKET_URL, VITE_PING_URL, VITE_PING_INTERVAL_MS
 */
export default function useSocket({
  token,
  onReceiveMessage,
  onMessageSent,
  onUserConnected,
  onUserDisconnected,
  onTyping,
  onOnlineList,
}) {
  const socketRef = useRef(null);

  const [networkOk, setNetworkOk] = useState(() => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') return navigator.onLine;
      return true;
    } catch {
      return true;
    }
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Vite env
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const socketUrl = env.VITE_SOCKET_URL ?? 'http://localhost:3000';
  const pingUrl = env.VITE_PING_URL ?? `${socketUrl}/`;
  const pingIntervalMs = (() => {
    const raw = env.VITE_PING_INTERVAL_MS;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 10000;
  })();

  // Basic ping helper
  const doPing = async (url, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store', credentials: 'include' });
      clearTimeout(timer);
      return res && res.status >= 200 && res.status < 400;
    } catch {
      clearTimeout(timer);
      return false;
    }
  };

  // Aggressive disconnect helper
  const strongDisconnect = () => {
    const s = socketRef.current;
    if (!s) {
      setIsConnected(false);
      setIsConnecting(false);
      return;
    }
    try {
      // stop automatic reconnection attempts
      if (typeof s.disconnect === 'function') s.disconnect();
      if (typeof s.close === 'function') s.close();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('strongDisconnect error', err && (err.message || err));
    }
    socketRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
  };

  // Create socket and attach handlers (also sets isConnected/isConnecting)
  const createSocket = (authToken) => {
    if (!authToken) return;
    if (socketRef.current) return;

    setIsConnecting(true);

    const s = io(socketUrl, {
      auth: { token: authToken },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    s.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      // eslint-disable-next-line no-console
      console.log('socket connected', s.id);
    });

    s.on('disconnect', (reason) => {
      setIsConnected(false);
      setIsConnecting(false);
      // eslint-disable-next-line no-console
      console.log('socket disconnected', reason);
    });

    s.on('connect_error', (err) => {
      setIsConnected(false);
      setIsConnecting(false);
      // eslint-disable-next-line no-console
      console.warn('socket connect_error', err && (err.message || err));
    });

    s.on('receive_message', (m) => {
      if (typeof onReceiveMessage === 'function') {
        try { onReceiveMessage(m); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
      }
    });

    s.on('message_sent', (m) => {
      if (typeof onMessageSent === 'function') {
        try { onMessageSent(m); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
      }
    });

    s.on('typing', (p) => {
      if (typeof onTyping === 'function') {
        try { onTyping(p); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
      }
    });

    s.on('online_list', (list) => {
      if (typeof onOnlineList === 'function') {
        try { onOnlineList(list); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
      }
    });

    s.on('user_connected', (payload) => {
      if (typeof onUserConnected === 'function') {
        try { onUserConnected(payload); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
      }
    });

    s.on('user_disconnected', (payload) => {
      if (typeof onUserDisconnected === 'function') {
        try { onUserDisconnected(payload); } catch (e) { /* eslint-disable-next-line no-console */ console.error(e); }
      }
    });

    socketRef.current = s;
  };

  // Ping + visibility + window events effect
  useEffect(() => {
    let mounted = true;
    let pingTimer = null;

    const runPing = async () => {
      const navOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
      if (!navOnline) {
        if (mounted) setNetworkOk(false);
        return;
      }
      const ok = await doPing(pingUrl, 4000);
      if (mounted) setNetworkOk(Boolean(ok));
    };

    const startPingLoop = () => {
      void runPing();
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => { void runPing(); }, pingIntervalMs);
    };

    const stopPingLoop = () => {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    };

    const handleOnline = () => {
      setNetworkOk(true);
      startPingLoop();
    };

    const handleOffline = () => {
      setNetworkOk(false);
      stopPingLoop();
      // when offline, disconnect strongly so backend removes socket quickly
      strongDisconnect();
    };

    const handleVisibility = () => {
      const vis = (typeof document !== 'undefined' && document.visibilityState) ? document.visibilityState : 'visible';
      if (vis === 'visible') {
        void runPing();
        startPingLoop();
      } else {
        // if hidden, stop ping and disconnect (we only want presence when user is on page)
        stopPingLoop();
        strongDisconnect();
      }
    };

    const handlePageHide = () => {
      // pagehide/beforeunload -> strongly disconnect
      strongDisconnect();
    };

    try {
      if (typeof window !== 'undefined' && window) {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('pagehide', handlePageHide, { capture: true });
        window.addEventListener('beforeunload', handlePageHide);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('useSocket: attach listeners failed', err && (err.message || err));
    }

    startPingLoop();

    return () => {
      mounted = false;
      stopPingLoop();
      try {
        if (typeof window !== 'undefined' && window) {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          window.removeEventListener('visibilitychange', handleVisibility);
          window.removeEventListener('pagehide', handlePageHide);
          window.removeEventListener('beforeunload', handlePageHide);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('useSocket: remove listeners failed', err && (err.message || err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch token/network/visibility and connect/disconnect accordingly.
  useEffect(() => {
    const visibility = (typeof document !== 'undefined' && document.visibilityState) ? document.visibilityState : 'visible';
    const shouldConnect = Boolean(token) && visibility === 'visible' && Boolean(networkOk);

    if (shouldConnect) {
      createSocket(token);
      return undefined;
    }

    strongDisconnect();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, networkOk, typeof document !== 'undefined' ? document.visibilityState : 'visible']);

  // Keep isConnected in sync with actual socket state in case external code manipulates socketRef
  useEffect(() => {
    const s = socketRef.current;
    const connected = Boolean(s && s.connected);
    if (connected !== isConnected) setIsConnected(connected);
    // also set isConnecting flag sensibly (if token exists but not connected and network ok)
    const connecting = Boolean(token && !connected && networkOk && (typeof document !== 'undefined' ? document.visibilityState === 'visible' : true));
    if (connecting !== isConnecting) setIsConnecting(connecting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef.current, token, networkOk, typeof document !== 'undefined' ? document.visibilityState : 'visible']);

  return {
    socketRef,
    isConnected,
    isConnecting,
    networkOk,
  };
}
