
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, PlanId, PlanDetails } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react'; // Added useRef
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User as FirebaseUser 
} from 'firebase/auth';
import { auth as firebaseAuthService, db } from '@/lib/firebase'; 
import { ref, set, get, update, remove, onValue, type Unsubscribe } from "firebase/database"; // Added onValue and Unsubscribe
import { addDays, formatISO, isPast, parseISO as datefnsParseISO } from 'date-fns';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';

const TRIAL_DURATION_DAYS = 5;

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => Promise<void>; 
  registerForCargo: (editalId: string, cargoId: string) => Promise<void>;
  unregisterFromCargo: (editalId: string, cargoId: string) => Promise<void>;
  toggleTopicStudyStatus: (compositeTopicId: string) => Promise<void>;
  addStudyLog: (compositeTopicId: string, duration: number) => Promise<void>;
  addQuestionLog: (logEntry: Omit<QuestionLogEntry, 'date'>) => Promise<void>;
  addRevisionSchedule: (compositeTopicId: string, daysToReview: number) => Promise<void>;
  toggleRevisionReviewedStatus: (compositeTopicId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  startFreeTrial: () => Promise<void>;
  changeCargoForPlanoCargo: (newCargoCompositeId: string) => Promise<void>;
  isPlanoCargoWithinGracePeriod: () => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const cleanProgressForCargo = (user: AppUser, cargoCompositeIdPrefix: string): Partial<AppUser> => {
  const updates: Partial<AppUser> = {};
  updates.studiedTopicIds = (user.studiedTopicIds || []).filter(id => !id.startsWith(cargoCompositeIdPrefix));
  updates.studyLogs = (user.studyLogs || []).filter(log => !log.compositeTopicId.startsWith(cargoCompositeIdPrefix));
  updates.questionLogs = (user.questionLogs || []).filter(log => !log.compositeTopicId.startsWith(cargoCompositeIdPrefix));
  updates.revisionSchedules = (user.revisionSchedules || []).filter(rs => !rs.compositeTopicId.startsWith(cargoCompositeIdPrefix));
  return updates;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const dbUnsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(firebaseAuthService, (firebaseUser: FirebaseUser | null) => {
      setLoading(true);

      if (dbUnsubscribeRef.current) {
        dbUnsubscribeRef.current();
        dbUnsubscribeRef.current = null;
      }

      if (firebaseUser) {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        
        dbUnsubscribeRef.current = onValue(userRef, async (snapshot) => {
          try {
            let dbData = snapshot.exists() ? snapshot.val() : {};
            let isNewUserInDb = !snapshot.exists();

            if (isNewUserInDb) {
              console.log(`[AuthProvider] New user in DB or DB data missing for ${firebaseUser.uid}. Initializing.`);
              dbData = { // Initialize dbData with defaults for a new user
                name: firebaseUser.displayName || 'Usuário',
                email: firebaseUser.email || '',
                avatarUrl: firebaseUser.photoURL || null,
                registeredCargoIds: [],
                studiedTopicIds: [],
                studyLogs: [],
                questionLogs: [],
                revisionSchedules: [],
                activePlan: null,
                planDetails: null,
                stripeCustomerId: null,
                hasHadFreeTrial: false,
                planHistory: [],
              };
              await set(userRef, dbData); // Persist this initial structure
            } else {
              // Sync Firebase Auth profile info to DB if it's the source of truth and different
              const updatesToSyncToDb: any = {};
              if (firebaseUser.displayName && dbData.name !== firebaseUser.displayName) {
                updatesToSyncToDb.name = firebaseUser.displayName;
              }
              if (firebaseUser.photoURL && dbData.avatarUrl !== firebaseUser.photoURL) {
                updatesToSyncToDb.avatarUrl = firebaseUser.photoURL;
              }
              // Email is usually not synced this way due to security policies, handled at auth.
              if (Object.keys(updatesToSyncToDb).length > 0) {
                await update(userRef, updatesToSyncToDb);
                dbData = { ...dbData, ...updatesToSyncToDb }; // Reflect sync in current dbData
              }
            }
            
            let appUser: AppUser = {
              id: firebaseUser.uid,
              name: dbData.name || firebaseUser.displayName || 'Usuário',
              email: dbData.email || firebaseUser.email || '',
              avatarUrl: dbData.avatarUrl || firebaseUser.photoURL || undefined,
              registeredCargoIds: dbData.registeredCargoIds || [],
              studiedTopicIds: dbData.studiedTopicIds || [],
              studyLogs: dbData.studyLogs || [],
              questionLogs: dbData.questionLogs || [],
              revisionSchedules: dbData.revisionSchedules || [],
              activePlan: dbData.activePlan || null,
              planDetails: dbData.planDetails || null,
              stripeCustomerId: dbData.stripeCustomerId || null,
              hasHadFreeTrial: dbData.hasHadFreeTrial || false,
              planHistory: dbData.planHistory || [],
            };

            let trialExpiredToastShown = false;
            if (appUser.activePlan === 'plano_trial' && appUser.planDetails?.expiryDate) {
              if (isPast(datefnsParseISO(appUser.planDetails.expiryDate))) {
                console.log(`[AuthProvider] Free trial for user ${firebaseUser.uid} expired on ${appUser.planDetails.expiryDate}. Reverting plan.`);
                
                // Prepare to update DB, this will trigger another onValue, or update appUser state directly
                const dbUpdatesForExpiredTrial = { activePlan: null, planDetails: null };
                await update(userRef, dbUpdatesForExpiredTrial);
                
                // Reflect change locally immediately to avoid flicker and for toast
                appUser = { ...appUser, activePlan: null, planDetails: null };
                trialExpiredToastShown = true; 
              }
            }
            setUser(appUser);

            if (trialExpiredToastShown) {
               toast({
                  title: "Teste Gratuito Expirado",
                  description: "Seu período de teste gratuito de 5 dias terminou. Para continuar acessando os recursos, por favor, escolha um plano pago.",
                  variant: "default",
                  duration: 9000,
                });
            }

          } catch (error) {
            console.error("Error processing RTDB snapshot or updating DB:", error);
            toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar seus dados salvos.", variant: "destructive" });
            setUser({ // Fallback minimal user
              id: firebaseUser.uid, name: firebaseUser.displayName || 'Usuário', email: firebaseUser.email || '',
              registeredCargoIds: [], studiedTopicIds: [], studyLogs: [], questionLogs: [], revisionSchedules: [],
              activePlan: null, planDetails: null, stripeCustomerId: null, hasHadFreeTrial: false, planHistory: [],
            });
          } finally {
            setLoading(false); // Ensure loading is set to false
          }
        }, (error) => {
          console.error("Firebase RTDB onValue listener error:", error);
          toast({ title: "Erro de Conexão com Dados", description: "Não foi possível sincronizar seus dados.", variant: "destructive" });
          setUser(null);
          setLoading(false); // Ensure loading is set to false
        });

      } else { // No firebaseUser (logged out)
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (dbUnsubscribeRef.current) {
        dbUnsubscribeRef.current();
      }
    };
  }, [toast]); // Added toast to dependency array as it's used in the effect

  const login = async (email: string, pass: string) => {
    // setLoading(true) is handled by onAuthStateChanged
    await signInWithEmailAndPassword(firebaseAuthService, email, pass);
  };

  const register = async (name: string, email: string, pass: string) => {
    // setLoading(true) is handled by onAuthStateChanged
    const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    
    // The onValue listener in useEffect will handle setting the initial DB data if it's missing.
    // No need to explicitly set here as it might race with the onValue listener.
    // If onValue finds no data for a new user, it will initialize it.
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(firebaseAuthService, email);
  };

  const logout = async () => {
    // setLoading(true) is handled by onAuthStateChanged
    await signOut(firebaseAuthService);
    router.push('/login'); 
  };
  
  const updateUser = async (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => {
    const firebaseCurrentUser = firebaseAuthService.currentUser;
    if (firebaseCurrentUser && user) {
      setLoading(true);
      try {
        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (updatedInfo.hasOwnProperty('name') && updatedInfo.name !== user.name) authUpdates.displayName = updatedInfo.name;
        if (updatedInfo.hasOwnProperty('avatarUrl') && updatedInfo.avatarUrl !== user.avatarUrl) authUpdates.photoURL = updatedInfo.avatarUrl || null;
        
        if (Object.keys(authUpdates).length > 0) await updateProfile(firebaseCurrentUser, authUpdates);
        
        // DB updates will be picked up by onValue listener. 
        // We only need to trigger Firebase Auth profile update.
        // For directness, we can also update DB here:
        const dbUpdates: any = {};
        if (authUpdates.displayName) dbUpdates.name = authUpdates.displayName;
        if (authUpdates.photoURL !== undefined) dbUpdates.avatarUrl = authUpdates.photoURL;

        if (Object.keys(dbUpdates).length > 0) {
            await update(ref(db, `users/${user.id}`), dbUpdates);
        }
        // User state will be updated by onValue listener.

        toast({ title: "Perfil Atualizado!", description: "Suas informações foram salvas.", variant: "default", className: "bg-accent text-accent-foreground" });
      } catch (error) {
        console.error("Error updating user profile:", error);
        toast({ title: "Erro ao Atualizar", description: "Não foi possível salvar suas informações.", variant: "destructive" });
      } finally {
        setLoading(false); // Manually set loading false as onValue might not trigger immediately for this type of update
      }
    } else {
      throw new Error("Nenhum usuário logado para atualizar.");
    }
  };

  const registerForCargo = async (editalId: string, cargoId: string) => {
    if (!user) {
      toast({ title: "Usuário não encontrado", description: "Não foi possível registrar no cargo.", variant: "destructive" });
      throw new Error("User not found for cargo registration");
    }

    const plan = user.activePlan;
    const planDetails = user.planDetails;
    let canRegister = false;
    let reason = "";

    switch (plan) {
      case 'plano_anual':
      case 'plano_trial':
        canRegister = true;
        break;

      case 'plano_edital':
        if (planDetails?.selectedEditalId === editalId) {
          canRegister = true;
        } else {
          reason = "Seu Plano Edital não cobre este edital. Para se inscrever em um novo edital, você precisa fazer um upgrade.";
        }
        break;

      case 'plano_cargo':
        reason = "Seu plano atual só permite inscrição em um cargo. Para se inscrever em outros, você precisa fazer um upgrade.";
        break;

      default: // null or other
        reason = "Você precisa de um plano ativo para se inscrever em um cargo. Por favor, visite nossa página de planos.";
        break;
    }

    if (!canRegister) {
      toast({
        title: "Inscrição não permitida",
        description: reason,
        variant: "destructive",
        duration: 9000,
      });
      return;
    }

    const compositeId = `${editalId}_${cargoId}`;
    const updatedRegisteredCargoIds = Array.from(new Set([...(user.registeredCargoIds || []), compositeId]));
    
    try {
      await update(ref(db, `users/${user.id}`), { registeredCargoIds: updatedRegisteredCargoIds });
      // Success toast is handled by the calling component
    } catch (error) {
      console.error("Error registering for cargo:", error);
      toast({ title: "Erro na Inscrição do Cargo", description: "Não foi possível salvar a inscrição no cargo.", variant: "destructive" });
      throw error; 
    }
  };

  const unregisterFromCargo = async (editalId: string, cargoId: string) => {
    if (!user) {
      toast({ title: "Usuário não logado.", variant: "destructive" });
      return;
    }
    // setLoading(true);
    const cargoCompositeId = `${editalId}_${cargoId}`;

    if (user.activePlan === 'plano_cargo' && user.planDetails?.selectedCargoCompositeId === cargoCompositeId) {
        toast({
            title: "Ação Não Permitida",
            description: "Este cargo está vinculado ao seu Plano Cargo ativo. Para alterações, gerencie seu plano na página de perfil.",
            variant: "destructive",
            duration: 7000,
        });
        // setLoading(false);
        return;
    }

    const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== cargoCompositeId);
    const progressUpdates = cleanProgressForCargo(user, `${cargoCompositeId}_`); 

    try {
      await update(ref(db, `users/${user.id}`), { 
        registeredCargoIds: updatedRegisteredCargoIds,
        ...progressUpdates
      });
      // setUser state will be updated by onValue
      toast({ title: "Inscrição Cancelada", description: `Sua inscrição e progresso no cargo foram removidos.` });
    } catch (error) {
      console.error("Error unregistering from cargo and clearing progress:", error);
      toast({ title: "Erro ao Cancelar", description: "Não foi possível remover a inscrição ou o progresso do cargo.", variant: "destructive" });
    } 
    // finally { setLoading(false); }
  };

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user) {
      // setLoading(true);
      let updatedStudiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = updatedStudiedTopicIds.indexOf(compositeTopicId);
      if (topicIndex > -1) updatedStudiedTopicIds.splice(topicIndex, 1); 
      else updatedStudiedTopicIds.push(compositeTopicId); 
      try {
        await update(ref(db, `users/${user.id}`), { studiedTopicIds: updatedStudiedTopicIds });
        // setUser state will be updated by onValue
      } catch (error) {
        console.error("Error toggling topic study status:", error);
        toast({ title: "Erro ao Atualizar Status", description: "Não foi possível salvar o status do tópico.", variant: "destructive" });
      } 
      // finally { setLoading(false); }
    }
  };

  const addStudyLog = async (compositeTopicId: string, duration: number) => {
    if (user) {
      // setLoading(true);
      const newLog: StudyLogEntry = { compositeTopicId, date: new Date().toISOString(), duration };
      const updatedStudyLogs = [...(user.studyLogs || []), newLog];
      try {
        await update(ref(db, `users/${user.id}`), { studyLogs: updatedStudyLogs });
        // setUser state will be updated by onValue
      } catch (error) {
        console.error("Error adding study log:", error);
        toast({ title: "Erro ao Salvar Log", description: "Não foi possível salvar o registro de estudo.", variant: "destructive" });
      } 
      // finally { setLoading(false); }
    }
  };

  const addQuestionLog = async (logEntryData: Omit<QuestionLogEntry, 'date'>) => {
    if (user) {
      // setLoading(true);
      const newQuestionLog: QuestionLogEntry = { ...logEntryData, date: new Date().toISOString() };
      const updatedQuestionLogs = [...(user.questionLogs || []), newQuestionLog];
      try {
        await update(ref(db, `users/${user.id}`), { questionLogs: updatedQuestionLogs });
        // setUser state will be updated by onValue
      } catch (error) {
        console.error("Error adding question log:", error);
        toast({ title: "Erro ao Salvar Desempenho", description: "Não foi possível salvar o registro de questões.", variant: "destructive" });
      } 
      // finally { setLoading(false); }
    }
  };

  const addRevisionSchedule = async (compositeTopicId: string, daysToReview: number) => {
    if (user) {
      // setLoading(true);
      const scheduledDate = formatISO(addDays(new Date(), daysToReview));
      let updatedRevisionSchedules = [...(user.revisionSchedules || [])];
      const existingScheduleIndex = updatedRevisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      const newScheduleEntry: RevisionScheduleEntry = { compositeTopicId, scheduledDate, isReviewed: false, reviewedDate: null };

      if (existingScheduleIndex > -1) updatedRevisionSchedules[existingScheduleIndex] = newScheduleEntry;
      else updatedRevisionSchedules.push(newScheduleEntry);
      try {
        await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
        // setUser state will be updated by onValue
      } catch (error) {
        console.error("Error adding revision schedule:", error);
        toast({ title: "Erro ao Agendar Revisão", description: "Não foi possível salvar o agendamento.", variant: "destructive" });
      } 
      // finally { setLoading(false); }
    }
  };

  const toggleRevisionReviewedStatus = async (compositeTopicId: string) => {
     if (user) {
      // setLoading(true);
      let updatedRevisionSchedules = [...(user.revisionSchedules || [])];
      const scheduleIndex = updatedRevisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      
      if (scheduleIndex > -1) {
        const currentStatus = updatedRevisionSchedules[scheduleIndex].isReviewed;
        updatedRevisionSchedules[scheduleIndex] = {
          ...updatedRevisionSchedules[scheduleIndex],
          isReviewed: !currentStatus,
          reviewedDate: !currentStatus ? new Date().toISOString() : null,
        };
        try {
          await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
          // setUser state will be updated by onValue
        } catch (error) {
          console.error("Error toggling revision status:", error);
          toast({ title: "Erro ao Atualizar Revisão", description: "Não foi possível salvar o status da revisão.", variant: "destructive" });
        }
      }
      // setLoading(false);
    }
  };
  
  const isPlanoCargoWithinGracePeriod = (): boolean => {
    if (user?.activePlan === 'plano_cargo' && user.planDetails?.startDate) {
        // Stripe's checkout.session.completed provides current_period_start in seconds.
        // Assuming planDetails.startDate is correctly set from this (or a similar reliable source)
        // and is an ISO string.
        const startDate = datefnsParseISO(user.planDetails.startDate);
        // Add 7 full days. If startDate is 1st Jan 10:00, grace period ends 8th Jan 10:00.
        const gracePeriodEndDate = addDays(startDate, 7); 
        return new Date() < gracePeriodEndDate;
    }
    return false;
  };

  const changeCargoForPlanoCargo = async (newCargoCompositeId: string) => {
    if (!user || user.activePlan !== 'plano_cargo' || !user.planDetails?.selectedCargoCompositeId) {
        toast({ title: "Ação Inválida", description: "Não é possível trocar de cargo nestas condições.", variant: "destructive" });
        return;
    }
    if (!isPlanoCargoWithinGracePeriod()) {
        toast({ title: "Prazo Expirado", description: "O prazo de 7 dias para trocar de cargo do Plano Cargo já passou.", variant: "destructive", duration: 7000 });
        return;
    }

    // setLoading(true);
    const oldCargoCompositeId = user.planDetails.selectedCargoCompositeId;
    const oldCargoPrefix = `${oldCargoCompositeId}_`; 
    
    const progressUpdates = cleanProgressForCargo(user, oldCargoPrefix);
    
    const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== oldCargoCompositeId);
    if (!updatedRegisteredCargoIds.includes(newCargoCompositeId)) {
      updatedRegisteredCargoIds.push(newCargoCompositeId);
    }

    const updatedPlanDetails: PlanDetails = {
        ...user.planDetails,
        selectedCargoCompositeId: newCargoCompositeId,
        // startDate remains the same for the plan
    };

    try {
        await update(ref(db, `users/${user.id}`), {
            planDetails: updatedPlanDetails,
            registeredCargoIds: updatedRegisteredCargoIds,
            ...progressUpdates,
        });
        // setUser state will be updated by onValue
        toast({ title: "Cargo Alterado!", description: "Seu Plano Cargo foi atualizado para o novo cargo selecionado e o progresso do cargo anterior foi removido.", variant: "default", className: "bg-accent text-accent-foreground", duration: 7000 });
    } catch (error) {
        console.error("Error changing cargo for Plano Cargo:", error);
        toast({ title: "Erro ao Trocar Cargo", description: "Não foi possível atualizar para o novo cargo.", variant: "destructive" });
    } 
    // finally { setLoading(false); }
  };


  const cancelSubscription = async () => {
    if (!user || !user.activePlan) {
      toast({ title: "Nenhuma Assinatura Ativa", description: "Você não possui um plano ativo para cancelar.", variant: "default" });
      return;
    }
   
    if (user.activePlan === 'plano_cargo' && !isPlanoCargoWithinGracePeriod()) {
        toast({
            title: "Cancelamento Não Permitido",
            description: "O cancelamento com reembolso do Plano Cargo só é permitido dentro do período de 7 dias após a compra.",
            variant: "destructive",
            duration: 7000,
        });
        return;
    }
    // setLoading(true);
    const updates: any = { // Use any for updates object for flexibility
        activePlan: null,
        planDetails: null,
    };
    
    const oldPlanDetails = user.planDetails;
    const oldPlanHistory = user.planHistory || [];
    if (oldPlanDetails) {
        updates.planHistory = [...oldPlanHistory, oldPlanDetails];
    }

    // If cancelling a specific plan that ties to a cargo/edital, and we want to clear related progress
    if (user.activePlan === 'plano_cargo' && user.planDetails?.selectedCargoCompositeId) {
        const cargoPrefix = `${user.planDetails.selectedCargoCompositeId}_`;
        const progressToClear = cleanProgressForCargo(user, cargoPrefix);
        Object.assign(updates, progressToClear);
        // Also remove from registeredCargoIds
        updates.registeredCargoIds = (user.registeredCargoIds || []).filter(id => id !== user.planDetails!.selectedCargoCompositeId);
    } else if (user.activePlan === 'plano_edital' && user.planDetails?.selectedEditalId) {
        // If Plano Edital, users manually register for cargos. Cancellation doesn't auto-clear these
        // unless defined. For now, just nullify plan.
    } else if (user.activePlan === 'plano_anual' || user.activePlan === 'plano_trial') {
        // For Anual or Trial, a full cancellation might imply clearing all progress
        // This is a business decision. Current logic for trial expiration is to nullify plan.
        // For Anual, a "cancel" might mean "don't renew", but here we simulate immediate access loss.
        // For simplicity, let's assume cancelling these also nullifies plan and planDetails.
        // If progress needs clearing for Anual:
        // updates.registeredCargoIds = []; updates.studiedTopicIds = []; updates.studyLogs = [];
        // updates.questionLogs = []; updates.revisionSchedules = [];
    }


    try {
      await update(ref(db, `users/${user.id}`), updates);
      // setUser state will be updated by onValue
      toast({ title: "Assinatura Cancelada", description: "Sua assinatura foi cancelada.", variant: "default", className: "bg-accent text-accent-foreground" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({ title: "Erro ao Cancelar Assinatura", description: "Não foi possível processar o cancelamento.", variant: "destructive" });
    } 
    // finally { setLoading(false); }
  };

  const startFreeTrial = async () => {
    if (!user) {
      toast({ title: "Usuário não logado", description: "Faça login para iniciar seu teste.", variant: "destructive" });
      router.push("/login?redirect=/planos");
      return;
    }
    if (user.hasHadFreeTrial) {
      toast({ title: "Teste Já Utilizado", description: "Você já utilizou seu período de teste gratuito.", variant: "default" });
      return;
    }
    if (user.activePlan && user.activePlan !== 'plano_trial') {
      toast({ title: "Plano Ativo", description: "Você já possui um plano pago ativo.", variant: "default" });
      return;
    }

    // setLoading(true);
    const now = new Date();
    const trialPlanDetails: PlanDetails = {
      planId: 'plano_trial',
      startDate: formatISO(now),
      expiryDate: formatISO(addDays(now, TRIAL_DURATION_DAYS)),
    };

    try {
      await update(ref(db, `users/${user.id}`), { 
        activePlan: 'plano_trial', 
        planDetails: trialPlanDetails,
        hasHadFreeTrial: true 
      });
      // setUser state will be updated by onValue
      toast({ 
        title: "Teste Gratuito Ativado!", 
        description: `Você tem ${TRIAL_DURATION_DAYS} dias para explorar todos os recursos. Aproveite!`, 
        variant: "default",
        className: "bg-accent text-accent-foreground",
        duration: 7000 
      });
      router.push('/'); 
    } catch (error) {
      console.error("Error starting free trial:", error);
      toast({ title: "Erro ao Ativar Teste", description: "Não foi possível iniciar seu período de teste.", variant: "destructive" });
    } 
    // finally { setLoading(false); }
  };

  return (
    <AuthContext.Provider value={{ 
      user, loading, login, register, sendPasswordReset, logout, updateUser, 
      registerForCargo, unregisterFromCargo, toggleTopicStudyStatus, addStudyLog, 
      addQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus,
      cancelSubscription, startFreeTrial, changeCargoForPlanoCargo, isPlanoCargoWithinGracePeriod
    }}>
      {children}
    </AuthContext.Provider>
  );
};
