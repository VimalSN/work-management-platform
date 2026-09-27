import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { CreateTeamMemberModal } from '../components/CreateTeamMemberModal';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ROLE_BADGE_COLOR } from '../lib/badgeColors';
import type { OrgUser } from '../types';

export function TeamPage() {
  // The backend only lets ADMIN create users (POST /auth/users) - Manager
  // can view this page (see App.tsx's RequireRole) but was never actually
  // meant to see the add-member action.
  const { user } = useAuth();
  const canAddMembers = user?.role === 'ADMIN';
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<OrgUser[]>('/users')).data,
  });

  return (
    <div className="space-y-6 max-w-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500">{users?.length ?? 0} members in your organization.</p>
        </div>
        {canAddMembers && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowAddModal(true)}>
            Add member
          </Button>
        )}
      </div>

      {canAddMembers && showAddModal && <CreateTeamMemberModal onClose={() => setShowAddModal(false)} />}

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
    </div>
  );
}
