
import type { Edital, Cargo, User, Subject, Topic } from '@/types';

// This mockUser is for reference and testing purposes, not used in production auth.
export const mockUser: User = {
  id: 'user1',
  name: 'Usuário Exemplo',
  email: 'usuario@example.com',
  avatarUrl: 'https://placehold.co/100x100.png',
  registeredCargoIds: ['edital1_cargo1'], 
  studiedTopicIds: [],
  studyLogs: [],
  questionLogs: [],
  revisionSchedules: [],
};

// Note: The main 'editais' list is now fetched from Firebase on the homepage.
// The data below might still be used in deeper pages (like edital details) if they haven't been migrated.
// It's recommended to migrate all data fetching to Firebase for consistency.

const mockAnalistaSubjects: Subject[] = [
  {
    id: 'subj1_1',
    name: 'Linguagens de Programação',
    topics: [
      { id: 'topic1_1_1', name: 'Java Avançado' },
      { id: 'topic1_1_2', name: 'Python para Dados' },
      { id: 'topic1_1_3', name: 'JavaScript ESNext' },
    ],
  },
  {
    id: 'subj1_2',
    name: 'Banco de Dados',
    topics: [
      { id: 'topic1_2_1', name: 'SQL e Modelagem Relacional' },
      { id: 'topic1_2_2', name: 'NoSQL Conceitos' },
      { id: 'topic1_2_3', name: 'Otimização de Consultas' },
    ],
  },
  {
    id: 'subj1_3',
    name: 'Engenharia de Software',
    topics: [
      { id: 'topic1_3_1', name: 'Metodologias Ágeis (Scrum/Kanban)' },
      { id: 'topic1_3_2', name: 'Padrões de Projeto (Design Patterns)' },
      { id: 'topic1_3_3', name: 'Arquitetura de Microsserviços' },
    ],
  },
];

const mockTecnicoAdminSubjects: Subject[] = [
  {
    id: 'subj2_1',
    name: 'Português',
    topics: [
      { id: 'topic2_1_1', name: 'Interpretação de Texto' },
      { id: 'topic2_1_2', name: 'Gramática Normativa' },
      { id: 'topic2_1_3', name: 'Redação Oficial' },
    ],
  },
  {
    id: 'subj2_2',
    name: 'Matemática Básica',
    topics: [
      { id: 'topic2_2_1', name: 'Raciocínio Lógico' },
      { id: 'topic2_2_2', name: 'Porcentagem e Juros' },
      { id: 'topic2_2_3', name: 'Regra de Três Simples e Composta' },
    ],
  },
  {
    id: 'subj2_3',
    name: 'Noções de Administração',
    topics: [
      { id: 'topic2_3_1', name: 'Organização e Arquivamento' },
      { id: 'topic2_3_2', name: 'Atendimento ao Público' },
      { id: 'topic2_3_3', name: 'Legislação Administrativa Básica' },
    ],
  },
];


export const mockCargos: Cargo[] = [
  { 
    id: 'cargo1', 
    name: 'Analista de Sistemas', 
    description: 'Desenvolvimento e manutenção de sistemas.', 
    requirements: ['Graduação em TI', 'Experiência com Java'], 
    salary: 7500,
    subjects: mockAnalistaSubjects,
  },
  { 
    id: 'cargo2', 
    name: 'Técnico Administrativo', 
    description: 'Suporte administrativo e organização de documentos.', 
    requirements: ['Ensino Médio Completo', 'Conhecimentos em Pacote Office'], 
    salary: 3500,
    subjects: mockTecnicoAdminSubjects,
  },
  { 
    id: 'cargo3', 
    name: 'Engenheiro Civil', 
    description: 'Planejamento e execução de obras.', 
    requirements: ['Graduação em Engenharia Civil', 'CREA Ativo'], 
    salary: 9000 
  },
];

// This export is being deprecated for the home page but might be used by detail pages.
// Consider removing it once all pages fetch from Firebase.
export const mockEditais: Edital[] = [
  {
    id: 'edital1',
    title: 'Concurso Público Prefeitura XYZ',
    organization: 'Prefeitura Municipal de XYZ',
    publicationDate: '2024-07-01',
    closingDate: '2024-08-15',
    summary: 'Diversas vagas para níveis fundamental, médio e superior na prefeitura de XYZ.',
    imageUrl: 'https://placehold.co/600x400.png',
    cargos: [mockCargos[0], mockCargos[1]],
    status: 'open',
    state: 'SP',
  },
];
