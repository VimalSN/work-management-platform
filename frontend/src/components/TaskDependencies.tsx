import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './ui/ToastContext';
import { Button } from './ui/Button';
import { InlineSelect } from './ui/InlineSelect';
import type { InlineSelectOption } from './ui/InlineSelect';
import { CREATABLE_DEPENDENCY_LINK_TYPES } from '../types';
import type { DependencyItem, DependencyLinkType, TaskDependencies as TaskDependenciesData, TaskSummary } from '../types';

const SECTIONS: { label: string; key: keyof TaskDependenciesData }[] = [
  { label: 'Blocks', key: 'blocks' },
  { label: 'Blocked by', key: 'blockedBy' },
  { label: 'Relates to', key: 'relatesTo' },
  { label: 'Duplicates', key: 'duplicates' },
  { label: 'Duplicated by', key: 'duplicatedBy' },
];

const LINK_TYPE_LABEL: Record<DependencyLinkType, string> = {
  BLOCKS: 'Blocks',
  BLOCKED_BY: 'Blocked by',
  RELATES_TO: 'Relates to',
  DUPLICATES: 'Duplicates',
};

const LINK_TYPE_OPTIONS: InlineSelectOption[] = CREATABLE_DEPENDENCY_LINK_TYPES.map((t) => ({
  value: t,
  label: LINK_TYPE_LABEL[t],
}));

export function TaskDependencies({ taskId, canManage }: { taskId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data } = useQuery({
    queryKey: ['tasks', taskId, 'dependencies'],
    queryFn: async () => (await api.get<TaskDependenciesData>(`/tasks/${taskId}/dependencies`)).data,
  });

  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedTaskTitle, setSelectedTaskTitle] = useState('');
  const [type, setType] = useState<DependencyLinkType>('BLOCKS');

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['tasks', 'search', search],
    queryFn: async () => (await api.get<TaskSummary[]>('/tasks', { params: { search } })).data,
    enabled: search.trim().length > 1,
  });

  const taskOptions: InlineSelectOption[] = (searchResults ?? [])
    .filter((t) => t.id !== taskId)
    .map((t) => ({ value: t.id, label: t.title }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks', taskId, 'dependencies'] });

  const addDependency = useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/dependencies`, { relatedTaskId: selectedTaskId, type }),
    onSuccess: () => {
      setSearch('');
      setSelectedTaskId('');
      setSelectedTaskTitle('');
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
                <Link to={`/tasks/${item.task.id}`} className="hover:text-brand-700 hover:underline">
                  {item.task.title}
                </Link>
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
          <div className="w-48">
            <InlineSelect
              variant="bordered"
              value={selectedTaskId}
              options={taskOptions}
              placeholder="Search tasks to link…"
              search={search}
              loading={isSearching}
              onSearchChange={setSearch}
              selectedLabel={selectedTaskId ? selectedTaskTitle : undefined}
              onChange={(value) => {
                setSelectedTaskId(value);
                setSelectedTaskTitle(taskOptions.find((o) => o.value === value)?.label ?? '');
              }}
            />
          </div>
          <div className="w-36">
            <InlineSelect
              variant="bordered"
              value={type}
              options={LINK_TYPE_OPTIONS}
              onChange={(v) => setType(v as DependencyLinkType)}
            />
          </div>
          <Button type="submit" disabled={!selectedTaskId} loading={addDependency.isPending}>
            Link
          </Button>
        </form>
      )}
    </div>
  );
}
