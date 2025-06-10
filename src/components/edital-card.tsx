
"use client";

import Link from 'next/link';
import Image from 'next/image';
import type { Edital } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Landmark, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditalCardProps {
  edital: Edital;
  className?: string;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function EditalCard({ edital, className }: EditalCardProps) {
  const statusMap: Record<Edital['status'], { text: string; variant: "default" | "secondary" | "destructive" | "outline" | "accent" }> = {
    open: { text: 'Aberto', variant: 'accent' }, // Use accent green for open
    closed: { text: 'Encerrado', variant: 'destructive' },
    upcoming: { text: 'Próximo', variant: 'secondary' },
  };
  
  const currentStatus = statusMap[edital.status] || { text: edital.status, variant: 'outline' };

  return (
    <Card className={cn("flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl bg-card", className)}>
      {edital.imageUrl && (
        <div className="relative h-48 w-full">
          <Image
            src={edital.imageUrl}
            alt={edital.title}
            layout="fill"
            objectFit="cover"
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
        <div className="space-y-1 text-xs">
            <div className="flex items-center text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-primary" />
                <span>Publicação: {formatDate(edital.publicationDate)}</span>
            </div>
            <div className="flex items-center text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                <span>Encerramento: {formatDate(edital.closingDate)}</span>
            </div>
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
