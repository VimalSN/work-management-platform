import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WorkloadEntry } from '../types';

export function WorkloadPage() {
  const { data: workload, isLoading } = useQuery({
    queryKey: ['workload'],
    queryFn: async () => (await api.get<WorkloadEntry[]>('/workload')).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Workload</h1>
      <p className="text-sm text-slate-500">
        Assigned hours are the sum of estimated hours across each person's non-completed tasks.
      </p>

      {isLoading && <p className="text-slate-500">Loading…</p>}

      {workload && (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {workload.map((entry) => {
            const overCapacity = entry.assignedHours > entry.capacityHours;
            const percent = Math.min(100, (entry.assignedHours / Math.max(entry.capacityHours, 1)) * 100);
            return (
              <div key={entry.userId} className="p-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-slate-900">
                    {entry.name} <span className="text-slate-400">({entry.role})</span>
                  </span>
                  <span className={overCapacity ? 'text-red-600 font-medium' : 'text-slate-600'}>
                    {entry.assignedHours}h / {entry.capacityHours}h
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${overCapacity ? 'bg-red-500' : 'bg-slate-700'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
