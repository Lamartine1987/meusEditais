
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Edital } from '@/types';
import { mockEditais } from '@/lib/mock-data'; // Import mock data

export const dynamic = 'force-dynamic'; // Garante que a rota seja sempre executada dinamicamente

export async function GET() {
  // This check ensures that we only try to connect to the real database in the
  // deployed App Hosting environment, where K_SERVICE is set.
  if (process.env.K_SERVICE) {
    try {
      console.log("API: Tentando buscar todos os editais do Firebase Admin DB (Ambiente de Produção).");
      
      const editaisRef = adminDb.ref('editais');
      const snapshot = await editaisRef.once('value');
      const data = snapshot.val();

      if (!data) {
        console.warn("API AVISO: Nenhum dado encontrado no Firebase Realtime Database em produção no caminho 'editais'. A aplicação está retornando dados de exemplo (mock) para evitar uma página em branco. Verifique se os dados existem no seu banco de dados e se o backend do App Hosting tem as permissões corretas para acessá-los.");
        return NextResponse.json(mockEditais);
      }

      // This logic handles if the data is at `editais/` or `editais/editais/`
      const editaisData = data.editais && typeof data.editais === 'object' ? data.editais : data;

      const editaisArray: Edital[] = Object.keys(editaisData).map(key => ({
        id: key,
        ...editaisData[key]
      }));
      
      console.log(`API: Sucesso! ${editaisArray.length} edital(is) encontrado(s) no Firebase DB.`);
      return NextResponse.json(editaisArray);

    } catch (error: any) {
      console.error("API ERRO CRÍTICO: Falha ao buscar dados do Firebase em produção. Detalhes:", error);
      console.warn("API AVISO: Devido a um erro crítico ao acessar o Firebase, a aplicação está retornando dados de exemplo (mock) para evitar uma falha completa.");
      // Fallback to mock data in case of any production error to keep the site alive
      return NextResponse.json(mockEditais);
    }
  } else {
    // Fallback for local development or build time
    console.log("API: Ambiente de build ou local detectado. Usando dados de exemplo (mockEditais).");
    return NextResponse.json(mockEditais);
  }
}
