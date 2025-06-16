
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, PlanId, PlanDetails } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
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
import { ref, set, get, update, remove } from "firebase/database"; 
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        try {
          const snapshot = await get(userRef);
          let dbData = snapshot.exists() ? snapshot.val() : {};

          // Check for expired free trial
          let trialExpiredToastShown = false;
          if (dbData.activePlan === 'plano_trial' && dbData.planDetails?.expiryDate) {
            if (isPast(datefnsParseISO(dbData.planDetails.expiryDate))) {
              console.log(`[AuthProvider] Free trial for user ${firebaseUser.uid} expired on ${dbData.planDetails.expiryDate}. Reverting plan.`);
              dbData.activePlan = null;
              dbData.planDetails = null; 
              // No need to set hasHadFreeTrial again, it was set at trial start
              await update(userRef, { activePlan: null, planDetails: null });
              trialExpiredToastShown = true; 
            }
          }

          const appUser: AppUser = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || dbData.name || 'Usuário',
            email: firebaseUser.email || dbData.email || '',
            avatarUrl: firebaseUser.photoURL || dbData.avatarUrl,
            registeredCargoIds: dbData.registeredCargoIds || [],
            studiedTopicIds: dbData.studiedTopicIds || [],
            studyLogs: dbData.studyLogs || [],
            questionLogs: dbData.questionLogs || [],
            revisionSchedules: dbData.revisionSchedules || [],
            activePlan: dbData.activePlan || null,
            planDetails: dbData.planDetails || null,
            stripeCustomerId: dbData.stripeCustomerId || null,
            hasHadFreeTrial: dbData.hasHadFreeTrial || false,
          };
          setUser(appUser);

          if (trialExpiredToastShown) {
             toast({
                title: "Teste Gratuito Expirado",
                description: "Seu período de teste gratuito de 5 dias terminou. Para continuar acessando os recursos, por favor, escolha um plano pago.",
                variant: "default",
                duration: 9000,
              });
          }

          const dataToSaveToDb: any = { 
            name: appUser.name,
            email: appUser.email,
            avatarUrl: appUser.avatarUrl || null,
            registeredCargoIds: appUser.registeredCargoIds,
            studiedTopicIds: appUser.studiedTopicIds,
            studyLogs: appUser.studyLogs,
            questionLogs: appUser.questionLogs,
            revisionSchedules: appUser.revisionSchedules,
            activePlan: appUser.activePlan,
            planDetails: appUser.planDetails,
            stripeCustomerId: appUser.stripeCustomerId,
            hasHadFreeTrial: appUser.hasHadFreeTrial,
          };
          
          if (!snapshot.exists()) {
             await set(userRef, dataToSaveToDb);
          } else {
             const updatesToSync: Partial<AppUser> = {};
             if (dbData.name !== appUser.name && firebaseUser.displayName === appUser.name) updatesToSync.name = appUser.name; // Prioritize Firebase Auth if different
             if (dbData.email !== appUser.email && firebaseUser.email === appUser.email) updatesToSync.email = appUser.email;
             if ((dbData.avatarUrl || null) !== (appUser.avatarUrl || null) && firebaseUser.photoURL === appUser.avatarUrl) updatesToSync.avatarUrl = appUser.avatarUrl || null;
             
             // Ensure all fields are initialized if missing in DB
             for (const key in dataToSaveToDb) {
                if (!dbData.hasOwnProperty(key) && !updatesToSync.hasOwnProperty(key as keyof AppUser)) {
                    (updatesToSync as any)[key] = (dataToSaveToDb as any)[key];
                }
             }
             if ((dbData.stripeCustomerId || null) !== (appUser.stripeCustomerId || null)) updatesToSync.stripeCustomerId = appUser.stripeCustomerId || null;
             if (dbData.hasHadFreeTrial !== appUser.hasHadFreeTrial) updatesToSync.hasHadFreeTrial = appUser.hasHadFreeTrial;


             if (Object.keys(updatesToSync).length > 0) {
                await update(userRef, updatesToSync);
             }
          }

        } catch (error) {
          console.error("Error fetching/updating user data from RTDB:", error);
          toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar seus dados salvos.", variant: "destructive" });
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || undefined,
            registeredCargoIds: [], studiedTopicIds: [], studyLogs: [], questionLogs: [], revisionSchedules: [],
            activePlan: null, planDetails: null, stripeCustomerId: null, hasHadFreeTrial: false,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    await signInWithEmailAndPassword(firebaseAuthService, email, pass);
  };

  const register = async (name: string, email: string, pass: string) => {
    setLoading(true);
    const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    
    await set(ref(db, `users/${userCredential.user.uid}`), {
      name: name, email: email, avatarUrl: null,
      registeredCargoIds: [], studiedTopicIds: [], studyLogs: [], questionLogs: [], revisionSchedules: [],
      activePlan: null, planDetails: null, stripeCustomerId: null, hasHadFreeTrial: false,
    });
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(firebaseAuthService, email);
  };

  const logout = async () => {
    setLoading(true);
    await signOut(firebaseAuthService);
    router.push('/login'); 
  };
  
  const updateUser = async (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => {
    const firebaseCurrentUser = firebaseAuthService.currentUser;
    if (firebaseCurrentUser && user) {
      setLoading(true);
      try {
        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (updatedInfo.hasOwnProperty('name')) authUpdates.displayName = updatedInfo.name;
        if (updatedInfo.hasOwnProperty('avatarUrl')) authUpdates.photoURL = updatedInfo.avatarUrl || null;
        
        if (Object.keys(authUpdates).length > 0) await updateProfile(firebaseCurrentUser, authUpdates);
        
        const dbUpdates: Partial<Pick<AppUser, 'name' | 'avatarUrl'>> = {};
        if (updatedInfo.hasOwnProperty('name') && typeof updatedInfo.name === 'string') dbUpdates.name = updatedInfo.name;
        if (updatedInfo.hasOwnProperty('avatarUrl')) dbUpdates.avatarUrl = updatedInfo.avatarUrl || null; 

        if (Object.keys(dbUpdates).length > 0) await update(ref(db, `users/${user.id}`), dbUpdates);
        
        setUser(prevUser => {
          if (!prevUser) return null;
          return {
            ...prevUser,
            name: updatedInfo.hasOwnProperty('name') ? updatedInfo.name || prevUser.name : prevUser.name,
            avatarUrl: updatedInfo.hasOwnProperty('avatarUrl') ? updatedInfo.avatarUrl || undefined : prevUser.avatarUrl,
          };
        });
        toast({ title: "Perfil Atualizado!", description: "Suas informações foram salvas.", variant: "default", className: "bg-accent text-accent-foreground" });
      } catch (error) {
        console.error("Error updating user profile:", error);
        toast({ title: "Erro ao Atualizar", description: "Não foi possível salvar suas informações.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    } else {
      throw new Error("Nenhum usuário logado para atualizar.");
    }
  };

  const registerForCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      const compositeId = `${editalId}_${cargoId}`;
      const updatedRegisteredCargoIds = Array.from(new Set([...(user.registeredCargoIds || []), compositeId]));
      
      try {
        await update(ref(db, `users/${user.id}`), { registeredCargoIds: updatedRegisteredCargoIds });
        setUser(prevUser => prevUser ? { ...prevUser, registeredCargoIds: updatedRegisteredCargoIds } : null);
      } catch (error) {
        console.error("Error registering for cargo:", error);
        toast({ title: "Erro na Inscrição do Cargo", description: "Não foi possível salvar a inscrição no cargo.", variant: "destructive" });
        throw error; 
      } finally {
        setLoading(false);
      }
    } else {
        toast({ title: "Usuário não encontrado", description: "Não foi possível registrar no cargo.", variant: "destructive" });
        throw new Error("User not found for cargo registration");
    }
  };

  const unregisterFromCargo = async (editalId: string, cargoId: string) => {
    if (!user) {
      toast({ title: "Usuário não logado.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const cargoCompositeId = `${editalId}_${cargoId}`;

    // If this cargo is tied to an active 'plano_cargo', prevent unregistering.
    // Management should happen via profile page (change cargo or cancel plan within grace period).
    if (user.activePlan === 'plano_cargo' && user.planDetails?.selectedCargoCompositeId === cargoCompositeId) {
        toast({
            title: "Ação Não Permitida",
            description: "Este cargo está vinculado ao seu Plano Cargo ativo. Para alterações, gerencie seu plano na página de perfil.",
            variant: "destructive",
            duration: 7000,
        });
        setLoading(false);
        return;
    }

    const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== cargoCompositeId);
    const progressUpdates = cleanProgressForCargo(user, `${cargoCompositeId}_`); // Note the underscore for topic prefix

    try {
      await update(ref(db, `users/${user.id}`), { 
        registeredCargoIds: updatedRegisteredCargoIds,
        ...progressUpdates
      });
      setUser(prevUser => {
        if (!prevUser) return null;
        return { 
          ...prevUser, 
          registeredCargoIds: updatedRegisteredCargoIds,
          studiedTopicIds: progressUpdates.studiedTopicIds || prevUser.studiedTopicIds,
          studyLogs: progressUpdates.studyLogs || prevUser.studyLogs,
          questionLogs: progressUpdates.questionLogs || prevUser.questionLogs,
          revisionSchedules: progressUpdates.revisionSchedules || prevUser.revisionSchedules,
        };
      });
      toast({ title: "Inscrição Cancelada", description: `Sua inscrição e progresso no cargo foram removidos.` });
    } catch (error) {
      console.error("Error unregistering from cargo and clearing progress:", error);
      toast({ title: "Erro ao Cancelar", description: "Não foi possível remover a inscrição ou o progresso do cargo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user) {
      setLoading(true);
      let updatedStudiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = updatedStudiedTopicIds.indexOf(compositeTopicId);
      if (topicIndex > -1) updatedStudiedTopicIds.splice(topicIndex, 1); 
      else updatedStudiedTopicIds.push(compositeTopicId); 
      try {
        await update(ref(db, `users/${user.id}`), { studiedTopicIds: updatedStudiedTopicIds });
        setUser(prevUser => prevUser ? { ...prevUser, studiedTopicIds: updatedStudiedTopicIds } : null);
      } catch (error) {
        console.error("Error toggling topic study status:", error);
        toast({ title: "Erro ao Atualizar Status", description: "Não foi possível salvar o status do tópico.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const addStudyLog = async (compositeTopicId: string, duration: number) => {
    if (user) {
      setLoading(true);
      const newLog: StudyLogEntry = { compositeTopicId, date: new Date().toISOString(), duration };
      const updatedStudyLogs = [...(user.studyLogs || []), newLog];
      try {
        await update(ref(db, `users/${user.id}`), { studyLogs: updatedStudyLogs });
        setUser(prevUser => prevUser ? { ...prevUser, studyLogs: updatedStudyLogs } : null);
      } catch (error) {
        console.error("Error adding study log:", error);
        toast({ title: "Erro ao Salvar Log", description: "Não foi possível salvar o registro de estudo.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const addQuestionLog = async (logEntryData: Omit<QuestionLogEntry, 'date'>) => {
    if (user) {
      setLoading(true);
      const newQuestionLog: QuestionLogEntry = { ...logEntryData, date: new Date().toISOString() };
      const updatedQuestionLogs = [...(user.questionLogs || []), newQuestionLog];
      try {
        await update(ref(db, `users/${user.id}`), { questionLogs: updatedQuestionLogs });
        setUser(prevUser => prevUser ? { ...prevUser, questionLogs: updatedQuestionLogs } : null);
      } catch (error) {
        console.error("Error adding question log:", error);
        toast({ title: "Erro ao Salvar Desempenho", description: "Não foi possível salvar o registro de questões.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const addRevisionSchedule = async (compositeTopicId: string, daysToReview: number) => {
    if (user) {
      setLoading(true);
      const scheduledDate = formatISO(addDays(new Date(), daysToReview));
      let updatedRevisionSchedules = [...(user.revisionSchedules || [])];
      const existingScheduleIndex = updatedRevisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      const newScheduleEntry: RevisionScheduleEntry = { compositeTopicId, scheduledDate, isReviewed: false, reviewedDate: null };

      if (existingScheduleIndex > -1) updatedRevisionSchedules[existingScheduleIndex] = newScheduleEntry;
      else updatedRevisionSchedules.push(newScheduleEntry);
      try {
        await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
        setUser(prevUser => prevUser ? { ...prevUser, revisionSchedules: updatedRevisionSchedules } : null);
      } catch (error) {
        console.error("Error adding revision schedule:", error);
        toast({ title: "Erro ao Agendar Revisão", description: "Não foi possível salvar o agendamento.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleRevisionReviewedStatus = async (compositeTopicId: string) => {
     if (user) {
      setLoading(true);
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
          setUser(prevUser => prevUser ? { ...prevUser, revisionSchedules: updatedRevisionSchedules } : null);
        } catch (error) {
          console.error("Error toggling revision status:", error);
          toast({ title: "Erro ao Atualizar Revisão", description: "Não foi possível salvar o status da revisão.", variant: "destructive" });
        }
      }
      setLoading(false);
    }
  };
  
  const isPlanoCargoWithinGracePeriod = (): boolean => {
    if (user?.activePlan === 'plano_cargo' && user.planDetails?.startDate) {
        const startDate = datefnsParseISO(user.planDetails.startDate);
        const sevenDaysAfterStart = addDays(startDate, 7);
        return isPast(new Date()) && new Date() < sevenDaysAfterStart; // isPast(new Date()) is a bit redundant if checking against future
    }
    return false;
  };

  const changeCargoForPlanoCargo = async (newCargoCompositeId: string) => {
    if (!user || user.activePlan !== 'plano_cargo' || !user.planDetails?.selectedCargoCompositeId) {
        toast({ title: "Ação Inválida", description: "Não é possível trocar de cargo nestas condições.", variant: "destructive" });
        return;
    }
    if (!isPlanoCargoWithinGracePeriod()) {
        toast({ title: "Prazo Expirado", description: "O prazo de 7 dias para trocar de cargo do Plano Cargo já passou.", variant: "destructive" });
        return;
    }

    setLoading(true);
    const oldCargoCompositeId = user.planDetails.selectedCargoCompositeId;
    const oldCargoPrefix = `${oldCargoCompositeId}_`; // For cleaning topics
    
    const progressUpdates = cleanProgressForCargo(user, oldCargoPrefix);
    
    // Update registeredCargoIds: remove old, add new
    const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== oldCargoCompositeId);
    updatedRegisteredCargoIds.push(newCargoCompositeId);

    const updatedPlanDetails: PlanDetails = {
        ...user.planDetails,
        selectedCargoCompositeId: newCargoCompositeId,
    };

    try {
        await update(ref(db, `users/${user.id}`), {
            planDetails: updatedPlanDetails,
            registeredCargoIds: updatedRegisteredCargoIds,
            ...progressUpdates,
        });
        setUser(prevUser => {
            if (!prevUser) return null;
            return {
                ...prevUser,
                planDetails: updatedPlanDetails,
                registeredCargoIds: updatedRegisteredCargoIds,
                studiedTopicIds: progressUpdates.studiedTopicIds || prevUser.studiedTopicIds,
                studyLogs: progressUpdates.studyLogs || prevUser.studyLogs,
                questionLogs: progressUpdates.questionLogs || prevUser.questionLogs,
                revisionSchedules: progressUpdates.revisionSchedules || prevUser.revisionSchedules,
            };
        });
        toast({ title: "Cargo Alterado!", description: "Seu Plano Cargo foi atualizado para o novo cargo selecionado e o progresso do cargo anterior foi removido.", variant: "default", className: "bg-accent text-accent-foreground", duration: 7000 });
    } catch (error) {
        console.error("Error changing cargo for Plano Cargo:", error);
        toast({ title: "Erro ao Trocar Cargo", description: "Não foi possível atualizar para o novo cargo.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };


  const cancelSubscription = async () => {
    if (!user || !user.activePlan) {
      toast({ title: "Nenhuma Assinatura Ativa", description: "Você não possui um plano ativo para cancelar.", variant: "default" });
      return;
    }
    setLoading(true);

    const updates: Partial<AppUser> = {
        activePlan: null,
        planDetails: null,
        // Reset progress as per previous logic
        registeredCargoIds: [],
        studiedTopicIds: [],
        studyLogs: [],
        questionLogs: [],
        revisionSchedules: [],
        // stripeCustomerId is kept
    };

    // For Plano Cargo, if outside grace period, prevent cancellation.
    if (user.activePlan === 'plano_cargo' && !isPlanoCargoWithinGracePeriod()) {
        toast({
            title: "Cancelamento Não Permitido",
            description: "O cancelamento do Plano Cargo só é permitido dentro do período de 7 dias após a compra.",
            variant: "destructive",
            duration: 7000,
        });
        setLoading(false);
        return;
    }


    try {
      await update(ref(db, `users/${user.id}`), updates);
      setUser(prevUser => {
        if (!prevUser) return null;
        return { 
          ...prevUser, 
          activePlan: null, 
          planDetails: null,
          registeredCargoIds: [],
          studiedTopicIds: [],
          studyLogs: [],
          questionLogs: [],
          revisionSchedules: [],
        };
      });
      toast({ title: "Assinatura Cancelada", description: "Sua assinatura e todo o progresso associado foram removidos.", variant: "default", className: "bg-accent text-accent-foreground" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({ title: "Erro ao Cancelar Assinatura", description: "Não foi possível processar o cancelamento.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

    setLoading(true);
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
        hasHadFreeTrial: true // Mark trial as used
      });
      setUser(prev => prev ? { ...prev, activePlan: 'plano_trial', planDetails: trialPlanDetails, hasHadFreeTrial: true } : null);
      toast({ 
        title: "Teste Gratuito Ativado!", 
        description: `Você tem ${TRIAL_DURATION_DAYS} dias para explorar todos os recursos. Aproveite!`, 
        variant: "default",
        className: "bg-accent text-accent-foreground",
        duration: 7000 
      });
      router.push('/'); // Redirect to homepage or dashboard
    } catch (error) {
      console.error("Error starting free trial:", error);
      toast({ title: "Erro ao Ativar Teste", description: "Não foi possível iniciar seu período de teste.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
