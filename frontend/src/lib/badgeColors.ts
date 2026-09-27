import type { BadgeColor } from '../components/ui/Badge';
import type { Role } from '../auth/AuthContext';
import type { IssueType, Priority, TaskStatus } from '../types';

export const STATUS_BADGE_COLOR: Record<TaskStatus, BadgeColor> = {
  TODO: 'gray',
  IN_PROGRESS: 'blue',
  IN_REVIEW: 'purple',
  DONE: 'green',
};

export const ROLE_BADGE_COLOR: Record<Role, BadgeColor> = {
  ADMIN: 'purple',
  MANAGER: 'blue',
  DEVELOPER: 'gray',
  VIEWER: 'amber',
};

// Low is deliberately the same neutral gray as "no particular priority" -
// only Medium and up should draw the eye.
export const PRIORITY_BADGE_COLOR: Record<Priority, BadgeColor> = {
  LOW: 'gray',
  MEDIUM: 'blue',
  HIGH: 'amber',
  CRITICAL: 'red',
};

export const ISSUE_TYPE_BADGE_COLOR: Record<IssueType, BadgeColor> = {
  TASK: 'blue',
  BUG: 'red',
  STORY: 'green',
  EPIC: 'purple',
};
