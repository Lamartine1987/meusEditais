
"use client";

import { useEffect, useState, useMemo } from 'react';
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
import { Loader2, Save, AlertTriangle, ShieldCheck, Gem, Edit3, KeyRound, ExternalLink, XCircle, Users, RotateCcw, Info, Zap, History, Trophy, Package } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import type { PlanId, Edital as EditalType, Cargo as CargoType, PlanDetails } from '@/types';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from '@/components/ui/switch';


const profileSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, updateUser, sendPasswordReset, cancelSubscription, loading: authLoading, isPlanoCargoWithinGracePeriod, setRankingParticipation } = useAuth();
  const { toast } = useToast();
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  
  const [allEditaisData, setAllEditaisData] = useState<EditalType[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name || '',
      });
    }
  }, [user, reset]);

  useEffect(() => {
    const fetchAllEditais = async () => {
        setDataLoading(true);
        console.log('[PerfilPage] Fetching editais for plan management...');
        try {
            const response = await fetch('/api/editais');
            if (!response.ok) {
                throw new Error('Falha ao carregar dados dos editais.');
            }
            const data: EditalType[] = await response.json();
            console.log(`[PerfilPage] Successfully fetched ${data.length} editais.`);
            setAllEditaisData(data);
        } catch (error) {
            console.error('[PerfilPage] Error fetching editais:', error);
            setAllEditaisData([]);
        } finally {
            setDataLoading(false);
        }
    };
    
    fetchAllEditais();
  }, []);

  const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum plano";
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo";
      case 'plano_edital': return "Plano Edital";
      case 'plano_anual': return "Plano Anual";
      case 'plano_trial': return "Plano Teste Gratuito";
      default: return "Plano Desconhecido";
    }
  };

  const getPlanDetailsDescription = (plan: PlanDetails): React.ReactNode => {
    switch (plan.planId) {
      case 'plano_anual':
        return "Acesso ilimitado a todos os editais e cargos.";
      case 'plano_trial':
        return "Acesso completo para avaliação.";
      case 'plano_edital': {
        const edital = allEditaisData.find(e => e.id === plan.selectedEditalId);
        return edital ? <>Acesso a todos os cargos do edital: <Link href={`/editais/${plan.selectedEditalId}`} className="font-semibold text-primary hover:underline">{edital.title}</Link></> : "Acesso a um edital específico.";
      }
      case 'plano_cargo': {
        let foundEdital: EditalType | undefined;
        let foundCargo: CargoType | undefined;
        for (const edital of allEditaisData) {
            if (plan.selectedCargoCompositeId?.startsWith(edital.id + '_')) {
                const cargoId = plan.selectedCargoCompositeId.substring(edital.id.length + 1);
                const cargo = edital.cargos?.find(c => c.id === cargoId);
                if (cargo) {
                    foundEdital = edital;
                    foundCargo = cargo;
                    break;
                }
            }
        }
        return foundCargo && foundEdital ? <>Acesso ao cargo: <Link href={`/editais/${foundEdital.id}/cargos/${foundCargo.id}`} className="font-semibold text-primary hover:underline">{foundCargo.name}</Link><span className="text-muted-foreground/80"> ({foundEdital.title})</span></> : `Acesso a um cargo específico.`;
      }
      default:
        return null;
    }
  };


  const onSubmitName: SubmitHandler<ProfileFormValues> = async (data) => {
    if (!user) return;
    try {
      await updateUser({ name: data.name }); 
      toast({
        title: "Nome Atualizado!",
        description: "Seu nome foi salvo com sucesso.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error) {
      toast({
        title: "Erro ao Atualizar Nome",
        description: "Não foi possível salvar seu nome. Tente novamente.",
        variant: "destructive",
      });
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
      toast({
        title: "E-mail de Redefinição Enviado",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
        duration: 7000,
      });
    } catch (error: any) {
      let errorMessage = "Não foi possível enviar o e-mail de redefinição.";
       if (error.code === 'auth/too-many-requests') {
        errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
      }
      toast({ title: "Falha ao Enviar E-mail", description: errorMessage, variant: "destructive" });
    } finally {
      setIsPasswordResetting(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsCancellingSubscription(true);
    try {
      await cancelSubscription();
    } catch (error) {
      // Error already handled in cancelSubscription
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
  
  const handleRankingToggle = async (checked: boolean) => {
    await setRankingParticipation(checked);
  };


  if (authLoading || dataLoading) { 
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
                <CardHeader>
                    <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
                    <CardTitle className="text-2xl">Acesso Restrito</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-muted-foreground mb-6">Você precisa estar logado para acessar esta página.</p>
                    <Button asChild size="lg">
                        <Link href="/login">Fazer Login</Link>
                    </Button>
                </CardContent>
              </Card>
            </div>
          </PageWrapper>
      )
  }

  const showCancelTrialButton = user.activePlans?.some(p => p.planId === 'plano_trial');

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
                <Input 
                  id="name" 
                  {...register('name')} 
                  placeholder="Seu nome completo"
                  className="text-base h-11 rounded-md shadow-sm"
                />
                {errors.name && <p className="text-sm text-destructive pt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-semibold">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={user.email || ''} 
                  readOnly 
                  disabled
                  placeholder="seu@email.com"
                  className="text-base h-11 rounded-md shadow-sm bg-muted/50 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground pt-1">O e-mail não pode ser alterado através desta página no momento.</p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6">
              <Button type="submit" disabled={isSubmitting || authLoading} className="w-full sm:w-auto min-w-[150px] h-11 text-base">
                {(isSubmitting || authLoading) ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salvar Nome
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Trophy className="mr-3 h-6 w-6 text-primary" />Preferências</CardTitle>
            <CardDescription>Gerencie suas preferências de privacidade e participação.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="ranking-switch" className="flex flex-col space-y-1">
                <span className="font-semibold">Participar do Ranking</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Permitir que seu progresso seja exibido publicamente.
                </span>
              </Label>
              <Switch
                id="ranking-switch"
                checked={user.isRankingParticipant === true}
                onCheckedChange={handleRankingToggle}
                disabled={authLoading}
              />
            </div>
          </CardContent>
        </Card>


        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><ShieldCheck className="mr-3 h-6 w-6 text-primary"/>Segurança da Conta</CardTitle>
            <CardDescription>Gerencie sua senha.</CardDescription>
          </CardHeader>
          <Separator className="mb-1" />
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label className="font-semibold flex items-center"><KeyRound className="mr-2 h-4 w-4 text-primary"/>Senha</Label>
              <p className="text-sm text-muted-foreground">
                Para alterar sua senha, enviaremos um link de redefinição para seu e-mail.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handlePasswordReset} 
              disabled={isPasswordResetting || authLoading}
              variant="outline"
              className="w-full sm:w-auto min-w-[200px] h-11 text-base"
            >
              {isPasswordResetting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Enviando E-mail...
                </>
              ) : (
                "Enviar E-mail para Redefinir Senha"
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg rounded-xl bg-card">
          <CardHeader>
            <CardTitle className="text-xl flex items-center"><Gem className="mr-3 h-6 w-6 text-primary"/>Meus Planos Ativos</CardTitle>
             <CardDescription>Informações sobre suas assinaturas atuais.</CardDescription>
          </CardHeader>
          <Separator />
           <CardContent className="pt-6 space-y-4">
              {(user.activePlans && user.activePlans.length > 0) ? (
                <ul className="space-y-4">
                  {user.activePlans.map((plan, index) => (
                    <li key={index} className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-semibold text-foreground flex items-center">
                          <Package className="mr-2 h-5 w-5" />
                          {getPlanDisplayName(plan.planId)}
                        </h3>
                         {plan.expiryDate && <Badge variant="outline">Expira em: {new Date(plan.expiryDate).toLocaleDateString('pt-BR')}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 pl-7">
                        {getPlanDetailsDescription(plan)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Você ainda não possui um plano ativo. Considere assinar um para desbloquear todos os recursos!
                </p>
              )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-2 items-center justify-start flex-wrap">
            <Button asChild variant="default" className="w-full sm:w-auto h-11 text-base">
              <Link href="/planos">
                {(user.activePlans?.length ?? 0) > 0 ? "Ver Outros Planos" : "Ver Planos Disponíveis"}
                <ExternalLink className="ml-2 h-4 w-4"/>
              </Link>
            </Button>
            
            {showCancelTrialButton && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button 
                        variant="destructive" 
                        className="w-full sm:w-auto h-11 text-base"
                        disabled={isCancellingSubscription || authLoading}
                    >
                        {isCancellingSubscription ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <XCircle className="mr-2 h-5 w-5" />}
                        Cancelar Teste Gratuito
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Cancelamento do Teste</AlertDialogTitle>
                        <AlertDialogDescription>
                        Você tem certeza que deseja cancelar seu período de Teste Gratuito? Seu acesso à plataforma será limitado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancellingSubscription}>Continuar Teste</AlertDialogCancel>
                        <AlertDialogAction 
                        onClick={handleConfirmCancel}
                        disabled={isCancellingSubscription || authLoading}
                        className="bg-destructive hover:bg-destructive/90"
                        >
                        {isCancellingSubscription && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sim, Cancelar Teste
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
          </CardFooter>
        </Card>

        <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader>
                <CardTitle className="text-xl flex items-center"><History className="mr-3 h-6 w-6 text-primary"/>Histórico de Assinaturas</CardTitle>
                <CardDescription>Seus planos anteriores.</CardDescription>
            </CardHeader>
            <Separator className="mb-1" />
            <CardContent className="pt-6 space-y-4">
                {user.planHistory && user.planHistory.length > 0 ? (
                    <ul className="space-y-3">
                        {user.planHistory.map((plan, index) => {
                            const status = "Expirado/Substituído";

                            return (
                                <li key={index} className="p-3 border rounded-md text-sm">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="font-semibold">{getPlanDisplayName(plan.planId)}</p>
                                      <Badge variant={'secondary'}>
                                        {status}
                                      </Badge>
                                    </div>
                                    {plan.startDate && (
                                        <p className="text-xs text-muted-foreground">
                                            Período: {new Date(plan.startDate).toLocaleDateString('pt-BR')}
                                            {plan.expiryDate ? ` - ${new Date(plan.expiryDate).toLocaleDateString('pt-BR')}` : ''}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">Nenhum plano anterior encontrado.</p>
                )}
            </CardContent>
        </Card>

      </div>
    </PageWrapper>
  );
}
