
"use client";

import Link from 'next/link';
import type { Cargo } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { DollarSign, CheckSquare, UserPlus, UserMinus, Loader2, Library } from 'lucide-react';
import { useState } from 'react';

interface CargoCardProps {
  editalId: string; // Adicionado para construir o link
  cargo: Cargo;
  isUserRegisteredForThisCargo: boolean;
  onRegister: (cargoId: string) => Promise<void>;
  onUnregister: (cargoId: string) => Promise<void>;
  isUserLoggedIn: boolean;
  editalStatus: 'open' | 'closed' | 'upcoming';
}

export function CargoCard({ editalId, cargo, isUserRegisteredForThisCargo, onRegister, onUnregister, isUserLoggedIn, editalStatus }: CargoCardProps) {
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    setIsSubmitting(true);
    await onRegister(cargo.id);
    setIsSubmitting(false);
  };

  const handleUnregister = async () => {
    setIsSubmitting(true);
    await onUnregister(cargo.id);
    setIsSubmitting(false);
    setIsAlertOpen(false);
  };

  const canRegister = editalStatus === 'open';

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl flex flex-col h-full bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-primary hover:underline">
          <Link href={`/editais/${editalId}/cargos/${cargo.id}`}>
            {cargo.name}
          </Link>
        </CardTitle>
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
      {isUserLoggedIn && (
        <CardFooter className="pt-4 border-t flex flex-col gap-2">
           <Button variant="outline" className="w-full group" asChild>
            <Link href={`/editais/${editalId}/cargos/${cargo.id}`}>
              <Library className="mr-2 h-4 w-4" />
              Ver Matérias do Cargo
            </Link>
          </Button>
          {canRegister && (
            <>
              {isUserRegisteredForThisCargo ? (
                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                      Cancelar Inscrição no Cargo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você tem certeza que deseja cancelar sua inscrição neste cargo? 
                        Qualquer progresso salvo relacionado a este cargo poderá ser perdido.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isSubmitting}>Não, manter</AlertDialogCancel>
                      <AlertDialogAction onClick={handleUnregister} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, cancelar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={handleRegister} className="w-full" variant="default" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Inscrever-se neste Cargo
                </Button>
              )}
            </>
          )}
          {!canRegister && editalStatus !== 'open' && (
            <Button className="w-full" variant="outline" disabled>
              {editalStatus === 'closed' ? 'Edital Encerrado' : 'Inscrições em Breve'}
            </Button>
          )}
        </CardFooter>
      )}
      {!isUserLoggedIn && (
         <CardFooter className="pt-4 border-t">
             <Button variant="outline" className="w-full group" asChild>
                <Link href={`/editais/${editalId}/cargos/${cargo.id}`}>
                  <Library className="mr-2 h-4 w-4" />
                  Ver Matérias do Cargo
                </Link>
            </Button>
         </CardFooter>
      )}
    </Card>
  );
}
