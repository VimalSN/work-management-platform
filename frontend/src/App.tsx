import { useAuth } from './auth/AuthContext';
import { AuthForm } from './components/AuthForm';
import { HealthStatus } from './components/HealthStatus';
import { CreateTeammateForm } from './components/CreateTeammateForm';

function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white shadow rounded-lg p-8 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Work Management Platform</h1>
          <button onClick={() => logout()} className="text-sm text-slate-500 hover:text-slate-800">
            Log out
          </button>
        </div>

        <div className="text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{user.name}</span> ({user.email}) —{' '}
          <span className="font-medium">{user.role}</span>
        </div>

        <HealthStatus />

        {user.role === 'ADMIN' && <CreateTeammateForm />}
      </div>
    </div>
  );
}

export default App;
