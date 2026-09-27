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
import { Avatar } from '../components/ui/Avatar';
import { InlineSelect } from '../components/ui/InlineSelect';
import type { InlineSelectOption } from '../components/ui/InlineSelect';
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
    | 'reporterId'
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

  const statusOptions: InlineSelectOption[] = TASK_STATUSES.map((s) => ({
    value: s,
    label: s,
    render: <Badge color={STATUS_BADGE_COLOR[s]}>{s}</Badge>,
  }));
  const priorityOptions: InlineSelectOption[] = PRIORITIES.map((p) => {
    const label = p.charAt(0) + p.slice(1).toLowerCase();
    return { value: p, label, render: <Badge color={PRIORITY_BADGE_COLOR[p]}>{label}</Badge> };
  });
  const issueTypeOptions: InlineSelectOption[] = ISSUE_TYPES.map((t) => {
    const Icon = ISSUE_TYPE_ICON[t];
    const label = t.charAt(0) + t.slice(1).toLowerCase();
    return {
      value: t,
      label,
      render: (
        <span className="flex items-center gap-1.5">
          <Icon className="w-4 h-4 text-slate-400" />
          {label}
        </span>
      ),
    };
  });
  const userOptions: InlineSelectOption[] = (orgUsers ?? []).map((u) => ({
    value: u.id,
    label: u.name,
    render: (
      <span className="flex items-center gap-2">
        <Avatar name={u.name} size="sm" />
        {u.name}
      </span>
    ),
  }));

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
            <div className="text-sm">
              <span className="text-slate-500 text-xs">Status</span>
              <InlineSelect
                value={task.status}
                options={statusOptions}
                disabled={!canEdit || updateTask.isPending}
                onChange={(v) => updateTask.mutate({ status: v as TaskStatus })}
              />
            </div>

            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Details</h3>

            <div className="text-sm">
              <span className="text-slate-500 text-xs">Assignee</span>
              <InlineSelect
                value={task.assigneeId ?? ''}
                options={userOptions}
                disabled={!canManage || updateTask.isPending}
                allowClear
                clearLabel="Unassigned"
                placeholder="Unassigned"
                onChange={(v) => updateTask.mutate({ assigneeId: v || null })}
              />
              {canManage && task.assigneeId !== user?.id && (
                <button
                  type="button"
                  onClick={() => updateTask.mutate({ assigneeId: user!.id })}
                  disabled={updateTask.isPending}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium px-1"
                >
                  Assign to me
                </button>
              )}
            </div>

            <div className="text-sm">
              <span className="text-slate-500 text-xs">Reporter</span>
              <InlineSelect
                value={task.reporterId ?? ''}
                options={userOptions}
                disabled={!canManage || updateTask.isPending}
                placeholder="Unknown"
                onChange={(v) => updateTask.mutate({ reporterId: v || null })}
              />
            </div>

            <div className="text-sm">
              <span className="text-slate-500 text-xs">Priority</span>
              <InlineSelect
                value={task.priority}
                options={priorityOptions}
                disabled={!canEdit || updateTask.isPending}
                onChange={(v) => updateTask.mutate({ priority: v as Priority })}
              />
            </div>

            <div className="text-sm">
              <span className="text-slate-500 text-xs">Type</span>
              <InlineSelect
                value={task.issueType}
                options={issueTypeOptions}
                disabled={!canManage || updateTask.isPending}
                onChange={(v) => updateTask.mutate({ issueType: v as IssueType })}
              />
            </div>

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
