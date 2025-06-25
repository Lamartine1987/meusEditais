
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Edital } from '@/types';

export const dynamic = 'force-dynamic'; // Garante que a rota seja sempre executada dinamicamente

export async function GET() {
  try {
    console.log("API: Tentando buscar todos os editais do Firebase Admin DB.");
    
    // O caminho para a raiz de todos os 'editais' no Realtime Database.
    const editaisRef = adminDb.ref('editais'); 
    
    const snapshot = await editaisRef.once('value');
    const editaisData = snapshot.val();

    if (!editaisData) {
      console.log("API: Nenhum edital encontrado no caminho 'editais' do Firebase DB.");
      return NextResponse.json([]); // Retorna um array vazio se não houver dados
    }

    // O Firebase retorna os dados como um objeto onde as chaves são os IDs.
    // Precisamos converter este objeto em um array de objetos Edital.
    const editaisArray: Edital[] = Object.keys(editaisData).map(key => ({
      id: key, // A chave do objeto é o ID do edital
      ...editaisData[key]
    }));
    
    console.log(`API: Sucesso! ${editaisArray.length} edital(is) encontrado(s) no Firebase DB.`);
    return NextResponse.json(editaisArray);

  } catch (error: any) {
    // Log do erro completo para depuração no servidor
    console.error("API Error: Falha ao buscar dados do Firebase. Detalhes:", error);
    
    // Retorna uma resposta de erro estruturada para o cliente
    return NextResponse.json(
      { error: 'Falha ao buscar os dados dos editais do servidor.', details: error.message }, 
      { status: 500 }
    );
  }
}
