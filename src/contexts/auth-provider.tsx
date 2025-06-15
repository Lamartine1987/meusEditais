
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
import { addDays, formatISO, parseISO, differenceInCalendarDays } from 'date-fns';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';


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
  subscribeToPlan: (planId: PlanId, specificDetails?: { selectedCargoCompositeId?: string; selectedEditalId?: string }) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  changeCargoForPlanoCargo: (newCargoCompositeId: string) => Promise<void>;
  isPlanoCargoWithinGracePeriod: () => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const clearProgressDataForCargo = (
  currentProgress: {
    studiedTopicIds?: string[];
    studyLogs?: StudyLogEntry[];
    questionLogs?: QuestionLogEntry[];
    revisionSchedules?: RevisionScheduleEntry[];
  },
  cargoCompositeIdToRemove: string // Format: editalId_cargoId
): {
  studiedTopicIds: string[];
  studyLogs: StudyLogEntry[];
  questionLogs: QuestionLogEntry[];
  revisionSchedules: RevisionScheduleEntry[];
} => {
  const cargoPrefixToRemove = `${cargoCompositeIdToRemove}_`; 

  const updatedStudiedTopicIds = (currentProgress.studiedTopicIds || []).filter(
    (id) => !id.startsWith(cargoPrefixToRemove)
  );
  const updatedStudyLogs = (currentProgress.studyLogs || []).filter(
    (log) => !log.compositeTopicId.startsWith(cargoPrefixToRemove)
  );
  const updatedQuestionLogs = (currentProgress.questionLogs || []).filter(
    (log) => !log.compositeTopicId.startsWith(cargoPrefixToRemove)
  );
  const updatedRevisionSchedules = (currentProgress.revisionSchedules || []).filter(
    (schedule) => !schedule.compositeTopicId.startsWith(cargoPrefixToRemove)
  );

  return {
    studiedTopicIds: updatedStudiedTopicIds,
    studyLogs: updatedStudyLogs,
    questionLogs: updatedQuestionLogs,
    revisionSchedules: updatedRevisionSchedules,
  };
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
          const dbData = snapshot.exists() ? snapshot.val() : {};

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
          };
          setUser(appUser);

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
            stripeCustomerId: appUser.stripeCustomerId
          };
          
          if (!snapshot.exists()) {
             await set(ref(db, `users/${firebaseUser.uid}`), dataToSaveToDb);
          } else {
             const updates: Partial<AppUser> = {};
             if (dbData.name !== appUser.name) updates.name = appUser.name;
             if (dbData.email !== appUser.email) updates.email = appUser.email;
             if ((dbData.avatarUrl || null) !== (appUser.avatarUrl || null)) updates.avatarUrl = appUser.avatarUrl || null;
             if ((dbData.stripeCustomerId || null) !== (appUser.stripeCustomerId || null)) updates.stripeCustomerId = appUser.stripeCustomerId || null;
             
             if (!dbData.hasOwnProperty('registeredCargoIds')) updates.registeredCargoIds = dataToSaveToDb.registeredCargoIds;
             if (!dbData.hasOwnProperty('studiedTopicIds')) updates.studiedTopicIds = dataToSaveToDb.studiedTopicIds;
             if (!dbData.hasOwnProperty('studyLogs')) updates.studyLogs = dataToSaveToDb.studyLogs;
             if (!dbData.hasOwnProperty('questionLogs')) updates.questionLogs = dataToSaveToDb.questionLogs;
             if (!dbData.hasOwnProperty('revisionSchedules')) updates.revisionSchedules = dataToSaveToDb.revisionSchedules;
             if (!dbData.hasOwnProperty('activePlan')) updates.activePlan = dataToSaveToDb.activePlan;
             if (!dbData.hasOwnProperty('planDetails')) updates.planDetails = dataToSaveToDb.planDetails;
             if (!dbData.hasOwnProperty('stripeCustomerId') && !updates.hasOwnProperty('stripeCustomerId')) updates.stripeCustomerId = dataToSaveToDb.stripeCustomerId;

             if (Object.keys(updates).length > 0) {
                await update(ref(db, `users/${firebaseUser.uid}`), updates);
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
            activePlan: null, planDetails: null, stripeCustomerId: null,
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
      activePlan: null, planDetails: null, stripeCustomerId: null,
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
    if (user) {
        setLoading(true);
        const compositeCargoIdToRemove = `${editalId}_${cargoId}`;
        
        // Cannot unregister from cargo if it's part of an active Plano Cargo
        if (user.activePlan === 'plano_cargo' && user.planDetails?.selectedCargoCompositeId === compositeCargoIdToRemove) {
            toast({ title: "Ação Não Permitida", description: "Este cargo faz parte do seu Plano Cargo ativo. Gerencie seu plano na página de perfil.", variant: "destructive", duration: 7000 });
            setLoading(false);
            return;
        }

        const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== compositeCargoIdToRemove);
        const progressCleared = clearProgressDataForCargo(user, compositeCargoIdToRemove);
      
        try {
            await update(ref(db, `users/${user.id}`), { 
                registeredCargoIds: updatedRegisteredCargoIds,
                ...progressCleared
            });
            setUser(prevUser => prevUser ? { 
                ...prevUser, 
                registeredCargoIds: updatedRegisteredCargoIds,
                ...progressCleared
            } : null);
            toast({ title: "Inscrição Cancelada", description: "Sua inscrição e progresso para este cargo foram removidos." });
        } catch (error) {
            console.error("Error unregistering from cargo and deleting progress:", error);
            toast({ title: "Erro ao Cancelar", description: "Não foi possível remover a inscrição e o progresso do cargo.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
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

  const subscribeToPlan = async (planId: PlanId, specificDetails?: { selectedCargoCompositeId?: string; selectedEditalId?: string }) => {
    if (!user) {
      toast({ title: "Usuário não logado", variant: "destructive" });
      return;
    }
    setLoading(true);
    const now = new Date();
    const planDetails: PlanDetails = {
      planId,
      startDate: formatISO(now), // startDate is crucial for the 7-day rule
      expiryDate: formatISO(addDays(now, 365)), 
      ...specificDetails,
    };
    try {
      await update(ref(db, `users/${user.id}`), { activePlan: planId, planDetails });
      setUser(prev => prev ? { ...prev, activePlan: planId, planDetails } : null);
      toast({ title: "Plano (simulado) atualizado!", variant: "default" });
    } catch (error) {
      toast({ title: "Erro ao (simular) atualizar plano", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    if (!user || !user.activePlan) {
      toast({ title: "Nenhuma Assinatura Ativa", variant: "default" });
      return;
    }
    setLoading(true);
    try {
      // Logic for removing plan and all associated progress
      const updates = {
        activePlan: null,
        planDetails: null,
        registeredCargoIds: [],
        studiedTopicIds: [],
        studyLogs: [],
        questionLogs: [],
        revisionSchedules: [],
      };
      await update(ref(db, `users/${user.id}`), updates);
      setUser(prevUser => prevUser ? { ...prevUser, ...updates } : null);
      toast({ title: "Assinatura Cancelada", description: "Seu plano e todo o progresso associado foram removidos.", variant: "default" });
    } catch (error) {
      console.error("Error cancelling subscription and deleting progress:", error);
      toast({ title: "Erro ao Cancelar Assinatura", description: "Não foi possível cancelar a assinatura e remover o progresso.", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const isPlanoCargoWithinGracePeriod = (): boolean => {
    if (user?.activePlan === 'plano_cargo' && user.planDetails?.startDate) {
      try {
        const startDate = parseISO(user.planDetails.startDate);
        // differenceInCalendarDays returns the number of full calendar days.
        // If today is the 7th day, diff will be 6. If today is 8th day, diff will be 7.
        // So, if diff < 7, it's within the 7-day grace period (0-6 days inclusive).
        return differenceInCalendarDays(new Date(), startDate) < 7;
      } catch (e) {
        console.error("Error parsing plan start date:", e);
        return false;
      }
    }
    return false;
  };

  const changeCargoForPlanoCargo = async (newCargoCompositeId: string) => {
    if (!user || user.activePlan !== 'plano_cargo' || !user.planDetails?.selectedCargoCompositeId) {
      toast({ title: "Ação Inválida", description: "Não há um Plano Cargo ativo para trocar.", variant: "destructive" });
      return;
    }
    if (!isPlanoCargoWithinGracePeriod()) {
      toast({ title: "Prazo Expirado", description: "A troca de cargo só é permitida nos primeiros 7 dias da assinatura.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const oldCargoCompositeId = user.planDetails.selectedCargoCompositeId;

    try {
      // 1. Clear progress for the old cargo
      const clearedProgress = clearProgressDataForCargo(user, oldCargoCompositeId);
      
      // 2. Update planDetails with the new cargo ID (startDate remains the same)
      const updatedPlanDetails: PlanDetails = {
        ...user.planDetails,
        selectedCargoCompositeId: newCargoCompositeId,
      };

      // 3. Update registeredCargoIds: remove old, add new
      const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== oldCargoCompositeId);
      if (!updatedRegisteredCargoIds.includes(newCargoCompositeId)) {
          updatedRegisteredCargoIds.push(newCargoCompositeId);
      }
      
      const updatesToDB = {
        planDetails: updatedPlanDetails,
        registeredCargoIds: updatedRegisteredCargoIds,
        ...clearedProgress, 
      };

      await update(ref(db, `users/${user.id}`), updatesToDB);
      
      setUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          planDetails: updatedPlanDetails,
          registeredCargoIds: updatedRegisteredCargoIds,
          ...clearedProgress,
        };
      });
      toast({ title: "Cargo Alterado!", description: "Seu Plano Cargo foi atualizado para o novo cargo selecionado. O progresso do cargo anterior foi removido.", variant: "default", className: "bg-accent text-accent-foreground" });
    } catch (error) {
      console.error("Error changing cargo for Plano Cargo:", error);
      toast({ title: "Erro ao Trocar Cargo", description: "Não foi possível atualizar seu plano para o novo cargo.", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };


  return (
    <AuthContext.Provider value={{ 
      user, loading, login, register, sendPasswordReset, logout, updateUser, 
      registerForCargo, unregisterFromCargo, toggleTopicStudyStatus, addStudyLog, 
      addQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus,
      subscribeToPlan, cancelSubscription, changeCargoForPlanoCargo, isPlanoCargoWithinGracePeriod
    }}>
      {children}
    </AuthContext.Provider>
  );
};

    