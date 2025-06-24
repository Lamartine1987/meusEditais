
import { NextResponse } from 'next/server';
import { mockEditais } from '@/lib/mock-data';
import { adminDb } from '@/lib/firebase-admin';
import type { Edital } from '@/types';

export async function GET() {
  // Em um ambiente local ou de desenvolvimento, as credenciais do Firebase Admin SDK podem não estar disponíveis.
  // Retornamos dados de exemplo para permitir o desenvolvimento da interface do usuário sem quebrar a aplicação.
  // Quando implantado no App Hosting, a lógica de produção abaixo será usada.
  if (process.env.NODE_ENV === 'development') {
    console.log("API: Retornando dados de exemplo para desenvolvimento local.");
    await new Promise(resolve => setTimeout(resolve, 500)); // Simula um atraso de rede
    return NextResponse.json(mockEditais);
  }

  // --- Lógica para o Ambiente de Produção ---
  try {
    console.log("API: Tentando buscar editais do Firebase Admin DB.");
    const editaisRef = adminDb.ref('editais/editais');
    const snapshot = await editaisRef.once('value');

    if (!snapshot.exists()) {
      console.log("API: Nenhum edital encontrado no banco de dados.");
      return NextResponse.json([]);
    }

    const data = snapshot.val();
    // O Firebase retorna um objeto, então convertemos para um array
    const editaisArray: Edital[] = Object.keys(data).map(key => ({
      id: key,
      ...data[key],
    }));

    console.log(`API: ${editaisArray.length} editais buscados com sucesso.`);
    return NextResponse.json(editaisArray);

  } catch (error) {
    console.error("API Error fetching from Firebase:", error);
    return new NextResponse(
      JSON.stringify({ error: "Falha ao buscar dados do banco de dados." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
