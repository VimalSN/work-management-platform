import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../socket/SocketContext';
import type { Comment } from '../types';

export function TaskComments({ taskId, canComment }: { taskId: string; canComment: boolean }) {
  const queryClient = useQueryClient();
  const socket = useSocket();

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
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (body.trim()) addComment.mutate();
  }

  return (
    <div className="mt-3 pl-4 border-l-2 border-slate-100 space-y-2 text-sm">
      <div className="space-y-1">
        {comments?.length === 0 && <p className="text-slate-400">No comments yet.</p>}
        {comments?.map((c) => (
          <div key={c.id} className="text-slate-700">
            <span className="font-medium">{c.author.name}:</span> {c.body}
          </div>
        ))}
      </div>
      {canComment && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Add a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button
            type="submit"
            disabled={addComment.isPending || !body.trim()}
            className="text-sm bg-slate-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
          >
            Post
          </button>
        </form>
      )}
    </div>
  );
}
