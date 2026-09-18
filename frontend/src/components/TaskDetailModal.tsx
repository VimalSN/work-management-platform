import { Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Input';
import { TaskDependencies } from './TaskDependencies';
import { TaskComments } from './TaskComments';
import { TASK_STATUSES } from '../types';
import type { OrgUser, Task, TaskStatus } from '../types';

export function TaskDetailModal({
  task,
  orgUsers,
  canManage,
  canEditStatus,
  canComment,
  onClose,
  onUpdateStatus,
  onUpdateAssignee,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  task: Task;
  orgUsers: OrgUser[];
  canManage: boolean;
  canEditStatus: boolean;
  canComment: boolean;
  onClose: () => void;
  onUpdateStatus: (status: TaskStatus) => void;
  onUpdateAssignee: (assigneeId: string) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  return (
    <Modal title={task.title} onClose={onClose}>
      {task.description && <p className="text-sm text-slate-600">{task.description}</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="text-slate-500 text-xs">Status</span>
          <Select
            value={task.status}
            disabled={!canEditStatus || isUpdating}
            onChange={(e) => onUpdateStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500 text-xs">Assignee</span>
          <Select
            value={task.assigneeId ?? ''}
            disabled={!canManage || isUpdating}
            onChange={(e) => onUpdateAssignee(e.target.value)}
          >
            <option value="">Unassigned</option>
            {orgUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {task.estimatedHours != null && <p className="text-xs text-slate-400">Estimated: {task.estimatedHours}h</p>}

      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Dependencies</h3>
        <TaskDependencies taskId={task.id} canManage={canManage} />
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Comments</h3>
        <TaskComments taskId={task.id} canComment={canComment} />
      </div>

      {canManage && (
        <div className="border-t border-slate-100 pt-3 flex justify-end">
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={isDeleting} onClick={onDelete}>
            Delete task
          </Button>
        </div>
      )}
    </Modal>
  );
}
