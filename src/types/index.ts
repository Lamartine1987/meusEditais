
export interface StudyLogEntry {
  compositeTopicId: string;
  date: string; // ISO string date for when the log was saved
  duration: number; // in seconds
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  registeredCargoIds?: string[]; 
  studiedTopicIds?: string[];
  studyLogs?: StudyLogEntry[];
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
}
