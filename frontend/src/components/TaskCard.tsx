import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { CalendarClock, Clock, User } from 'lucide-react';
import { Badge } from './ui/Badge';
import { ISSUE_TYPE_ICON } from '../lib/issueTypeIcons';
import { PRIORITY_BADGE_COLOR } from '../lib/badgeColors';
import type { Task } from '../types';

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TaskCard({
  task,
  assigneeName,
  draggable,
  onOpen,
}: {
  task: Task;
  assigneeName: string;
  draggable: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 10 }
    : undefined;

  const IssueIcon = ISSUE_TYPE_ICON[task.issueType];
  const isOverdue = task.dueDate != null && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={`bg-white border border-slate-200 rounded-md p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-2 ${
        isDragging ? 'opacity-50' : ''
      } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <IssueIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
        <p className="text-sm font-medium text-slate-900">{task.title}</p>
      </div>

      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span key={label} className="bg-brand-50 text-brand-700 rounded-full px-1.5 py-0.5 text-[10px] leading-none">
              {label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span className="flex items-center gap-1 truncate">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          {assigneeName}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
              <CalendarClock className="w-3.5 h-3.5" />
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {task.estimatedHours != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {task.estimatedHours}h
            </span>
          )}
        </div>
      </div>

      {task.priority !== 'MEDIUM' && (
        <Badge color={PRIORITY_BADGE_COLOR[task.priority]}>
          {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
        </Badge>
      )}
    </div>
  );
}
