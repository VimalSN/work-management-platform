import type { Role } from './auth/AuthContext';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  version: number;
  projectId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrgUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// The four types the API accepts. BLOCKS/BLOCKED_BY are the same edge from
// opposite ends - the backend stores only one direction (see docs/phase-4).
export type DependencyLinkType = 'BLOCKS' | 'BLOCKED_BY' | 'RELATES_TO' | 'DUPLICATES';

export const DEPENDENCY_LINK_TYPES: DependencyLinkType[] = ['BLOCKS', 'BLOCKED_BY', 'RELATES_TO', 'DUPLICATES'];

export type TaskSummary = {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string;
};

export type DependencyItem = {
  dependencyId: string;
  task: TaskSummary;
};

export type TaskDependencies = {
  blocks: DependencyItem[];
  blockedBy: DependencyItem[];
  relatesTo: DependencyItem[];
  duplicates: DependencyItem[];
  duplicatedBy: DependencyItem[];
};
