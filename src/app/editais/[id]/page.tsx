
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import type { Edital } from '@/types'; // Cargo type also imported if needed directly
import { mockEditais } from '@/lib/mock-data';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { CargoCard } from '@/components/cargo-card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Landmark, Link as LinkIcon, Briefcase, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' });
}

export default function EditalDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [edital, setEdital] = useState<Edital | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      // Simulate fetching data
      const timer = setTimeout(() => {
        const foundEdital = mockEditais.find(e => e.id === id) || null;
        setEdital(foundEdital);
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [id]);

  if (loading) {
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
        <div className="mb-6">
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
              {edital.cargos.map((cargo) => (
                <CargoCard key={cargo.id} cargo={cargo} />
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
