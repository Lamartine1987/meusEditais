
export interface NoteEntry {
  id: string; // Unique ID for the note
  compositeTopicId: string;
  date: string; // ISO string date
  text: string; // The note content
}

export interface StudyLogEntry {
  id: string; // Unique ID for the log
  compositeTopicId: string;
  date: string; // ISO string date for when the log was saved
  duration: number; // in seconds
  pdfName?: string;
  startPage?: number;
  endPage?: number;
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
  id: string;
  compositeTopicId: string;
  scheduledDate: string; // ISO string date for when the revision is scheduled
  isReviewed: boolean;
  reviewedDate: string | null; // ISO string date for when it was marked as reviewed
}

export type PlanId = 'plano_cargo' | 'plano_edital' | 'plano_anual' | 'plano_trial';

export interface PlanDetails {
  planId: PlanId;
  startDate?: string; // ISO date
  expiryDate?: string; // ISO date
  // Specific to 'plano_cargo'
  selectedCargoCompositeId?: string; // e.g., "edital1_cargo1"
  // Specific to 'plano_edital'
  selectedEditalId?: string; // e.g., "edital1"
  // Stripe specific fields
  stripeSubscriptionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null; 
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
  notes?: NoteEntry[];
  activePlan?: PlanId | null; // Highest active plan tier
  activePlans?: PlanDetails[]; // List of all active plans
  stripeCustomerId?: string | null; 
  hasHadFreeTrial?: boolean; // Tracks if the user has used the free trial
  planHistory?: PlanDetails[];
  isRankingParticipant?: boolean | null; // null = undecided, true = yes, false = no
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
  vacancies?: number;
  reserveList?: boolean | number;
  subjects?: Subject[]; 
}

export interface Edital {
  id: string;
  title: string;
  organization: string;
  publicationDate: string; // ISO date string
  closingDate: string; // ISO date string
  examDate?: string; // ISO date string for the exam date
  summary: string;
  fullTextUrl?: string;
  imageUrl?: string; 
  cargos?: Cargo[]; 
  status: 'open' | 'closed' | 'upcoming';
  state?: string; // e.g., 'SP', 'RJ', 'Nacional'
}
