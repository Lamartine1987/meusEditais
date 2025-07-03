
"use client";

import Link from 'next/link';
import Image from 'next/image';
import type { Edital } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Landmark, ArrowRight, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditalCardProps {
  edital: Edital;
  className?: string;
}

function formatDate(dateString: string) {
  if (!dateString) return 'Data não informada';
  try {
    const date = new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }
    return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch (error) {
    console.error('Invalid date string for formatDate:', dateString);
    return 'Data inválida';
  }
}

export function EditalCard({ edital, className }: EditalCardProps) {
  const statusMap: Record<Edital['status'], { text: string; variant: "default" | "secondary" | "destructive" | "outline" | "accent" }> = {
    open: { text: 'Aberto', variant: 'accent' }, // Use accent green for open
    closed: { text: 'Encerrado', variant: 'destructive' },
    upcoming: { text: 'Próximo', variant: 'secondary' },
  };
  
  const currentStatus = statusMap[edital.status] || { text: edital.status, variant: 'outline' };

  const getTotalVacanciesText = () => {
    if (!edital.cargos || edital.cargos.length === 0) {
      return null;
    }

    const totalVacancies = edital.cargos.reduce((acc, cargo) => acc + (cargo.vacancies || 0), 0);
    
    const reserveInfo = edital.cargos.reduce((acc, cargo) => {
        if (typeof cargo.reserveList === 'number') {
            acc.numericTotal += cargo.reserveList;
        } else if (cargo.reserveList === true) {
            acc.hasBoolean = true;
        }
        return acc;
    }, { numericTotal: 0, hasBoolean: false });

    let vacanciesText = '';
    if (totalVacancies > 0) {
        vacanciesText = `${totalVacancies} ${totalVacancies === 1 ? 'vaga' : 'vagas'}`;
    }

    let reserveText = '';
    if (reserveInfo.numericTotal > 0) {
        reserveText = `${reserveInfo.numericTotal} CR`;
    } else if (reserveInfo.hasBoolean) {
        reserveText = 'CR';
    }

    if (vacanciesText && reserveText) {
        return `${vacanciesText} + ${reserveText}`;
    }
    
    return vacanciesText || reserveText || null;
  };

  const totalVacanciesText = getTotalVacanciesText();

  return (
    <Card className={cn("flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl bg-card", className)}>
      {edital.imageUrl && (
        <div className="relative h-48 w-full">
          <Image
            src={edital.imageUrl}
            alt={edital.title}
            fill
            style={{ objectFit: 'cover' }}
            data-ai-hint="public tender announcement"
            className="rounded-t-xl"
          />
           <div className="absolute top-2 right-2">
             <Badge variant={currentStatus.variant} className="text-xs px-2 py-1 shadow-md">{currentStatus.text}</Badge>
           </div>
        </div>
      )}
      {!edital.imageUrl && ( // Fallback for no image
        <div className="h-48 w-full bg-muted flex items-center justify-center rounded-t-xl">
            <Landmark className="w-16 h-16 text-muted-foreground opacity-50" />
            <div className="absolute top-2 right-2">
             <Badge variant={currentStatus.variant} className="text-xs px-2 py-1 shadow-md">{currentStatus.text}</Badge>
           </div>
        </div>
      )}
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg font-bold leading-tight hover:text-primary transition-colors">
          <Link href={`/editais/${edital.id}`}>{edital.title}</Link>
        </CardTitle>
        <div className="flex items-center text-xs text-muted-foreground pt-1">
            <Landmark className="h-3.5 w-3.5 mr-1.5" />
            {edital.organization}
        </div>
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-3">
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{edital.summary}</p>
        
        {totalVacanciesText && (
          <div className="flex items-center text-xs text-muted-foreground font-medium mb-2">
            <Users className="h-4 w-4 mr-1.5 text-primary" />
            <span>{totalVacanciesText} no total</span>
          </div>
        )}

        <div className="space-y-1 text-xs">
            <div className="flex items-center text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-primary" />
                <span>Publicação: {formatDate(edital.publicationDate)}</span>
            </div>
            <div className="flex items-center text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                <span>Encerramento: {formatDate(edital.closingDate)}</span>
            </div>
            {edital.examDate && (
              <div className="flex items-center text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-accent" />
                  <span className="font-semibold">Prova: {formatDate(edital.examDate)}</span>
              </div>
            )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild className="w-full group" variant="default">
          <Link href={`/editais/${edital.id}`}>
            Ver Detalhes
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
