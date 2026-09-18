import type { BadgeColor } from '../components/ui/Badge';
import type { Role } from '../auth/AuthContext';
import type { TaskStatus } from '../types';

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
