
import { GoalType, UserProfile } from './types';

export const GOAL_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

export const PROFILE_SPEEDS: Record<GoalType, Record<UserProfile, number>> = {
  [GoalType.CLASS]: { BEGINNER: 1, INTERMEDIATE: 1, ADVANCED: 1 }, // Flat rate
  [GoalType.MATERIAL]: { BEGINNER: 5, INTERMEDIATE: 3, ADVANCED: 1 },
  [GoalType.QUESTIONS]: { BEGINNER: 10, INTERMEDIATE: 6, ADVANCED: 2 },
  [GoalType.LEI_SECA]: { BEGINNER: 5, INTERMEDIATE: 3, ADVANCED: 1 },
  [GoalType.SUMMARY]: { BEGINNER: 1, INTERMEDIATE: 1, ADVANCED: 1 }, // Set by admin
};

export const INITIAL_LOGO = "https://picsum.photos/id/1/200/200";

export const WEEK_DAYS = [
  { id: 0, name: 'Domingo' },
  { id: 1, name: 'Segunda' },
  { id: 2, name: 'Terça' },
  { id: 3, name: 'Quarta' },
  { id: 4, name: 'Quinta' },
  { id: 5, name: 'Sexta' },
  { id: 6, name: 'Sábado' },
];
