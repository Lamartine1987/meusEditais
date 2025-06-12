
"use client";

import { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Library, CheckCircle, Clock, CalendarCheck, AlertTriangle, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { RevisionScheduleEntry } from '@/types';
import { parseISO, isToday, isPast } from 'date-fns';

const formatTotalDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function EstatisticasPage() {
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  const stats = useMemo(() => {
    if (!user) return null;

    const totalCargosInscritos = user.registeredCargoIds?.length || 0;
    const totalTopicosEstudados = user.studiedTopicIds?.length || 0;
    
    const tempoTotalEstudoSegundos = user.studyLogs?.reduce((acc, log) => acc + log.duration, 0) || 0;
    const tempoTotalEstudoFormatado = formatTotalDuration(tempoTotalEstudoSegundos);

    const revisoesPendentes = user.revisionSchedules?.filter(
      (rs: RevisionScheduleEntry) => !rs.isReviewed && (isToday(parseISO(rs.scheduledDate)) || isPast(parseISO(rs.scheduledDate)))
    ).length || 0;

    return {
      totalCargosInscritos,
      totalTopicosEstudados,
      tempoTotalEstudoFormatado,
      revisoesPendentes,
    };
  }, [user]);

  if (isLoading || authLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!user) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <Card className="max-w-md mx-auto shadow-lg rounded-xl">
            <CardHeader>
              <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
              <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para ver suas estatísticas.</p>
              <Button asChild size="lg">
                <Link href="/login">Fazer Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  if (!stats) {
     return ( // Should not happen if user is loaded, but as a fallback
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <p>Não foi possível carregar as estatísticas.</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Minhas Estatísticas" 
          description="Acompanhe seu progresso geral nos estudos."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <Card className="shadow-md rounded-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cargos Inscritos</CardTitle>
              <Library className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCargosInscritos}</div>
              <p className="text-xs text-muted-foreground">
                Total de cargos que você está acompanhando.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tópicos Concluídos</CardTitle>
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTopicosEstudados}</div>
              <p className="text-xs text-muted-foreground">
                Número de tópicos marcados como estudados.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tempo Total de Estudo</CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tempoTotalEstudoFormatado}</div>
              <p className="text-xs text-muted-foreground">
                Soma de todos os seus registros de estudo.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revisões Pendentes</CardTitle>
              <CalendarCheck className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.revisoesPendentes}</div>
              <p className="text-xs text-muted-foreground">
                Tópicos agendados para revisão hoje ou em datas passadas.
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Futuramente, podemos adicionar gráficos aqui */}
        {/* 
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Progresso ao Longo do Tempo (Exemplo)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Gráficos serão adicionados aqui em breve.</p>
            </CardContent>
          </Card>
        </div>
        */}

      </div>
    </PageWrapper>
  );
}
