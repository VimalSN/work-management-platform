import { Trash2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Input';
import { LabelsInput } from './ui/LabelsInput';
import { ISSUE_TYPE_ICON } from '../lib/issueTypeIcons';
import { TaskDependencies } from './TaskDependencies';
import { TaskComments } from './TaskComments';
import { TaskAttachments } from './TaskAttachments';
import { ISSUE_TYPES, PRIORITIES, TASK_STATUSES } from '../types';
import type { IssueType, OrgUser, Priority, Task, TaskStatus } from '../types';

type TaskUpdate = Partial<
  Pick<Task, 'status' | 'assigneeId' | 'priority' | 'issueType' | 'dueDate' | 'labels'>
>;

export function TaskDetailModal({
  task,
  orgUsers,
  canManage,
  canEditStatus,
  canComment,
  onClose,
  onUpdate,
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
  onUpdate: (data: TaskUpdate) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const IssueIcon = ISSUE_TYPE_ICON[task.issueType];
  const isOverdue = task.dueDate != null && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  return (
    <Modal title={task.title} onClose={onClose} size="lg">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <IssueIcon className="w-4 h-4" />
        {task.issueType.charAt(0) + task.issueType.slice(1).toLowerCase()}
      </div>

      {task.description && <p className="text-sm text-slate-600 whitespace-pre-wrap">{task.description}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="text-slate-500 text-xs">Status</span>
          <Select
            value={task.status}
            disabled={!canEditStatus || isUpdating}
            onChange={(e) => onUpdate({ status: e.target.value as TaskStatus })}
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
            onChange={(e) => onUpdate({ assigneeId: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {orgUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500 text-xs">Priority</span>
          <Select
            value={task.priority}
            disabled={!canEditStatus || isUpdating}
            onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500 text-xs">Type</span>
          <Select
            value={task.issueType}
            disabled={!canManage || isUpdating}
            onChange={(e) => onUpdate({ issueType: e.target.value as IssueType })}
          >
            {ISSUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500 text-xs">Due date</span>
          <input
            type="date"
            className={`input ${isOverdue ? 'text-red-600 border-red-300' : ''}`}
            value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
            disabled={!canEditStatus || isUpdating}
            onChange={(e) => onUpdate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </label>
        {task.estimatedHours != null && (
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Estimated</span>
            <p className="text-slate-700 py-2">{task.estimatedHours}h</p>
          </label>
        )}
      </div>

      <div>
        <span className="text-slate-500 text-xs">Labels</span>
        <div className="mt-1">
          <LabelsInput
            labels={task.labels}
            onChange={(labels) => onUpdate({ labels })}
            readOnly={!canEditStatus || isUpdating}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Attachments</h3>
        <TaskAttachments taskId={task.id} canUpload={canComment} isManager={canManage} />
      </div>

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
