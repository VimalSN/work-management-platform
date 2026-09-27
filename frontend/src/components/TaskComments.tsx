import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../socket/SocketContext';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { Comment } from '../types';

export function TaskComments({ taskId, canComment }: { taskId: string; canComment: boolean }) {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { showToast } = useToast();

  const { data: comments } = useQuery({
    queryKey: ['tasks', taskId, 'comments'],
    queryFn: async () => (await api.get<Comment[]>(`/tasks/${taskId}/comments`)).data,
  });

  useEffect(() => {
    if (!socket) return;

    function handleCommentCreated(comment: Comment) {
      // This project's room receives comment events for EVERY task in it,
      // not just this one - filter to the task this component is showing.
      if (comment.taskId !== taskId) return;
      queryClient.setQueryData<Comment[]>(['tasks', taskId, 'comments'], (old) => {
        if (!old) return [comment];
        // The poster's own mutation already refetches on success, so their
        // own comment can arrive twice - once from that refetch, once from
        // this broadcast (which the server sends back to the whole room,
        // sender included). Skip re-adding an id already present.
        if (old.some((c) => c.id === comment.id)) return old;
        return [...old, comment];
      });
    }

    socket.on('comment:created', handleCommentCreated);
    return () => {
      socket.off('comment:created', handleCommentCreated);
    };
  }, [socket, taskId, queryClient]);

  const [body, setBody] = useState('');

  const addComment = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/comments`, { body }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'comments'] });
    },
    onError: () => showToast('error', 'Could not post comment'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (body.trim()) addComment.mutate();
  }

  function initials(name: string) {
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function formatTimestamp(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-3">
        {comments?.length === 0 && <p className="text-slate-400">No comments yet.</p>}
        {comments?.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-medium flex items-center justify-center flex-shrink-0">
              {initials(c.author.name)}
            </div>
            <div className="flex-1 min-w-0 bg-slate-50 rounded-md px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-slate-800">{c.author.name}</span>
                <span className="text-xs text-slate-400">{formatTimestamp(c.createdAt)}</span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      {canComment && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button type="submit" disabled={!body.trim()} loading={addComment.isPending}>
            Post
          </Button>
        </form>
      )}
    </div>
  );
}
