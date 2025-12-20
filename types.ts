
export type UserProfile = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type UserRole = 'ADMIN' | 'USER';

export enum GoalType {
  CLASS = 'AULAS',
  MATERIAL = 'MATERIAL',
  QUESTIONS = 'QUESTÕES',
  LEI_SECA = 'LEI SECA',
  SUMMARY = 'RESUMO'
}

// Fixed missing CycleSystem enum
export enum CycleSystem {
  CONTINUOUS = 'CONTINUOUS',
  ROTATING = 'ROTATING'
}

// Fixed missing CycleItem interface
export interface CycleItem {
  id: string;
  type: 'DISCIPLINE' | 'FOLDER';
}

// Fixed missing StudyCycle interface
export interface StudyCycle {
  id: string;
  name: string;
  order: number;
  items: CycleItem[];
  topicsPerDiscipline: number;
}

// Fixed missing Folder interface
export interface Folder {
  id: string;
  name: string;
}

// Fixed missing PlanAccess interface
export interface PlanAccess {
  planId: string;
  assignedAt: string;
  expiresAt: string;
}

export interface ReviewConfig {
  enabled: boolean;
  intervals: number[];
  repeatLast: boolean;
}

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  color: string;
  order: number;
  minutes?: number;
  pages?: number;
  links: string[];
  articles?: string;
  multiplier?: number;
  reviewConfig?: ReviewConfig;
  referencedGoalIds?: string[];
  observations?: string;
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

// Updated StudyPlan to use concrete types instead of any
export interface StudyPlan {
  id: string;
  name: string;
  imageUrl: string;
  disciplines: Discipline[];
  folders: Folder[];
  cycles: StudyCycle[];
  cycleSystem: CycleSystem;
}

// Updated RegisteredUser to include accessList with PlanAccess type and optional password field
export interface RegisteredUser {
  id: string;
  name: string;
  cpf: string;
  email: string;
  role: UserRole;
  accessList: PlanAccess[];
  password?: string;
}

export interface UserRoutine {
  days: { [key: number]: number };
  profile: UserProfile;
  selectedPlanId: string | null;
  isPaused: boolean;
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
  reviewStep?: number;
  actualTimeSpent?: number; // Tempo líquido em minutos
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
    allPlannings: { [planId: string]: PlanningEntry[] };
    currentSession: {
      activeGoalId: string | null;
      startTime: number | null;
      totalPausedTime: number;
      lastPauseTime: number | null;
    };
  };
}
