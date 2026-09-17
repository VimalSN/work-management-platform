import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HealthStatus } from './HealthStatus';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-900">Work Management Platform</span>
          <nav className="flex gap-1">
            <NavLink to="/projects" className={navLinkClass}>
              Projects
            </NavLink>
            {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
              <NavLink to="/team" className={navLinkClass}>
                Team
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            {user.name} — <span className="font-medium">{user.role}</span>
          </span>
          <button onClick={() => logout()} className="text-slate-500 hover:text-slate-800">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Outlet />
      </main>

      <footer className="max-w-4xl mx-auto px-6 pb-6">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <HealthStatus />
        </div>
      </footer>
    </div>
  );
}
