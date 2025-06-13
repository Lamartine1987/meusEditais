
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Library, CheckCircle, Clock, CalendarCheck, AlertTriangle, FilterIcon, Target, BookOpen, Layers } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RevisionScheduleEntry, StudyLogEntry, QuestionLogEntry, Edital, Cargo, Subject as SubjectType, Topic as TopicType } from '@/types';
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

  const [selectedTopicId, setSelectedTopicId] = useState<'all_topics_in_subject' | string>('all_topics_in_subject');
  const [topicsForFilter, setTopicsForFilter] = useState<TopicType[]>([]);


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
    setSelectedSubjectId('all_subjects_in_cargo'); 
  }, [filterScope, allEditaisData]);

  useEffect(() => {
    if (selectedSubjectId !== 'all_subjects_in_cargo' && filterScope !== 'all') {
      const [editalId, cargoId] = filterScope.split('_');
      const edital = allEditaisData.find(e => e.id === editalId);
      const cargo = edital?.cargos?.find(c => c.id === cargoId);
      const subject = cargo?.subjects?.find(s => s.id === selectedSubjectId);
      setTopicsForFilter(subject?.topics || []);
    } else {
      setTopicsForFilter([]);
    }
    setSelectedTopicId('all_topics_in_subject');
  }, [selectedSubjectId, filterScope, allEditaisData]);


  const stats = useMemo(() => {
    if (!user) return null;

    const filterByScopeSubjectTopicAndPeriod = <T extends { compositeTopicId: string; date?: string }>(items: T[] | undefined): T[] => {
      if (!items || items.length === 0) return [];
    
      const { startDate, endDate } = (() => {
        const now = new Date();
        switch (filterPeriod) {
          case 'today': return { startDate: startOfDay(now), endDate: endOfDay(now) };
          case 'this_week': return { startDate: startOfWeek(now, { locale: ptBR }), endDate: endOfWeek(now, { locale: ptBR }) };
          case 'this_month': return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
          case 'all_time': default: return { startDate: null, endDate: null };
        }
      })();
    
      return items.filter(item => {
        if (!item.compositeTopicId || typeof item.compositeTopicId !== 'string') return false;
        
        const parts = item.compositeTopicId.split('_');
        // Logs (study, question) and revision schedules have topicId, so 4 parts: edital_cargo_subject_topic
        // studiedTopicIds also have 4 parts.
        if (parts.length < 4) return false; 
    
        const itemEditalId = parts[0];
        const itemCargoId = parts[1];
        const itemSubjectId = parts[2];
        const itemTopicId = parts[3];
    
        // 1. Filter by Scope (Cargo)
        let passesScopeFilter = filterScope === 'all';
        if (!passesScopeFilter) {
          const [filterEditalId, filterCargoId] = filterScope.split('_');
          passesScopeFilter = itemEditalId === filterEditalId && itemCargoId === filterCargoId;
        }
        if (!passesScopeFilter) return false;
    
        // 2. Filter by Subject
        let passesSubjectFilter = true;
        if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
          passesSubjectFilter = itemSubjectId === selectedSubjectId;
        }
        if (!passesSubjectFilter) return false;
    
        // 3. Filter by Topic
        let passesTopicFilter = true;
        if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo' && selectedTopicId !== 'all_topics_in_subject') {
          passesTopicFilter = itemTopicId === selectedTopicId;
        }
        if (!passesTopicFilter) return false;
    
        // 4. Filter by Period (only if period is not 'all_time')
        if (filterPeriod === 'all_time') return true;
        if (!item.date) return false; // Item must have a date for period filtering
        if (!startDate || !endDate) return false; // Should not happen if period is not 'all_time' but good check
    
        const itemDate = parseISO(item.date);
        return isWithinInterval(itemDate, { start: startDate, end: endDate });
      });
    };
    
    // For studiedTopicIds, it doesn't have a date, so period filter doesn't apply directly.
    // It's just a list of IDs. The filtering here is based on scope, subject, and topic.
    const filterCompositeIdsByScopeSubjectAndTopic = (compositeIds: string[] | undefined): string[] => {
        if (!compositeIds || compositeIds.length === 0) return [];
    
        return compositeIds.filter(id => {
            if (!id || typeof id !== 'string') return false;
            const parts = id.split('_');
            if (parts.length < 4) return false; // edital_cargo_subject_topic
    
            const itemEditalId = parts[0];
            const itemCargoId = parts[1];
            const itemSubjectId = parts[2];
            const itemTopicId = parts[3];
    
            let passesScopeFilter = filterScope === 'all';
            if (!passesScopeFilter) {
                const [filterEditalId, filterCargoId] = filterScope.split('_');
                passesScopeFilter = itemEditalId === filterEditalId && itemCargoId === filterCargoId;
            }
            if (!passesScopeFilter) return false;
    
            let passesSubjectFilter = true;
            if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
                passesSubjectFilter = itemSubjectId === selectedSubjectId;
            }
            if (!passesSubjectFilter) return false;
    
            let passesTopicFilter = true;
            if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo' && selectedTopicId !== 'all_topics_in_subject') {
                passesTopicFilter = itemTopicId === selectedTopicId;
            }
            return passesTopicFilter;
        });
    };

    const filteredStudyLogs = filterByScopeSubjectTopicAndPeriod(user.studyLogs);
    const filteredQuestionLogs = filterByScopeSubjectTopicAndPeriod(user.questionLogs);
    const filteredStudiedTopicIds = filterCompositeIdsByScopeSubjectAndTopic(user.studiedTopicIds);
    // Revision schedules have a 'date' (scheduledDate) but the period filter should apply to 'scheduledDate'.
    // However, the current period filter is designed for 'date' field of creation.
    // For "Revisões Pendentes", we usually care about *all* pending revisions regardless of creation date,
    // but applying scope/subject/topic is important.
    // Let's filter revisions primarily by scope/subject/topic for counts, and then for "pending" status.
    const relevantRevisionSchedules = filterCompositeIdsByScopeSubjectAndTopic(user.revisionSchedules?.map(rs => rs.compositeTopicId));
    const allUserRevisions = user.revisionSchedules || [];
    const filteredRevisionSchedulesObjects = allUserRevisions.filter(rs => relevantRevisionSchedules.includes(rs.compositeTopicId));


    const totalCargosInscritos = user.registeredCargoIds?.length || 0;
    const totalTopicosEstudados = filteredStudiedTopicIds.length;

    const tempoTotalEstudoSegundos = filteredStudyLogs.reduce((acc, log) => acc + log.duration, 0);
    const tempoTotalEstudoFormatado = formatTotalDuration(tempoTotalEstudoSegundos);

    const revisoesPendentes = filteredRevisionSchedulesObjects.filter(
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
  }, [user, filterScope, filterPeriod, selectedSubjectId, selectedTopicId, allEditaisData]);


  const getFilterDescription = useCallback(() => {
    let scopeDesc = "geral";
    if (filterScope !== 'all') {
        const cargoInfo = registeredCargosList.find(c => c.id === filterScope);
        scopeDesc = cargoInfo ? `para ${cargoInfo.name.replace(/\s\(.*\)/, '')}` : "para este cargo"; 
    }

    let subjectDesc = "";
    if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
        const subjectInfo = subjectsForFilter.find(s => s.id === selectedSubjectId);
        subjectDesc = subjectInfo ? ` na matéria ${subjectInfo.name}` : "";
    }

    let topicDesc = "";
    if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo' && selectedTopicId !== 'all_topics_in_subject') {
        const topicInfo = topicsForFilter.find(t => t.id === selectedTopicId);
        topicDesc = topicInfo ? ` no assunto "${topicInfo.name}"` : "";
    }
    
    let periodDesc = "";
    switch(filterPeriod) {
        case 'today': periodDesc = " (hoje)"; break;
        case 'this_week': periodDesc = " (esta semana)"; break;
        case 'this_month': periodDesc = " (este mês)"; break;
        case 'all_time': periodDesc = " (todo o período)"; break;
    }
    
    if (filterScope === 'all' && selectedSubjectId === 'all_subjects_in_cargo' && selectedTopicId === 'all_topics_in_subject' && filterPeriod === 'all_time') {
      return "Visão geral completa.";
    }

    return `${scopeDesc}${subjectDesc}${topicDesc}${periodDesc}.`;
  }, [filterScope, selectedSubjectId, selectedTopicId, filterPeriod, registeredCargosList, subjectsForFilter, topicsForFilter]);


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
          description="Acompanhe seu progresso detalhado nos estudos."
        />

        <Card className="mb-6 shadow-md rounded-xl bg-card">
            <CardHeader>
                <CardTitle className="text-lg flex items-center"><FilterIcon className="mr-2 h-5 w-5 text-primary"/>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            <SelectItem value="all_subjects_in_cargo">Todas as Matérias</SelectItem>
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
                    <label htmlFor="selectedTopicId" className="block text-sm font-medium text-muted-foreground mb-1">Assunto (Tópico)</label>
                    <Select
                        value={selectedTopicId}
                        onValueChange={setSelectedTopicId}
                        disabled={selectedSubjectId === 'all_subjects_in_cargo' || topicsForFilter.length === 0}
                    >
                        <SelectTrigger id="selectedTopicId">
                            <SelectValue placeholder="Selecionar assunto..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_topics_in_subject">Todos os Assuntos</SelectItem>
                            {topicsForFilter.map(topic => (
                                <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     {selectedSubjectId !== 'all_subjects_in_cargo' && topicsForFilter.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">Nenhum assunto encontrado para esta matéria.</p>
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
        
        <p className="text-sm text-muted-foreground mb-6 italic text-center">Exibindo estatísticas {getFilterDescription()}</p>


        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {filterScope === 'all' && selectedSubjectId === 'all_subjects_in_cargo' && selectedTopicId === 'all_topics_in_subject' && (
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
                Tópicos marcados como estudados.
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
                Soma dos registros de estudo.
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
                Tópicos agendados para revisão.
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
                    </>
                ) : (
                  <>
                    <p className="text-muted-foreground">Nenhum registro de questões encontrado para os filtros selecionados.</p>
                  </>
                )}
            </CardContent>
          </Card>

        </div>
      </div>
    </PageWrapper>
  );
}

    