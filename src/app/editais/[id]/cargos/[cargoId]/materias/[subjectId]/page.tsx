
"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType, Topic as TopicType, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, NoteEntry } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Loader2, ArrowLeft, BookOpen, Play, Pause, RotateCcw, Save, 
  TimerIcon, Info, AlertTriangle, CreditCard, Lock, CalendarClock, 
  FileQuestion, FileText, Trash2, History, CheckCircle2, ChevronRight,
  CalendarDays, Target, XCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { isToday, isPast, parseISO, format, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formatDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function SubjectTopicsPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;
  const subjectId = params.subjectId as string;

  const { 
    user, toggleTopicStudyStatus, addStudyLog, deleteStudyLog,
    addQuestionLog, deleteQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus,
    addNote, deleteNote,
    loading: authLoading 
  } = useAuth();
  const { toast } = useToast();

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [subject, setSubject] = useState<SubjectType | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  // Estados locais para formulários de cada tópico
  const [pdfInfos, setPdfInfos] = useState<Record<string, { pdfName: string; startPage: string; endPage: string }>>({});
  const [noteTexts, setNoteTexts] = useState<Record<string, string>>({});
  const [isSavingLog, setIsSavingLog] = useState<Record<string, boolean>>({});
  const [isSavingNote, setIsSavingNote] = useState<Record<string, boolean>>({});

  // Estados para Questões (Modal)
  const [questionData, setQuestionLogData] = useState({ total: '', correct: '', target: '80' });
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);
  const [openQuestionsModalId, setOpenQuestionsModalId] = useState<string | null>(null);

  // Estados para Revisão (Modal)
  const [selectedRevisionDays, setSelectedRevisionDays] = useState('1');
  const [openRevisionModalId, setOpenRevisionModalId] = useState<string | null>(null);

  // Refatoração do Timer
  const [timerStates, setTimerStates] = useState<Record<string, { time: number; isRunning: boolean }>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const activeTimerTopicIdRef = useRef<string | null>(null);

  const [activeAccordionItem, setActiveAccordionItem] = useState<string | null>(null);

  useEffect(() => {
    if (!user || authLoading) return;
    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    
    const activePaidPlans = user.activePlans?.filter(p => p.status === 'active') || [];
    
    const canAccess = activePaidPlans.some(p => 
        p.planId === 'plano_mensal' || 
        p.planId === 'plano_trial' ||
        (p.planId === 'plano_edital' && p.selectedEditalId === editalId) ||
        (p.planId === 'plano_cargo' && p.selectedCargoCompositeId === currentCargoCompositeId)
    );
    
    const suspended = !canAccess && (user.activePlans?.some(p => p.status === 'past_due' || p.status === 'unpaid') ?? false);
    
    setHasAccess(canAccess);
    setIsSuspended(suspended);
  }, [user, authLoading, editalId, cargoId]);

  useEffect(() => {
    const fetchSubjectDetails = async () => {
      setLoadingData(true);
      try {
        const response = await fetch('/api/editais');
        if (!response.ok) throw new Error('Falha ao buscar dados.');
        const allEditais: Edital[] = await response.json();
        const foundEdital = allEditais.find(e => e.id === editalId);
        if (foundEdital) {
          setEdital(foundEdital);
          const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId);
          if (foundCargo) {
            setCargo(foundCargo);
            const foundSubject = foundCargo.subjects?.find(s => s.id === subjectId);
            if (foundSubject) {
              setSubject(foundSubject);
              const initialTimerStates: Record<string, { time: number; isRunning: boolean }> = {};
              foundSubject.topics?.forEach(topic => {
                initialTimerStates[topic.id] = { time: 0, isRunning: false };
              });
              setTimerStates(initialTimerStates);
            }
          }
        }
      } catch (error: any) {
        toast({ title: "Erro ao Carregar Dados", variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    };
    fetchSubjectDetails();
  }, [editalId, cargoId, subjectId, toast]);

  useEffect(() => {
    const activeTopicId = activeTimerTopicIdRef.current;
    if (activeTopicId && timerStates[activeTopicId]?.isRunning) {
        if (!startTimeRef.current) {
            startTimeRef.current = Date.now() - (timerStates[activeTopicId].time * 1000);
        }
        timerRef.current = setInterval(() => {
            if (startTimeRef.current) {
                const elapsedTime = Date.now() - startTimeRef.current;
                setTimerStates(prev => ({
                    ...prev,
                    [activeTopicId]: { ...prev[activeTopicId], time: Math.floor(elapsedTime / 1000) }
                }));
            }
        }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerStates]);

  const handleToggleTopicCheckbox = async (topicId: string) => {
    if (!hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const isCurrentlyStudied = user?.studiedTopicIds?.includes(compositeTopicId);
    try {
      await toggleTopicStudyStatus(compositeTopicId);
      if (!isCurrentlyStudied) {
        await addStudyLog(compositeTopicId, { duration: 0, pdfName: "Tópico concluído (Checklist)" });
      }
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleTimerPlayPause = (topicId: string) => {
      if (!hasAccess) return;
      if (activeTimerTopicIdRef.current && activeTimerTopicIdRef.current !== topicId && timerStates[activeTimerTopicIdRef.current]?.isRunning) {
          setTimerStates(prev => ({ ...prev, [activeTimerTopicIdRef.current!]: { ...prev[activeTimerTopicIdRef.current!], isRunning: false } }));
      }
      const isCurrentlyRunning = timerStates[topicId]?.isRunning;
      if (isCurrentlyRunning) { 
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          startTimeRef.current = null;
      } else { 
          activeTimerTopicIdRef.current = topicId;
          startTimeRef.current = Date.now() - (timerStates[topicId].time * 1000);
      }
      setTimerStates(prev => ({ ...prev, [topicId]: { ...prev[topicId], isRunning: !isCurrentlyRunning } }));
  };

  const handleTimerReset = (topicId: string) => {
    if(!hasAccess) return;
    if (timerRef.current && activeTimerTopicIdRef.current === topicId) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    startTimeRef.current = null;
    if (activeTimerTopicIdRef.current === topicId) activeTimerTopicIdRef.current = null;
    setTimerStates(prev => ({ ...prev, [topicId]: { time: 0, isRunning: false }, }));
  };

  const handleSaveStudyLog = async (topicId: string) => {
    if (!user || !hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const info = pdfInfos[topicId] || { pdfName: '', startPage: '', endPage: '' };
    const duration = timerStates[topicId]?.time || 0;

    setIsSavingLog(prev => ({ ...prev, [topicId]: true }));
    try {
      await addStudyLog(compositeTopicId, {
        duration,
        pdfName: info.pdfName || undefined,
        startPage: info.startPage ? parseInt(info.startPage) : undefined,
        endPage: info.endPage ? parseInt(info.endPage) : undefined,
      });
      toast({ title: "Registro Salvo!", variant: "default", className:"bg-accent text-accent-foreground" });
      handleTimerReset(topicId);
      setPdfInfos(prev => ({ ...prev, [topicId]: { pdfName: '', startPage: '', endPage: '' } }));
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
    } finally {
      setIsSavingLog(prev => ({ ...prev, [topicId]: false }));
    }
  };

  const handleSaveQuestions = async (topicId: string) => {
    if (!hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    setIsSavingQuestions(true);
    try {
      await addQuestionLog({
        compositeTopicId,
        totalQuestions: parseInt(questionData.total),
        correctQuestions: parseInt(questionData.correct),
        incorrectQuestions: Math.max(0, parseInt(questionData.total) - parseInt(questionData.correct)),
        targetPercentage: parseInt(questionData.target),
      });
      toast({ title: "Questões Registradas!", variant: "default", className:"bg-accent text-accent-foreground" });
      setQuestionLogData({ total: '', correct: '', target: '80' });
      setOpenQuestionsModalId(null);
    } catch (error) {
      toast({ title: "Erro ao registrar questões", variant: "destructive" });
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const handleScheduleRevision = async (topicId: string) => {
    if (!hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    try {
      await addRevisionSchedule(compositeTopicId, parseInt(selectedRevisionDays));
      toast({ title: "Revisão Agendada!", variant: "default", className:"bg-accent text-accent-foreground" });
      setOpenRevisionModalId(null);
    } catch (error) {
      toast({ title: "Erro ao agendar", variant: "destructive" });
    }
  };

  const handleCompleteRevision = async (revisionId: string) => {
    if (!hasAccess) return;
    try {
      await toggleRevisionReviewedStatus(revisionId, true);
      toast({ title: "Revisão Concluída!", variant: "default", className: "bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ title: "Erro ao concluir revisão", variant: "destructive" });
    }
  };

  const handleSaveNote = async (topicId: string) => {
    if (!hasAccess) return;
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    const text = noteTexts[topicId];
    if (!text?.trim()) return;

    setIsSavingNote(prev => ({ ...prev, [topicId]: true }));
    try {
      await addNote(compositeTopicId, text);
      toast({ title: "Anotação Salva!", variant: "default", className:"bg-accent text-accent-foreground" });
      setNoteTexts(prev => ({ ...prev, [topicId]: '' }));
    } catch (error) {
      toast({ title: "Erro ao salvar anotação", variant: "destructive" });
    } finally {
      setIsSavingNote(prev => ({ ...prev, [topicId]: false }));
    }
  };

  const getTopicData = useCallback((topicId: string) => {
    if (!user) return { logs: [], revisions: [], notes: [], questions: [], totalTime: 0, performance: 0 };
    const compositeTopicId = `${editalId}_${cargoId}_${subjectId}_${topicId}`;
    
    const logs = (user.studyLogs || []).filter(l => l.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const revisions = (user.revisionSchedules || []).filter(r => r.compositeTopicId === compositeTopicId);
    const notes = (user.notes || []).filter(n => n.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const questions = (user.questionLogs || []).filter(q => q.compositeTopicId === compositeTopicId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const totalTime = logs.reduce((acc, log) => acc + log.duration, 0);
    
    const totalQ = questions.reduce((acc, q) => acc + q.totalQuestions, 0);
    const correctQ = questions.reduce((acc, q) => acc + q.correctQuestions, 0);
    const performance = totalQ > 0 ? (correctQ / totalQ) * 100 : 0;

    return { logs, revisions, notes, questions, totalTime, performance };
  }, [user, editalId, cargoId, subjectId]);

  if (loadingData || authLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!hasAccess) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Button variant="outline" asChild><Link href={`/editais/${editalId}/cargos/${cargoId}`}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
          </div>
          <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center">
                {isSuspended ? <AlertTriangle className="mr-3 h-6 w-6 text-destructive" /> : <Lock className="mr-3 h-6 w-6 text-muted-foreground" />}
                {isSuspended ? "Assinatura Suspensa" : "Acesso Restrito"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-6">Para acessar os tópicos e registrar seu progresso, você precisa ter uma assinatura ativa.</p>
              <Button asChild size="lg"><Link href="/planos">Ver Planos</Link></Button>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  if (!edital || !cargo || !subject) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <PageHeader title="Não Encontrado" />
          <Button onClick={() => router.back()} variant="outline">Voltar</Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href={`/editais/${editalId}/cargos/${cargoId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Matérias
            </Link>
          </Button>
        </div>

        <PageHeader title={subject.name} description={`Estude e gerencie seu progresso em ${subject.name}.`} />

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <BookOpen className="mr-3 h-6 w-6 text-primary" />
              Tópicos da Matéria
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            {subject.topics && subject.topics.length > 0 ? (
              <Accordion 
                type="single" 
                collapsible 
                className="w-full space-y-4"
                onValueChange={(value) => {
                    if (activeAccordionItem && timerStates[activeAccordionItem]?.isRunning) handleTimerPlayPause(activeAccordionItem);
                    setActiveAccordionItem(value || null);
                }}
              >
                {subject.topics.map((topic: TopicType, index) => {
                  const compositeTopicId = `${editalId}_${cargoId}_${subject.id}_${topic.id}`;
                  const isStudiedChecked = user?.studiedTopicIds?.includes(compositeTopicId) ?? false;
                  const { logs, revisions, notes, questions, totalTime, performance } = getTopicData(topic.id);
                  
                  // Lógica de Revisão
                  const activeRevision = revisions.find(r => !r.isReviewed);
                  const isRevisionDue = activeRevision && (isToday(parseISO(activeRevision.scheduledDate)) || isPast(parseISO(activeRevision.scheduledDate)));
                  const isRevisionFuture = activeRevision && isAfter(parseISO(activeRevision.scheduledDate), new Date()) && !isToday(parseISO(activeRevision.scheduledDate));
                  
                  const currentTimer = timerStates[topic.id] || { time: 0, isRunning: false };

                  return (
                    <AccordionItem 
                        value={topic.id} 
                        key={topic.id} 
                        className={cn(
                            "rounded-lg border shadow-sm overflow-hidden transition-colors duration-200",
                            isRevisionDue ? "border-yellow-500 bg-yellow-50/30" : 
                            isRevisionFuture ? "border-blue-400 bg-blue-50/20" : 
                            "border-border bg-card"
                        )}
                    >
                      <AccordionTrigger className="py-4 px-4 hover:no-underline hover:bg-muted/30">
                        <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center text-left">
                                <span className="text-sm text-muted-foreground mr-3 font-mono">{index + 1}.</span>
                                <span className="text-base font-semibold">{topic.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {performance > 0 && (
                                    <Badge variant="outline" className={cn(
                                        "flex items-center gap-1 font-mono",
                                        performance >= 80 ? "text-accent border-accent/30 bg-accent/5" : "text-primary border-primary/30 bg-primary/5"
                                    )}>
                                        <Target className="h-3 w-3" />
                                        {performance.toFixed(0)}%
                                    </Badge>
                                )}
                                {activeRevision && (
                                    <Badge 
                                        variant={isRevisionDue ? "destructive" : "secondary"}
                                        className={cn(isRevisionDue && "animate-pulse", "flex items-center gap-1.5")}
                                    >
                                        <CalendarDays className="h-3 w-3" />
                                        {isRevisionDue ? "Revisar Agora" : `Revisão: ${format(parseISO(activeRevision.scheduledDate), 'dd/MM')}`}
                                    </Badge>
                                )}
                                {totalTime > 0 && <Badge variant="outline" className="font-mono">{formatDuration(totalTime)}</Badge>}
                                {isStudiedChecked && <CheckCircle2 className="h-5 w-5 text-accent" />}
                            </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-6 pt-2 space-y-6">
                        
                        {/* Alerta de Revisão Agendada */}
                        {activeRevision && (
                            <Alert className={cn(
                                "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                                isRevisionDue ? "border-yellow-500 bg-yellow-100/50" : "border-blue-400 bg-blue-100/30"
                            )}>
                                <div className="flex gap-3">
                                    <CalendarClock className={cn("h-4 w-4 mt-1", isRevisionDue ? "text-yellow-600" : "text-blue-600")} />
                                    <div>
                                        <AlertTitle className="font-bold">
                                            {isRevisionDue ? "Atenção: Revisão Pendente!" : "Revisão Agendada"}
                                        </AlertTitle>
                                        <AlertDescription className="text-sm">
                                            Este tópico tem uma revisão prevista para o dia <strong>{format(parseISO(activeRevision.scheduledDate), "dd 'de' MMMM", {locale: ptBR})}</strong>. 
                                            {isRevisionDue ? " Complete o estudo hoje para manter o conhecimento fresco!" : " Prepare-se para revisá-lo em breve."}
                                        </AlertDescription>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-background/50 hover:bg-background shrink-0"
                                    onClick={() => handleCompleteRevision(activeRevision.id)}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-accent" />
                                    Marcar como Revisado
                                </Button>
                            </Alert>
                        )}

                        {/* Top Action Bar */}
                        <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg bg-muted/20">
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`check-${topic.id}`} 
                                    checked={isStudiedChecked} 
                                    onCheckedChange={() => handleToggleTopicCheckbox(topic.id)}
                                />
                                <Label htmlFor={`check-${topic.id}`} className="font-medium">Marcar como estudado</Label>
                            </div>
                            <div className="ml-auto flex gap-2">
                                <Dialog 
                                  open={openRevisionModalId === topic.id} 
                                  onOpenChange={(open) => setOpenRevisionModalId(open ? topic.id : null)}
                                >
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm"><CalendarClock className="mr-2 h-4 w-4" /> Agendar Revisão</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Agendar Revisão</DialogTitle>
                                            <DialogDescription>Escolha em quantos dias deseja revisar este tópico novamente.</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <Input 
                                                type="number" 
                                                value={selectedRevisionDays} 
                                                onChange={(e) => setSelectedRevisionDays(e.target.value)}
                                                className="w-full"
                                                placeholder="Dias (ex: 1, 7, 30)"
                                            />
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={() => handleScheduleRevision(topic.id)}>Confirmar Agendamento</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        {/* Questions Section */}
                        <div className="space-y-3">
                            <Dialog 
                              open={openQuestionsModalId === topic.id} 
                              onOpenChange={(open) => setOpenQuestionsModalId(open ? topic.id : null)}
                            >
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full h-12 text-base border-dashed"><FileQuestion className="mr-2 h-5 w-5" /> Registrar Desempenho em Questões</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Registrar Questões</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>Total de Questões</Label>
                                            <Input type="number" value={questionData.total} onChange={e => setQuestionLogData({...questionData, total: e.target.value})} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Acertos</Label>
                                            <Input type="number" value={questionData.correct} onChange={e => setQuestionLogData({...questionData, correct: e.target.value})} />
                                        </div>
                                        {questionData.total && questionData.correct && (
                                            <div className="text-sm font-medium text-muted-foreground flex justify-between px-1">
                                                <span>Erros calculados:</span>
                                                <span className="text-destructive">{Math.max(0, parseInt(questionData.total) - parseInt(questionData.correct))}</span>
                                            </div>
                                        )}
                                        <div className="grid gap-2 pt-2">
                                            <Label className="flex justify-between items-center">
                                                <span>Meta de Aproveitamento (%)</span>
                                                <span className="text-xs font-normal text-muted-foreground">O padrão é 80%</span>
                                            </Label>
                                            <Input type="number" value={questionData.target} onChange={e => setQuestionLogData({...questionData, target: e.target.value})} />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={() => handleSaveQuestions(topic.id)} disabled={isSavingQuestions}>
                                            {isSavingQuestions ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                            Salvar Registro
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {questions.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Histórico de Questões:</h4>
                                    {questions.map(q => {
                                        const perc = (q.correctQuestions / q.totalQuestions) * 100;
                                        const isApproved = perc >= q.targetPercentage;
                                        return (
                                            <div key={q.id} className="p-3 bg-muted/10 border rounded-lg text-sm relative group">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-xs font-semibold text-muted-foreground mb-1 block">
                                                        {format(parseISO(q.date), "dd/MM/yy HH:mm")}
                                                    </span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" 
                                                        onClick={() => deleteQuestionLog(q.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <ul className="space-y-1">
                                                    <li className="flex items-center gap-1.5">
                                                        <span className="text-primary">•</span>
                                                        <span>Total: {q.totalQuestions}, Acertos: {q.correctQuestions} ({perc.toFixed(1)}%), Erros: {q.incorrectQuestions}</span>
                                                    </li>
                                                    <li className="flex items-center gap-1.5">
                                                        <span className="text-primary">•</span>
                                                        <span className="flex items-center gap-1.5 flex-wrap">
                                                            Meta: {q.targetPercentage}% - Status: 
                                                            {isApproved ? (
                                                                <span className="flex items-center gap-1 text-accent font-semibold ml-1">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprovado
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-destructive font-semibold ml-1">
                                                                    <XCircle className="h-3.5 w-3.5" /> Reprovado
                                                                </span>
                                                            )}
                                                        </span>
                                                    </li>
                                                </ul>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Progress Section (Cronômetro + PDF) */}
                        <Card className="border-primary/20 bg-primary/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center text-primary uppercase tracking-wider">
                                    <TimerIcon className="mr-2 h-4 w-4" /> Registrar Progresso
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="p-4 bg-background border rounded-lg flex items-center justify-between shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase">Cronômetro de Estudo</p>
                                        <div className="text-4xl font-mono font-black text-primary tracking-tighter">{formatDuration(currentTimer.time)}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full shadow-md" onClick={() => handleTimerPlayPause(topic.id)}>
                                            {currentTimer.isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={() => handleTimerReset(topic.id)}>
                                            <RotateCcw className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <p className="text-xs font-bold flex items-center text-muted-foreground uppercase tracking-widest"><FileText className="mr-2 h-4 w-4" /> Registro de Leitura (Opcional)</p>
                                    <div className="grid gap-4">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs font-semibold">Nome do PDF/Material</Label>
                                            <Input 
                                                placeholder="Ex: Aula 01 - Direito Const.pdf" 
                                                className="bg-background"
                                                value={pdfInfos[topic.id]?.pdfName || ''}
                                                onChange={e => setPdfInfos({...pdfInfos, [topic.id]: { ...pdfInfos[topic.id], pdfName: e.target.value }})}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-1.5">
                                                <Label className="text-xs font-semibold">Página Inicial</Label>
                                                <Input 
                                                    type="number" placeholder="Ex: 1" className="bg-background" 
                                                    value={pdfInfos[topic.id]?.startPage || ''}
                                                    onChange={e => setPdfInfos({...pdfInfos, [topic.id]: { ...pdfInfos[topic.id], startPage: e.target.value }})}
                                                />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label className="text-xs font-semibold">Página Final</Label>
                                                <Input 
                                                    type="number" placeholder="Ex: 15" className="bg-background" 
                                                    value={pdfInfos[topic.id]?.endPage || ''}
                                                    onChange={e => setPdfInfos({...pdfInfos, [topic.id]: { ...pdfInfos[topic.id], endPage: e.target.value }})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Button className="w-full h-11" onClick={() => handleSaveStudyLog(topic.id)} disabled={isSavingLog[topic.id]}>
                                    {isSavingLog[topic.id] ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Progresso
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Notes Section */}
                        <Card className="border-accent/20 bg-accent/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-bold flex items-center text-accent uppercase tracking-wider">
                                    <FileText className="mr-2 h-4 w-4" /> Minhas Anotações
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea 
                                    placeholder="Digite suas observações importantes aqui..." 
                                    className="bg-background min-h-[100px] text-sm"
                                    value={noteTexts[topic.id] || ''}
                                    onChange={e => setNoteTexts({...noteTexts, [topic.id]: e.target.value})}
                                />
                                <Button variant="accent" className="w-full h-10" onClick={() => handleSaveNote(topic.id)} disabled={isSavingNote[topic.id]}>
                                    {isSavingNote[topic.id] ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                    Salvar Anotação
                                </Button>

                                {notes.length > 0 && (
                                    <div className="pt-2 space-y-2">
                                        {notes.map(note => (
                                            <div key={note.id} className="p-3 bg-background border rounded-md text-sm relative group">
                                                <p className="pr-8 whitespace-pre-wrap">{note.text}</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[10px] text-muted-foreground">{format(parseISO(note.date), "dd/MM/yy 'às' HH:mm")}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteNote(note.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* History / Logs Section */}
                        <div className="pt-4 border-t border-border/50">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center mb-4 tracking-widest">
                                <History className="mr-2 h-4 w-4" /> Histórico de Atividade
                            </h4>
                            {logs.length > 0 ? (
                                <div className="space-y-2">
                                    {logs.map(log => (
                                        <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 text-sm hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-full">
                                                    <TimerIcon className="h-4 w-4 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground">{log.pdfName || "Estudo Cronometrado"}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span>{format(parseISO(log.date), "dd/MM/yy 'às' HH:mm")}</span>
                                                        {log.startPage && <span>• pág. {log.startPage}-{log.endPage}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono font-bold text-primary">{formatDuration(log.duration)}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteStudyLog(log.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-xs text-muted-foreground py-4 italic">Nenhum registro de estudo salvo para este tópico ainda.</p>
                            )}
                        </div>

                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : (
              <p className="text-center py-10 text-muted-foreground">Nenhum tópico cadastrado para esta matéria.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
