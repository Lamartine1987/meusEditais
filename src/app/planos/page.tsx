
"use client";

import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Gem, Briefcase, Library, Zap, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo, useEffect } from 'react';
import type { PlanId, Edital as EditalType, Cargo as CargoType } from '@/types';
import { useRouter } from 'next/navigation';
import { mockEditais } from '@/lib/mock-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from '@/components/ui/separator';

const PlanFeature = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-start">
    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 shrink-0" />
    <span className="text-muted-foreground">{children}</span>
  </li>
);

interface FlattenedCargo {
  id: string; // compositeId: editalId_cargoId
  name: string;
  editalTitle: string;
}

export default function PlanosPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [allEditaisData, setAllEditaisData] = useState<EditalType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPlanType, setModalPlanType] = useState<'cargo' | 'edital' | null>(null);
  const [selectedItemInModal, setSelectedItemInModal] = useState<string | null>(null);
  const [isProcessingModalSelection, setIsProcessingModalSelection] = useState(false);

  useEffect(() => {
    // Simulate fetching editais data if needed, or just use mock
    setAllEditaisData(mockEditais);
  }, []);

  const allFlattenedCargos = useMemo((): FlattenedCargo[] => {
    if (!allEditaisData.length) return [];
    return allEditaisData.reduce((acc, edital) => {
      edital.cargos?.forEach(cargo => {
        acc.push({
          id: `${edital.id}_${cargo.id}`, // compositeId
          name: cargo.name,
          editalTitle: edital.title,
        });
      });
      return acc;
    }, [] as FlattenedCargo[]);
  }, [allEditaisData]);

  const allSelectableEditais = useMemo(() => allEditaisData, [allEditaisData]);


  const handleOpenSelectionModal = (planType: 'cargo' | 'edital') => {
    if (!user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para selecionar um plano.", variant: "destructive" });
      router.push('/login?redirect=/planos');
      return;
    }
     if (user.activePlan && user.activePlan !== planType && user.activePlan === 'plano_anual') {
       toast({ title: "Plano Anual Ativo", description: "Você já possui o Plano Anual, que dá acesso a tudo. Não é necessário assinar um plano inferior.", variant: "default", duration: 7000 });
      return;
    }
    // Simplificando: se já tem um plano de cargo/edital, e tenta outro, vamos permitir o fluxo. O backend/checkout decidiria.
    // Ou, se o plano ATUAL é o mesmo tipo do que ele está tentando selecionar (ex: tem plano_cargo, e clica em plano_cargo de novo)
    // E o `user.planDetails?.planId === planType`, então ele já tem esse TIPO de plano.
    // Poderíamos informá-lo, mas o modal ainda permite escolher um item específico.
    // A lógica de "já tem esse plano" será tratada na página de checkout com mais detalhes.

    setModalPlanType(planType);
    setSelectedItemInModal(null); // Reset selection
    setIsModalOpen(true);
  };

  const handleModalSelectionAndCheckout = () => {
    if (!selectedItemInModal || !modalPlanType) return;
    setIsProcessingModalSelection(true);

    let redirectUrl = '';
    if (modalPlanType === 'cargo') {
      redirectUrl = `/checkout/plano_cargo?selectedCargoCompositeId=${selectedItemInModal}`;
    } else if (modalPlanType === 'edital') {
      redirectUrl = `/checkout/plano_edital?selectedEditalId=${selectedItemInModal}`;
    }

    if (redirectUrl) {
      router.push(redirectUrl);
    }
    // setIsModalOpen(false); // Checkout page will handle next steps, modal can close
    // setIsProcessingModalSelection(false); // Handled by page navigation
  };

  const handleSelectAnualPlan = () => {
     if (!user) {
      toast({ title: "Login Necessário", description: "Você precisa estar logado para selecionar um plano.", variant: "destructive" });
      router.push('/login?redirect=/planos');
      return;
    }
     if (user.activePlan && user.activePlan === 'plano_anual') {
        toast({ title: "Plano Já Ativo", description: `Você já está inscrito no Plano Anual.`, variant: "default" });
        return;
    }
    // Se ele tem plano_cargo ou plano_edital e quer o anual, isso é um upgrade, permitido.
    // A página de checkout pode lidar com a lógica de "já tem um plano inferior".
    router.push('/checkout/plano_anual');
  };


  return (
    <PageWrapper>
      <div className="container mx-auto px-0 sm:px-4 py-8">
        <PageHeader 
          title="Nossos Planos"
          description="Escolha o plano ideal para sua jornada de aprovação."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Plano Cargo */}
          <Card className="shadow-lg rounded-xl flex flex-col transform hover:scale-105 transition-transform duration-300">
            <CardHeader className="items-center text-center pb-4">
              <Briefcase className="h-12 w-12 text-primary mb-3" />
              <CardTitle className="text-2xl font-semibold">Plano Cargo</CardTitle>
              <CardDescription className="text-base text-muted-foreground">Foco total em uma oportunidade!</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-2">
              <p className="text-center text-3xl font-bold text-primary">
                R$ 4<span className="text-xl font-normal">,99/mês</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>1 cargo específico</strong> de <strong>1 edital</strong> à sua escolha.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo para o cargo selecionado.</PlanFeature>
                <PlanFeature>Acompanhamento de progresso detalhado.</PlanFeature>
                <PlanFeature>Ideal para quem tem um objetivo claro.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => handleOpenSelectionModal('cargo')}
                disabled={authLoading}
                variant="outline"
              >
                {authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                Selecionar Cargo
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Edital */}
          <Card className="shadow-xl rounded-xl flex flex-col border-2 border-primary relative transform hover:scale-105 transition-transform duration-300">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary text-primary-foreground">
                    Mais Popular
                </span>
            </div>
            <CardHeader className="items-center text-center pb-4 pt-10">
              <Library className="h-12 w-12 text-primary mb-3" />
              <CardTitle className="text-2xl font-semibold">Plano Edital</CardTitle>
              <CardDescription className="text-base text-muted-foreground">Explore todas as vagas de um edital.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-2">
              <p className="text-center text-3xl font-bold text-primary">
                R$ 9<span className="text-xl font-normal">,99/mês</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>todos os cargos</strong> de <strong>1 edital específico</strong>.</PlanFeature>
                <PlanFeature>Flexibilidade para estudar para múltiplas vagas do mesmo concurso.</PlanFeature>
                <PlanFeature>Todas as funcionalidades de estudo e acompanhamento.</PlanFeature>
                <PlanFeature>Perfeito para quem quer maximizar chances em um concurso.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
               <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={() => handleOpenSelectionModal('edital')}
                disabled={authLoading}
                variant="outline"
              >
                 {authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ArrowRight className="mr-2 h-5 w-5" />}
                Selecionar Edital
              </Button>
            </CardFooter>
          </Card>

          {/* Plano Anual */}
          <Card className="shadow-lg rounded-xl flex flex-col transform hover:scale-105 transition-transform duration-300">
            <CardHeader className="items-center text-center pb-4">
              <Zap className="h-12 w-12 text-primary mb-3" />
              <CardTitle className="text-2xl font-semibold">Plano Anual</CardTitle>
              <CardDescription className="text-base text-muted-foreground">Acesso total e ilimitado!</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-4 pt-2">
              <p className="text-center text-3xl font-bold text-primary">
                R$ 39<span className="text-xl font-normal">,99/ano</span>
              </p>
              <ul className="space-y-2 text-sm">
                <PlanFeature>Acesso a <strong>todos os cargos</strong> de <strong>todos os editais</strong> da plataforma.</PlanFeature>
                <PlanFeature>Liberdade total para explorar e se preparar para múltiplos concursos.</PlanFeature>
                <PlanFeature>Todas as funcionalidades premium e atualizações futuras.</PlanFeature>
                <PlanFeature>O melhor custo-benefício para concurseiros dedicados.</PlanFeature>
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                size="lg" 
                className="w-full text-base" 
                onClick={handleSelectAnualPlan}
                disabled={authLoading}
              >
                {authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Gem className="mr-2 h-5 w-5" />}
                Assinar Plano Anual
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Modal para Seleção de Cargo */}
        {modalPlanType === 'cargo' && (
          <AlertDialog open={isModalOpen && modalPlanType === 'cargo'} onOpenChange={(open) => { if (!open) { setIsModalOpen(false); setModalPlanType(null); } }}>
            <AlertDialogContent className="max-w-lg w-full">
              <AlertDialogHeader>
                <AlertDialogTitle>Selecionar Cargo para Assinatura</AlertDialogTitle>
                <AlertDialogDescription>Escolha o cargo específico que você deseja incluir no seu Plano Cargo.</AlertDialogDescription>
              </AlertDialogHeader>
              <Separator />
              {allFlattenedCargos.length > 0 ? (
                <ScrollArea className="h-[350px] my-4 pr-3">
                  <RadioGroup value={selectedItemInModal || ''} onValueChange={setSelectedItemInModal} className="space-y-2">
                    {allFlattenedCargos.map(cargo => (
                      <Label 
                        htmlFor={cargo.id} 
                        key={cargo.id} 
                        className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary transition-colors"
                      >
                        <RadioGroupItem value={cargo.id} id={cargo.id} className="border-muted-foreground"/>
                        <span className="font-medium">{cargo.name} <span className="text-xs text-muted-foreground/80">({cargo.editalTitle})</span></span>
                      </Label>
                    ))}
                  </RadioGroup>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum cargo disponível para seleção.</p>
              )}
              <Separator />
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel onClick={() => { setIsModalOpen(false); setModalPlanType(null); }} disabled={isProcessingModalSelection}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleModalSelectionAndCheckout} disabled={!selectedItemInModal || isProcessingModalSelection}>
                  {isProcessingModalSelection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar e Ir para Checkout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Modal para Seleção de Edital */}
        {modalPlanType === 'edital' && (
           <AlertDialog open={isModalOpen && modalPlanType === 'edital'} onOpenChange={(open) => { if (!open) { setIsModalOpen(false); setModalPlanType(null); } }}>
            <AlertDialogContent className="max-w-lg w-full">
              <AlertDialogHeader>
                <AlertDialogTitle>Selecionar Edital para Assinatura</AlertDialogTitle>
                <AlertDialogDescription>Escolha o edital ao qual você deseja ter acesso completo com o Plano Edital.</AlertDialogDescription>
              </AlertDialogHeader>
               <Separator />
              {allSelectableEditais.length > 0 ? (
                <ScrollArea className="h-[350px] my-4 pr-3">
                  <RadioGroup value={selectedItemInModal || ''} onValueChange={setSelectedItemInModal} className="space-y-2">
                    {allSelectableEditais.map(edital => (
                       <Label 
                        htmlFor={edital.id} 
                        key={edital.id} 
                        className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary transition-colors"
                      >
                        <RadioGroupItem value={edital.id} id={edital.id} className="border-muted-foreground"/>
                        <span className="font-medium">{edital.title} <span className="text-xs text-muted-foreground/80">({edital.organization})</span></span>
                      </Label>
                    ))}
                  </RadioGroup>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum edital disponível para seleção.</p>
              )}
              <Separator />
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel onClick={() => { setIsModalOpen(false); setModalPlanType(null); }} disabled={isProcessingModalSelection}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleModalSelectionAndCheckout} disabled={!selectedItemInModal || isProcessingModalSelection}>
                  {isProcessingModalSelection && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar e Ir para Checkout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Card className="mt-12 bg-muted/70 shadow-md rounded-xl">
            <CardHeader>
                <CardTitle className="text-xl text-center">Como funciona a assinatura?</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground space-y-3">
                <p>Para o <strong>Plano Anual</strong>, você será direcionado ao checkout.</p>
                <p>Para os <strong>Planos Cargo e Edital</strong>, selecione o item desejado no modal para prosseguir ao checkout.</p>
                <p><strong>Atenção:</strong> No momento, a integração com pagamentos reais (Stripe) é simulada. As funcionalidades de estudo requerem um plano ativo (simulado).</p>
            </CardContent>
             <CardFooter className="justify-center pt-4">
                {user ? (
                     <Button variant="outline" asChild>
                        <Link href="/perfil">Ver Meu Perfil</Link>
                    </Button>
                ) : (
                    <Button variant="outline" asChild>
                        <Link href="/login">Já tem uma conta? Faça Login</Link>
                    </Button>
                )}
            </CardFooter>
        </Card>

      </div>
    </PageWrapper>
  );
}

