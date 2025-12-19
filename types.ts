
export type UserProfile = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type UserRole = 'ADMIN' | 'USER';

export enum GoalType {
  CLASS = 'AULAS',
  MATERIAL = 'MATERIAL',
  QUESTIONS = 'QUESTÕES',
  LEI_SECA = 'LEI SECA',
  SUMMARY = 'RESUMO'
}

export interface ReviewConfig {
  enabled: boolean;
  intervals: number[]; // e.g. [1, 7, 15, 30]
  repeatLast: boolean;
}

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  color: string;
  order: number;
  minutes?: number; // Para Aulas e Resumo
  pages?: number;   // Para Material, Questões e Lei Seca
  links: string[];
  articles?: string; // Para Lei Seca
  multiplier?: number; // Para Lei Seca (2x, 3x, etc)
  reviewConfig?: ReviewConfig;
  referencedGoalIds?: string[]; // Para Resumo (quais metas ele resume)
}

export interface Topic {
  id: string;
  title: string;
  order: number;
  goals: Goal[];
}

export interface Discipline {
  id: string;
  name: string;
  topics: Topic[];
  folderId: string | null;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

export enum CycleSystem {
  CONTINUOUS = 'CONTÍNUO',
  ROTATING = 'ROTATIVO'
}

export interface CycleItem {
  id: string;
  type: 'DISCIPLINE' | 'FOLDER';
}

export interface StudyCycle {
  id: string;
  name: string;
  items: CycleItem[];
  topicsPerDiscipline: number;
  order: number;
}

export interface StudyPlan {
  id: string;
  name: string;
  imageUrl: string;
  disciplines: Discipline[];
  folders: Folder[];
  cycles: StudyCycle[];
  cycleSystem: CycleSystem;
}

export interface PlanAccess {
  planId: string;
  expiresAt: string; // ISO Date
  assignedAt: string; // ISO Date
}

export interface RegisteredUser {
  id: string;
  name: string;
  cpf: string;
  email: string;
  password: string;
  role: UserRole;
  accessList: PlanAccess[];
}

export interface UserRoutine {
  days: { [key: number]: number }; // dayIndex: minutes
  profile: UserProfile;
  selectedPlanId: string | null;
}

export interface PlanningEntry {
  id: string;
  goalId: string;
  topicId: string;
  disciplineId: string;
  date: string;
  durationMinutes: number;
  status: 'PENDING' | 'COMPLETED' | 'DELAYED';
  isReview: boolean;
  reviewStep?: number; // 0 for 1st review, 1 for 2nd...
  actualTimeSpent?: number;
}

export interface AppState {
  admin: {
    plans: StudyPlan[];
    logoUrl: string;
    users: RegisteredUser[];
  };
  auth: {
    currentUser: RegisteredUser | null;
    isAuthenticated: boolean;
  };
  user: {
    routine: UserRoutine;
    planning: PlanningEntry[];
    currentSession: {
      activeGoalId: string | null;
      startTime: number | null;
      totalPausedTime: number;
      lastPauseTime: number | null;
    };
  };
}
