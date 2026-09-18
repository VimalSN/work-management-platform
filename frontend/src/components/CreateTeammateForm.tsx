import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import type { Role } from '../auth/AuthContext';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'];

// Admin-only widget: proves the authorize() middleware actually works, not
// just that it exists. A non-admin never sees this - the backend would
// reject the request with 403 even if they somehow called it directly.
export function CreateTeammateForm() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('DEVELOPER');

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/users', { name, email, password, role }),
    onSuccess: () => {
      setName('');
      setEmail('');
      setPassword('');
      setRole('DEVELOPER');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      showToast('success', 'Teammate added');
    },
    onError: () => showToast('error', 'Could not add teammate'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Add a teammate (Admin only)</h2>
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Temporary password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={mutation.isPending} className="w-full">
        Add teammate
      </Button>
    </form>
  );
}
