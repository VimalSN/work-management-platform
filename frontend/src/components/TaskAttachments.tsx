import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../socket/SocketContext';
import { useToast } from './ui/ToastContext';
import type { Attachment } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachments({
  taskId,
  canUpload,
  isManager,
}: {
  taskId: string;
  canUpload: boolean;
  isManager: boolean;
}) {
  const { user } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: attachments } = useQuery({
    queryKey: ['tasks', taskId, 'attachments'],
    queryFn: async () => (await api.get<Attachment[]>(`/tasks/${taskId}/attachments`)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'attachments'] });

  useEffect(() => {
    if (!socket) return;

    function handleAttachmentEvent(payload: { taskId: string }) {
      if (payload.taskId !== taskId) return;
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'attachments'] });
    }

    socket.on('attachment:created', handleAttachmentEvent);
    socket.on('attachment:deleted', handleAttachmentEvent);
    return () => {
      socket.off('attachment:created', handleAttachmentEvent);
      socket.off('attachment:deleted', handleAttachmentEvent);
    };
  }, [socket, taskId, queryClient]);

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/tasks/${taskId}/attachments`, formData);
    },
    onSuccess: invalidate,
    onError: () => showToast('error', 'Could not upload file'),
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: string) => api.delete(`/tasks/${taskId}/attachments/${attachmentId}`),
    onSuccess: invalidate,
    onError: () => showToast('error', 'Could not remove attachment'),
  });

  // The download link needs the same Bearer token every other request
  // does, which a plain <a href> can't attach - so this fetches the file
  // through the authenticated `api` client as a blob, then hands the
  // browser a throwaway object URL to save it from.
  async function handleDownload(attachment: Attachment) {
    const res = await api.get(`/tasks/${taskId}/attachments/${attachment.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleFileChange(fileList: FileList | null) {
    if (!fileList) return;
    Array.from(fileList).forEach((file) => uploadAttachment.mutate(file));
  }

  return (
    <div className="space-y-2 text-sm">
      {attachments && attachments.length === 0 && !canUpload && (
        <p className="text-slate-400">No attachments.</p>
      )}

      {attachments && attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-2 bg-slate-50 rounded px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => handleDownload(attachment)}
                className="flex items-center gap-1.5 min-w-0 text-left hover:text-brand-700"
              >
                <Paperclip className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <span className="truncate">{attachment.filename}</span>
                <span className="text-slate-400 text-xs flex-shrink-0">{formatFileSize(attachment.size)}</span>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(attachment)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label={`Download ${attachment.filename}`}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {(attachment.uploadedBy.id === user?.id || isManager) && (
                  <button
                    type="button"
                    onClick={() => deleteAttachment.mutate(attachment.id)}
                    disabled={deleteAttachment.isPending}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${attachment.filename}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
          className="flex items-center gap-1.5 text-brand-600 hover:text-brand-700 text-xs font-medium disabled:opacity-50"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          {uploadAttachment.isPending ? 'Uploading…' : 'Attach a file'}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileChange(e.target.files)}
      />
    </div>
  );
}
