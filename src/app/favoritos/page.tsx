
"use client";

import { useEffect, useState, useMemo } from 'react';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, AlertTriangle, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { NoteEntry, Edital, Cargo, Subject as SubjectType, Topic } from '@/types';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface NoteWithContext extends NoteEntry {
  editalTitle?: string;
  cargoName?: string;
  subjectName?: string;
  topicName?: string;
  topicLink?: string;
}

interface GroupedNotes {
  [editalAndCargo: string]: {
    editalTitle: string;
    cargoName: string;
    subjects: {
      [subjectName: string]: {
        subjectName: string;
        topics: {
          [topicName: string]: {
            topicName: string;
            topicLink?: string;
            notes: NoteWithContext[];
          }
        }
      }
    }
  }
}

export default function FavoritosPage() {
  const { user, loading: authLoading, deleteNote } = useAuth();
  const [allEditaisData, setAllEditaisData] = useState<Edital[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch all editais to provide context for notes
    const fetchAllEditais = async () => {
      setDataLoading(true);
      try {
        const response = await fetch('/api/editais');
        if (!response.ok) throw new Error('Falha ao buscar dados de editais.');
        const data: Edital[] = await response.json();
        setAllEditaisData(data);
      } catch (error) {
        toast({ title: "Erro de Dados", description: "Não foi possível carregar o contexto dos editais.", variant: "destructive" });
      } finally {
        setDataLoading(false);
      }
    };
    fetchAllEditais();
  }, [toast]);

  const notesWithContext = useMemo((): NoteWithContext[] => {
    if (!user?.notes || allEditaisData.length === 0) return [];

    return user.notes.map(note => {
      let context: Partial<NoteWithContext> = {};
      
      let foundEdital: Edital | undefined;
      let foundCargo: Cargo | undefined;
      let foundSubject: SubjectType | undefined;
      let foundTopic: Topic | undefined;

      for (const edital of allEditaisData) {
        if (note.compositeTopicId.startsWith(edital.id + '_')) {
            const restAfterEdital = note.compositeTopicId.substring(edital.id.length + 1);
            for (const cargo of edital.cargos || []) {
                if (restAfterEdital.startsWith(cargo.id + '_')) {
                    const restAfterCargo = restAfterEdital.substring(cargo.id.length + 1);
                    for (const subject of cargo.subjects || []) {
                        if (restAfterCargo.startsWith(subject.id + '_')) {
                            const topicId = restAfterCargo.substring(subject.id.length + 1);
                            const topic = subject.topics?.find(t => t.id === topicId);
                            if (topic) {
                                foundEdital = edital;
                                foundCargo = cargo;
                                foundSubject = subject;
                                foundTopic = topic;
                                break; // topic found
                            }
                        }
                    }
                }
                if (foundTopic) break; // cargo found
            }
        }
        if (foundTopic) break; // edital found
      }

      if (foundEdital && foundCargo && foundSubject && foundTopic) {
        context.editalTitle = foundEdital.title;
        context.cargoName = foundCargo.name;
        context.subjectName = foundSubject.name;
        context.topicName = foundTopic.name;
        context.topicLink = `/editais/${foundEdital.id}/cargos/${foundCargo.id}/materias/${foundSubject.id}`;
      }

      return { ...note, ...context };
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user?.notes, allEditaisData]);

  const groupedNotes = useMemo((): GroupedNotes => {
    return notesWithContext.reduce((acc, note) => {
      const editalKey = note.editalTitle || 'Desconhecido';
      const cargoKey = note.cargoName || 'Desconhecido';
      const subjectKey = note.subjectName || 'Desconhecido';
      const topicKey = note.topicName || 'Desconhecido';
      const groupKey = `${editalKey} / ${cargoKey}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          editalTitle: editalKey,
          cargoName: cargoKey,
          subjects: {},
        };
      }
      if (!acc[groupKey].subjects[subjectKey]) {
        acc[groupKey].subjects[subjectKey] = {
          subjectName: subjectKey,
          topics: {},
        };
      }
      if (!acc[groupKey].subjects[subjectKey].topics[topicKey]) {
        acc[groupKey].subjects[subjectKey].topics[topicKey] = {
          topicName: topicKey,
          topicLink: note.topicLink,
          notes: [],
        };
      }
      acc[groupKey].subjects[subjectKey].topics[topicKey].notes.push(note);
      return acc;
    }, {} as GroupedNotes);
  }, [notesWithContext]);

  const handleDeleteNoteConfirm = async (noteId: string | null) => {
    if (!noteId) return;
    await deleteNote(noteId);
  };

  if (authLoading || dataLoading) {
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
              <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para ver suas anotações.</p>
              <Button asChild size="lg">
                <Link href="/login?redirect=/favoritos">Fazer Login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader title="Minhas Anotações" description="Todas as suas observações de estudo em um só lugar." />

        {notesWithContext.length === 0 ? (
          <Card className="text-center py-16 shadow-lg rounded-xl">
            <CardContent>
                <Star className="mx-auto h-16 w-16 text-primary mb-6" />
                <p className="text-2xl font-semibold text-foreground mb-2">Nenhuma Anotação Encontrada</p>
                <p className="text-md text-muted-foreground">Comece a fazer anotações nos tópicos de estudo para vê-las aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="w-full space-y-4">
            {Object.entries(groupedNotes).map(([groupKey, groupData]) => (
              <AccordionItem key={groupKey} value={groupKey} className="border rounded-lg shadow-sm bg-card">
                <AccordionTrigger className="p-4 text-lg font-semibold">
                  {groupData.cargoName} <span className="text-sm font-normal text-muted-foreground ml-2">({groupData.editalTitle})</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <Accordion type="multiple" className="w-full space-y-3">
                    {Object.entries(groupData.subjects).map(([subjectKey, subjectData]) => (
                       <AccordionItem key={subjectKey} value={subjectKey} className="border rounded-md bg-muted/30">
                          <AccordionTrigger className="p-3 text-base font-medium">
                            {subjectData.subjectName}
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <Accordion type="multiple" className="w-full space-y-2">
                               {Object.entries(subjectData.topics).map(([topicKey, topicData]) => (
                                   <AccordionItem key={topicKey} value={topicKey} className="border rounded-md bg-background">
                                     <AccordionTrigger className="p-2 text-sm font-normal text-left">
                                      <Link href={topicData.topicLink || '#'} className="hover:underline">{topicData.topicName}</Link>
                                     </AccordionTrigger>
                                     <AccordionContent className="px-2 pb-2">
                                        <ul className="space-y-2">
                                          {topicData.notes.map(note => (
                                              <li key={note.id} className="text-sm p-3 border rounded-md bg-muted/20 relative group">
                                                  <p className="whitespace-pre-wrap">{note.text}</p>
                                                  <small className="text-xs text-muted-foreground/80 mt-2 block">
                                                      {format(parseISO(note.date), "dd/MM/yy 'às' HH:mm")}
                                                  </small>
                                                  
                                                  <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                      <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="absolute top-1 right-1 h-7 w-7"
                                                          onClick={(e) => {
                                                              e.stopPropagation(); // Impede que o accordion feche
                                                          }}
                                                      >
                                                          <Trash2 className="h-4 w-4 text-destructive" />
                                                      </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                          Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita.
                                                        </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction 
                                                          onClick={() => handleDeleteNoteConfirm(note.id)} 
                                                          className="bg-destructive hover:bg-destructive/90"
                                                        >
                                                          Excluir
                                                        </AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                  </AlertDialog>
                                              </li>
                                          ))}
                                        </ul>
                                     </AccordionContent>
                                   </AccordionItem>
                               ))}
                            </Accordion>
                          </AccordionContent>
                       </AccordionItem>
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </PageWrapper>
  );
}
