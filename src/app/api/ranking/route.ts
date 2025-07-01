
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { User, StudyLogEntry, QuestionLogEntry } from '@/types';

export const dynamic = 'force-dynamic'; // Garante que a rota seja sempre executada dinamicamente

interface PublicRankingUser {
  id: string;
  name: string;
  avatarUrl?: string;
  totalStudyTime: number; // in seconds
  totalQuestionsAnswered: number;
  score: number;
}

export async function GET() {
  try {
    console.log("API: Tentando buscar dados de todos os usuários para o ranking.");
    
    const usersRef = adminDb.ref('users');
    const snapshot = await usersRef.once('value');
    const allUsersData = snapshot.val();

    if (!allUsersData) {
      console.log("API: Nenhum usuário encontrado no banco de dados.");
      return NextResponse.json([]);
    }

    const rankingData: PublicRankingUser[] = Object.keys(allUsersData).map(userId => {
      const userData: User = allUsersData[userId];
      
      const totalStudyTime = (userData.studyLogs || []).reduce(
        (acc: number, log: StudyLogEntry) => acc + (log.duration || 0),
        0
      );
      
      const totalQuestionsAnswered = (userData.questionLogs || []).reduce(
        (acc: number, log: QuestionLogEntry) => acc + (log.totalQuestions || 0),
        0
      );

      // Scoring logic: 1 point per minute of study + 1 point per question answered
      const score = Math.floor(totalStudyTime / 60) + totalQuestionsAnswered;

      return {
        id: userId,
        name: userData.name || 'Usuário Anônimo',
        avatarUrl: userData.avatarUrl,
        totalStudyTime: totalStudyTime,
        totalQuestionsAnswered: totalQuestionsAnswered,
        score: score,
      };
    });

    // Filtra usuários que não têm pontuação e ordena os demais
    const sortedRanking = rankingData
      .filter(user => user.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log(`API: Ranking processado com sucesso para ${sortedRanking.length} usuários.`);
    // We don't need to send the score to the client, just the display data
    const clientSafeRanking = sortedRanking.map(({ score, ...rest }) => rest);
    return NextResponse.json(clientSafeRanking);

  } catch (error: any) {
    console.error("API Ranking Error: Falha ao buscar ou processar dados do ranking.", error);
    return NextResponse.json(
      { error: 'Falha ao buscar os dados do ranking.', details: error.message }, 
      { status: 500 }
    );
  }
}
