export type BotStep =
  | 'IDLE'
  | 'NAVIGATOR_DIRECTION'
  | 'NAVIGATOR_GRADE'
  | 'NAVIGATOR_LIST'
  | 'COPILOT_TOPIC'
  | 'COPILOT_GOAL'
  | 'COPILOT_HYPOTHESIS'
  | 'COPILOT_TASKS'
  | 'REHEARSAL_ACTIVE'
  | 'PROJECT_VIEW';

export interface ProjectDraft {
  id?: string;
  topic?: string;
  academicTitle?: string;
  goal?: string;
  tasks?: string[];
  hypothesis?: string;
  object?: string;
  subject?: string;
  mentorTip?: string;
  relevance?: string;
  checklist?: number[]; // Отмеченные пункты чек-листа (1..7)
  createdAt?: number;
  updatedAt?: number;
}

export interface StructuredProjectAnalysis {
  isProject: boolean;
  refusalReason?: string;
  topic?: string;
  academicTitle?: string;
  goal?: string;
  hypothesis?: string;
  object?: string;
  subject?: string;
  tasks?: string[];
  mentorTip?: string;
}

export interface RehearsalState {
  currentQuestionIndex: number;
  questions: string[];
  answers: { question: string; answer: string; feedback?: string }[];
}

export interface UserSession {
  userId: number;
  step: BotStep;
  filterGrade?: number;
  filterDirection?: string;
  activeProjectId?: string;
  projectDraft: ProjectDraft;
  rehearsal?: RehearsalState;
  pendingText?: string;
  updatedAt: number;
}

