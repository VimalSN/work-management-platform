import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../socket/SocketContext';
import { useToast } from '../components/ui/ToastContext';
import { useConfirm } from '../components/ui/ConfirmContext';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Input';
import { LabelsInput } from '../components/ui/LabelsInput';
import { RowMenu } from '../components/ui/RowMenu';
import { TaskAttachments } from '../components/TaskAttachments';
import { TaskDependencies } from '../components/TaskDependencies';
import { TaskComments } from '../components/TaskComments';
import { ISSUE_TYPE_ICON } from '../lib/issueTypeIcons';
import { PRIORITY_BADGE_COLOR, STATUS_BADGE_COLOR } from '../lib/badgeColors';
import { ISSUE_TYPES, PRIORITIES, TASK_STATUSES } from '../types';
import type { IssueType, OrgUser, Priority, Project, Task, TaskStatus } from '../types';

type TaskUpdate = Partial<
  Pick<
    Task,
    | 'status'
    | 'assigneeId'
    | 'priority'
    | 'issueType'
    | 'dueDate'
    | 'labels'
    | 'description'
    | 'acceptanceCriteria'
    | 'stepsToReproduce'
    | 'expectedResult'
    | 'actualResult'
  >
>;

// Rendered with key={task.id} by the parent, below - React's own recommended
// way to "reset state when an identity changes" is to let the key change
// force a full remount, rather than reaching for an effect or a ref to
// detect the change by hand. Each draft below then only ever needs to
// initialize once per mount (i.e. once per task) and is otherwise free to
// diverge from `task` while the user is actively typing - a background
// refetch of the SAME task (e.g. someone else's comment arriving over the
// socket) never wipes out an in-progress edit, because it doesn't remount
// this component.
function TaskContentFields({
  task,
  canEdit,
  onSave,
}: {
  task: Task;
  canEdit: boolean;
  onSave: (field: keyof TaskUpdate, draft: string, original: string | null) => void;
}) {
  const [description, setDescription] = useState(task.description ?? '');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(task.acceptanceCriteria ?? '');
  const [stepsToReproduce, setStepsToReproduce] = useState(task.stepsToReproduce ?? '');
  const [expectedResult, setExpectedResult] = useState(task.expectedResult ?? '');
  const [actualResult, setActualResult] = useState(task.actualResult ?? '');
  const isBug = task.issueType === 'BUG';

  return (
    <>
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Description</h2>
        <textarea
          className="input min-h-24 resize-y"
          value={description}
          disabled={!canEdit}
          placeholder={canEdit ? 'Add a description…' : 'No description'}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => onSave('description', description, task.description)}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Acceptance criteria</h2>
        <textarea
          className="input min-h-20 resize-y"
          value={acceptanceCriteria}
          disabled={!canEdit}
          placeholder={canEdit ? 'What does "done" look like for this task?' : 'None set'}
          onChange={(e) => setAcceptanceCriteria(e.target.value)}
          onBlur={() => onSave('acceptanceCriteria', acceptanceCriteria, task.acceptanceCriteria)}
        />
      </section>

      {isBug && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Steps to reproduce</h2>
            <textarea
              className="input min-h-20 resize-y"
              value={stepsToReproduce}
              disabled={!canEdit}
              placeholder={canEdit ? '1. …\n2. …\n3. …' : 'Not provided'}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              onBlur={() => onSave('stepsToReproduce', stepsToReproduce, task.stepsToReproduce)}
            />
          </section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Expected result</h2>
              <textarea
                className="input min-h-16 resize-y"
                value={expectedResult}
                disabled={!canEdit}
                placeholder={canEdit ? 'What should happen' : 'Not provided'}
                onChange={(e) => setExpectedResult(e.target.value)}
                onBlur={() => onSave('expectedResult', expectedResult, task.expectedResult)}
              />
            </section>
            <section>
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Actual result</h2>
              <textarea
                className="input min-h-16 resize-y"
                value={actualResult}
                disabled={!canEdit}
                placeholder={canEdit ? 'What actually happens' : 'Not provided'}
                onChange={(e) => setActualResult(e.target.value)}
                onBlur={() => onSave('actualResult', actualResult, task.actualResult)}
              />
            </section>
          </div>
        </>
      )}
    </>
  );
}

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { data: task, isLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => (await api.get<Task>(`/tasks/${id}`)).data,
  });

  const projectId = task?.projectId;

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => (await api.get<Project>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
  });

  const { data: orgUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<OrgUser[]>('/users')).data,
  });

  function userName(userId: string | null) {
    if (!userId) return 'Unassigned';
    return orgUsers?.find((u) => u.id === userId)?.name || 'Unknown';
  }

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit('join-project', projectId);

    function handleUpdated(updated: Task) {
      if (updated.id !== id) return;
      queryClient.setQueryData(['tasks', id], updated);
    }
    function handleDeleted(payload: { id: string }) {
      if (payload.id !== id) return;
      showToast('error', 'This task was deleted');
      navigate(`/projects/${projectId}`);
    }

    socket.on('task:updated', handleUpdated);
    socket.on('task:deleted', handleDeleted);
    return () => {
      socket.emit('leave-project', projectId);
      socket.off('task:updated', handleUpdated);
      socket.off('task:deleted', handleDeleted);
    };
  }, [socket, projectId, id, queryClient, navigate, showToast]);

  const updateTask = useMutation({
    mutationFn: (data: TaskUpdate) => api.patch<Task>(`/tasks/${id}`, { ...data, version: task!.version }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', id] });
      const previous = queryClient.getQueryData<Task>(['tasks', id]);
      queryClient.setQueryData<Task>(['tasks', id], (old) => (old ? { ...old, ...data } : old));
      return { previous };
    },
    onSuccess: (res) => {
      queryClient.setQueryData(['tasks', id], res.data);
    },
    onError: (err: any, _data, context) => {
      if (context?.previous) queryClient.setQueryData(['tasks', id], context.previous);
      if (err.response?.status === 409) {
        showToast('error', 'This task was changed by someone else - showing the latest version.');
        queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      } else {
        showToast('error', 'Could not update task');
      }
    },
  });

  const deleteTask = useMutation({
    mutationFn: () => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      showToast('success', 'Task deleted');
      navigate(`/projects/${projectId}`);
    },
    onError: () => showToast('error', 'Could not delete task'),
  });

  async function handleDelete() {
    if (!task) return;
    const confirmed = await confirm({
      title: 'Delete task',
      message: `Delete "${task.title}"? This cannot be undone.`,
      danger: true,
    });
    if (confirmed) deleteTask.mutate();
  }

  function saveIfChanged(field: keyof TaskUpdate, draft: string, original: string | null) {
    const normalized = draft.trim() ? draft : null;
    if (normalized !== (original ?? null)) {
      updateTask.mutate({ [field]: normalized } as TaskUpdate);
    }
  }

  if (isLoading) return <p className="text-slate-500">Loading task…</p>;
  if (!task) return <p className="text-slate-500">Task not found.</p>;

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canComment = user?.role !== 'VIEWER';
  const canEdit = canManage || user?.id === task.assigneeId;
  const IssueIcon = ISSUE_TYPE_ICON[task.issueType];
  const isOverdue = task.dueDate != null && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <Link
          to={projectId ? `/projects/${projectId}` : '/projects'}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← {project?.name ?? 'Project'}
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2 min-w-0">
          <IssueIcon className="w-5 h-5 mt-1 flex-shrink-0 text-slate-400" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 break-words">{task.title}</h1>
            <p className="text-xs text-slate-400">
              {task.issueType.charAt(0) + task.issueType.slice(1).toLowerCase()}
              {task.reporterId && ` · Reported by ${userName(task.reporterId)}`}
            </p>
          </div>
        </div>
        {canManage && (
          <RowMenu
            items={[{ label: 'Delete task', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: handleDelete }]}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <TaskContentFields key={task.id} task={task} canEdit={canEdit} onSave={saveIfChanged} />

          <section className="border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Attachments</h2>
            <TaskAttachments taskId={task.id} canUpload={canComment} isManager={canManage} />
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Dependencies</h2>
            <TaskDependencies taskId={task.id} canManage={canManage} />
          </section>

          <section className="border-t border-slate-100 pt-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Activity</h2>
            <TaskComments taskId={task.id} canComment={canComment} />
          </section>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-md p-4 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-500 text-xs">Status</span>
              <Select
                value={task.status}
                disabled={!canEdit || updateTask.isPending}
                onChange={(e) => updateTask.mutate({ status: e.target.value as TaskStatus })}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <div className="mt-1">
                <Badge color={STATUS_BADGE_COLOR[task.status]}>{task.status}</Badge>
              </div>
            </label>

            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Details</h3>

            <label className="block text-sm">
              <span className="text-slate-500 text-xs">Assignee</span>
              <Select
                value={task.assigneeId ?? ''}
                disabled={!canManage || updateTask.isPending}
                onChange={(e) => updateTask.mutate({ assigneeId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {orgUsers?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              {canManage && task.assigneeId !== user?.id && (
                <button
                  type="button"
                  onClick={() => updateTask.mutate({ assigneeId: user!.id })}
                  disabled={updateTask.isPending}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium mt-1"
                >
                  Assign to me
                </button>
              )}
            </label>

            <div className="text-sm">
              <span className="text-slate-500 text-xs">Reporter</span>
              <p className="text-slate-700 py-1">{task.reporterId ? userName(task.reporterId) : '—'}</p>
            </div>

            <label className="block text-sm">
              <span className="text-slate-500 text-xs">Priority</span>
              <Select
                value={task.priority}
                disabled={!canEdit || updateTask.isPending}
                onChange={(e) => updateTask.mutate({ priority: e.target.value as Priority })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
              <div className="mt-1">
                <Badge color={PRIORITY_BADGE_COLOR[task.priority]}>
                  {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                </Badge>
              </div>
            </label>

            <label className="block text-sm">
              <span className="text-slate-500 text-xs">Type</span>
              <Select
                value={task.issueType}
                disabled={!canManage || updateTask.isPending}
                onChange={(e) => updateTask.mutate({ issueType: e.target.value as IssueType })}
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block text-sm">
              <span className="text-slate-500 text-xs">Due date</span>
              <input
                type="date"
                className={`input ${isOverdue ? 'text-red-600 border-red-300' : ''}`}
                value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                disabled={!canEdit || updateTask.isPending}
                onChange={(e) =>
                  updateTask.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
              />
            </label>

            {task.estimatedHours != null && (
              <div className="text-sm">
                <span className="text-slate-500 text-xs">Estimated</span>
                <p className="text-slate-700 py-1">{task.estimatedHours}h</p>
              </div>
            )}

            <div className="text-sm">
              <span className="text-slate-500 text-xs">Labels</span>
              <div className="mt-1">
                <LabelsInput
                  labels={task.labels}
                  onChange={(labels) => updateTask.mutate({ labels })}
                  readOnly={!canEdit || updateTask.isPending}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
