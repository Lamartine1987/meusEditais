
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Edital } from '@/types';
import { mockEditais } from '@/lib/mock-data'; // Import mock data

export const dynamic = 'force-dynamic'; // Garante que a rota seja sempre executada dinamicamente

export async function GET() {
  // This check ensures that we only try to connect to the real database in the
  // deployed App Hosting environment, where K_SERVICE is set.
  // During `next build`, this variable is not set, so we fall back to mock data.
  // This prevents build-time errors when Firebase Admin credentials are not available.
  if (process.env.K_SERVICE) {
    try {
      console.log("API: Tentando buscar todos os editais do Firebase Admin DB (Ambiente de Produção).");
      
      const editaisRef = adminDb.ref('editais'); // We still point to the parent 'editais'
      const snapshot = await editaisRef.once('value');
      const data = snapshot.val();

      if (!data) {
        console.log("API: Nenhum dado encontrado no caminho 'editais' do Firebase DB.");
        return NextResponse.json([]);
      }

      // Check for the nested 'editais' key and use it if it exists, otherwise use the parent data.
      // This makes the logic robust to the current structure (editais/editais) and a fixed one (editais/).
      const editaisData = data.editais && typeof data.editais === 'object' ? data.editais : data;

      const editaisArray: Edital[] = Object.keys(editaisData).map(key => ({
        id: key,
        ...editaisData[key]
      }));
      
      console.log(`API: Sucesso! ${editaisArray.length} edital(is) encontrado(s) no Firebase DB.`);
      return NextResponse.json(editaisArray);

    } catch (error: any) {
      console.error("API Error: Falha ao buscar dados do Firebase. Detalhes:", error);
      return NextResponse.json(
        { error: 'Falha ao buscar os dados dos editais do servidor.', details: error.message }, 
        { status: 500 }
      );
    }
  } else {
    // Fallback for local development or build time
    console.log("API: Ambiente de build ou local detectado. Usando dados de exemplo (mockEditais).");
    return NextResponse.json(mockEditais);
  }
}
