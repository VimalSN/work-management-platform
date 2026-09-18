import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '../lib/api';
import { CreateTeammateForm } from '../components/CreateTeammateForm';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ROLE_BADGE_COLOR } from '../lib/badgeColors';
import type { OrgUser } from '../types';

export function TeamPage() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<OrgUser[]>('/users')).data,
  });

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Team</h1>
        <p className="text-sm text-slate-500">{users?.length ?? 0} members in your organization.</p>
      </div>

      {users && (
        <Card className="divide-y divide-slate-100">
          {users.map((u) => (
            <div key={u.id} className="p-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-slate-900">{u.name}</div>
                  <div className="text-slate-400 text-xs">{u.email}</div>
                </div>
              </div>
              <Badge color={ROLE_BADGE_COLOR[u.role]}>{u.role}</Badge>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-4">
        <CreateTeammateForm />
      </Card>
    </div>
  );
}
