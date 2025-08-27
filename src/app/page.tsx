
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Edital } from '@/types';
import { Input } from '@/components/ui/input';
import { EditalCard } from '@/components/edital-card';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Search, Filter, NewspaperIcon, MapPin, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const brazilStatesAbbreviations = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];
const specialFilters = ['Todos', 'Nacional'];

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [allEditais, setAllEditais] = useState<Edital[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'upcoming'>('all');
  const [stateFilter, setStateFilter] = useState<string>(specialFilters[0]); // Default to 'Todos'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchEditais = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/editais');
        if (!response.ok) {
          // Try to get a more specific error message from the response body
          const errorBody = await response.json().catch(() => ({ error: 'Failed to fetch data from API.' }));
          throw new Error(errorBody.error || `HTTP error! status: ${response.status}`);
        }
        const data: Edital[] = await response.json();
        setAllEditais(data);
      } catch (err: any) {
        console.error("API fetch error:", err);
        setError("Não foi possível carregar os editais. Tente novamente mais tarde.");
        toast({
          title: "Erro ao Carregar Dados",
          description: err.message || "Não foi possível buscar os editais.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEditais();
  }, [toast]);

  const processedEditais = useMemo(() => {
    if (!allEditais) return [];

    const getStatus = (publicationDateStr: string, closingDateStr: string): Edital['status'] => {
      // Return 'closed' if dates are invalid or missing
      if (!publicationDateStr || !closingDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(publicationDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(closingDateStr)) {
        return 'closed';
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [pubYear, pubMonth, pubDay] = publicationDateStr.split('-').map(Number);
      const pubDate = new Date(pubYear, pubMonth - 1, pubDay);

      const [closeYear, closeMonth, closeDay] = closingDateStr.split('-').map(Number);
      const closeDate = new Date(closeYear, closeMonth - 1, closeDay);
      
      if (isNaN(pubDate.getTime()) || isNaN(closeDate.getTime())) {
        return 'closed';
      }

      if (today < pubDate) return 'upcoming';
      if (today > closeDate) return 'closed';
      return 'open';
    };

    const statusOrder: Record<Edital['status'], number> = {
      open: 1,
      upcoming: 2,
      closed: 3,
    };

    return allEditais
      .map(edital => ({
        ...edital,
        status: getStatus(edital.publicationDate, edital.closingDate), // Calculate status dynamically
      }))
      .sort((a, b) => {
        // First, sort by status
        const statusDifference = statusOrder[a.status] - statusOrder[b.status];
        if (statusDifference !== 0) {
          return statusDifference;
        }
        
        // If statuses are the same, then sort by publication date (most recent first)
        try {
          return new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime();
        } catch (e) {
          return 0; // Don't crash on invalid dates
        }
      });
  }, [allEditais]);

  const filteredEditais = useMemo(() => {
    if (!processedEditais) return [];
    return processedEditais
      .filter(edital => {
        // Safe search filter
        const searchTermLower = searchTerm.toLowerCase();
        return (
          (edital?.title || '').toLowerCase().includes(searchTermLower) ||
          (edital?.organization || '').toLowerCase().includes(searchTermLower) ||
          (edital?.summary || '').toLowerCase().includes(searchTermLower)
        );
      })
      .filter(edital => {
        // Status filter now works on dynamically calculated status
        if (statusFilter === 'all') return true;
        return edital?.status === statusFilter;
      })
      .filter(edital => {
        // State filter
        if (stateFilter === specialFilters[0]) return true; // 'Todos'
        if (stateFilter === specialFilters[1]) return edital?.state === specialFilters[1]; // 'Nacional'
        return edital?.state === stateFilter;
      });
  }, [processedEditais, searchTerm, statusFilter, stateFilter]);

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <div className="mb-6 p-4 bg-gradient-to-r from-primary via-purple-600 to-pink-600 text-primary-foreground rounded-lg shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 shrink-0" />
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold">Experimente Grátis por 7 Dias!</h3>
              <p className="text-sm sm:text-base opacity-90">Explore todos os recursos da plataforma sem compromisso.</p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 hover:text-primary active:bg-primary-foreground/80 shrink-0 py-3 px-6 text-base"
            size="lg"
          >
            <Link href="/planos">
              Ver Planos
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        <Card className="mb-8 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold text-center text-primary">Encontre seu Próximo Edital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar por título, organização ou palavra-chave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 py-3 text-base focus:animate-subtle-focus rounded-lg shadow-sm h-12"
                  aria-label="Buscar editais"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: 'all' | 'open' | 'closed' | 'upcoming') => setStatusFilter(value)}>
                <SelectTrigger className="w-full sm:w-[200px] py-3 text-base rounded-lg shadow-sm h-12">
                  <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="closed">Encerrados</SelectItem>
                  <SelectItem value="upcoming">Próximos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-primary" />
                Filtrar por Estado/Região
              </label>
              <ScrollArea className="w-full whitespace-nowrap rounded-md pb-2.5">
                <div className="flex space-x-2">
                  {[...specialFilters, ...brazilStatesAbbreviations].map((stateAbbr) => (
                    <Button
                      key={stateAbbr}
                      variant={stateFilter === stateAbbr ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStateFilter(stateAbbr)}
                      className="h-9 px-3 text-xs sm:text-sm"
                    >
                      {stateAbbr}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
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
        ) : error ? (
            <Card className="text-center py-16 shadow-lg rounded-xl bg-destructive/10 border-destructive">
                <CardContent>
                <AlertCircle className="mx-auto h-16 w-16 text-destructive mb-6" />
                <p className="text-2xl font-semibold text-destructive-foreground mb-2">Ocorreu um erro</p>
                <p className="text-md text-destructive-foreground/80">{error}</p>
                </CardContent>
            </Card>
        ) : filteredEditais.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEditais.map((edital) => (
              edital && <EditalCard key={edital.id} edital={edital} className="animate-fade-in" />
            ))}
          </div>
        ) : (
          <Card className="text-center py-16 shadow-lg rounded-xl">
            <CardContent>
              <NewspaperIcon className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
              <p className="text-2xl font-semibold text-foreground mb-2">Nenhum edital encontrado.</p>
              <p className="text-md text-muted-foreground">Tente ajustar sua busca ou filtros.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
