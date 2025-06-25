
import { NextResponse } from 'next/server';
import { mockEditais } from '@/lib/mock-data';
// A conexão com o banco de dados foi temporariamente removida para usar dados de exemplo consistentes.
// import { adminDb } from '@/lib/firebase-admin';
import type { Edital } from '@/types';

export const dynamic = 'force-dynamic'; // Impede a geração estática no build

export async function GET() {
  // Para fins de desenvolvimento e demonstração, esta API está configurada
  // para retornar dados de exemplo (mock data). Em um cenário de produção real,
  // a lógica para buscar do banco de dados seria reativada aqui.
  console.log("API: Retornando dados de exemplo (mock data) para todos os ambientes.");
  await new Promise(resolve => setTimeout(resolve, 300)); // Simula um pequeno atraso de rede
  return NextResponse.json(mockEditais);
}
