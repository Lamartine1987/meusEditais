
"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Library, CheckCircle, Clock, CalendarCheck, AlertTriangle, FilterIcon, Target, BookOpen, Layers, PieChart as PieChartIcon, BookCopy, BarChartHorizontal, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RevisionScheduleEntry, StudyLogEntry, QuestionLogEntry, Edital, Cargo, Subject as SubjectType, Topic as TopicType } from '@/types';
import { parseISO, isToday, isPast, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis, Cell } from "recharts";


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

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];


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
      const parsed = parseCargoCompositeId(compositeId, allEditaisData);
      if (parsed) {
        const edital = allEditaisData.find(e => e.id === parsed.editalId);
        const cargo = edital?.cargos?.find(c => c.id === parsed.cargoId);
        if (cargo && edital) {
          registeredInfos.push({
            id: compositeId,
            name: `${cargo.name} (${edital.title || 'Edital Desc.'})`,
            editalId: edital.id,
            cargoId: cargo.id
          });
        }
      } else {
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
    
    const totalPaginasLidas = filteredStudyLogs.reduce((acc, log) => {
        if (log.startPage !== undefined && log.endPage !== undefined && log.endPage >= log.startPage) {
            return acc + (log.endPage - log.startPage + 1);
        }
        return acc;
    }, 0);
    const materiaisEstudados = new Set(filteredStudyLogs.map(log => log.pdfName).filter(Boolean)).size;

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

    // --- Chart Data Processing ---
    
    const studyTimeByDay = filteredStudyLogs.reduce((acc, log) => {
      const day = format(parseISO(log.date), 'yyyy-MM-dd');
      acc[day] = (acc[day] || 0) + log.duration;
      return acc;
    }, {} as Record<string, number>);

    const studyTimeData = Object.entries(studyTimeByDay)
      .map(([date, duration]) => ({
        date: format(parseISO(date), 'dd/MM'),
        dateISO: date,
        tempoMin: Math.ceil(duration / 60),
      }))
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      
    const questionPerformanceData = [
      { name: 'Certas', value: totalQuestoesCertas, fill: 'hsl(var(--accent))' },
      { name: 'Erradas', value: totalQuestoesErradas, fill: 'hsl(var(--destructive))' },
    ];
    
    let studyTimeBreakdownData: { name: string; tempoMin: number; fill: string; }[] = [];
    let breakdownChartTitle: string = 'Tempo por Matéria';
    let breakdownChartDescription: string = 'Selecione um cargo para ver os dados.';

    if (filterScope !== 'all') { // A cargo must be selected
      const parsedScope = parseCargoCompositeId(filterScope, allEditaisData);
      
      if (selectedSubjectId !== 'all_subjects_in_cargo') {
        // Breakdown by TOPIC
        breakdownChartTitle = 'Tempo por Assunto (Tópico)';
        breakdownChartDescription = 'Total de minutos estudados para cada assunto da matéria selecionada.';

        const timeByTopic = filteredStudyLogs.reduce((acc, log) => {
          const parsed = robustParseCompositeTopicId(log.compositeTopicId, allEditaisData);
          if (parsed?.topicId) {
            acc[parsed.topicId] = (acc[parsed.topicId] || 0) + log.duration;
          }
          return acc;
        }, {} as Record<string, number>);

        const subjectTopics = parsedScope ? allEditaisData.find(e => e.id === parsedScope.editalId)?.cargos?.find(c => c.id === parsedScope.cargoId)?.subjects?.find(s => s.id === selectedSubjectId)?.topics : [];
        
        if (subjectTopics) {
          studyTimeBreakdownData = Object.entries(timeByTopic).map(([topicId, duration], index) => {
            const topicName = subjectTopics.find(t => t.id === topicId)?.name || 'Desconhecido';
            return { name: topicName, tempoMin: Math.ceil(duration / 60), fill: CHART_COLORS[index % CHART_COLORS.length] };
          }).sort((a, b) => b.tempoMin - a.tempoMin);
        }
      } else { // Breakdown by SUBJECT
        breakdownChartTitle = 'Tempo por Matéria';
        breakdownChartDescription = 'Total de minutos estudados para cada matéria do cargo selecionado.';

        const timeBySubject = filteredStudyLogs.reduce((acc, log) => {
          const parsed = robustParseCompositeTopicId(log.compositeTopicId, allEditaisData);
          if (parsed?.subjectId) {
            acc[parsed.subjectId] = (acc[parsed.subjectId] || 0) + log.duration;
          }
          return acc;
        }, {} as Record<string, number>);

        const cargoSubjects = parsedScope ? allEditaisData.find(e => e.id === parsedScope.editalId)?.cargos?.find(c => c.id === parsedScope.cargoId)?.subjects : [];
        
        if (cargoSubjects) {
          studyTimeBreakdownData = Object.entries(timeBySubject).map(([subjectId, duration], index) => {
            const subjectName = cargoSubjects.find(s => s.id === subjectId)?.name || 'Desconhecido';
            return { name: subjectName, tempoMin: Math.ceil(duration / 60), fill: CHART_COLORS[index % CHART_COLORS.length] };
          }).sort((a, b) => b.tempoMin - a.tempoMin);
        }
      }
    }


    return {
      totalCargosInscritos,
      totalTopicosEstudados,
      tempoTotalEstudoFormatado,
      revisoesPendentes,
      performanceGeralQuestoes,
      totalPaginasLidas,
      materiaisEstudados,
      chartData: {
        studyTimeData,
        questionPerformanceData,
        studyTimeBreakdownData,
        breakdownChartTitle,
        breakdownChartDescription,
      }
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
  
  const questionChartConfig = {
    value: { label: "Questões" },
    Certas: { label: "Certas", color: "hsl(var(--accent))" },
    Erradas: { label: "Erradas", color: "hsl(var(--destructive))" },
  } satisfies ChartConfig;

  const timeChartConfig = {
    tempoMin: { label: "Tempo (min)", color: "hsl(var(--primary))" },
  } satisfies ChartConfig;

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


        <div className="grid grid-cols-1 gap-6">
            <Card className="shadow-lg rounded-xl bg-card">
                <CardHeader>
                    <CardTitle>Resumo de Desempenho</CardTitle>
                    <CardDescription>Suas principais métricas de estudo com base nos filtros selecionados.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        {filterScope === 'all' && (
                            <div className="p-4 rounded-lg bg-muted/50">
                                <Library className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm font-medium text-muted-foreground">Cargos Inscritos</p>
                                <p className="text-2xl font-bold">{stats.totalCargosInscritos}</p>
                            </div>
                        )}
                        <div className="p-4 rounded-lg bg-muted/50">
                            <CheckCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium text-muted-foreground">Tópicos Concluídos</p>
                            <p className="text-2xl font-bold">{stats.totalTopicosEstudados}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                            <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium text-muted-foreground">Tempo de Estudo</p>
                            <p className="text-2xl font-bold">{stats.tempoTotalEstudoFormatado}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                            <CalendarCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium text-muted-foreground">Revisões Pendentes</p>
                            <p className="text-2xl font-bold">{stats.revisoesPendentes}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                            <FileText className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium text-muted-foreground">Materiais Estudados</p>
                            <p className="text-2xl font-bold">{stats.materiaisEstudados}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                            <BookCopy className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm font-medium text-muted-foreground">Páginas Lidas</p>
                            <p className="text-2xl font-bold">{stats.totalPaginasLidas}</p>
                        </div>
                    </div>
                    <div className="pt-6 border-t">
                        <h3 className="text-lg font-semibold flex items-start mb-2">
                            <Target className="h-5 w-5 text-primary mr-2 mt-1" />
                            Desempenho em Questões
                        </h3>
                        {stats.performanceGeralQuestoes.total > 0 ? (
                            <div>
                                <span className="text-3xl font-bold">{stats.performanceGeralQuestoes.aproveitamento.toFixed(1)}%</span>
                                <span className="text-xl font-semibold text-muted-foreground"> de Acerto</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Total de {stats.performanceGeralQuestoes.total} questões ({stats.performanceGeralQuestoes.certas} certas, {stats.performanceGeralQuestoes.erradas} erradas) nos filtros atuais.
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">Nenhum registro de questões encontrado para os filtros selecionados.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats.chartData.studyTimeData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><BarChartHorizontal className="mr-2 h-5 w-5 text-primary" />Tempo de Estudo por Dia</CardTitle>
                <CardDescription>Tempo total de estudo (em minutos) registrado a cada dia no período filtrado.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={timeChartConfig} className="h-[250px] w-full">
                  <BarChart accessibilityLayer data={stats.chartData.studyTimeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}`}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      width={30}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                    <Bar
                      dataKey="tempoMin"
                      fill="var(--color-tempoMin)"
                      radius={4}
                      barSize={60}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                 <CardTitle className="flex items-center"><BarChartHorizontal className="mr-2 h-5 w-5 text-primary" />Tempo de Estudo por Dia</CardTitle>
              </CardHeader>
               <CardContent className="text-center text-muted-foreground py-10">
                 Nenhum dado de tempo de estudo para exibir no gráfico.
               </CardContent>
            </Card>
          )}

          
            {stats.performanceGeralQuestoes.total > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-5 w-5 text-primary" />Desempenho em Questões</CardTitle>
                   <CardDescription>Distribuição de acertos e erros nas questões registradas.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ChartContainer
                    config={questionChartConfig}
                    className="mx-auto aspect-square h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={stats.chartData.questionPerformanceData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        strokeWidth={5}
                      >
                         {stats.chartData.questionPerformanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                         ))}
                      </Pie>
                      <ChartLegend
                        content={<ChartLegendContent nameKey="name" />}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-5 w-5 text-primary" />Desempenho em Questões</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground py-10">
                        Nenhum dado de questões para exibir no gráfico.
                    </CardContent>
                </Card>
            )}

            {stats.chartData.studyTimeBreakdownData.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><BookCopy className="mr-2 h-5 w-5 text-primary" />{stats.chartData.breakdownChartTitle}</CardTitle>
                   <CardDescription>{stats.chartData.breakdownChartDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={timeChartConfig} className="h-[250px] w-full">
                    <BarChart
                      accessibilityLayer
                      data={stats.chartData.studyTimeBreakdownData}
                      layout="vertical"
                      margin={{ left: 10, right: 10 }}
                    >
                      <CartesianGrid horizontal={false} />
                       <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                        width={80} 
                        className="text-xs"
                      />
                      <XAxis dataKey="tempoMin" type="number" hide />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                      />
                      <Bar dataKey="tempoMin" radius={4}>
                        {stats.chartData.studyTimeBreakdownData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            ) : (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><BookCopy className="mr-2 h-5 w-5 text-primary" />Tempo por Matéria/Assunto</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground py-10">
                        {filterScope === 'all'
                            ? 'Selecione um cargo para ver a distribuição de tempo.'
                            : 'Nenhum dado de estudo encontrado para este filtro.'
                        }
                    </CardContent>
                </Card>
            )}
          
        </div>

      </div>
    </PageWrapper>
  );
}
