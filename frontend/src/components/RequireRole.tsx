import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../auth/AuthContext';

// A hidden nav link is a UX convenience, not access control - anyone who
// lands on the URL directly (a stale route from before logout, a typed-in
// address, a bookmark) still reaches the route unless it's guarded here too.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
