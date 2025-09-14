/* eslint-disable no-empty */
// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * useSocket({ token, onReceiveMessage, onMessageSent, onUserConnected, onUserDisconnected, onTyping })
 * returns a ref: { current: socket }
 */
export default function useSocket({ token, onReceiveMessage, onMessageSent, onUserConnected, onUserDisconnected, onTyping }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!token) return;
    const socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect', () => console.log('socket connected', socket.id));
    socket.on('receive_message', (m) => onReceiveMessage?.(m));
    socket.on('message_sent', (m) => onMessageSent?.(m));
    socket.on('user_connected', (p) => onUserConnected?.(p));
    socket.on('user_disconnected', (p) => onUserDisconnected?.(p));
    socket.on('typing', (p) => onTyping?.(p));
    socket.on('connect_error', (err) => console.error('socket error', err));

    ref.current = socket;
    return () => {
      try { socket.disconnect(); } catch {}
      ref.current = null;
    };
  }, [token, onReceiveMessage, onMessageSent, onUserConnected, onUserDisconnected, onTyping]);

  return ref;
}
