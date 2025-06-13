
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

interface ParsedIds {
  editalId: string;
  cargoId: string;
  subjectId?: string;
  topicId?: string;
}

const parseCompositeIdForStats = (compositeId: string): ParsedIds | null => {
  if (!compositeId || typeof compositeId !== 'string') return null;
  const parts = compositeId.split('_');

  if (parts.length < 2) return null; // Minimum: editalId_cargoId

  const editalId = parts[0];
  const cargoId = parts[1];
  let subjectId: string | undefined = undefined;
  let topicId: string | undefined = undefined;

  // Mock data structure implies:
  // Edital ID: 1 part (e.g., "edital1")
  // Cargo ID: 1 part (e.g., "cargo1")
  // Subject ID: 2 parts (e.g., "subj1_1")
  // Topic ID: 3 parts (e.g., "topic1_1_1")
  // Total expected parts = 1 (edital) + 1 (cargo) + 2 (subject) + 3 (topic) = 7
  if (parts.length === 7) {
    subjectId = `${parts[2]}_${parts[3]}`; // e.g., "subj1_1"
    topicId = `${parts[4]}_${parts[5]}_${parts[6]}`; // e.g., "topic1_1_1"
  }
  // Add other `else if` blocks here if other ID structures in mockData need specific parsing rules.
  // For example, if a subjectId was "math" (1 part) and topicId "algebra" (1 part), parts.length would be 4.
  // else if (parts.length === 4) {
  //   subjectId = parts[2];
  //   topicId = parts[3];
  // }
  // For now, we only explicitly parse the 7-part structure for subject/topic.
  // If not 7 parts, subjectId and topicId will remain undefined, and items will
  // not match specific subject/topic filters.

  return { editalId, cargoId, subjectId, topicId };
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
        const parsed = parseCompositeIdForStats(item.compositeTopicId);
        if (!parsed) return false;
    
        const { editalId: itemEditalId, cargoId: itemCargoId, subjectId: itemSubjectId, topicId: itemTopicId } = parsed;
        
        // 1. Filter by Scope (Cargo)
        if (filterScope !== 'all') {
          const scopeParts = filterScope.split('_');
          // filterScope must be editalId_cargoId (2 parts)
          if (scopeParts.length < 2) return false; 
          const filterEditalId = scopeParts[0];
          const filterCargoId = scopeParts[1];

          if (itemEditalId !== filterEditalId || itemCargoId !== filterCargoId) {
            return false;
          }
        }
    
        // 2. Filter by Subject
        if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
          if (!itemSubjectId || itemSubjectId !== selectedSubjectId) { 
            return false;
          }
        }
    
        // 3. Filter by Topic
        if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo' && selectedTopicId !== 'all_topics_in_subject') {
          if (!itemTopicId || itemTopicId !== selectedTopicId) {
            return false;
          }
        }
    
        // 4. Filter by Period
        if (filterPeriod !== 'all_time') {
          if (!item.date || !startDate || !endDate) { 
            return false; 
          }
          const itemDate = parseISO(item.date);
          if (!isWithinInterval(itemDate, { start: startDate, end: endDate })) {
            return false;
          }
        }
        
        return true; 
      });
    };
        
    const filterCompositeIdsByScopeSubjectAndTopic = (compositeIds: string[] | undefined): string[] => {
        if (!compositeIds || compositeIds.length === 0) return [];
    
        return compositeIds.filter(id => {
            const parsed = parseCompositeIdForStats(id);
            if (!parsed) return false;
            const { editalId: itemEditalId, cargoId: itemCargoId, subjectId: itemSubjectId, topicId: itemTopicId } = parsed;
    
            if (filterScope !== 'all') {
              const scopeParts = filterScope.split('_');
              if (scopeParts.length < 2) return false;
              const filterEditalId = scopeParts[0];
              const filterCargoId = scopeParts[1];
              if (itemEditalId !== filterEditalId || itemCargoId !== filterCargoId) {
                return false;
              }
            }
        
            if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo') {
              if (!itemSubjectId || itemSubjectId !== selectedSubjectId) {
                return false;
              }
            }
        
            if (filterScope !== 'all' && selectedSubjectId !== 'all_subjects_in_cargo' && selectedTopicId !== 'all_topics_in_subject') {
              if (!itemTopicId || itemTopicId !== selectedTopicId) {
                return false;
              }
            }
            return true;
        });
    };

    const filteredStudyLogs = filterByScopeSubjectTopicAndPeriod(user.studyLogs);
    const filteredQuestionLogs = filterByScopeSubjectTopicAndPeriod(user.questionLogs);
    const filteredStudiedTopicIds = filterCompositeIdsByScopeSubjectAndTopic(user.studiedTopicIds);
    
    const allUserRevisions = user.revisionSchedules || [];
    // For revisions, we filter based on the compositeTopicId and then check the date properties separately if needed,
    // as filterByScopeSubjectTopicAndPeriod is for items that *have* a standard 'date' property for period filtering.
    // Here we just want to get the *relevant* revision objects first based on scope/subject/topic.
    const relevantRevisionCompositeIds = filterCompositeIdsByScopeSubjectAndTopic(allUserRevisions.map(rs => rs.compositeTopicId));
    const filteredRevisionSchedulesObjects = allUserRevisions.filter(rs => relevantRevisionCompositeIds.includes(rs.compositeTopicId));


    const totalCargosInscritos = user.registeredCargoIds?.length || 0;
    const totalTopicosEstudados = filteredStudiedTopicIds.length;

    const tempoTotalEstudoSegundos = filteredStudyLogs.reduce((acc, log) => acc + log.duration, 0);
    const tempoTotalEstudoFormatado = formatTotalDuration(tempoTotalEstudoSegundos);

    // Filter revisions by period after getting the relevant objects
    const { startDate: periodStartDate, endDate: periodEndDate } = (() => {
        const now = new Date();
        switch (filterPeriod) {
            case 'today': return { startDate: startOfDay(now), endDate: endOfDay(now) };
            case 'this_week': return { startDate: startOfWeek(now, { locale: ptBR }), endDate: endOfWeek(now, { locale: ptBR }) };
            case 'this_month': return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
            case 'all_time': default: return { startDate: null, endDate: null };
        }
    })();

    const revisoesPendentes = filteredRevisionSchedulesObjects.filter(
      (rs: RevisionScheduleEntry) => {
        if (!rs.scheduledDate || rs.isReviewed) return false;
        const scheduledDateObj = parseISO(rs.scheduledDate);
        const isDue = isToday(scheduledDateObj) || isPast(scheduledDateObj);
        if (!isDue) return false;

        if (filterPeriod !== 'all_time' && periodStartDate && periodEndDate) {
            // Check if the scheduledDate falls within the selected period
            return isWithinInterval(scheduledDateObj, { start: periodStartDate, end: periodEndDate });
        }
        return true; // If 'all_time' or period dates are not set, just consider if it's due
      }
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
        subjectDesc = subjectInfo ? ` na matéria "${subjectInfo.name}"` : "";
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

    return `Exibindo estatísticas ${scopeDesc}${subjectDesc}${topicDesc}${periodDesc}.`;
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
        
        <p className="text-sm text-muted-foreground mb-6 italic text-center">{getFilterDescription()}</p>


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
                Tópicos marcados como estudados nos filtros atuais.
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
                Soma dos registros de estudo nos filtros atuais.
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
                Tópicos para revisão nos filtros atuais.
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
                        <p className="text-xs text-muted-foreground">Desempenho nos filtros atuais.</p>
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
    

    