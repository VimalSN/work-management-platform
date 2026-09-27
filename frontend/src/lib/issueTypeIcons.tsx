import { Bookmark, Bug, CheckSquare, Zap } from 'lucide-react';
import type { IssueType } from '../types';

export const ISSUE_TYPE_ICON: Record<IssueType, typeof Bug> = {
  TASK: CheckSquare,
  BUG: Bug,
  STORY: Bookmark,
  EPIC: Zap,
};
