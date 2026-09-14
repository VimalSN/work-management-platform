import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

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
      setError(err.response?.data?.error?.fieldErrors ? formatFieldErrors(err.response.data.error.fieldErrors) : err.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">
          {mode === 'login' ? 'Log in' : 'Create your organization'}
        </h1>

        {mode === 'register' && (
          <Field label="Organization name">
            <input
              className="input"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
            />
          </Field>
        )}
        {mode === 'register' && (
          <Field label="Your name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}
        <Field label="Email">
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-slate-900 text-white rounded py-2 font-medium disabled:opacity-50"
        >
          {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Register'}
        </button>

        <button
          type="button"
          className="w-full text-sm text-slate-500"
          onClick={() => {
            setError(null);
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? "Don't have an organization yet? Register" : 'Already registered? Log in'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
