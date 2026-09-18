import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireRole';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { TeamPage } from './pages/TeamPage';

function App() {
  const { user, loading } = useAuth();

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
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route
          path="/team"
          element={
            <RequireRole roles={['ADMIN', 'MANAGER']}>
              <TeamPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
