
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { Edital } from '@/types';
import { mockEditais } from '@/lib/mock-data';
import { Input } from '@/components/ui/input';
import { EditalCard } from '@/components/edital-card';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { Search, Filter, NewspaperIcon, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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

  useEffect(() => {
    // Simulate fetching data
    setLoading(true);
    const timer = setTimeout(() => {
      setAllEditais(mockEditais);
      setLoading(false);
    }, 1000); // Simulate network delay
    return () => clearTimeout(timer);
  }, []);

  const filteredEditais = useMemo(() => {
    return allEditais
      .filter(edital =>
        edital.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        edital.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
        edital.summary.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter(edital => {
        if (statusFilter === 'all') return true;
        return edital.status === statusFilter;
      })
      .filter(edital => {
        if (stateFilter === specialFilters[0]) return true; // 'Todos'
        if (stateFilter === specialFilters[1]) return edital.state === specialFilters[1]; // 'Nacional'
        return edital.state === stateFilter;
      });
  }, [allEditais, searchTerm, statusFilter, stateFilter]);

  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
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
        ) : filteredEditais.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEditais.map((edital) => (
              <EditalCard key={edital.id} edital={edital} className="animate-fade-in" />
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

