import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ui/ToastContext';
import { useConfirm } from '../components/ui/ConfirmContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { RowMenu } from '../components/ui/RowMenu';
import { CreateProjectModal } from '../components/CreateProjectModal';
import type { Project } from '../types';

export function ProjectsListPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  });

  const [showCreateModal, setShowCreateModal] = useState(false);

  const deleteProject = useMutation({
    mutationFn: (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('success', 'Project deleted');
    },
    onError: (err: any) => {
      showToast(
        'error',
        err.response?.status === 409
          ? 'Cannot delete a project that still has tasks - delete or reassign them first.'
          : 'Could not delete project.',
      );
    },
  });

  async function handleDelete(project: Project) {
    const confirmed = await confirm({
      title: 'Delete project',
      message: `Delete "${project.name}"? This cannot be undone.`,
      danger: true,
    });
    if (confirmed) deleteProject.mutate(project.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Everything your organization is working on.</p>
        </div>
        {canManage && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            New project
          </Button>
        )}
      </div>

      {showCreateModal && <CreateProjectModal onClose={() => setShowCreateModal(false)} />}

      {isLoading && <p className="text-slate-500">Loading projects…</p>}
      {projects && projects.length === 0 && <p className="text-slate-500">No projects yet.</p>}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card key={project.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/projects/${project.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                  <FolderKanban className="w-5 h-5 text-brand-600 flex-shrink-0" />
                  <span className="font-medium text-slate-900 truncate">{project.name}</span>
                </Link>
                {canManage && (
                  <RowMenu
                    items={[
                      {
                        label: 'Delete',
                        icon: <Trash2 className="w-4 h-4" />,
                        danger: true,
                        onClick: () => handleDelete(project),
                      },
                    ]}
                  />
                )}
              </div>
              {project.description && <p className="text-sm text-slate-500 line-clamp-2">{project.description}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
