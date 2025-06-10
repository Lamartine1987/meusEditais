export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  registeredCargoIds?: string[]; // Alterado de registeredEditalIds
}

export interface Cargo {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  salary?: number;
}

export interface Edital {
  id: string;
  title: string;
  organization: string;
  publicationDate: string; // ISO date string
  closingDate: string; // ISO date string
  summary: string;
  fullTextUrl?: string;
  imageUrl?: string; // For a representative image
  cargos?: Cargo[]; // Cargos can be part of the edital or fetched separately
  status: 'open' | 'closed' | 'upcoming';
}
