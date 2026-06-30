'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

/**
 * Returns the shared socket plus its connection state. Use this for
 * status indicators or to decide whether to render real-time UI.
 */
export function useSocket() {
  const socket = getSocket();
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  return { socket, connected };
}

/**
 * Subscribe to a single server event for the lifetime of the component.
 * The handler ref is updated in place so callers don't need to memoise.
 */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const wrapped = (payload: T) => handlerRef.current(payload);
    socket.on(event, wrapped);
    return () => { socket.off(event, wrapped); };
  }, [event]);
}

/**
 * Join a server-side room for the lifetime of the component. The backend is
 * expected to listen for 'join'/'leave' with the room name.
 */
export function useSocketRoom(room: string | null | undefined) {
  useEffect(() => {
    if (!room) return;
    const socket = getSocket();
    const join = () => socket.emit('join', room);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.emit('leave', room);
      socket.off('connect', join);
    };
  }, [room]);
}
