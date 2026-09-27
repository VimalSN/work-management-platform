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

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export type IssueType = 'TASK' | 'BUG' | 'STORY' | 'EPIC';

export const ISSUE_TYPES: IssueType[] = ['TASK', 'BUG', 'STORY', 'EPIC'];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  stepsToReproduce: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  status: TaskStatus;
  priority: Priority;
  issueType: IssueType;
  dueDate: string | null;
  labels: string[];
  version: number;
  estimatedHours: number | null;
  projectId: string;
  assigneeId: string | null;
  reporterId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  taskId: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
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

// Only 3 of the 4 are offered when CREATING a link - BLOCKED_BY is the same
// edge as BLOCKS, just described from the other task's side, so picking it
// here would just be a confusing way to do the same thing you could do by
// adding a BLOCKS link from the other task instead. It still shows up as a
// read-only "Blocked by" section (see TaskDependencies.tsx's SECTIONS) once
// some other task links to this one with BLOCKS.
export const CREATABLE_DEPENDENCY_LINK_TYPES: DependencyLinkType[] = ['BLOCKS', 'RELATES_TO', 'DUPLICATES'];

export type TaskSummary = {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string;
  assigneeId?: string | null;
  estimatedHours?: number | null;
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

export type Comment = {
  id: string;
  body: string;
  taskId: string;
  createdAt: string;
  author: { id: string; name: string };
};

export type WorkloadEntry = {
  userId: string;
  name: string;
  role: Role;
  assignedHours: number;
  capacityHours: number;
};

export type NotificationType = 'TASK_ASSIGNED' | 'NEW_COMMENT';

export type AppNotification = {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  taskId: string | null;
  createdAt: string;
};
