
import type { Edital, Cargo, User, Subject, Topic } from '@/types';

export const mockUser: User = {
  id: 'user1',
  name: 'Usuário Exemplo',
  email: 'usuario@example.com',
  avatarUrl: 'https://placehold.co/100x100.png',
  registeredCargoIds: ['edital1_cargo1'], 
  studiedTopicIds: [],
  studyLogs: [],
  questionLogs: [],
};

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
    // Sem subjects definidos para este cargo por enquanto
  },
];

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
  },
  {
    id: 'edital2',
    title: 'Processo Seletivo Tribunal Regional ABC',
    organization: 'Tribunal Regional ABC',
    publicationDate: '2024-06-15',
    closingDate: '2024-07-30',
    summary: 'Oportunidades para cargos técnicos e analistas no Tribunal Regional.',
    imageUrl: 'https://placehold.co/600x400.png',
    cargos: [mockCargos[0]], // Analista de Sistemas também neste edital
    status: 'open',
  },
  {
    id: 'edital3',
    title: 'Edital Universidade Federal do Sul',
    organization: 'Universidade Federal do Sul',
    publicationDate: '2024-05-20',
    closingDate: '2024-06-20',
    summary: 'Vagas para docentes e técnicos administrativos.',
    imageUrl: 'https://placehold.co/600x400.png',
    cargos: [mockCargos[2]],
    status: 'closed',
  },
  {
    id: 'edital4',
    title: 'Concurso Banco Central',
    organization: 'Banco Central do Brasil',
    publicationDate: '2024-09-01',
    closingDate: '2024-10-15',
    summary: 'Vagas para analista e técnico do Banco Central.',
    imageUrl: 'https://placehold.co/600x400.png',
    status: 'upcoming',
  },
];
