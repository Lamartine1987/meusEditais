
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Edital, Cargo, Subject as SubjectType } from '@/types';
import { mockEditais } from '@/lib/mock-data';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, ArrowLeft, BookOpen, ChevronRight, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function CargoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const editalId = params.id as string;
  const cargoId = params.cargoId as string;

  const [edital, setEdital] = useState<Edital | null>(null);
  const [cargo, setCargo] = useState<Cargo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (editalId && cargoId) {
      setLoading(true);
      // Simulate data fetching
      const timer = setTimeout(() => {
        const foundEdital = mockEditais.find(e => e.id === editalId) || null;
        if (foundEdital) {
          const foundCargo = foundEdital.cargos?.find(c => c.id === cargoId) || null;
          setEdital(foundEdital);
          setCargo(foundCargo);
        }
        setLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [editalId, cargoId]);

  if (loading) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </PageWrapper>
    );
  }

  if (!edital || !cargo) {
    return (
      <PageWrapper>
        <div className="container mx-auto px-4 py-8 text-center">
          <PageHeader title="Informação Não Encontrada" />
          <p className="mb-4">O edital ou cargo que você está procurando não foi encontrado.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href={`/editais/${editalId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Detalhes do Edital
            </Link>
          </Button>
        </div>

        <PageHeader 
          title={`Matérias para: ${cargo.name}`}
          description={`Conteúdo programático do cargo ${cargo.name} no edital ${edital.title}.`}
        />

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center">
              <BookOpen className="mr-3 h-6 w-6 text-primary" />
              Conteúdo Programático
            </CardTitle>
          </CardHeader>
          <Separator className="mb-4" />
          <CardContent>
            {cargo.subjects && cargo.subjects.length > 0 ? (
              <Accordion type="single" collapsible className="w-full space-y-3">
                {cargo.subjects.map((subject: SubjectType) => (
                  <AccordionItem value={subject.id} key={subject.id} className="border-b-0 rounded-lg bg-muted/50 shadow-sm">
                    <AccordionTrigger className="px-4 py-3 text-md font-semibold hover:no-underline hover:bg-muted rounded-t-lg data-[state=open]:rounded-b-none data-[state=open]:bg-muted">
                      <div className="flex items-center">
                         <ChevronRight className="h-5 w-5 mr-2 transition-transform duration-200 group-[[data-state=open]]:rotate-90" />
                        {subject.name}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 bg-background rounded-b-lg border-t border-border">
                      {subject.topics && subject.topics.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
                          {subject.topics.map(topic => (
                            <li key={topic.id}>{topic.name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nenhum tópico cadastrado para esta matéria.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">Nenhuma matéria cadastrada para este cargo.</p>
                <p className="text-sm text-muted-foreground mt-1">Verifique o edital completo para mais informações.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
