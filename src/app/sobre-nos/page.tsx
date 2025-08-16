
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Heart, Eye, BarChart3, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const FeatureCard = ({ icon, title, children }: { icon: React.ElementType, title: string, children: React.ReactNode }) => {
  const Icon = icon;
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
};

export default function SobreNosPage() {
  return (
    <PageWrapper>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <PageHeader 
          title="Sobre Nós: Sua Aprovação é a Nossa Missão"
          description="Entenda o porquê de termos criado a plataforma Meus Editais."
        />

        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-primary">
              Simplificando a jornada do concurseiro.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-base leading-relaxed text-foreground/90">
            <p>
              Sabemos que a jornada para a aprovação em um concurso público é cheia de desafios. A quantidade de informações dispersas, a dificuldade de organizar os estudos e a incerteza sobre o progresso são obstáculos que todo concurseiro enfrenta. Foi pensando nisso que nasceu o <strong>Meus Editais</strong>.
            </p>
            
            <div className="space-y-6 rounded-lg border bg-muted/50 p-6">
                <FeatureCard icon={Target} title="Nosso Propósito">
                    Nossa missão é clara: democratizar e simplificar a preparação para concursos públicos. Queremos que você, concurseiro, tenha em um só lugar todas as ferramentas necessárias para transformar seu esforço em aprovação, com clareza, organização e foco total no que realmente importa.
                </FeatureCard>
                 <FeatureCard icon={Heart} title="O Que Nos Move">
                    Somos movidos pela crença de que a tecnologia pode ser a maior aliada do estudante. Acreditamos que, com as ferramentas certas, qualquer pessoa dedicada pode alcançar seu objetivo. Sua vitória é a nossa maior motivação.
                </FeatureCard>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-semibold">Como Fazemos Isso?</h2>
              <ul className="space-y-4">
                <FeatureCard icon={Eye} title="Centralização de Editais">
                    Acabou a busca incessante por informações. Reunimos os principais editais em um só lugar, de forma clara e organizada.
                </FeatureCard>
                <FeatureCard icon={BookOpen} title="Foco no Conteúdo Programático">
                    Disponibilizamos o conteúdo programático de cada cargo, permitindo que você marque seu progresso tópico por tópico, garantindo que nada seja esquecido.
                </FeatureCard>
                <FeatureCard icon={BarChart3} title="Acompanhamento Detalhado">
                    Com nosso cronômetro, registro de questões e agendamento de revisões, você tem uma visão completa do seu desempenho e pode tomar decisões mais inteligentes sobre seus estudos.
                </FeatureCard>
              </ul>
            </div>
            
            <div className="pt-6 text-center">
              <h2 className="text-xl font-bold">Junte-se a Nós!</h2>
              <p className="mt-2 text-muted-foreground">
                Seja você um iniciante ou um concurseiro experiente, o Meus Editais foi feito para você. Explore nossos recursos, organize sua rotina e dê o próximo passo rumo ao seu cargo dos sonhos.
              </p>
              <Button asChild size="lg" className="mt-6">
                <Link href="/planos">
                  Conheça Nossos Planos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
