import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
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
  const { showToast } = useToast();

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
    onError: (err: any) => {
      const errorData = err.response?.data?.error;
      showToast('error', typeof errorData === 'string' ? errorData : 'Could not create dependency');
    },
  });

  const removeDependency = useMutation({
    mutationFn: (dependencyId: string) => api.delete(`/tasks/${taskId}/dependencies/${dependencyId}`),
    onSuccess: invalidate,
    onError: () => showToast('error', 'Could not remove dependency'),
  });

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (selectedTaskId) addDependency.mutate();
  }

  return (
    <div className="space-y-2 text-sm">
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
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        );
      })}

      {canManage && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 flex-wrap pt-1">
          <Input
            className="w-48"
            placeholder="Search tasks to link…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedTaskId('');
            }}
          />
          {search.trim().length > 1 && (
            <Select className="w-48" value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
              <option value="">Select a task…</option>
              {searchResults
                ?.filter((t) => t.id !== taskId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </Select>
          )}
          <Select className="w-36" value={type} onChange={(e) => setType(e.target.value as DependencyLinkType)}>
            {DEPENDENCY_LINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={!selectedTaskId} loading={addDependency.isPending}>
            Link
          </Button>
        </form>
      )}
    </div>
  );
}
