
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import type { Edital, Cargo } from '@/types'; 
import { PageWrapper } from '@/components/layout/page-wrapper';
import { CargoCard } from '@/components/cargo-card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Landmark, Link as LinkIcon, Briefcase, Loader2, ArrowLeft } from 'lucide-react'; 
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

function formatDate(dateString: string) {
  if (!dateString) return 'Data não informada';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
  } catch (error) {
    console.error('Invalid date string for formatDate:', dateString);
    return 'Data inválida';
  }
}

export default function EditalDetailPage() {
  const params = useParams();
  const editalId = params.id as string; 
  const [edital, setEdital] = useState<Edital | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [error, setError] = useState<string | null>(null); // Add error state

  const { user, registerForCargo, unregisterFromCargo, loading: authLoading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchEditalDetails = async () => {
      if (editalId) {
        setLoading(true);
        setError(null);
        try {
          // Fetch ALL editais from the API, then find the specific one.
          // This ensures we're using the same data source as the homepage.
          const response = await fetch('/api/editais');
          if (!response.ok) {
            throw new Error('Falha ao buscar dados dos editais.');
          }
          const allEditais: Edital[] = await response.json();
          const foundEdital = allEditais.find(e => e.id === editalId) || null;
          setEdital(foundEdital);

          if (!foundEdital) {
              setError("O edital que você está procurando não foi encontrado.");
          }

        } catch (err: any) {
          console.error("Error fetching edital details:", err);
          setError("Não foi possível carregar os detalhes do edital. Tente novamente mais tarde.");
          toast({
            title: "Erro ao Carregar Dados",
            description: err.message,
            variant: "destructive"
          });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchEditalDetails();
  }, [editalId, toast]);

  const handleRegisterCargo = async (cargoId: string) => {
    if (!edital) return;
    setIsSubmittingRegistration(true);
    const cargo = edital.cargos?.find(c => c.id === cargoId);
    try {
      // Pass the correct editalId from the URL params
      await registerForCargo(editalId, cargoId);
      toast({ title: "Inscrição Realizada!", description: `Você se inscreveu no cargo: ${cargo?.name || 'N/A'} do edital ${edital.title}`, variant: 'default', className: "bg-accent text-accent-foreground" });
    } catch (error: any) {
      toast({ title: "Inscrição não permitida", description: error.message || "Não foi possível realizar a inscrição no cargo.", variant: "destructive" });
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleUnregisterCargo = async (cargoId: string) => {
    if (!edital) return;
    setIsSubmittingRegistration(true);
    const cargo = edital.cargos?.find(c => c.id === cargoId);
    try {
       // Pass the correct editalId from the URL params
      await unregisterFromCargo(editalId, cargoId);
      toast({ title: "Inscrição Cancelada", description: `Sua inscrição no cargo: ${cargo?.name || 'N/A'} do edital ${edital.title} foi cancelada.` });
    } catch (error) {
      toast({ title: "Erro ao Cancelar", description: "Não foi possível cancelar a inscrição no cargo.", variant: "destructive" });
    } finally {
      setIsSubmittingRegistration(false);
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

  if (error || !edital) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <PageHeader title={error ? "Erro" : "Edital Não Encontrado"} />
          <p>{error || "O edital que você está procurando não foi encontrado."}</p>
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
              {edital.cargos.map((cargo) => {
                const isUserRegisteredForThisCargo = !!user?.registeredCargoIds?.includes(`${editalId}_${cargo.id}`);
                return (
                  <CargoCard 
                    key={cargo.id} 
                    editalId={editalId} // Pass editalId here
                    cargo={cargo}
                    isUserRegisteredForThisCargo={isUserRegisteredForThisCargo}
                    onRegister={handleRegisterCargo} 
                    onUnregister={handleUnregisterCargo} 
                    isUserLoggedIn={!!user}
                    editalStatus={edital.status}
                  />
                );
              })}
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
