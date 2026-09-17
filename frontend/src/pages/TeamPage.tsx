import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CreateTeammateForm } from '../components/CreateTeammateForm';
import type { OrgUser } from '../types';

export function TeamPage() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<OrgUser[]>('/users')).data,
  });

  return (
    <div className="space-y-6 max-w-sm">
      <h1 className="text-xl font-semibold text-slate-900">Team</h1>

      {users && (
        <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {users.map((u) => (
            <li key={u.id} className="p-3 flex items-center justify-between text-sm">
              <span>
                {u.name} <span className="text-slate-400">({u.email})</span>
              </span>
              <span className="text-slate-500">{u.role}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <CreateTeammateForm />
      </div>
    </div>
  );
}
