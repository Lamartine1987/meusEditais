
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Edital, Cargo } from '@/types';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Briefcase, Loader2, PlusCircle, Library, UserMinus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface RegisteredCargoInfo {
  edital: Edital;
  cargo: Cargo;
}

export default function MyEditaisPage() {
  const { user, loading: authLoading, unregisterFromCargo } = useAuth();
  const { toast } = useToast();
  const [loadingData, setLoadingData] = useState(true); 
  const [allEditais, setAllEditais] = useState<Edital[]>([]);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllEditais = async () => {
      setLoadingData(true);
      try {
        const response = await fetch('/api/editais', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Falha ao buscar dados dos editais.');
        }
        const data: Edital[] = await response.json();
        console.log('[Meus Editais] Editais recebidos da API:', data);
        setAllEditais(data);
      } catch (error: any) {
        console.error("Error fetching editais for My Editais page:", error);
        toast({
          title: "Erro ao Carregar Editais",
          description: "Não foi possível buscar a lista de editais. Tente recarregar a página.",
          variant: "destructive",
        });
      } finally {
        setLoadingData(false);
      }
    };

    fetchAllEditais();
  }, [toast]);
  
  const myRegisteredCargos = useMemo((): RegisteredCargoInfo[] => {
    if (authLoading || loadingData || !user || !user.registeredCargoIds || !allEditais.length) {
      return [];
    }
    
    console.log('[Meus Editais] Calculando cargos inscritos. IDs do usuário:', user.registeredCargoIds);
    console.log('[Meus Editais] Usando a lista de editais com os IDs:', allEditais.map(e => e.id));


    const registeredInfos: RegisteredCargoInfo[] = [];
    user.registeredCargoIds.forEach(compositeId => {
      let foundMatch = false;
      for (const edital of allEditais) {
        // Check if the compositeId starts with the edital's ID followed by an underscore.
        if (compositeId.startsWith(`${edital.id}_`)) {
          const potentialCargoId = compositeId.substring(edital.id.length + 1);
          const cargo = edital.cargos?.find(c => c.id === potentialCargoId);
          
          if (cargo) {
            registeredInfos.push({ edital, cargo });
            foundMatch = true;
            break; // Found a valid edital/cargo pair, move to the next compositeId
          }
        }
      }
      if (!foundMatch) {
          console.warn(`[Meus Editais] Não foi possível encontrar uma combinação válida de edital/cargo para a inscrição com ID: '${compositeId}'`);
      }
    });
    
    console.log('[Meus Editais] Cargos encontrados e processados:', registeredInfos);
    return registeredInfos.sort((a, b) => a.cargo.name.localeCompare(b.cargo.name));
  }, [user, authLoading, allEditais, loadingData]);

  const handleUnregisterCargo = async (editalId: string, cargoId: string) => {
    const compositeId = `${editalId}_${cargoId}`;
    setIsCancelling(compositeId);
    try {
      await unregisterFromCargo(editalId, cargoId);
      toast({ title: "Inscrição Cancelada", description: `Sua inscrição no cargo foi cancelada com sucesso.` });
    } catch (error) {
      toast({ title: "Erro ao Cancelar", description: "Não foi possível cancelar a inscrição no cargo.", variant: "destructive" });
    } finally {
      setIsCancelling(null);
    }
  };

  const isPageLoading = authLoading || loadingData;

  if (isPageLoading) { 
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
                <Briefcase className="mx-auto h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para ver seus cargos inscritos.</p>
                <Button asChild size="lg">
                    <Link href="/login">Fazer Login</Link>
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
        <PageHeader 
          title="Meus Cargos Inscritos" 
          description="Acompanhe os cargos em que você está inscrito e gerencie suas inscrições."
          actions={
            <Button asChild variant="default">
              <Link href="/">
                <PlusCircle className="mr-2 h-4 w-4" />
                Encontrar Novos Editais e Cargos
              </Link>
            </Button>
          }
        />
        {myRegisteredCargos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myRegisteredCargos.map(({ edital, cargo }) => {
              const compositeId = `${edital.id}_${cargo.id}`;
              const isCurrentCancelling = isCancelling === compositeId;
              return (
                <Card key={compositeId} className="shadow-lg rounded-xl flex flex-col h-full bg-card animate-fade-in">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl font-semibold text-primary">{cargo.name}</CardTitle>
                    <CardDescription className="text-sm">
                      Edital: {edital.title} <br/>
                      <span className="text-xs text-muted-foreground">Organização: {edital.organization}</span>
                    </CardDescription>
                  </CardHeader>
                  <Separator className="my-2" />
                  <CardContent className="flex-grow pt-3 pb-2">
                     <p className="text-xs text-muted-foreground line-clamp-3">{cargo.description || "Descrição do cargo não disponível."}</p>
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex flex-col gap-2">
                    <Button variant="outline" className="w-full group" asChild>
                      <Link href={`/editais/${edital.id}/cargos/${cargo.id}`}>
                        <Library className="mr-2 h-4 w-4" />
                        Ver Matérias
                      </Link>
                    </Button>
                    <div className="w-full">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="w-full" disabled={isCurrentCancelling}>
                            {isCurrentCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                            Cancelar Inscrição
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                             <AlertDialogTitle className="flex items-center">
                               <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
                               Confirmar Cancelamento
                             </AlertDialogTitle>
                            <AlertDialogDescription>
                              Você tem certeza que deseja cancelar sua inscrição no cargo "{cargo.name}" do edital "{edital.title}"? 
                              Qualquer progresso de estudo salvo relacionado a este cargo (status de tópicos, logs de tempo, questões, etc.) será mantido, mas a inscrição será removida.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={isCurrentCancelling}>Manter Inscrição</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleUnregisterCargo(edital.id, cargo.id)} 
                              disabled={isCurrentCancelling}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              {isCurrentCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Sim, Cancelar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="text-center py-16 shadow-lg rounded-xl bg-card">
            <CardContent>
                <Briefcase className="mx-auto h-16 w-16 text-primary mb-6" />
                <p className="text-2xl font-semibold text-foreground mb-2">Nenhuma Inscrição Encontrada</p>
                <p className="text-md text-muted-foreground">Você ainda não está inscrito em nenhum cargo.</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Explore os cargos disponíveis nos editais e encontre sua próxima oportunidade!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
