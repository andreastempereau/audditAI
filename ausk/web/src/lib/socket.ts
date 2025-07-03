import { io, Socket } from 'socket.io-client';
import { ChatMessage } from './api';

// Socket event types
export interface ServerToClientEvents {
  'chat:message': (message: ChatMessage) => void;
  'chat:typing': (data: { userId: string; userName: string; isTyping: boolean }) => void;
  'audit:log': (log: any) => void;
  'org:member-updated': (member: any) => void;
  'indexRebalanced': (data: { timestamp: string; orphanCount: number; fragmentsTotal: number }) => void;
  'uploadProgress': (data: { fileId: string; percent: number }) => void;
  'uploadComplete': (data: { fileId: string; version: number }) => void;
  'fragmentUpdated': (data: { fragmentId: string; newData: any }) => void;
}

export interface ClientToServerEvents {
  'chat:join': (threadId?: string) => void;
  'chat:leave': (threadId?: string) => void;
  'chat:typing': (data: { threadId?: string; isTyping: boolean }) => void;
}

// Create socket instance
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000',
  {
    autoConnect: false,
    auth: (cb) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      cb({ token });
    },
  }
);

// Socket connection management
export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

// Reconnect with new token
export const reconnectSocket = () => {
  socket.auth = (cb) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    cb({ token });
  };
  socket.disconnect();
  socket.connect();
};