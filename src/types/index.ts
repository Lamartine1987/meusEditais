
export interface StudyLogEntry {
  compositeTopicId: string;
  date: string; // ISO string date for when the log was saved
  duration: number; // in seconds
}

export interface QuestionLogEntry {
  compositeTopicId: string;
  date: string; // ISO string date for when the log was saved
  totalQuestions: number;
  correctQuestions: number;
  incorrectQuestions: number;
  targetPercentage: number; // User's target approval percentage (0-100)
}

export interface RevisionScheduleEntry {
  compositeTopicId: string;
  scheduledDate: string; // ISO string date for when the revision is scheduled
  isReviewed: boolean;
  reviewedDate: string | null; // ISO string date for when it was marked as reviewed
}

export type PlanId = 'plano_cargo' | 'plano_edital' | 'plano_anual';

export interface PlanDetails {
  planId: PlanId;
  startDate?: string; // ISO date
  expiryDate?: string; // ISO date
  // Specific to 'plano_cargo'
  selectedCargoCompositeId?: string; // e.g., "edital1_cargo1"
  // Specific to 'plano_edital'
  selectedEditalId?: string; // e.g., "edital1"
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  registeredCargoIds?: string[]; 
  studiedTopicIds?: string[];
  studyLogs?: StudyLogEntry[];
  questionLogs?: QuestionLogEntry[];
  revisionSchedules?: RevisionScheduleEntry[];
  activePlan?: PlanId | null;
  planDetails?: PlanDetails | null;
}

export interface Topic {
  id: string;
  name: string;
}

export interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Cargo {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  salary?: number;
  subjects?: Subject[]; // Novo campo para matérias
}

export interface Edital {
  id: string;
  title: string;
  organization: string;
  publicationDate: string; // ISO date string
  closingDate: string; // ISO date string
  summary: string;
  fullTextUrl?: string;
  imageUrl?: string; 
  cargos?: Cargo[]; 
  status: 'open' | 'closed' | 'upcoming';
  state?: string; // e.g., 'SP', 'RJ', 'Nacional'
}

