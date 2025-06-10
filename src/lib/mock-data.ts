import type { Edital, Cargo, User } from '@/types';

export const mockUser: User = {
  id: 'user1',
  name: 'Usuário Exemplo',
  email: 'usuario@example.com',
  avatarUrl: 'https://placehold.co/100x100.png',
};

export const mockCargos: Cargo[] = [
  { id: 'cargo1', name: 'Analista de Sistemas', description: 'Desenvolvimento e manutenção de sistemas.', requirements: ['Graduação em TI', 'Experiência com Java'], salary: 7500 },
  { id: 'cargo2', name: 'Técnico Administrativo', description: 'Suporte administrativo e organização de documentos.', requirements: ['Ensino Médio Completo', 'Conhecimentos em Pacote Office'], salary: 3500 },
  { id: 'cargo3', name: 'Engenheiro Civil', description: 'Planejamento e execução de obras.', requirements: ['Graduação em Engenharia Civil', 'CREA Ativo'], salary: 9000 },
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
    cargos: [mockCargos[0]],
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

export const mockMyEditais: Edital[] = [
  mockEditais[0], // User is registered for the first edital
];
