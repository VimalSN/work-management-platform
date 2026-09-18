import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { TaskDependencies } from '../components/TaskDependencies';
import { TASK_STATUSES } from '../types';
import type { OrgUser, Project, Task, TaskStatus } from '../types';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['projects', id],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['projects', id, 'tasks'],
    queryFn: async () => (await api.get<Task[]>(`/projects/${id}/tasks`)).data,
  });

  const { data: orgUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<OrgUser[]>('/users')).data,
  });

  function userName(userId: string | null) {
    if (!userId) return 'Unassigned';
    return orgUsers?.find((u) => u.id === userId)?.name || 'Unknown';
  }

  const updateTask = useMutation({
    mutationFn: (vars: { taskId: string; data: Partial<Pick<Task, 'status' | 'assigneeId'>> }) =>
      api.patch(`/tasks/${vars.taskId}`, vars.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] }),
  });

  function handleDeleteTask(task: Task) {
    if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      deleteTask.mutate(task.id);
    }
  }

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const createTask = useMutation({
    mutationFn: () =>
      api.post(`/projects/${id}/tasks`, {
        title,
        description: description || undefined,
        assigneeId: assigneeId || undefined,
      }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setAssigneeId('');
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createTask.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm text-slate-500 hover:text-slate-800">
          ← All projects
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{project?.name ?? 'Project'}</h1>
        {project?.description && <p className="text-sm text-slate-500">{project.description}</p>}
      </div>

      {tasksLoading && <p className="text-slate-500">Loading tasks…</p>}
      {tasks && tasks.length === 0 && <p className="text-slate-500">No tasks yet.</p>}

      {tasks && tasks.length > 0 && (
        <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {tasks.map((task) => {
            const canEditStatus = canManage || user?.id === task.assigneeId;
            return (
              <li key={task.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-900">{task.title}</div>
                    {task.description && <div className="text-sm text-slate-500">{task.description}</div>}
                    <div className="text-xs text-slate-400 mt-1">Assigned to {userName(task.assigneeId)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      className="text-sm text-slate-500 hover:text-slate-800"
                    >
                      {expandedTaskId === task.id ? 'Hide' : 'Dependencies'}
                    </button>
                    <select
                      className="input w-40"
                      value={task.status}
                      disabled={!canEditStatus || updateTask.isPending}
                      onChange={(e) =>
                        updateTask.mutate({ taskId: task.id, data: { status: e.target.value as TaskStatus } })
                      }
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {canManage && (
                      <button
                        onClick={() => handleDeleteTask(task)}
                        disabled={deleteTask.isPending}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {expandedTaskId === task.id && <TaskDependencies taskId={task.id} canManage={canManage} />}
              </li>
            );
          })}
        </ul>
      )}

      {canManage && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 max-w-sm">
          <h2 className="text-sm font-semibold text-slate-700">New task</h2>
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {orgUsers?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={createTask.isPending}
            className="w-full bg-slate-900 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {createTask.isPending ? 'Creating…' : 'Create task'}
          </button>
          {createTask.isError && <p className="text-sm text-red-600">Could not create task</p>}
        </form>
      )}
    </div>
  );
}
