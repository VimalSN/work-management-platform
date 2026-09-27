import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../socket/SocketContext';
import { useToast } from '../components/ui/ToastContext';
import { debounce } from '../lib/debounce';
import { TaskCard } from '../components/TaskCard';
import { TaskColumn } from '../components/TaskColumn';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { Button } from '../components/ui/Button';
import { TASK_STATUSES } from '../types';
import type { OrgUser, Project, Task, TaskStatus } from '../types';

const COLUMN_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  DONE: 'Done',
};

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { showToast } = useToast();

  // Without a minimum drag distance, the pointer sensor treats every
  // pointer-down as a potential drag and intercepts it before a plain click
  // (zero movement) can register - so clicking a card to open it would
  // never fire onClick. Requiring 8px of movement before a drag "activates"
  // lets a real click pass through untouched while still recognizing drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: project } = useQuery({
    queryKey: ['projects', id],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['projects', id, 'tasks'],
    queryFn: async () => (await api.get<Task[]>(`/projects/${id}/tasks`)).data,
  });

  useEffect(() => {
    if (!socket || !id) return;

    function join() {
      socket!.emit('join-project', id);
    }

    // 'connect' fires on the FIRST connection and again on every reconnect
    // (e.g. after a dropped WiFi connection comes back). Room membership
    // isn't remembered across a disconnect - a reconnect is a new
    // connection as far as the server is concerned, so it has to be
    // rejoined explicitly every time, not just once on mount.
    join();
    socket.on('connect', join);

    // Debounced: several task events landing within the same burst (e.g.
    // someone bulk-updating a handful of tasks) collapse into one refetch
    // once the burst settles, not one refetch per event.
    const refetchTasks = debounce(() => {
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
    }, 300);

    socket.on('task:created', refetchTasks);
    socket.on('task:updated', refetchTasks);
    socket.on('task:deleted', refetchTasks);

    return () => {
      socket.emit('leave-project', id);
      socket.off('connect', join);
      socket.off('task:created', refetchTasks);
      socket.off('task:updated', refetchTasks);
      socket.off('task:deleted', refetchTasks);
    };
  }, [socket, id, queryClient]);

  const { data: orgUsers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<OrgUser[]>('/users')).data,
  });

  function userName(userId: string | null) {
    if (!userId) return 'Unassigned';
    return orgUsers?.find((u) => u.id === userId)?.name || 'Unknown';
  }

  // Only status changes ever happen from the board itself (via drag and
  // drop) - every other field is edited on the task's own detail page now.
  const updateTaskStatus = useMutation({
    mutationFn: (vars: { taskId: string; status: TaskStatus; version: number }) =>
      api.patch(`/tasks/${vars.taskId}`, { status: vars.status, version: vars.version }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['projects', id, 'tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['projects', id, 'tasks']);
      queryClient.setQueryData<Task[]>(['projects', id, 'tasks'], (old) =>
        old?.map((t) => (t.id === vars.taskId ? { ...t, status: vars.status } : t)),
      );
      return { previousTasks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['projects', id, 'tasks'], context.previousTasks);
      }
      if (err.response?.status === 409) {
        showToast('error', 'This task was changed by someone else - showing the latest version.');
        queryClient.invalidateQueries({ queryKey: ['projects', id, 'tasks'] });
      } else {
        showToast('error', 'Could not update task');
      }
    },
  });

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeDragTask = tasks?.find((t) => t.id === activeDragId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const taskId = String(event.active.id);
    const newStatus = event.over?.id as TaskStatus | undefined;
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || !newStatus || task.status === newStatus) return;
    updateTaskStatus.mutate({ taskId, status: newStatus, version: task.version });
  }

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState('');

  const visibleTasks = useMemo(() => {
    if (!tasks) return tasks;
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((t) => {
      const assignee = orgUsers?.find((u) => u.id === t.assigneeId)?.name ?? 'Unassigned';
      return t.title.toLowerCase().includes(query) || assignee.toLowerCase().includes(query);
    });
  }, [tasks, search, orgUsers]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/projects" className="text-sm text-slate-500 hover:text-slate-800">
            ← All projects
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{project?.name ?? 'Project'}</h1>
          {project?.description && <p className="text-sm text-slate-500">{project.description}</p>}
        </div>
        {canManage && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            New task
          </Button>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal projectId={id!} orgUsers={orgUsers ?? []} onClose={() => setShowCreateModal(false)} />
      )}

      {tasks && tasks.length > 0 && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
            placeholder="Search this board…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {tasksLoading && <p className="text-slate-500">Loading tasks…</p>}

      {visibleTasks && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {TASK_STATUSES.map((status) => {
              const columnTasks = visibleTasks.filter((t) => t.status === status);
              return (
                <TaskColumn key={status} status={status} label={COLUMN_LABELS[status]} count={columnTasks.length}>
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      assigneeName={userName(task.assigneeId)}
                      draggable={canManage || user?.id === task.assigneeId}
                      onOpen={() => navigate(`/tasks/${task.id}`)}
                    />
                  ))}
                </TaskColumn>
              );
            })}
          </div>
          <DragOverlay>
            {activeDragTask && (
              <TaskCard
                task={activeDragTask}
                assigneeName={userName(activeDragTask.assigneeId)}
                draggable
                onOpen={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
