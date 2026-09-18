import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL, getAccessToken } from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }

    // auth as a FUNCTION, not a fixed object: socket.io-client calls this
    // fresh on every (re)connection attempt, so a reconnect after the access
    // token has rotated (it's short-lived, 15 minutes) sends the CURRENT
    // token rather than whatever was in memory when the socket first opened.
    const newSocket = io(API_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
    });
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
