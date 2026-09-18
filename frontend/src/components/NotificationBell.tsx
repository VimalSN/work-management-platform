import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../socket/SocketContext';
import type { AppNotification } from '../types';

export function NotificationBell() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<AppNotification[]>('/notifications')).data,
  });

  useEffect(() => {
    // Personal notifications aren't tied to any one project's room - the
    // server joins every socket to its own user:<id> room automatically on
    // connect, so no explicit join/leave is needed here the way project
    // rooms need one.
    if (!socket) return;
    function handleCreated(notification: AppNotification) {
      queryClient.setQueryData<AppNotification[]>(['notifications'], (old) =>
        old ? [notification, ...old] : [notification],
      );
    }
    socket.on('notification:created', handleCreated);
    return () => {
      socket.off('notification:created', handleCreated);
    };
  }, [socket, queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-slate-500 hover:text-slate-800 text-sm">
        Notifications
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center bg-red-600 text-white text-xs rounded-full w-5 h-5">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
          <div className="flex items-center justify-between p-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications?.length === 0 && <p className="p-3 text-sm text-slate-400">No notifications yet.</p>}
            {notifications?.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead.mutate(n.id)}
                className={`w-full text-left p-3 text-sm ${n.read ? 'text-slate-500' : 'bg-slate-50 text-slate-900 font-medium'}`}
              >
                {n.message}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
