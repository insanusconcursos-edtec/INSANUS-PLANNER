
export type UserProfile = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type UserRole = 'ADMIN' | 'USER';

export enum GoalType {
  CLASS = 'AULAS',
  MATERIAL = 'MATERIAL',
  QUESTIONS = 'QUESTÕES',
  LEI_SECA = 'LEI SECA',
  SUMMARY = 'RESUMO'
}

export enum CycleSystem {
  CONTINUOUS = 'CONTINUOUS',
  ROTATING = 'ROTATING'
}

export interface CycleItem {
  id: string;
  type: 'DISCIPLINE' | 'FOLDER';
}

export interface StudyCycle {
  id: string;
  name: string;
  order: number;
  items: CycleItem[];
  topicsPerDiscipline: number;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

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

export interface SubGoal {
  id: string;
  title: string;
  minutes: number;
  link: string;
  order: number;
}

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  color: string;
  order: number;
  minutes?: number; // Agora derivado para AULAS
  pages?: number;
  links: string[];
  articles?: string;
  multiplier?: number;
  reviewConfig?: ReviewConfig;
  referencedGoalIds?: string[];
  observations?: string;
  pdfData?: string;
  pdfName?: string;
  subGoals?: SubGoal[]; // Especificamente para GoalType.CLASS
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
  subGoalId?: string; // ID da aula específica se for meta de aula
  topicId: string;
  disciplineId: string;
  date: string;
  durationMinutes: number;
  status: 'PENDING' | 'COMPLETED' | 'DELAYED';
  isReview: boolean;
  reviewStep?: number;
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
    allPlannings: { [planId: string]: PlanningEntry[] };
    currentSession: {
      activeGoalId: string | null;
      startTime: number | null;
      totalPausedTime: number;
      lastPauseTime: number | null;
    };
  };
}
