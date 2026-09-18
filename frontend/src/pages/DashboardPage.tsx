import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, Gauge, ListTodo } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { STATUS_BADGE_COLOR } from '../lib/badgeColors';
import type { AppNotification, TaskSummary, WorkloadEntry } from '../types';

export function DashboardPage() {
  const { user } = useAuth();

  const { data: myTasks } = useQuery({
    queryKey: ['tasks', 'mine', user?.id],
    queryFn: async () => (await api.get<TaskSummary[]>('/tasks', { params: { assigneeId: user!.id } })).data,
    enabled: !!user,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<AppNotification[]>('/notifications')).data,
  });

  const { data: workload } = useQuery({
    queryKey: ['workload'],
    queryFn: async () => (await api.get<WorkloadEntry[]>('/workload')).data,
  });

  const myWorkload = workload?.find((w) => w.userId === user?.id);
  const openTasks = myTasks?.filter((t) => t.status !== 'DONE') ?? [];
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome back, {user?.name}</h1>
        <p className="text-sm text-slate-500">Here's what's happening across your work.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ListTodo} label="Open tasks assigned to you" value={openTasks.length} />
        <StatCard
          icon={Gauge}
          label="Your workload"
          value={myWorkload ? `${myWorkload.assignedHours}h / ${myWorkload.capacityHours}h` : '—'}
        />
        <StatCard icon={CheckSquare} label="Unread notifications" value={unreadCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Your tasks</h2>
          {openTasks.length === 0 && <p className="text-sm text-slate-400">Nothing assigned to you right now.</p>}
          <ul className="divide-y divide-slate-100">
            {openTasks.map((task) => (
              <li key={task.id} className="py-2 flex items-center justify-between gap-3">
                <Link to={`/projects/${task.projectId}`} className="text-sm text-slate-800 hover:text-brand-700">
                  {task.title}
                </Link>
                <Badge color={STATUS_BADGE_COLOR[task.status]}>{task.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent notifications</h2>
          {notifications?.length === 0 && <p className="text-sm text-slate-400">No notifications yet.</p>}
          <ul className="divide-y divide-slate-100">
            {notifications?.slice(0, 5).map((n) => (
              <li key={n.id} className={`py-2 text-sm ${n.read ? 'text-slate-500' : 'text-slate-900 font-medium'}`}>
                {n.message}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof ListTodo; label: string; value: string | number }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="bg-brand-50 text-brand-600 rounded-md p-2">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xl font-semibold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Card>
  );
}
