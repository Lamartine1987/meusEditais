
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { User, StudyLogEntry, QuestionLogEntry } from '@/types';
import { parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export const dynamic = 'force-dynamic'; // Garante que a rota seja sempre executada dinamicamente

interface PublicRankingUser {
  id: string;
  name: string;
  avatarUrl?: string;
  totalStudyTime: number; // in seconds
  totalQuestionsAnswered: number;
  score: number;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // Expects YYYY-MM format

    console.log(`API Ranking: Tentando buscar dados de todos os usuários. Filtro de mês: ${month || 'Nenhum'}`);

    const usersRef = adminDb.ref('users');
    const snapshot = await usersRef.once('value');
    const allUsersData = snapshot.val();

    if (!allUsersData) {
      console.log("API Ranking: Nenhum usuário encontrado no banco de dados.");
      return NextResponse.json([]);
    }

    let dateInterval: { start: Date, end: Date } | null = null;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
        try {
            const monthDate = parseISO(`${month}-01`);
            dateInterval = {
                start: startOfMonth(monthDate),
                end: endOfMonth(monthDate),
            };
        } catch (e) {
            console.warn(`API Ranking: Formato de mês inválido recebido: ${month}. Ignorando filtro.`);
        }
    }


    const rankingData: PublicRankingUser[] = Object.keys(allUsersData)
      .filter(userId => {
        const userData: User = allUsersData[userId];
        return userData.isRankingParticipant === true;
      })
      .map(userId => {
        const userData: User = allUsersData[userId];
        
        const studyLogsToConsider = (userData.studyLogs || []).filter((log: StudyLogEntry) => {
            if (!dateInterval) return true;
            try {
                const logDate = parseISO(log.date);
                return isWithinInterval(logDate, dateInterval);
            } catch {
                return false;
            }
        });

        const questionLogsToConsider = (userData.questionLogs || []).filter((log: QuestionLogEntry) => {
            if (!dateInterval) return true;
            try {
                const logDate = parseISO(log.date);
                return isWithinInterval(logDate, dateInterval);
            } catch {
                return false;
            }
        });
        
        const totalStudyTime = studyLogsToConsider.reduce(
          (acc: number, log: StudyLogEntry) => acc + (log.duration || 0),
          0
        );
        
        const totalQuestionsAnswered = questionLogsToConsider.reduce(
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

    console.log(`API Ranking: Ranking processado com sucesso para ${sortedRanking.length} usuários.`);
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
