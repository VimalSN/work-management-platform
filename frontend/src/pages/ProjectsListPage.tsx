import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { Project } from '../types';

export function ProjectsListPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createProject = useMutation({
    mutationFn: () => api.post('/projects', { name, description: description || undefined }),
    onSuccess: () => {
      setName('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    createProject.mutate();
  }

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteProject = useMutation({
    mutationFn: (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => {
      setDeleteError(
        err.response?.status === 409
          ? 'Cannot delete a project that still has tasks - delete or reassign them first.'
          : 'Could not delete project.',
      );
    },
  });

  function handleDelete(project: Project) {
    if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteProject.mutate(project.id);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Projects</h1>

      {isLoading && <p className="text-slate-500">Loading projects…</p>}

      {projects && projects.length === 0 && <p className="text-slate-500">No projects yet.</p>}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {projects && projects.length > 0 && (
        <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
              <Link to={`/projects/${project.id}`} className="flex-1">
                <div className="font-medium text-slate-900">{project.name}</div>
                {project.description && <div className="text-sm text-slate-500">{project.description}</div>}
              </Link>
              {canManage && (
                <button
                  onClick={() => handleDelete(project)}
                  disabled={deleteProject.isPending}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 ml-4"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 max-w-sm">
          <h2 className="text-sm font-semibold text-slate-700">New project</h2>
          <input
            className="input"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="submit"
            disabled={createProject.isPending}
            className="w-full bg-slate-900 text-white rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {createProject.isPending ? 'Creating…' : 'Create project'}
          </button>
          {createProject.isError && <p className="text-sm text-red-600">Could not create project</p>}
        </form>
      )}
    </div>
  );
}
