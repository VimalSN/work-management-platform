import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Clock, User } from 'lucide-react';
import type { Task } from '../types';

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
      <p className="text-sm font-medium text-slate-900">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1 truncate">
          <User className="w-3.5 h-3.5 flex-shrink-0" />
          {assigneeName}
        </span>
        {task.estimatedHours != null && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {task.estimatedHours}h
          </span>
        )}
      </div>
    </div>
  );
}
