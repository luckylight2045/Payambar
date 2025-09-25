// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * useSocket({ token })
 * - returns a ref object whose current is the socket or null.
 * - handles connect/disconnect lifecycle when token changes.
 * - listens to window 'online'/'offline' to avoid lingering socket attempts while offline.
 *
 * Note: this hook keeps behavior conservative (no global side effects). The consumer
 * should attach event listeners to socketRef.current (e.g. s.on('receive_message', ...)).
 */
export default function useSocket({ token }) {
  const ref = useRef(null);

  useEffect(() => {
    // If no token, ensure socket disconnected & cleared
    if (!token) {
      if (ref.current) {
        try {
          ref.current.removeAllListeners();
          ref.current.disconnect();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[useSocket] disconnect error', e && e.message);
        }
        ref.current = null;
      }
      return;
    }

    // Create socket
    const socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    });

    // Basic debug logging
    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.debug('[useSocket] connected', socket.id);
    });
    socket.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[useSocket] connect_error', err && (err.message || err));
    });
    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.debug('[useSocket] disconnected', reason);
    });

    ref.current = socket;

    // Browser network handlers: when offline, force disconnect; when online try connect.
    const handleOffline = () => {
      try {
        // Immediately disconnect to avoid misleading server-side state.
        socket.disconnect();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useSocket] disconnect on offline failed', e && e.message);
      }
    };

    const handleOnline = () => {
      try {
        // Try to reconnect — server should emit online_list on connect
        socket.connect();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useSocket] connect on online failed', e && e.message);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      try {
        socket.removeAllListeners();
        socket.disconnect();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useSocket] cleanup failed', e && e.message);
      }
      ref.current = null;
    };
  }, [token]);

  return ref;
}
