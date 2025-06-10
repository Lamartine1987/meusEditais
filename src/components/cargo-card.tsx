
"use client";

import type { Cargo } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, CheckSquare } from 'lucide-react';

interface CargoCardProps {
  cargo: Cargo;
}

export function CargoCard({ cargo }: CargoCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl flex flex-col h-full bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-primary">{cargo.name}</CardTitle>
        {cargo.salary && (
          <div className="flex items-center text-sm text-accent font-medium mt-1">
            <DollarSign className="h-4 w-4 mr-1" />
            {`R$ ${cargo.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow pt-1">
        <CardDescription className="mb-3 text-sm line-clamp-4">{cargo.description}</CardDescription>
        {cargo.requirements && cargo.requirements.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-1 mt-2 flex items-center">
              <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Requisitos Principais:
            </h4>
            <ul className="space-y-0.5">
              {cargo.requirements.slice(0, 3).map((req, index) => ( 
                <li key={index} className="text-xs text-muted-foreground flex items-start">
                  <span className="mr-1.5 mt-0.5 text-primary">&bull;</span>{req}
                </li>
              ))}
              {cargo.requirements.length > 3 && (
                <li className="text-xs text-muted-foreground font-medium flex items-start">
                  <span className="mr-1.5 mt-0.5 text-primary">&bull;</span>... e mais.
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
