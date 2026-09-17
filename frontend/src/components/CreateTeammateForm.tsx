import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Role } from '../auth/AuthContext';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'];

// Admin-only widget: proves the authorize() middleware actually works, not
// just that it exists. A non-admin never sees this - the backend would
// reject the request with 403 even if they somehow called it directly.
export function CreateTeammateForm() {
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
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Add a teammate (Admin only)</h2>
      <input
        className="input"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="input"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="Temporary password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-slate-900 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
      >
        {mutation.isPending ? 'Adding…' : 'Add teammate'}
      </button>
      {mutation.isError && <p className="text-sm text-red-600">Could not add teammate</p>}
      {mutation.isSuccess && <p className="text-sm text-green-600">Teammate added</p>}
    </form>
  );
}
