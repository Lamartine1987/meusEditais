
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
import { parseISO, isToday, isPast, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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

const robustParseCompositeTopicId = (compositeId: string, allEditais: Edital[]): ParsedIds | null => {
    if (!compositeId || typeof compositeId !== 'string' || !allEditais || allEditais.length === 0) {
        return null;
    }

    for (const edital of allEditais) {
        if (compositeId.startsWith(edital.id + '_')) {
            const restAfterEdital = compositeId.substring(edital.id.length + 1);
            
            for (const cargo of edital.cargos || []) {
                if (restAfterEdital.startsWith(cargo.id + '_')) {
                    const restAfterCargo = restAfterEdital.substring(cargo.id.length + 1);

                    for (const subject of cargo.subjects || []) {
                        if (restAfterCargo.startsWith(subject.id + '_')) {
                            const topicId = restAfterCargo.substring(subject.id.length + 1);
                            
                            const topic = subject.topics?.find(t => t.id === topicId);
                            if (topic) {
                                return {
                                    editalId: edital.id,
                                    cargoId: cargo.id,
                                    subjectId: subject.id,
                                    topicId: topic.id
                                };
                            }
                        }
                    }
                }
            }
        }
    }
    return null; // Return null if no complete match is found
}

const parseCargoCompositeId = (compositeId: string, allEditais: Edital[]): { editalId: string, cargoId: string } | null => {
    if (!compositeId || typeof compositeId !== 'string' || !allEditais || allEditais.length === 0) {
        return null;
    }

    for (const edital of allEditais) {
        if (compositeId.startsWith(edital.id + '_')) {
            const cargoId = compositeId.substring(edital.id.length + 1);
            const cargo = edital.cargos?.find(c => c.id === cargoId);
            if (cargo) {
                return {
                    editalId: edital.id,
                    cargoId: cargo.id,
                };
            }
        }
    }
    return null;
};


export default function EstatisticasPage() {
  const { user, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [allEditaisData, setAllEditaisData] = useState<Edital[]>([]);

  const [filterScope, setFilterScope] = useState<'all' | string>('all'); // 'all' or 'editalId_cargoId'
  const [filterPeriod, setFilterPeriod] = useState<'all_time' | 'today' | 'this_week' | 'this_month' | 'specific_month'>('all_time');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<'all_subjects_in_cargo' | string>('all_subjects_in_cargo');
  const [subjectsForFilter, setSubjectsForFilter] = useState<SubjectType[]>([]);

  const [selectedTopicId, setSelectedTopicId] = useState<'all_topics_in_subject' | string>('all_topics_in_subject');
  const [topicsForFilter, setTopicsForFilter] = useState<TopicType[]>([]);


  useEffect(() => {
    const fetchAllEditais = async () => {
      try {
        const response = await fetch('/api/editais');
        if (!response.ok) {
          throw new Error('Falha ao buscar a lista de editais.');
        }
        const data: Edital[] = await response.json();
        setAllEditaisData(data);
      } catch (error: any) {
        console.error("Estatísticas: Erro ao buscar dados dos editais:", error);
        toast({
          title: "Erro de Dados",
          description: "Não foi possível carregar os dados dos editais para as estatísticas.",
          variant: "destructive",
        });
        setAllEditaisData([]);
      }
    };
    fetchAllEditais();
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading]);

  const registeredCargosList = useMemo((): RegisteredCargoInfo[] => {
    if (!user?.registeredCargoIds || !allEditaisData.length) return [];
    
    const registeredInfos: RegisteredCargoInfo[] = [];

    user.registeredCargoIds.forEach(compositeId => {
      let foundMatch = false;
      for (const edital of allEditaisData) {
        if (typeof compositeId === 'string' && compositeId.startsWith(`${edital.id}_`)) {
          const cargoId = compositeId.substring(edital.id.length + 1);
          const cargo = edital.cargos?.find(c => c.id === cargoId);

          if (cargo) {
            registeredInfos.push({
              id: compositeId,
              name: `${cargo.name} (${edital.title || 'Edital Desconhecido'})`,
              editalId: edital.id,
              cargoId: cargo.id
            });
            foundMatch = true;
            break; 
          }
        }
      }
      if (!foundMatch) {
          // Fallback if no match is found, displays the raw ID.
          registeredInfos.push({
            id: compositeId,
            name: `Cargo ${compositeId}`,
            editalId: 'unknown',
            cargoId: 'unknown'
          });
          console.warn(`[EstatisticasPage] Could not find a valid edital/cargo match for composite ID: '${compositeId}'`);
      }
    });

    return registeredInfos.sort((a,b) => a.name.localeCompare(b.name));
  }, [user?.registeredCargoIds, allEditaisData]);

  const availableMonths = useMemo((): string[] => {
    if (!user) return [];
    
    const allDateStrings: string[] = [
      ...(user.studyLogs || []).map(l => l.date),
      ...(user.questionLogs || []).map(l => l.date),
      ...(user.revisionSchedules || []).map(l => l.scheduledDate),
    ].filter((d): d is string => !!d);

    if (allDateStrings.length === 0) return [];

    const months = new Set<string>();
    allDateStrings.forEach(isoDate => {
      try {
        const date = parseISO(isoDate);
        if (!isNaN(date.getTime())) { 
          months.add(format(date, 'yyyy-MM'));
        }
      } catch (e) {
        console.warn(`[EstatisticasPage] Could not parse date: ${isoDate}`);
      }
    });
    
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [user]);

  useEffect(() => {
    if (filterScope !== 'all') {
        const parsedScope = parseCargoCompositeId(filterScope, allEditaisData);
        if (parsedScope) {
            const edital = allEditaisData.find(e => e.id === parsedScope.editalId);
            const cargo = edital?.cargos?.find(c => c.id === parsedScope.cargoId);
            setSubjectsForFilter(cargo?.subjects || []);
        } else {
             setSubjectsForFilter([]);
        }
    } else {
      setSubjectsForFilter([]);
    }
    setSelectedSubjectId('all_subjects_in_cargo');
  }, [filterScope, allEditaisData]);

  useEffect(() => {
    if (selectedSubjectId !== 'all_subjects_in_cargo' && filterScope !== 'all') {
      const parsedScope = parseCargoCompositeId(filterScope, allEditaisData);
      if(parsedScope) {
        const edital = allEditaisData.find(e => e.id === parsedScope.editalId);
        const cargo = edital?.cargos?.find(c => c.id === parsedScope.cargoId);
        const subject = cargo?.subjects?.find(s => s.id === selectedSubjectId);
        setTopicsForFilter(subject?.topics || []);
      } else {
         setTopicsForFilter([]);
      }
    } else {
      setTopicsForFilter([]);
    }
    setSelectedTopicId('all_topics_in_subject');
  }, [selectedSubjectId, filterScope, allEditaisData]);


  const stats = useMemo(() => {
    if (!user || !allEditaisData.length) return null;

    const { startDate, endDate } = (() => {
        const now = new Date();
        switch (filterPeriod) {
          case 'today': return { startDate: startOfDay(now), endDate: endOfDay(now) };
          case 'this_week': return { startDate: startOfWeek(now, { locale: ptBR }), endDate: endOfWeek(now, { locale: ptBR }) };
          case 'this_month': return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
          case 'specific_month': {
            if (!selectedMonth) return { startDate: null, endDate: null };
            try {
                const monthDate = parseISO(`${selectedMonth}-01`);
                return { startDate: startOfMonth(monthDate), endDate: endOfMonth(monthDate) };
            } catch (e) {
                console.error(`[EstatisticasPage] Invalid month format: ${selectedMonth}`);
                return { startDate: null, endDate: null };
            }
          }
          case 'all_time': default: return { startDate: null, endDate: null };
        }
    })();

    const filterByScopeSubjectTopicAndPeriod = <T extends { compositeTopicId: string; date?: string }>(items: T[] | undefined): T[] => {
      if (!items || items.length === 0) return [];
    
      return items.filter(item => {
        const parsed = robustParseCompositeTopicId(item.compositeTopicId, allEditaisData);
        if (!parsed) return false;
    
        const { editalId: itemEditalId, cargoId: itemCargoId, subjectId: itemSubjectId, topicId: itemTopicId } = parsed;
        
        if (filterScope !== 'all') {
            const parsedScope = parseCargoCompositeId(filterScope, allEditaisData);
            if (!parsedScope || itemEditalId !== parsedScope.editalId || itemCargoId !== parsedScope.cargoId) {
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
    
        if (filterPeriod !== 'all_time') {
          if (!startDate || !endDate) return false;
          if (!item.date) return false; 
          const itemDate = parseISO(item.date);
          if (isNaN(itemDate.getTime()) || !isWithinInterval(itemDate, { start: startDate, end: endDate })) {
            return false;
          }
        }
        
        return true; 
      });
    };
        
    const filterCompositeIdsByScopeSubjectAndTopic = (compositeIds: string[] | undefined): string[] => {
        if (!compositeIds || compositeIds.length === 0) return [];
    
        return compositeIds.filter(id => {
            const parsed = robustParseCompositeTopicId(id, allEditaisData);
            if (!parsed) return false;
            const { editalId: itemEditalId, cargoId: itemCargoId, subjectId: itemSubjectId, topicId: itemTopicId } = parsed;
    
            if (filterScope !== 'all') {
                const parsedScope = parseCargoCompositeId(filterScope, allEditaisData);
                if (!parsedScope || itemEditalId !== parsedScope.editalId || itemCargoId !== parsedScope.cargoId) {
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
    const relevantRevisionCompositeIds = filterCompositeIdsByScopeSubjectAndTopic(allUserRevisions.map(rs => rs.compositeTopicId));
    const filteredRevisionSchedulesObjects = allUserRevisions.filter(rs => relevantRevisionCompositeIds.includes(rs.compositeTopicId));

    const totalCargosInscritos = user.registeredCargoIds?.length || 0;
    const totalTopicosEstudados = filteredStudiedTopicIds.length;

    const tempoTotalEstudoSegundos = filteredStudyLogs.reduce((acc, log) => acc + log.duration, 0);
    const tempoTotalEstudoFormatado = formatTotalDuration(tempoTotalEstudoSegundos);

    const revisoesPendentes = filteredRevisionSchedulesObjects.filter(
      (rs: RevisionScheduleEntry) => {
        if (!rs.scheduledDate || rs.isReviewed) return false;
        const scheduledDateObj = parseISO(rs.scheduledDate);
        const isDue = isToday(scheduledDateObj) || isPast(scheduledDateObj);
        if (!isDue) return false;

        if (filterPeriod !== 'all_time' && startDate && endDate) {
            return isWithinInterval(scheduledDateObj, { start: startDate, end: endDate });
        }
        return true;
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
  }, [user, filterScope, filterPeriod, selectedSubjectId, selectedTopicId, allEditaisData, selectedMonth]);


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
        case 'specific_month':
            if (selectedMonth) {
                try {
                    const monthDate = parseISO(`${selectedMonth}-01`);
                    periodDesc = ` (${format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })})`;
                } catch {
                    periodDesc = " (mês inválido)";
                }
            } else {
                periodDesc = " (mês não selecionado)";
            }
            break;
        case 'all_time': periodDesc = " (todo o período)"; break;
    }
    
    if (filterScope === 'all' && selectedSubjectId === 'all_subjects_in_cargo' && selectedTopicId === 'all_topics_in_subject' && filterPeriod === 'all_time') {
      return "Visão geral completa.";
    }

    return `Exibindo estatísticas ${scopeDesc}${subjectDesc}${topicDesc}${periodDesc}.`;
  }, [filterScope, selectedSubjectId, selectedTopicId, filterPeriod, selectedMonth, registeredCargosList, subjectsForFilter, topicsForFilter]);


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
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    <Select value={filterPeriod} onValueChange={(value) => {
                        const newPeriod = value as any;
                        setFilterPeriod(newPeriod);
                        if (newPeriod !== 'specific_month') {
                            setSelectedMonth(null);
                        } else if (availableMonths.length > 0 && !selectedMonth) {
                            setSelectedMonth(availableMonths[0]);
                        }
                    }}>
                        <SelectTrigger id="filterPeriod">
                            <SelectValue placeholder="Selecionar período..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all_time">Todo o Período</SelectItem>
                            <SelectItem value="this_month">Este Mês</SelectItem>
                            <SelectItem value="this_week">Esta Semana</SelectItem>
                            <SelectItem value="today">Hoje</SelectItem>
                            <SelectItem value="specific_month">Mês Específico</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {filterPeriod === 'specific_month' && (
                  <div>
                    <label htmlFor="monthSelect" className="block text-sm font-medium text-muted-foreground mb-1">Mês Selecionado</label>
                    <Select value={selectedMonth || ''} onValueChange={setSelectedMonth} disabled={availableMonths.length === 0}>
                        <SelectTrigger id="monthSelect">
                            <SelectValue placeholder="Selecione um mês..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableMonths.length > 0 ? (
                                availableMonths.map(monthStr => (
                                    <SelectItem key={monthStr} value={monthStr}>
                                        {format(parseISO(`${monthStr}-01`), "MMMM 'de' yyyy", { locale: ptBR })}
                                    </SelectItem>
                                ))
                            ) : (
                                <SelectItem value="no-data" disabled>Nenhum dado de estudo encontrado</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                  </div>
                )}
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
    

    
