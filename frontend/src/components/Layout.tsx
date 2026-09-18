import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Waypoints, Menu, X, LogOut, LayoutDashboard, FolderKanban, Gauge, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { HealthStatus } from './HealthStatus';
import { NotificationBell } from './NotificationBell';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/workload', label: 'Workload', icon: Gauge },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (!user) return null;

  const canSeeTeam = user.role === 'ADMIN' || user.role === 'MANAGER';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            className="md:hidden text-slate-600 hover:text-slate-900"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 text-slate-900">
            <Waypoints className="w-6 h-6 text-brand-600" />
            <span className="font-semibold">Meridian</span>
          </div>
          <nav className="hidden md:flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            {canSeeTeam && (
              <NavLink to="/team" className={navLinkClass}>
                <Users className="w-4 h-4" />
                Team
              </NavLink>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          <NotificationBell />
          <span className="hidden sm:inline text-slate-600">
            {user.name} — <span className="font-medium">{user.role}</span>
          </span>
          <button
            onClick={() => logout()}
            className="text-slate-500 hover:text-slate-800 flex items-center gap-1"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      {/* Mobile slide-out drawer - the header's nav links collapse behind
          the hamburger button below the md breakpoint, reappearing here
          instead of being hidden entirely. */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl p-4 space-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Waypoints className="w-5 h-5 text-brand-600" />
                <span className="font-semibold">Meridian</span>
              </div>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            {canSeeTeam && (
              <NavLink to="/team" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                <Users className="w-4 h-4" />
                Team
              </NavLink>
            )}
            <div className="border-t border-slate-100 mt-3 pt-3 text-sm text-slate-600">
              {user.name} — <span className="font-medium">{user.role}</span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="bg-white border border-slate-200 rounded-lg px-4 py-2">
          <HealthStatus />
        </div>
      </footer>
    </div>
  );
}
