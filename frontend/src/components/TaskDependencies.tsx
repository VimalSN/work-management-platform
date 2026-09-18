import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { DEPENDENCY_LINK_TYPES } from '../types';
import type { DependencyItem, DependencyLinkType, TaskDependencies as TaskDependenciesData, TaskSummary } from '../types';

const SECTIONS: { label: string; key: keyof TaskDependenciesData }[] = [
  { label: 'Blocks', key: 'blocks' },
  { label: 'Blocked by', key: 'blockedBy' },
  { label: 'Relates to', key: 'relatesTo' },
  { label: 'Duplicates', key: 'duplicates' },
  { label: 'Duplicated by', key: 'duplicatedBy' },
];

export function TaskDependencies({ taskId, canManage }: { taskId: string; canManage: boolean }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['tasks', taskId, 'dependencies'],
    queryFn: async () => (await api.get<TaskDependenciesData>(`/tasks/${taskId}/dependencies`)).data,
  });

  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [type, setType] = useState<DependencyLinkType>('BLOCKS');

  const { data: searchResults } = useQuery({
    queryKey: ['tasks', 'search', search],
    queryFn: async () => (await api.get<TaskSummary[]>('/tasks', { params: { search } })).data,
    enabled: search.trim().length > 1,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'dependencies'] });

  const addDependency = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/dependencies`, { relatedTaskId: selectedTaskId, type }),
    onSuccess: () => {
      setSearch('');
      setSelectedTaskId('');
      invalidate();
    },
  });

  const removeDependency = useMutation({
    mutationFn: (dependencyId: string) => api.delete(`/tasks/${taskId}/dependencies/${dependencyId}`),
    onSuccess: invalidate,
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (selectedTaskId) addDependency.mutate();
  }

  const addErrorMessage = (() => {
    const errorData = (addDependency.error as any)?.response?.data?.error;
    return typeof errorData === 'string' ? errorData : addDependency.isError ? 'Could not create dependency' : null;
  })();

  return (
    <div className="mt-2 pl-4 border-l-2 border-slate-100 space-y-2 text-sm">
      {SECTIONS.map(({ label, key }) => {
        const items: DependencyItem[] = data?.[key] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={key}>
            <span className="text-slate-500">{label}:</span>{' '}
            {items.map((item) => (
              <span
                key={item.dependencyId}
                className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 mr-1"
              >
                {item.task.title}
                {canManage && (
                  <button
                    onClick={() => removeDependency.mutate(item.dependencyId)}
                    disabled={removeDependency.isPending}
                    className="text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${label.toLowerCase()} link to ${item.task.title}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        );
      })}

      {canManage && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 flex-wrap pt-1">
          <input
            className="input w-48"
            placeholder="Search tasks to link…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedTaskId('');
            }}
          />
          {search.trim().length > 1 && (
            <select
              className="input w-48"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
            >
              <option value="">Select a task…</option>
              {searchResults
                ?.filter((t) => t.id !== taskId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          )}
          <select className="input w-36" value={type} onChange={(e) => setType(e.target.value as DependencyLinkType)}>
            {DEPENDENCY_LINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selectedTaskId || addDependency.isPending}
            className="text-sm bg-slate-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
          >
            Link
          </button>
        </form>
      )}
      {addErrorMessage && <p className="text-red-600">{addErrorMessage}</p>}
    </div>
  );
}
