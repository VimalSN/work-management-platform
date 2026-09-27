import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { InlineSelect } from './ui/InlineSelect';
import type { InlineSelectOption } from './ui/InlineSelect';
import { ROLE_BADGE_COLOR } from '../lib/badgeColors';
import type { Role } from '../auth/AuthContext';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'];
const ROLE_OPTIONS: InlineSelectOption[] = ROLES.map((r) => ({
  value: r,
  label: r,
  render: <Badge color={ROLE_BADGE_COLOR[r]}>{r}</Badge>,
}));

// Admin-only widget: proves the authorize() middleware actually works, not
// just that it exists. A non-admin never sees this - the backend would
// reject the request with 403 even if they somehow called it directly.
export function CreateTeamMemberModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('DEVELOPER');

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/users', { name, email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('success', 'Team member added');
      onClose();
    },
    onError: () => showToast('error', 'Could not add team member'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title="Add a team member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Email</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Temporary password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500 text-xs">Role</span>
          <InlineSelect variant="bordered" value={role} options={ROLE_OPTIONS} onChange={(v) => setRole(v as Role)} />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={!name.trim() || !email.trim()}>
            Add team member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
