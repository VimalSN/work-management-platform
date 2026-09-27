import { useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, UploadCloud, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import { Modal } from './ui/Modal';
import { LabelsInput } from './ui/LabelsInput';
import { ISSUE_TYPES, PRIORITIES } from '../types';
import type { IssueType, OrgUser, Priority, Task } from '../types';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateTaskModal({
  projectId,
  orgUsers,
  onClose,
}: {
  projectId: string;
  orgUsers: OrgUser[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedResult, setExpectedResult] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('TASK');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingFile(false);
    addFiles(e.dataTransfer.files);
  }

  const createTask = useMutation({
    mutationFn: async () => {
      const { data: task } = await api.post<Task>(
        `/projects/${projectId}/tasks`,
        {
          title,
          description: description || undefined,
          acceptanceCriteria: acceptanceCriteria || undefined,
          stepsToReproduce: issueType === 'BUG' ? stepsToReproduce || undefined : undefined,
          expectedResult: issueType === 'BUG' ? expectedResult || undefined : undefined,
          actualResult: issueType === 'BUG' ? actualResult || undefined : undefined,
          assigneeId: assigneeId || undefined,
          estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
          priority,
          issueType,
          dueDate: dueDate || undefined,
          labels,
        },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      );

      // Attachments are a separate step, on purpose - a file only makes
      // sense to attach to a task that already exists (see backend/src/
      // routes/tasks.ts's /:id/attachments routes), so this fires once the
      // task above is confirmed created, not bundled into the same request.
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post(`/tasks/${task.id}/attachments`, formData);
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] });
      showToast('success', files.length > 0 ? `Task created with ${files.length} attachment(s)` : 'Task created');
      onClose();
    },
    onError: () => showToast('error', 'Could not create task'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createTask.mutate();
  }

  return (
    <Modal title="New task" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>

        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Description (optional)</span>
          <textarea
            className="input min-h-24 resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs to be done?"
          />
        </label>

        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Acceptance criteria (optional)</span>
          <textarea
            className="input min-h-16 resize-y"
            value={acceptanceCriteria}
            onChange={(e) => setAcceptanceCriteria(e.target.value)}
            placeholder="What does &quot;done&quot; look like for this task?"
          />
        </label>

        {issueType === 'BUG' && (
          <>
            <label className="block text-sm">
              <span className="text-slate-500 text-xs">Steps to reproduce (optional)</span>
              <textarea
                className="input min-h-16 resize-y"
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                placeholder={'1. …\n2. …\n3. …'}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Expected result (optional)</span>
                <textarea
                  className="input min-h-14 resize-y"
                  value={expectedResult}
                  onChange={(e) => setExpectedResult(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Actual result (optional)</span>
                <textarea
                  className="input min-h-14 resize-y"
                  value={actualResult}
                  onChange={(e) => setActualResult(e.target.value)}
                />
              </label>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block text-sm">
            <span className="text-slate-500 text-xs">Type</span>
            <Select value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 text-xs">Priority</span>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 text-xs">Assignee</span>
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {orgUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            {user && assigneeId !== user.id && (
              <button
                type="button"
                onClick={() => setAssigneeId(user.id)}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-1"
              >
                Assign to me
              </button>
            )}
          </label>
          <label className="block text-sm">
            <span className="text-slate-500 text-xs">Due date</span>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>

        <label className="block text-sm max-w-[10rem]">
          <span className="text-slate-500 text-xs">Estimated hours</span>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </label>

        <div className="text-sm">
          <span className="text-slate-500 text-xs">Labels</span>
          <div className="mt-1">
            <LabelsInput labels={labels} onChange={setLabels} />
          </div>
        </div>

        <div className="text-sm">
          <span className="text-slate-500 text-xs">Attachments (optional)</span>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={handleDrop}
            className={`mt-1 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
              isDraggingFile ? 'border-brand-400 bg-brand-50' : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <UploadCloud className="w-5 h-5 text-slate-400" />
            <p className="text-xs text-slate-500">
              Drop files here, or <span className="text-brand-600 font-medium">browse</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between gap-2 bg-slate-50 rounded px-2 py-1 text-xs"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Paperclip className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-slate-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-600 flex-shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createTask.isPending} disabled={!title.trim()}>
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
