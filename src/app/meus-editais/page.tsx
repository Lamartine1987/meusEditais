
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Edital } from '@/types';
import { mockEditais } from '@/lib/mock-data'; 
import { EditalCard } from '@/components/edital-card';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Briefcase, Loader2, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyEditaisPage() {
  const { user, loading: authLoading } = useAuth();
  // const [myEditais, setMyEditais] = useState<Edital[]>([]); // To be derived from user.registeredEditalIds
  const [loadingData, setLoadingData] = useState(true); // For simulating data fetch for all editais if needed

  // All editais (from mock or future API)
  const [allEditais, setAllEditais] = useState<Edital[]>([]);

  useEffect(() => {
    // Simulate fetching all editais data once
    setLoadingData(true);
    const timer = setTimeout(() => {
      setAllEditais(mockEditais); // In a real app, this might be fetched from an API
      setLoadingData(false);
    }, 500); // Simulate delay for fetching all editais
    return () => clearTimeout(timer);
  }, []);
  
  const myEditais = useMemo(() => {
    if (authLoading || loadingData || !user || !user.registeredEditalIds) {
      return [];
    }
    return allEditais.filter(edital => user.registeredEditalIds!.includes(edital.id));
  }, [user, authLoading, allEditais, loadingData]);


  if (authLoading || loadingData) { 
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
                <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para ver seus editais.</p>
                <Button asChild size="lg">
                    <Link href="/login">Fazer Login</Link>
                </Button>
            </CardContent>
        </Card>
        </div>
      </PageWrapper>
    );
  }

  // Show skeletons if user is loaded but derived myEditais are still being processed (or if allEditais are loading)
  const showSkeletons = (authLoading || loadingData) && user;


  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Meus Editais" 
          description="Acompanhe os editais aos quais você está vinculado."
          actions={
            <Button asChild variant="default">
              <Link href="/">
                <PlusCircle className="mr-2 h-4 w-4" />
                Encontrar Novos Editais
              </Link>
            </Button>
          }
        />
        {showSkeletons ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, index) => (
               <Card key={index} className="overflow-hidden shadow-md rounded-xl">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-6 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                   <Skeleton className="h-10 w-full mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : myEditais.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myEditais.map((edital) => (
              <EditalCard key={edital.id} edital={edital} className="animate-fade-in" />
            ))}
          </div>
        ) : (
          <Card className="text-center py-16 shadow-lg rounded-xl bg-card">
            <CardContent>
                <Briefcase className="mx-auto h-16 w-16 text-primary mb-6" />
                <p className="text-2xl font-semibold text-foreground mb-2">Nenhum Edital Encontrado</p>
                <p className="text-md text-muted-foreground">Você ainda não está inscrito em nenhum edital.</p>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Explore os editais disponíveis e encontre sua próxima oportunidade!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
