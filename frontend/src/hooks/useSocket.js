import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function useSocket({ token, onReceiveMessage, onMessageSent, onUserConnected, onUserDisconnected, onTyping }){
  const ref = useRef(null)

  useEffect(() => {
    if (!token) return

    const socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket']
    })

    socket.on('connect', () => console.log('socket connected', socket.id))
    socket.on('receive_message', msg => onReceiveMessage?.(msg))
    socket.on('message_sent', msg => onMessageSent?.(msg))
    socket.on('user_connected', payload => onUserConnected?.(payload))
    socket.on('user_disconnected', payload => onUserDisconnected?.(payload))
    socket.on('typing', payload => onTyping?.(payload))
    socket.on('connect_error', err => console.error('socket error', err))

    ref.current = socket
    return () => {
      socket.disconnect()
      ref.current = null
    }
  }, [token, onReceiveMessage, onMessageSent, onUserConnected, onUserDisconnected, onTyping])

  return ref
}
