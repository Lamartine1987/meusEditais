
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
import { Loader2, Save, AlertTriangle, ShieldCheck, Gem, Edit3, KeyRound, ExternalLink, XCircle, Users, RotateCcw, Info, Zap, History, Trophy, Package, DollarSign, Clock, Trash2, Repeat, Search as SearchIcon, CalendarPlus } from 'lucide-react';
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
import { isWithinGracePeriod } from '@/lib/utils';


const profileSchema = z.object({
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const planRank: Record<PlanId, number> = {
  plano_trial: 0,
  plano_cargo: 1,
  plano_edital: 2,
  plano_mensal: 3,
};

export default function ProfilePage() {
  const { user, updateUser, sendPasswordReset, cancelSubscription, loading: authLoading, setRankingParticipation, requestPlanRefund, deleteUserAccount, changeItemForPlan } = useAuth();
  const { toast } = useToast();
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState<string | null>(null);
  const [isRequestingRefund, setIsRequestingRefund] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  
  const [allEditaisData, setAllEditaisData] = useState<EditalType[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // State for the item change modal
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [planToChange, setPlanToChange] = useState<PlanDetails | null>(null);
  const [selectedEditalIdInCargoModal, setSelectedEditalIdInCargoModal] = useState<string | null>(null);
  const [cargosForSelectedEdital, setCargosForSelectedEdital] = useState<CargoType[]>([]);
  const [cargoSearchTerm, setCargoSearchTerm] = useState('');
  const [editalSearchTerm, setEditalSearchTerm] = useState('');
  const [selectedItemInModal, setSelectedItemInModal] = useState<string | null>(null);
  const [isProcessingChange, setIsProcessingChange] = useState(false);


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
        try {
            const response = await fetch('/api/editais');
            if (!response.ok) throw new Error('Falha ao carregar dados dos editais.');
            const data: EditalType[] = await response.json();
            setAllEditaisData(data);
        } catch (error) {
            setAllEditaisData([]);
        } finally {
            setDataLoading(false);
        }
    };
    
    fetchAllEditais();
  }, []);

  const allSelectableEditais = useMemo(() => allEditaisData.sort((a,b) => a.title.localeCompare(b.title)), [allEditaisData]);

  useEffect(() => {
    if (planToChange?.planId === 'plano_cargo' && selectedEditalIdInCargoModal) {
      const edital = allSelectableEditais.find(e => e.id === selectedEditalIdInCargoModal);
      setCargosForSelectedEdital(edital?.cargos || []);
      setSelectedItemInModal(null); 
      setCargoSearchTerm(''); 
    } else {
      setCargosForSelectedEdital([]);
    }
  }, [selectedEditalIdInCargoModal, planToChange, allSelectableEditais]);

  const filteredCargosForModal = useMemo(() => {
    if (!cargoSearchTerm) return cargosForSelectedEdital;
    return cargosForSelectedEdital.filter(cargo => 
      (cargo?.name || '').toLowerCase().includes(cargoSearchTerm.toLowerCase())
    );
  }, [cargosForSelectedEdital, cargoSearchTerm]);

  const filteredEditaisForModal = useMemo(() => {
    if (!editalSearchTerm) return allSelectableEditais;
    return allSelectableEditais.filter(edital => 
      (edital?.title || '').toLowerCase().includes(editalSearchTerm.toLowerCase()) ||
      (edital?.organization || '').toLowerCase().includes(editalSearchTerm.toLowerCase())
    );
  }, [allSelectableEditais, editalSearchTerm]);


  const handleOpenChangeModal = (plan: PlanDetails) => {
    setPlanToChange(plan);
    setSelectedItemInModal(null);
    if (plan.planId === 'plano_cargo') {
        setSelectedEditalIdInCargoModal(null);
        setCargosForSelectedEdital([]);
        setCargoSearchTerm('');
    } else {
        setEditalSearchTerm('');
    }
    setIsChangeModalOpen(true);
  };
  
  const handleConfirmChange = async () => {
    if (!planToChange || !selectedItemInModal) return;
    setIsProcessingChange(true);
    try {
        await changeItemForPlan(planToChange.stripePaymentIntentId!, selectedItemInModal);
        setIsChangeModalOpen(false);
        setPlanToChange(null);
    } catch(e) {
        // Toast is handled in auth provider
    } finally {
        setIsProcessingChange(false);
    }
  };


  const getPlanDisplayName = (planId?: PlanId | null): string => {
    if (!planId) return "Nenhum plano";
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo";
      case 'plano_edital': return "Plano Edital";
      case 'plano_mensal': return "Plano Mensal";
      case 'plano_trial': return "Plano Teste Gratuito";
      default: return "Plano Desconhecido";
    }
  };

  const getPlanDetailsDescription = (plan: PlanDetails): React.ReactNode => {
    switch (plan.planId) {
      case 'plano_mensal':
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

  const handleConfirmCancel = async (subscriptionId: string) => {
    setIsCancellingSubscription(subscriptionId);
    try {
      await cancelSubscription(subscriptionId);
    } catch (error) {
      // Error already handled in cancelSubscription
    } finally {
      setIsCancellingSubscription(null);
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

  const handleRequestRefund = async (plan: PlanDetails) => {
      if (!plan.stripePaymentIntentId) return;
      setIsRequestingRefund(plan.stripePaymentIntentId);
      try {
          await requestPlanRefund(plan.stripePaymentIntentId);
      } finally {
          setIsRequestingRefund(null);
      }
  };

  const handleDeleteAccountConfirm = async () => {
    setIsDeletingAccount(true);
    try {
        await deleteUserAccount();
    } catch (error) {
        // Toast is handled in auth-provider
    } finally {
        setIsDeletingAccount(false);
    }
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
                  {user.activePlans.map((plan, index) => {
                    const isPlanRefunding = plan.stripePaymentIntentId ? isRequestingRefund === plan.stripePaymentIntentId : false;
                    const isPlanCancelling = plan.stripeSubscriptionId ? isCancellingSubscription === plan.stripeSubscriptionId : false;
                    const canRequestRefund = isWithinGracePeriod(plan.startDate, 7);
                    const canChangeItem = (plan.planId === 'plano_cargo' || plan.planId === 'plano_edital') && isWithinGracePeriod(plan.startDate, 7);

                    return (
                        <li key={plan.stripePaymentIntentId || plan.stripeSubscriptionId || index} className="p-4 border rounded-lg bg-muted/50">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground flex items-center">
                                  <Package className="mr-2 h-5 w-5" />
                                  {getPlanDisplayName(plan.planId)}
                                   {plan.status === 'refundRequested' && <Badge variant="destructive" className="ml-2 animate-pulse"><Clock className="mr-1.5 h-3 w-3" /> Reembolso em Processamento</Badge>}
                                   {plan.status === 'past_due' && <Badge variant="destructive" className="ml-2 animate-pulse"><Clock className="mr-1.5 h-3 w-3" /> Pagamento Pendente</Badge>}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 pl-7">
                                  {getPlanDetailsDescription(plan)}
                                </p>
                                {plan.startDate && (
                                    <p className="text-xs text-muted-foreground mt-2 pl-7 flex items-center">
                                        <CalendarPlus className="mr-1.5 h-3 w-3" />
                                        Assinado em: {new Date(plan.startDate).toLocaleDateString('pt-BR')}
                                    </p>
                                )}
                            </div>
                             {plan.status === 'canceled' && plan.expiryDate ? (
                                <Badge variant="secondary">Cancelado. Expira em: {new Date(plan.expiryDate).toLocaleDateString('pt-BR')}</Badge>
                             ) : plan.expiryDate && (
                                <Badge variant={plan.planId === 'plano_trial' ? 'outline' : 'default'}>Expira em: {new Date(plan.expiryDate).toLocaleDateString('pt-BR')}</Badge>
                             )}
                          </div>
                          <div className="mt-4 pt-4 border-t border-muted-foreground/10 flex flex-col sm:flex-row justify-end gap-2">
                               {canChangeItem && plan.status === 'active' && (
                                  <Button variant="secondary" size="sm" onClick={() => handleOpenChangeModal(plan)}>
                                      <Repeat className="mr-2 h-4 w-4" />
                                      Trocar Cargo/Edital
                                  </Button>
                              )}

                              {plan.planId !== 'plano_trial' && plan.status === 'active' && canRequestRefund && (
                                <TooltipProvider>
                                  <Tooltip delayDuration={0}>
                                    <TooltipTrigger asChild><span tabIndex={0}>
                                      <Button variant="destructive" size="sm" onClick={() => handleRequestRefund(plan)} disabled={isPlanRefunding || !plan.stripePaymentIntentId}>
                                        {isPlanRefunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Solicitar Reembolso
                                      </Button>
                                    </span></TooltipTrigger>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              
                              {plan.planId === 'plano_mensal' && plan.status === 'active' && plan.stripeSubscriptionId && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" disabled={isPlanCancelling}>
                                            {isPlanCancelling ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                                            Cancelar Assinatura
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirmar Cancelamento</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Tem certeza de que deseja cancelar sua assinatura mensal? Seu acesso continuará ativo até o final do período já pago ({new Date(plan.expiryDate).toLocaleDateString('pt-BR')}), e você não será cobrado novamente.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isPlanCancelling}>Manter Assinatura</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleConfirmCancel(plan.stripeSubscriptionId!)} disabled={isPlanCancelling} className="bg-destructive hover:bg-destructive/90">
                                                {isPlanCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Sim, Cancelar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              )}

                              {plan.planId === 'plano_trial' && plan.status === 'active' && (
                                  <Button variant="destructive" size="sm" onClick={() => handleConfirmCancel('plano_trial')} disabled={isCancellingSubscription === 'plano_trial'}>
                                    {isCancellingSubscription === 'plano_trial' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                                    Cancelar Teste Gratuito
                                  </Button>
                              )}
                          </div>
                        </li>
                    )
                  })}
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
          </CardFooter>
        </Card>

        <Card className="shadow-lg rounded-xl bg-card">
            <CardHeader>
                <CardTitle className="text-xl flex items-center"><History className="mr-3 h-6 w-6 text-primary"/>Histórico de Assinaturas</CardTitle>
                <CardDescription>Seus planos anteriores e reembolsados.</CardDescription>
            </CardHeader>
            <Separator className="mb-1" />
            <CardContent className="pt-6 space-y-4">
                {user.planHistory && user.planHistory.length > 0 ? (
                    <ul className="space-y-3">
                        {user.planHistory.map((plan, index) => {
                            let statusText = "Expirado/Substituído";
                            let badgeVariant: "secondary" | "outline" = "outline";
                            if (plan.status === 'refunded') {
                                statusText = "Reembolsado";
                                badgeVariant = "secondary";
                            }
                            return (
                                <li key={plan.stripePaymentIntentId || index} className="p-3 border rounded-md text-sm">
                                    <div className="flex justify-between items-center mb-1">
                                      <p className="font-semibold">{getPlanDisplayName(plan.planId)}</p>
                                      <Badge variant={badgeVariant}>
                                        {statusText}
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
        
        <Card className="shadow-lg rounded-xl bg-card border-destructive">
          <CardHeader>
            <CardTitle className="text-xl flex items-center text-destructive"><AlertTriangle className="mr-3 h-6 w-6"/>Zona de Perigo</CardTitle>
            <CardDescription>Ações permanentes e irreversíveis.</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
               <div>
                  <h3 className="font-semibold">Excluir Conta</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta ação excluirá permanentemente sua conta, assinaturas e todos os seus dados de progresso. Esta ação não pode ser desfeita.
                  </p>
               </div>
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                   <Button variant="destructive" className="w-full sm:w-auto shrink-0">
                     <Trash2 className="mr-2 h-4 w-4" />
                     Excluir Minha Conta
                   </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                     <AlertDialogDescription>
                       Esta ação é irreversível. Todos os seus dados, incluindo progresso de estudo, histórico de questões, anotações e informações de perfil, serão permanentemente apagados.
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel disabled={isDeletingAccount}>Cancelar</AlertDialogCancel>
                     <AlertDialogAction
                       className="bg-destructive hover:bg-destructive/90"
                       onClick={handleDeleteAccountConfirm}
                       disabled={isDeletingAccount}
                     >
                       {isDeletingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       Sim, excluir minha conta
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>
             </div>
          </CardContent>
        </Card>

      </div>

      {/* Item Change Modal */}
      <AlertDialog open={isChangeModalOpen} onOpenChange={setIsChangeModalOpen}>
        <AlertDialogContent className="max-w-lg w-full">
            <AlertDialogHeader>
                <AlertDialogTitle>Trocar {planToChange?.planId === 'plano_cargo' ? 'Cargo' : 'Edital'}</AlertDialogTitle>
                <AlertDialogDescription>
                    Você pode trocar o item do seu plano uma vez dentro do período de 7 dias após a compra.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Separator />

            {planToChange?.planId === 'plano_cargo' && (
                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="edital-select-change-modal" className="mb-1.5 block text-sm font-medium text-muted-foreground">1. Selecione o Edital:</Label>
                        <Select value={selectedEditalIdInCargoModal || ""} onValueChange={setSelectedEditalIdInCargoModal}>
                            <SelectTrigger id="edital-select-change-modal"><SelectValue placeholder="Escolha um edital..." /></SelectTrigger>
                            <SelectContent>{allSelectableEditais.map(edital => (<SelectItem key={edital.id} value={edital.id}>{edital.title}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                    {selectedEditalIdInCargoModal && (
                        <div className="space-y-2">
                            <Label htmlFor="cargo-search-input-change" className="block text-sm font-medium text-muted-foreground">2. Busque e Selecione o Novo Cargo:</Label>
                            <div className="relative"><SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="cargo-search-input-change" type="search" placeholder="Buscar cargo..." value={cargoSearchTerm} onChange={(e) => setCargoSearchTerm(e.target.value)} className="pl-8"/></div>
                            {filteredCargosForModal.length > 0 ? (
                                <ScrollArea className="h-[200px] pr-3 border rounded-md">
                                    <RadioGroup value={selectedItemInModal || ''} onValueChange={setSelectedItemInModal} className="space-y-1 p-2">
                                        {filteredCargosForModal.map(cargo => {
                                            const compositeCargoId = `${selectedEditalIdInCargoModal}_${cargo.id}`;
                                            return (<Label htmlFor={compositeCargoId} key={compositeCargoId} className="flex items-center space-x-3 p-2.5 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary transition-colors"><RadioGroupItem value={compositeCargoId} id={compositeCargoId} className="border-muted-foreground"/><span className="font-medium">{cargo.name}</span></Label>);
                                        })}
                                    </RadioGroup>
                                </ScrollArea>
                            ) : (<p className="text-muted-foreground text-sm text-center py-4">{cargoSearchTerm ? "Nenhum cargo encontrado." : "Nenhum cargo para este edital."}</p>)}
                        </div>
                    )}
                </div>
            )}

            {planToChange?.planId === 'plano_edital' && (
                <div className="py-2 space-y-2">
                    <Label htmlFor="edital-search-input-change" className="block text-sm font-medium text-muted-foreground">Busque e Selecione o Novo Edital:</Label>
                    <div className="relative"><SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="edital-search-input-change" type="search" placeholder="Buscar edital..." value={editalSearchTerm} onChange={(e) => setEditalSearchTerm(e.target.value)} className="pl-8"/></div>
                    {filteredEditaisForModal.length > 0 ? (
                        <ScrollArea className="h-[300px] mt-2 pr-3 border rounded-md">
                            <RadioGroup value={selectedItemInModal || ''} onValueChange={setSelectedItemInModal} className="space-y-2 p-2">
                                {filteredEditaisForModal.map(edital => (<Label htmlFor={edital.id} key={edital.id} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:checked]:border-primary transition-colors"><RadioGroupItem value={edital.id} id={edital.id} className="border-muted-foreground"/><span className="font-medium">{edital.title} <span className="text-xs text-muted-foreground/80">({edital.organization})</span></span></Label>))}
                            </RadioGroup>
                        </ScrollArea>
                    ) : (<p className="text-muted-foreground text-sm text-center py-8">{editalSearchTerm ? "Nenhum edital encontrado." : "Nenhum edital disponível."}</p>)}
                </div>
            )}
            
            <Separator />
            <AlertDialogFooter className="pt-4">
                <AlertDialogCancel onClick={() => setIsChangeModalOpen(false)} disabled={isProcessingChange}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmChange} disabled={!selectedItemInModal || isProcessingChange}>
                    {isProcessingChange && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Troca
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </PageWrapper>
  );
}
