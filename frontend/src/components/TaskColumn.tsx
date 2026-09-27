import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import type { TaskStatus } from '../types';

export function TaskColumn({
  status,
  label,
  count,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-64 bg-slate-50 border rounded-md transition-colors ${
        isOver ? 'border-brand-300 ring-2 ring-brand-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-100 rounded-t-md">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
        <span className="text-xs text-slate-400 tabular-nums">{count}</span>
      </div>
      <div className="space-y-2 min-h-16 p-2">{children}</div>
    </div>
  );
}
