
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import type { Edital } from '@/types'; 
import { mockEditais } from '@/lib/mock-data';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { CargoCard } from '@/components/cargo-card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Landmark, Link as LinkIcon, Briefcase, Loader2, ArrowLeft, UserCheck, UserPlus, Info } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function EditalDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [edital, setEdital] = useState<Edital | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const { user, registerForEdital, unregisterFromEdital, loading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      setLoading(true);
      const timer = setTimeout(() => {
        const foundEdital = mockEditais.find(e => e.id === id) || null;
        setEdital(foundEdital);
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [id]);

  const isUserRegisteredForCurrentEdital = !!user?.registeredEditalIds?.includes(id);
  const canRegisterForEdital = edital?.status === 'open';

  const handleRegister = async () => {
    if (!edital) return;
    setIsSubmittingRegistration(true);
    try {
      await registerForEdital(edital.id);
      toast({ title: "Inscrição Realizada!", description: `Você se inscreveu no edital: ${edital.title}`, variant: 'default', className: "bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ title: "Erro na Inscrição", description: "Não foi possível realizar a inscrição.", variant: "destructive" });
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleUnregister = async () => {
    if (!edital) return;
    setIsSubmittingRegistration(true);
    try {
      await unregisterFromEdital(edital.id);
      toast({ title: "Inscrição Cancelada", description: `Sua inscrição no edital: ${edital.title} foi cancelada.` });
    } catch (error) {
      toast({ title: "Erro ao Cancelar", description: "Não foi possível cancelar a inscrição.", variant: "destructive" });
    } finally {
      setIsSubmittingRegistration(false);
      setIsAlertOpen(false);
    }
  };


  if (loading || authLoading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!edital) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <PageHeader title="Edital Não Encontrado" />
          <p>O edital que você está procurando não foi encontrado.</p>
          <Button asChild className="mt-4">
            <Link href="/">Voltar para a Página Inicial</Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }
  
  const statusMap: Record<Edital['status'], { text: string; variant: "default" | "secondary" | "destructive" | "outline" | "accent" }> = {
    open: { text: 'Aberto', variant: 'accent' },
    closed: { text: 'Encerrado', variant: 'destructive' },
    upcoming: { text: 'Próximo', variant: 'secondary' },
  };
  const currentStatus = statusMap[edital.status] || { text: edital.status, variant: 'outline' };


  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Button variant="outline" asChild>
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar aos Editais
                </Link>
            </Button>
            {user && canRegisterForEdital && (
              isUserRegisteredForCurrentEdital ? (
                 <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto" disabled={isSubmittingRegistration}>
                      {isSubmittingRegistration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                      Cancelar Inscrição no Edital
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você tem certeza que deseja cancelar sua inscrição neste edital? 
                        Qualquer progresso salvo relacionado a este edital poderá ser perdido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isSubmittingRegistration}>Não, manter</AlertDialogCancel>
                      <AlertDialogAction onClick={handleUnregister} disabled={isSubmittingRegistration} className="bg-destructive hover:bg-destructive/90">
                        {isSubmittingRegistration && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={handleRegister} className="w-full sm:w-auto" variant="default" disabled={isSubmittingRegistration}>
                  {isSubmittingRegistration ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Inscrever-se neste Edital
                </Button>
              )
            )}
            {user && !canRegisterForEdital && edital.status !== 'open' && (
                 <Button className="w-full sm:w-auto" variant="outline" disabled>
                    <Info className="mr-2 h-4 w-4" />
                    {edital.status === 'closed' ? 'Inscrições Encerradas' : 'Inscrições em Breve'}
                </Button>
            )}
        </div>
        <PageHeader title={edital.title} />

        <Card className="mb-8 shadow-lg rounded-xl overflow-hidden bg-card">
          {edital.imageUrl && (
            <div className="relative h-64 md:h-96 w-full">
              <Image
                src={edital.imageUrl}
                alt={edital.title}
                layout="fill"
                objectFit="cover"
                priority
                data-ai-hint="public tender document"
              />
            </div>
          )}
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div className="flex items-center text-lg text-muted-foreground mb-2 md:mb-0">
                <Landmark className="h-5 w-5 mr-2 text-primary" />
                {edital.organization}
              </div>
              <Badge variant={currentStatus.variant} className="text-sm px-3 py-1 shadow-sm">{currentStatus.text}</Badge>
            </div>
            
            <p className="text-foreground leading-relaxed mb-6 text-base">{edital.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
              <div className="flex items-center p-3 bg-muted/50 rounded-md">
                <CalendarDays className="h-5 w-5 mr-2 text-primary" />
                <strong>Publicação:</strong>&nbsp;{formatDate(edital.publicationDate)}
              </div>
              <div className="flex items-center p-3 bg-muted/50 rounded-md">
                <CalendarDays className="h-5 w-5 mr-2 text-destructive" />
                <strong>Encerramento:</strong>&nbsp;{formatDate(edital.closingDate)}
              </div>
            </div>

            {edital.fullTextUrl && (
              <Button asChild variant="default" size="lg" className="w-full sm:w-auto">
                <a href={edital.fullTextUrl} target="_blank" rel="noopener noreferrer">
                  <LinkIcon className="mr-2 h-5 w-5" />
                  Acessar Edital Completo
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {edital.cargos && edital.cargos.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-2 mt-10 flex items-center"><Briefcase className="mr-3 h-7 w-7 text-primary"/> Cargos Disponíveis</h2>
            <Separator className="mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {edital.cargos.map((cargo) => (
                <CargoCard 
                  key={cargo.id} 
                  cargo={cargo}
                  editalId={edital.id}
                  isUserRegisteredForEdital={isUserRegisteredForCurrentEdital}
                  onRegister={handleRegister}
                  onUnregister={handleUnregister} // This will be handled by the main edital button now
                  isUserLoggedIn={!!user}
                  editalStatus={edital.status}
                />
              ))}
            </div>
          </section>
        )}

        {(!edital.cargos || edital.cargos.length === 0) && (
           <Card className="text-center py-12 shadow-lg rounded-xl">
            <CardContent>
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-xl text-muted-foreground">Nenhum cargo especificado para este edital.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
