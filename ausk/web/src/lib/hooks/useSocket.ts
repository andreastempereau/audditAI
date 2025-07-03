import { useEffect, useRef } from 'react';
import { socket, ServerToClientEvents } from '../socket';

export function useSocket() {
  return socket;
}

export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K]
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const eventHandler = (...args: Parameters<ServerToClientEvents[K]>) => {
      (handlerRef.current as any)(...args);
    };

    socket.on(event, eventHandler as any);
    return () => {
      socket.off(event, eventHandler as any);
    };
  }, [event]);
}

export function useChatStream(threadId?: string) {
  const socket = useSocket();

  useEffect(() => {
    socket.emit('chat:join', threadId);
    return () => {
      socket.emit('chat:leave', threadId);
    };
  }, [socket, threadId]);

  const sendTyping = (isTyping: boolean) => {
    socket.emit('chat:typing', { threadId, isTyping });
  };

  return { sendTyping };
}