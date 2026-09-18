import { useDroppable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { Badge } from './ui/Badge';
import { STATUS_BADGE_COLOR } from '../lib/badgeColors';
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
      className={`flex-1 min-w-64 bg-slate-100 rounded-lg p-2 space-y-2 transition-colors ${
        isOver ? 'bg-brand-50 ring-2 ring-brand-300' : ''
      }`}
    >
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <Badge color={STATUS_BADGE_COLOR[status]}>{count}</Badge>
      </div>
      <div className="space-y-2 min-h-16">{children}</div>
    </div>
  );
}
