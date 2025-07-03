"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Dices } from 'lucide-react';

export default function RoletaDeQuestoesPage() {
  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Roleta de Questões" 
          description="Esta funcionalidade foi desativada."
        />
        <Card className="text-center py-16 shadow-lg rounded-xl">
            <CardContent>
                <Dices className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
                <p className="text-2xl font-semibold text-foreground mb-2">Funcionalidade Indisponível</p>
                <p className="text-md text-muted-foreground mb-6">A Roleta de Questões não está mais ativa.</p>
                <Button asChild>
                    <Link href="/">Voltar para a Página Inicial</Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
