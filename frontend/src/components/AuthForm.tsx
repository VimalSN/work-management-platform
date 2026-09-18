import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { GitBranch, ShieldCheck, Waypoints, Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const FEATURES = [
  { icon: GitBranch, text: 'Track dependencies between tasks, not just the tasks themselves' },
  { icon: Zap, text: 'Real-time updates across your whole team, no refresh needed' },
  { icon: ShieldCheck, text: 'Multi-tenant, role-based access enforced end to end' },
];

export function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [organizationName, setOrganizationName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(organizationName, name, email, password);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error?.fieldErrors
          ? formatFieldErrors(err.response.data.error.fieldErrors)
          : err.response?.data?.error || 'Something went wrong',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-slate-50">
      <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-brand-700 to-brand-900 text-white p-12">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Waypoints className="w-7 h-7" />
          Meridian
        </div>
        <div className="space-y-8 max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight">
            See what's blocking your team. Ship together.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-100">
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">A focused, dependency-aware work management platform.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-8 w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-slate-900 md:hidden mb-2">
            <Waypoints className="w-6 h-6 text-brand-600" />
            <span className="font-semibold">Meridian</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {mode === 'login' ? 'Log in' : 'Create your organization'}
          </h1>

          {mode === 'register' && (
            <Field label="Organization name">
              <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
            </Field>
          )}
          {mode === 'register' && (
            <Field label="Your name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={submitting} className="w-full">
            {mode === 'login' ? 'Log in' : 'Register'}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-slate-500 hover:text-slate-700"
            onClick={() => {
              setError(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? "Don't have an organization yet? Register" : 'Already registered? Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function formatFieldErrors(fieldErrors: Record<string, string[]>): string {
  return Object.values(fieldErrors).flat().join(', ');
}
