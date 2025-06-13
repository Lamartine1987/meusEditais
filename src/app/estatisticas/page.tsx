
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Library, CheckCircle, Clock, CalendarCheck, AlertTriangle, FilterIcon, Target, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RevisionScheduleEntry, StudyLogEntry, QuestionLogEntry, Edital, Cargo, Subject as SubjectType } from '@/types';
import { mockEditais } from '@/lib/mock-data';
import { parseISO, isToday, isPast, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatTotalDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface RegisteredCargoInfo {
  id: string; // compositeId: editalId_cargoId
  name: string;
  editalId: string;
  cargoId: string;
}

const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};
const endOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

export default function EstatisticasPage() {
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [allEditaisData, setAllEditaisData] = useState<Edital[]>([]);

  const [filterScope, setFilterScope] = useState<'all' | string>('all'); // 'all' or 'editalId_cargoId'
  const [filterPeriod, setFilterPeriod] = useState<'all_time' | 'today' | 'this_week' | 'this_month'>('all_time');
  const [selectedSubjectId, setSelectedSubjectId] = useState<'all_subjects_in_cargo' | string>('all_subjects_in_cargo');
  const [subjectsForFilter, setSubjectsForFilter] = useState<SubjectType[]>([]);


  useEffect(() => {
    setAllEditaisData(mockEditais);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  const registeredCargosList = useMemo((): RegisteredCargoInfo[] => {
    if (!user?.registeredCargoIds || !allEditaisData.length) return [];
    return user.registeredCargoIds.map(compositeId => {
      const [editalId, cargoId] = compositeId.split('_');
      const edital = allEditaisData.find(e => e.id === editalId);
      const cargo = edital?.cargos?.find(c => c.id === cargoId);
      return {
        id: compositeId,
        name: cargo ? `${cargo.name} (${edital?.title || 'Edital Desconhecido'})` : `Cargo ${compositeId}`,
        editalId,
        cargoId
      };
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [user?.registeredCargoIds, allEditaisData]);

  useEffect(() => {
    if (filterScope !== 'all') {
      const [editalId, cargoId] = filterScope.split('_');
      const edital = allEditaisData.find(e => e.id === editalId);
      const cargo = edital?.cargos?.find(c => c.id === cargoId);
      setSubjectsForFilter(cargo?.subjects || []);
    } else {
      setSubjectsForFilter([]);
    }
    setSelectedSubjectId('all_subjects_in_cargo'); // Reset subject when scope changes
  }, [filterScope, allEditaisData]);


  const stats = useMemo(() => {
    if (!user) return null;

    const filterByScopeAndSubjectAndPeriod = <T extends { compositeTopicId: string; date?: string }>(items: T[] | undefined): T[] => {
      if (!items || items.length === 0) return [];

      const { startDate, endDate } = (() => {
        const now = new Date();
        switch (filterPeriod) {
          case 'today':
            return { startDate: startOfDay(now), endDate: endOfDay(now) };
          case 'this_week':
            return { startDate: startOfWeek(now, { locale: ptBR }), endDate: endOfWeek(now, { locale: ptBR }) };
          case 'this_month':
            return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
          case 'all_time':
          default:
            return { startDate: null, endDate: null };
        }
      })();

      return items.filter(item => {
        if (!item.compositeTopicId || typeof item.compositeTopicId !== 'string') {
          return false; 
        }

        const parts = item.compositeTopicId.split('_');
        if (parts.length < 3) { // Precisa de editalId, cargoId, subjectId para a maioria dos filtros. StudyLogs terão 4.
            return false;
        }

        const itemEditalId = parts[0];
        const itemCargoId = parts[1];
        const itemSubjectId = parts[2];

        // 1. Filtrar por Escopo (Cargo)
        let passesScopeFilter = filterScope === 'all';
        if (!passesScopeFilter) { 
          const [filterEditalId, filterCargoId] = filterScope.split('_');
          passesScopeFilter = itemEditalId === filterEditalId && itemCargoId === filterCargoId;
        }
        if (!passesScopeFilter) return false;

        // 2. Filtrar por Matéria
        let passesSubjectFilter = true; 
        if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
          passesSubjectFilter = itemSubjectId === selectedSubjectId;
        }
        if (!passesSubjectFilter) return false;

        // 3. Filtrar por Período
        if (filterPeriod === 'all_time') return true;
        if (!item.date) return false; 

        if (!startDate || !endDate) {
           return false; // Se período específico mas datas não estão ok, não deve passar.
        }

        const itemDate = parseISO(item.date);
        return isWithinInterval(itemDate, { start: startDate, end: endDate });
      });
    };

    const filterTopicsByScopeAndSubject = (topicIds: string[] | undefined): string[] => {
        if(!topicIds || topicIds.length === 0) return [];
        let filtered = topicIds;
        if(filterScope !== 'all') {
            filtered = filtered.filter(id => {
                if (!id || typeof id !== 'string') return false;
                const parts = id.split('_');
                if (parts.length < 4) return false; // edital_cargo_materia_topico
                const [filterEditalId, filterCargoId] = filterScope.split('_');
                return parts[0] === filterEditalId && parts[1] === filterCargoId;
            });
            if(selectedSubjectId !== 'all_subjects_in_cargo'){
                filtered = filtered.filter(id => {
                     if (!id || typeof id !== 'string') return false;
                     const parts = id.split('_');
                     if (parts.length < 4) return false;
                     return parts[2] === selectedSubjectId;
                });
            }
        }
        return filtered;
    };

    const filterRevisionsByScopeAndSubject = (revisions: RevisionScheduleEntry[] | undefined): RevisionScheduleEntry[] => {
        if(!revisions || revisions.length === 0) return [];
        let filtered = revisions;
        if(filterScope !== 'all'){
            filtered = filtered.filter(rs => {
                if (!rs.compositeTopicId || typeof rs.compositeTopicId !== 'string') return false;
                const parts = rs.compositeTopicId.split('_');
                if (parts.length < 4) return false; // edital_cargo_materia_topico
                const [filterEditalId, filterCargoId] = filterScope.split('_');
                return parts[0] === filterEditalId && parts[1] === filterCargoId;
            });
            if(selectedSubjectId !== 'all_subjects_in_cargo'){
                 filtered = filtered.filter(rs => {
                    if (!rs.compositeTopicId || typeof rs.compositeTopicId !== 'string') return false;
                    const parts = rs.compositeTopicId.split('_');
                    if (parts.length < 4) return false;
                    return parts[2] === selectedSubjectId;
                 });
            }
        }
        return filtered;
    }

    const filteredStudyLogs = filterByScopeAndSubjectAndPeriod(user.studyLogs);
    const filteredQuestionLogs = filterByScopeAndSubjectAndPeriod(user.questionLogs);
    const filteredStudiedTopicIds = filterTopicsByScopeAndSubject(user.studiedTopicIds);
    const filteredRevisionSchedules = filterRevisionsByScopeAndSubject(user.revisionSchedules);


    const totalCargosInscritos = user.registeredCargoIds?.length || 0;
    const totalTopicosEstudados = filteredStudiedTopicIds.length;

    const tempoTotalEstudoSegundos = filteredStudyLogs.reduce((acc, log) => acc + log.duration, 0);
    const tempoTotalEstudoFormatado = formatTotalDuration(tempoTotalEstudoSegundos);

    const revisoesPendentes = filteredRevisionSchedules.filter(
      (rs: RevisionScheduleEntry) => !rs.isReviewed && rs.scheduledDate && (isToday(parseISO(rs.scheduledDate)) || isPast(parseISO(rs.scheduledDate)))
    ).length;

    const totalQuestoesRespondidas = filteredQuestionLogs.reduce((acc, log) => acc + log.totalQuestions, 0);
    const totalQuestoesCertas = filteredQuestionLogs.reduce((acc, log) => acc + log.correctQuestions, 0);
    const totalQuestoesErradas = filteredQuestionLogs.reduce((acc, log) => acc + log.incorrectQuestions, 0);
    const percentualAcertoMedio = totalQuestoesRespondidas > 0 ? (totalQuestoesCertas / totalQuestoesRespondidas) * 100 : 0;
    const performanceGeralQuestoes = {
        total: totalQuestoesRespondidas,
        certas: totalQuestoesCertas,
        erradas: totalQuestoesErradas,
        aproveitamento: percentualAcertoMedio
    };


    return {
      totalCargosInscritos,
      totalTopicosEstudados,
      tempoTotalEstudoFormatado,
      revisoesPendentes,
      performanceGeralQuestoes,
    };
  }, [user, filterScope, filterPeriod, selectedSubjectId, allEditaisData]);


  const getFilterDescription = useCallback(() => {
    let scopeDesc = "todos os cargos";
    if (filterScope !== 'all') {
        const cargoInfo = registeredCargosList.find(c => c.id === filterScope);
        scopeDesc = cargoInfo ? cargoInfo.name.replace(/\s\(.*\)/, '') : "este cargo"; 
    }

    let subjectDesc = "";
    if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
        const subjectInfo = subjectsForFilter.find(s => s.id === selectedSubjectId);
        subjectDesc = subjectInfo ? ` na matéria ${subjectInfo.name}` : "";
    }
    
    let periodDesc = "";
    switch(filterPeriod) {
        case 'today': periodDesc = "hoje"; break;
        case 'this_week': periodDesc = "esta semana"; break;
        case 'this_month': periodDesc = "este mês"; break;
        case 'all_time': periodDesc = "todo o período"; break;
    }

    if (filterScope === 'all' && selectedSubjectId === 'all_subjects_in_cargo' && filterPeriod === 'all_time') {
      return "geral";
    }

    return `para ${scopeDesc}${subjectDesc} (${periodDesc})`;
  }, [filterScope, selectedSubjectId, filterPeriod, registeredCargosList, subjectsForFilter]);


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
     return (
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

        <Card className="mb-6 shadow-md rounded-xl bg-card">
            <CardHeader>
                <CardTitle className="text-lg flex items-center"><FilterIcon className="mr-2 h-5 w-5 text-primary"/>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="filterScope" className="block text-sm font-medium text-muted-foreground mb-1">Escopo (Cargo)</label>
                    <Select value={filterScope} onValueChange={setFilterScope}>
                        <SelectTrigger id="filterScope">
                            <SelectValue placeholder="Selecionar escopo..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Visão Geral (Todos os Cargos)</SelectItem>
                            {registeredCargosList.map(cargo => (
                                <SelectItem key={cargo.id} value={cargo.id}>{cargo.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <label htmlFor="selectedSubjectId" className="block text-sm font-medium text-muted-foreground mb-1">Matéria</label>
                    <Select
                        value={selectedSubjectId}
                        onValueChange={setSelectedSubjectId}
                        disabled={filterScope === 'all' || subjectsForFilter.length === 0}
                    >
                        <SelectTrigger id="selectedSubjectId">
                            <SelectValue placeholder="Selecionar matéria..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_subjects_in_cargo">Todas as Matérias deste Cargo</SelectItem>
                            {subjectsForFilter.map(subject => (
                                <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     {filterScope !== 'all' && subjectsForFilter.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Nenhuma matéria encontrada para este cargo.</p>
                    )}
                </div>
                <div>
                    <label htmlFor="filterPeriod" className="block text-sm font-medium text-muted-foreground mb-1">Período</label>
                    <Select value={filterPeriod} onValueChange={(value) => setFilterPeriod(value as any)}>
                        <SelectTrigger id="filterPeriod">
                            <SelectValue placeholder="Selecionar período..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_time">Todo o Período</SelectItem>
                            <SelectItem value="today">Hoje</SelectItem>
                            <SelectItem value="this_week">Esta Semana</SelectItem>
                            <SelectItem value="this_month">Este Mês</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filterScope === 'all' && selectedSubjectId === 'all_subjects_in_cargo' && (
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
          )}

          <Card className="shadow-md rounded-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tópicos Concluídos</CardTitle>
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTopicosEstudados}</div>
              <p className="text-xs text-muted-foreground">
                Tópicos marcados como estudados {getFilterDescription()}.
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
                Soma dos registros de estudo {getFilterDescription()}.
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
                Tópicos para revisão {getFilterDescription()}.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-md rounded-xl bg-card col-span-1 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Desempenho em Questões</CardTitle>
              <Target className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {stats.performanceGeralQuestoes.total > 0 ? (
                    <>
                        <div className="text-2xl font-bold mb-2">{stats.performanceGeralQuestoes.aproveitamento.toFixed(1)}% de Acerto</div>
                        <p className="text-sm text-muted-foreground mb-1">
                            Total: {stats.performanceGeralQuestoes.total} questões | Certas: {stats.performanceGeralQuestoes.certas} | Erradas: {stats.performanceGeralQuestoes.erradas}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {getFilterDescription()}
                        </p>
                    </>
                ) : (
                  <>
                    <p className="text-muted-foreground">Nenhum registro de questões encontrado para os filtros selecionados.</p>
                     <p className="text-xs text-muted-foreground mt-1">
                        {getFilterDescription()}
                    </p>
                  </>
                )}
            </CardContent>
          </Card>

        </div>
      </div>
    </PageWrapper>
  );
}

    