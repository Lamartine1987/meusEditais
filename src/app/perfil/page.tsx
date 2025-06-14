
"use client";

import { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageWrapper } from '@/components/layout/page-wrapper';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save, AlertTriangle, ShieldCheck, Gem, Edit3, KeyRound, ExternalLink, XCircle, Info, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { mockEditais } from '@/lib/mock-data'; 
import type { PlanId, PlanDetails } from '@/types';
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
import { format, parseISO, addDays, differenceInCalendarDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const profileSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateUser, sendPasswordReset, cancelSubscription, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '' }
  });

  useEffect(() => {
    if (user) {
      reset({ name: user.name || '' });
    }
  }, [user, reset]);

  const onSubmitName: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user) return;
    try {
      await updateUser({ name: data.name }); 
      toast({ title: "Nome Atualizado!", description: "Seu nome foi salvo com sucesso.", variant: "default", className: "bg-accent text-accent-foreground" });
    } catch (error) {
      toast({ title: "Erro ao Atualizar Nome", description: "Não foi possível salvar seu nome. Tente novamente.", variant: "destructive" });
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      toast({ title: "Erro", description: "Email do usuário não encontrado.", variant: "destructive" });
      return;
    }
    setIsPasswordResetting(true);
    try {
      await sendPasswordReset(user.email);
      toast({ title: "E-mail de Redefinição Enviado", description: "Verifique sua caixa de entrada para redefinir sua senha.", variant: "default", className: "bg-accent text-accent-foreground", duration: 7000 });
    } catch (error: any) {
      let errorMessage = "Não foi possível enviar o e-mail de redefinição.";
       if (error.code === 'auth/too-many-requests') errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
      toast({ title: "Falha ao Enviar E-mail", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPasswordResetting(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancellingSubscription(true);
    try {
      await cancelSubscription();
    } finally {
      setIsCancellingSubscription(false);
    }
  };
  
  const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return '?';
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  };

  const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum plano ativo";
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo (1 Ano)";
      case 'plano_edital': return "Plano Edital (1 Ano)";
      case 'plano_anual': return "Plano Anual";
      default: return "Plano Desconhecido";
    }
  };

  const getPlanDetailsDescription = (planDetails?: PlanDetails | null): string | null => {
    if (!user || !planDetails) return null;

    const { planId, selectedCargoCompositeId, selectedEditalId, startDate, expiryDate } = planDetails;
    let details = "";
    let canChangeSelection = false;
    let changeDeadline: Date | null = null;

    if (startDate) {
        const start = parseISO(startDate);
        changeDeadline = addDays(start, 7);
        if (differenceInCalendarDays(new Date(), start) < 7) {
            canChangeSelection = true;
        }
    }

    if (planId === 'plano_cargo' && selectedCargoCompositeId) {
      const [editalId, cargoId] = selectedCargoCompositeId.split('_');
      const edital = mockEditais.find(e => e.id === editalId);
      const cargo = edital?.cargos?.find(c => c.id === cargoId);
      details = cargo ? `Acesso ao cargo: ${cargo.name} (${edital?.title || 'Edital Desc.'}).` : `Acesso a um cargo específico.`;
      if (canChangeSelection && changeDeadline) {
        details += ` Você pode alterar o cargo escolhido até ${format(changeDeadline, "dd/MM/yyyy", { locale: ptBR })}.`;
      } else if (startDate && !canChangeSelection) {
        details += ` A escolha do cargo é final.`;
      }
    } else if (planId === 'plano_edital' && selectedEditalId) {
      const edital = mockEditais.find(e => e.id === selectedEditalId);
      details = edital ? `Acesso a todos os cargos do edital: ${edital.title}.` : `Acesso a um edital específico.`;
       if (canChangeSelection && changeDeadline) {
        details += ` Você pode alterar o edital escolhido até ${format(changeDeadline, "dd/MM/yyyy", { locale: ptBR })}.`;
      } else if (startDate && !canChangeSelection) {
        details += ` A escolha do edital é final.`;
      }
    } else if (planId === 'plano_anual') {
      details = "Acesso ilimitado a todos os editais e cargos.";
    }

    if (expiryDate) {
      details += ` Plano válido até: ${format(parseISO(expiryDate), "dd/MM/yyyy", { locale: ptBR })}.`;
    }
    return details.trim() || null;
  };
  
  const canChangeCurrentPlanSelection = user?.activePlan && user.planDetails?.startDate && 
                                        (user.activePlan === 'plano_cargo' || user.activePlan === 'plano_edital') &&
                                        differenceInCalendarDays(new Date(), parseISO(user.planDetails.startDate)) < 7;


  if (authLoading && !user) { 
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
                <CardHeader><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl">Acesso Restrito</CardTitle></CardHeader>
                <CardContent><p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para acessar esta página.</p><Button asChild size="lg"><Link href="/login">Fazer Login</Link></Button></CardContent>
              </Card>
            </div>
          </PageWrapper>
      )
  }

  return (
    <PageWrapper>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais e de conta." />
        
        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader className="items-center text-center border-b pb-6">
            <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary ring-offset-background ring-offset-2">
              <AvatarImage src={user.avatarUrl} alt={user.name || 'Avatar'} data-ai-hint="user avatar large" />
              <AvatarFallback className="text-3xl font-semibold">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl">{user.name || 'Usuário'}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmitName)}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="font-semibold flex items-center"><Edit3 className="mr-2 h-4 w-4 text-primary"/>Nome Completo</Label>
                <Input id="name" {...register('name')} placeholder="Seu nome completo" className="text-base h-11 rounded-md shadow-sm"/>
                {errors.name && <p className="text-sm text-destructive pt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Email</Label>
                <Input id="email" type="email" value={user.email || ''} readOnly disabled placeholder="seu@email.com" className="text-base h-11 rounded-md shadow-sm bg-muted/50 cursor-not-allowed"/>
                <p className="text-xs text-muted-foreground pt-1">O e-mail não pode ser alterado através desta página no momento.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={isSubmitting || authLoading} className="w-full sm:w-auto min-w-[150px] h-11 text-base">
                {(isSubmitting || authLoading) ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Salvando...</> : <><Save className="mr-2 h-5 w-5" />Salvar Nome</>}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader><CardTitle className="text-xl flex items-center"><ShieldCheck className="mr-3 h-6 w-6 text-primary"/>Segurança da Conta</CardTitle><CardDescription>Gerencie sua senha.</CardDescription></CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="font-semibold flex items-center"><KeyRound className="mr-2 h-4 w-4 text-primary"/>Senha</Label>
              <p className="text-sm text-muted-foreground">Para alterar sua senha, enviaremos um link de redefinição para seu e-mail.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handlePasswordReset} disabled={isPasswordResetting || authLoading} variant="outline" className="w-full sm:w-auto min-w-[200px] h-11 text-base">
              {isPasswordResetting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Enviando E-mail...</> : "Enviar E-mail para Redefinir Senha"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Gem className="mr-3 h-6 w-6 text-primary"/>Meu Plano</CardTitle>
            <CardDescription>Informações sobre sua assinatura atual. Todos os planos têm validade de 1 ano.</CardDescription>
          </CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-6 space-y-3">
            <h3 className="text-lg font-semibold text-foreground">{getPlanDisplayName(user.activePlan)}</h3>
            {user.activePlan && user.planDetails && (<p className="text-sm text-muted-foreground">{getPlanDetailsDescription(user.planDetails)}</p>)}
            {!user.activePlan && (<p className="text-sm text-muted-foreground">Você ainda não possui um plano ativo. Considere assinar um para desbloquear todos os recursos!</p>)}
            
            {canChangeCurrentPlanSelection && (
                <div className="p-3 border-l-4 border-primary bg-primary/10 rounded-md">
                    <div className="flex items-start">
                        <RefreshCw className="h-5 w-5 text-primary mr-3 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-primary">Flexibilidade na Escolha!</p>
                            <p className="text-xs text-primary/80">
                                Você pode alterar sua seleção de {user.activePlan === 'plano_cargo' ? 'cargo' : 'edital'} até {format(addDays(parseISO(user.planDetails!.startDate!), 7), "dd/MM/yyyy", { locale: ptBR })}.
                                Para isso, basta "assinar" o novo item desejado na página de detalhes do respectivo edital/cargo.
                            </p>
                        </div>
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 items-center justify-start">
            <Button asChild variant="default" className="w-full sm:w-auto h-11 text-base">
              <Link href="/planos">
                {user.activePlan ? "Ver Opções de Planos" : "Ver Planos Disponíveis"}
                <ExternalLink className="ml-2 h-4 w-4"/>
              </Link>
            </Button>
            {user.activePlan && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto h-11 text-base" disabled={isCancellingSubscription || authLoading}>
                      {isCancellingSubscription ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" />}
                      Cancelar Assinatura
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Você tem certeza que deseja cancelar sua assinatura do {getPlanDisplayName(user.activePlan)}? 
                        Você perderá o acesso aos benefícios do plano ao final do período de cobrança atual (simulado aqui como imediato).
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isCancellingSubscription}>Manter Plano</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelSubscription} disabled={isCancellingSubscription || authLoading} className="bg-destructive hover:bg-destructive/90">
                        {isCancellingSubscription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, Cancelar Assinatura
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            )}
          </CardFooter>
        </Card>
      </div>
    </PageWrapper>
  );
}
