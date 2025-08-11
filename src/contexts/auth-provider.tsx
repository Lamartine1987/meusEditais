
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry, PlanId, PlanDetails, NoteEntry } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
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
import { ref, set, get, update, remove, onValue, type Unsubscribe } from "firebase/database";
import { addDays, formatISO, isPast, parseISO as datefnsParseISO } from 'date-fns';
import { useRouter } from 'next/navigation'; 
import { useToast } from '@/hooks/use-toast';
import { appConfig } from '@/lib/config';

const TRIAL_DURATION_DAYS = 30;

const planRank: Record<PlanId, number> = {
  plano_trial: 0,
  plano_cargo: 1,
  plano_edital: 2,
  plano_anual: 3,
};

interface AuthContextType {
  user: AppUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, cpf: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => Promise<void>; 
  registerForCargo: (editalId: string, cargoId: string) => Promise<void>;
  unregisterFromCargo: (editalId: string, cargoId: string) => Promise<void>;
  toggleTopicStudyStatus: (compositeTopicId: string) => Promise<void>;
  addStudyLog: (compositeTopicId: string, logData: { duration?: number; pdfName?: string; startPage?: number; endPage?: number; }) => Promise<void>;
  deleteStudyLog: (logId: string) => Promise<void>;
  addQuestionLog: (logEntry: Omit<QuestionLogEntry, 'date'>) => Promise<void>;
  addRevisionSchedule: (compositeTopicId: string, daysToReview: number) => Promise<void>;
  toggleRevisionReviewedStatus: (revisionId: string) => Promise<void>;
  addNote: (compositeTopicId: string, text: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  startFreeTrial: () => Promise<void>;
  changeCargoForPlanoCargo: (newCargoCompositeId: string) => Promise<void>;
  isPlanoCargoWithinGracePeriod: () => boolean;
  setRankingParticipation: (participate: boolean) => Promise<void>;
  requestPlanRefund: (paymentIntentId: string) => Promise<void>;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const dbUnsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    // A lógica para isAdmin foi movida para dentro do listener onAuthStateChanged
    // para garantir que seja definida com base nos dados do usuário mais recentes.
  }, []);

  useEffect(() => {
    // Se o serviço de autenticação não foi inicializado (ex: dev sem API key),
    // não tente se inscrever a mudanças, pois isso causará um erro.
    if (!firebaseAuthService) {
      setLoading(false); // Finaliza o carregamento, não haverá usuário.
      console.warn("[AuthProvider] O serviço de autenticação do Firebase não está disponível. A autenticação está desativada.");
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(firebaseAuthService, (firebaseUser: FirebaseUser | null) => {
      setLoading(true);

      if (dbUnsubscribeRef.current) {
        dbUnsubscribeRef.current();
        dbUnsubscribeRef.current = null;
      }

      if (firebaseUser) {
        // Correção: Garante que `db` não é undefined antes de usá-lo
        if (!db) {
            console.error("AuthProvider: a conexão com o banco de dados do Firebase (db) não está disponível.");
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        const userRef = ref(db, `users/${firebaseUser.uid}`);
        
        dbUnsubscribeRef.current = onValue(userRef, async (snapshot) => {
          try {
            const adminUIDs = (process.env.FIREBASE_ADMIN_UIDS || '').split(',');
            setIsAdmin(adminUIDs.includes(firebaseUser.uid));

            if (!snapshot.exists()) {
              console.warn(`[AuthProvider] User data not found in DB for ${firebaseUser.uid}. This is normal during registration.`);
              const temporaryUser: AppUser = {
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || 'Usuário',
                  email: firebaseUser.email || '',
                  avatarUrl: firebaseUser.photoURL || undefined,
                  cpf: undefined,
                  registeredCargoIds: [],
                  studiedTopicIds: [],
                  studyLogs: [],
                  questionLogs: [],
                  revisionSchedules: [],
                  notes: [],
                  activePlan: null,
                  activePlans: [],
                  stripeCustomerId: null,
                  hasHadFreeTrial: false,
                  planHistory: [],
                  isRankingParticipant: null,
                  isAdmin: adminUIDs.includes(firebaseUser.uid),
              };
              setUser(temporaryUser);
              setLoading(false);
              return;
            }

            let dbData = snapshot.val();
            
            const updatesToSyncToDb: any = {};
            if (firebaseUser.displayName && dbData.name !== firebaseUser.displayName) {
              updatesToSyncToDb.name = firebaseUser.displayName;
            }
            if (firebaseUser.photoURL && dbData.avatarUrl !== firebaseUser.photoURL) {
              updatesToSyncToDb.avatarUrl = firebaseUser.photoURL;
            }
            if (Object.keys(updatesToSyncToDb).length > 0) {
              await update(userRef, updatesToSyncToDb);
              dbData = { ...dbData, ...updatesToSyncToDb };
            }
            
            let appUser: AppUser = {
              id: firebaseUser.uid,
              name: dbData.name || firebaseUser.displayName || 'Usuário',
              email: dbData.email || firebaseUser.email || '',
              cpf: dbData.cpf,
              avatarUrl: dbData.avatarUrl || firebaseUser.photoURL || undefined,
              registeredCargoIds: dbData.registeredCargoIds || [],
              studiedTopicIds: dbData.studiedTopicIds || [],
              studyLogs: dbData.studyLogs || [],
              questionLogs: dbData.questionLogs || [],
              revisionSchedules: dbData.revisionSchedules || [],
              notes: dbData.notes || [],
              activePlan: dbData.activePlan || null,
              activePlans: dbData.activePlans || [],
              stripeCustomerId: dbData.stripeCustomerId || null,
              hasHadFreeTrial: dbData.hasHadFreeTrial || false,
              planHistory: dbData.planHistory || [],
              isRankingParticipant: dbData.isRankingParticipant ?? null,
              isAdmin: adminUIDs.includes(firebaseUser.uid),
            };

            let trialExpiredToastShown = false;
            const trialPlan = appUser.activePlans?.find(p => p.planId === 'plano_trial');
            if (trialPlan && trialPlan.expiryDate && isPast(datefnsParseISO(trialPlan.expiryDate))) {
                console.log(`[AuthProvider] Free trial for user ${firebaseUser.uid} expired on ${trialPlan.expiryDate}. Removing from active plans.`);
                const updatedActivePlans = appUser.activePlans?.filter(p => p.planId !== 'plano_trial') || [];
                
                let highestPlan: PlanDetails | null = null;
                if (updatedActivePlans.length > 0) {
                    highestPlan = updatedActivePlans.reduce((max, plan) => {
                      return planRank[plan.planId] > planRank[max.planId] ? plan : max;
                    });
                }
                const newActivePlanId = highestPlan ? highestPlan.planId : null;

                const dbUpdatesForExpiredTrial = { 
                  activePlans: updatedActivePlans,
                  activePlan: newActivePlanId,
                };

                await update(userRef, dbUpdatesForExpiredTrial);
                
                appUser = { ...appUser, ...dbUpdatesForExpiredTrial };
                trialExpiredToastShown = true; 
            }
            setUser(appUser);

            if (trialExpiredToastShown) {
               toast({
                  title: "Teste Gratuito Expirado",
                  description: `Seu período de teste gratuito de ${TRIAL_DURATION_DAYS} dias terminou. Para continuar acessando os recursos, por favor, escolha um plano pago.`,
                  variant: "default",
                  duration: 9000,
                });
            }

          } catch (error) {
            console.error("Error processing RTDB snapshot or updating DB:", error);
            toast({ title: "Erro ao carregar dados", description: "Não foi possível buscar seus dados salvos.", variant: "destructive" });
            setUser({
              id: firebaseUser.uid, name: firebaseUser.displayName || 'Usuário', email: firebaseUser.email || '',
              registeredCargoIds: [], studiedTopicIds: [], studyLogs: [], questionLogs: [], revisionSchedules: [],
              notes: [], activePlan: null, activePlans: [], stripeCustomerId: null, hasHadFreeTrial: false, planHistory: [],
              isRankingParticipant: null, isAdmin: false,
            });
          } finally {
            setLoading(false);
          }
        }, (error) => {
          console.error("Firebase RTDB onValue listener error:", error);
          toast({ title: "Erro de Conexão com Dados", description: "Não foi possível sincronizar seus dados.", variant: "destructive" });
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
        });

      } else {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (dbUnsubscribeRef.current) {
        dbUnsubscribeRef.current();
      }
    };
  }, [toast]);

  const login = async (email: string, pass: string) => {
    if (!firebaseAuthService) throw new Error("Firebase Auth service is not available.");
    await signInWithEmailAndPassword(firebaseAuthService, email, pass);
  };

  const register = async (name: string, email: string, pass: string, cpf: string) => {
    if (!firebaseAuthService) throw new Error("Firebase Auth service is not available.");
    if (!db) throw new Error("Firebase DB service is not available.");
    const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, email, pass);
    const firebaseUser = userCredential.user;

    await updateProfile(firebaseUser, { displayName: name });
    
    const userRefDb = ref(db, `users/${firebaseUser.uid}`);
    
    const newUserDbData: any = {
        id: firebaseUser.uid,
        name: name,
        email: email,
        cpf: cpf,
        registeredCargoIds: [],
        studiedTopicIds: [],
        studyLogs: [],
        questionLogs: [],
        revisionSchedules: [],
        notes: [],
        activePlan: null,
        activePlans: [],
        stripeCustomerId: null,
        hasHadFreeTrial: false,
        planHistory: [],
        isRankingParticipant: null,
    };

    if (firebaseUser.photoURL) {
      newUserDbData.avatarUrl = firebaseUser.photoURL;
    }
    
    await set(userRefDb, newUserDbData);
  };
  
  const sendPasswordReset = async (email: string) => {
    if (!firebaseAuthService) throw new Error("Firebase Auth service is not available.");
    await sendPasswordResetEmail(firebaseAuthService, email);
  };

  const logout = async () => {
    if (!firebaseAuthService) throw new Error("Firebase Auth service is not available.");
    await signOut(firebaseAuthService);
    router.push('/login'); 
  };
  
  const updateUser = async (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => {
    if (!firebaseAuthService) throw new Error("Firebase Auth service is not available.");
    if (!db) throw new Error("Firebase DB service is not available.");
    const firebaseCurrentUser = firebaseAuthService.currentUser;
    if (firebaseCurrentUser && user) {
      setLoading(true);
      try {
        const authUpdates: { displayName?: string; photoURL?: string | null } = {};
        if (updatedInfo.hasOwnProperty('name') && updatedInfo.name !== user.name) authUpdates.displayName = updatedInfo.name;
        if (updatedInfo.hasOwnProperty('avatarUrl') && updatedInfo.avatarUrl !== user.avatarUrl) authUpdates.photoURL = updatedInfo.avatarUrl || null;
        
        if (Object.keys(authUpdates).length > 0) await updateProfile(firebaseCurrentUser, authUpdates);
        
        const dbUpdates: any = {};
        if (authUpdates.displayName) dbUpdates.name = authUpdates.displayName;
        if (authUpdates.photoURL !== undefined) dbUpdates.avatarUrl = authUpdates.photoURL;

        if (Object.keys(dbUpdates).length > 0) {
            await update(ref(db, `users/${user.id}`), dbUpdates);
        }

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
    if (!user) {
      toast({ title: "Usuário não encontrado", description: "Não foi possível registrar no cargo.", variant: "destructive" });
      throw new Error("User not found for cargo registration");
    }
    if (!db) throw new Error("Firebase DB service is not available.");

    const currentCargoCompositeId = `${editalId}_${cargoId}`;
    let canRegister = false;
    let reason = "";

    if (user.activePlans?.some(p => p.planId === 'plano_anual' || p.planId === 'plano_trial')) {
      canRegister = true;
    } else if (user.activePlans?.some(p => p.planId === 'plano_edital' && p.selectedEditalId === editalId)) {
      canRegister = true;
    } else {
      reason = "Você não possui um plano que cubra este cargo. Para se inscrever, adquira um plano correspondente.";
    }

    if (!canRegister) {
      throw new Error(reason);
    }

    const compositeId = `${editalId}_${cargoId}`;
    const updatedRegisteredCargoIds = Array.from(new Set([...(user.registeredCargoIds || []), compositeId]));
    
    try {
      await update(ref(db, `users/${user.id}`), { registeredCargoIds: updatedRegisteredCargoIds });
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
    if (!db) throw new Error("Firebase DB service is not available.");
    const cargoCompositeId = `${editalId}_${cargoId}`;

    const isCargoTiedToPlan = user.activePlans?.some(p => p.planId === 'plano_cargo' && p.selectedCargoCompositeId === cargoCompositeId);

    if (isCargoTiedToPlan) {
        toast({
            title: "Ação Não Permitida",
            description: "Este cargo está vinculado a um Plano Cargo ativo. Para removê-lo, cancele o plano na sua página de perfil.",
            variant: "destructive",
            duration: 7000,
        });
        return;
    }

    const updatedRegisteredCargoIds = (user.registeredCargoIds || []).filter(id => id !== cargoCompositeId);
    const progressUpdates = cleanProgressForCargo(user, `${cargoCompositeId}_`); 

    try {
      await update(ref(db, `users/${user.id}`), { 
        registeredCargoIds: updatedRegisteredCargoIds,
        ...progressUpdates
      });
      toast({ title: "Inscrição Cancelada", description: `Sua inscrição e progresso no cargo foram removidos.` });
    } catch (error) {
      console.error("Error unregistering from cargo and clearing progress:", error);
      toast({ title: "Erro ao Cancelar", description: "Não foi possível remover a inscrição ou o progresso do cargo.", variant: "destructive" });
    } 
  };

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user && db) {
      let updatedStudiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = updatedStudiedTopicIds.indexOf(compositeTopicId);
      if (topicIndex > -1) updatedStudiedTopicIds.splice(topicIndex, 1); 
      else updatedStudiedTopicIds.push(compositeTopicId); 
      try {
        await update(ref(db, `users/${user.id}`), { studiedTopicIds: updatedStudiedTopicIds });
      } catch (error) {
        console.error("Error toggling topic study status:", error);
        toast({ title: "Erro ao Atualizar Status", description: "Não foi possível salvar o status do tópico.", variant: "destructive" });
      } 
    }
  };

  const addStudyLog = async (compositeTopicId: string, logData: { duration?: number, pdfName?: string, startPage?: number, endPage?: number }) => {
    if (user && db) {
        const newLog: StudyLogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            compositeTopicId,
            date: new Date().toISOString(),
            duration: logData.duration || 0,
            ...(logData.pdfName && { pdfName: logData.pdfName }),
            ...(logData.startPage !== undefined && { startPage: logData.startPage }),
            ...(logData.endPage !== undefined && { endPage: logData.endPage }),
        };
        const updatedStudyLogs = [...(user.studyLogs || []), newLog];
        try {
            await update(ref(db, `users/${user.id}`), { studyLogs: updatedStudyLogs });
        } catch (error) {
            console.error("Error adding study log:", error);
            toast({ title: "Erro ao Salvar Log", description: "Não foi possível salvar o registro de estudo.", variant: "destructive" });
        }
    }
  };

  const deleteStudyLog = async (logId: string) => {
    if (user && db) {
        const initialLogCount = (user.studyLogs || []).length;
        const updatedStudyLogs = (user.studyLogs || []).filter(log => log.id !== logId);
        const finalLogCount = updatedStudyLogs.length;

        if (initialLogCount === finalLogCount) {
             console.warn(`[AuthProvider/deleteStudyLog] Warning: Log ID "${logId}" not found in user's studyLogs. No deletion will occur.`);
             toast({ title: "Atenção", description: "O registro a ser excluído não foi encontrado. A lista pode já estar atualizada.", variant: "default" });
             return;
        }

        try {
            await update(ref(db, `users/${user.id}`), { studyLogs: updatedStudyLogs });
            toast({ title: "Registro Excluído", description: "O registro de estudo foi removido.", variant: "default" });
        } catch (error) {
            console.error("[AuthProvider/deleteStudyLog] Error deleting study log from DB:", error);
            toast({ title: "Erro ao Excluir", description: "Não foi possível remover o registro do banco de dados.", variant: "destructive" });
        }
    }
  };

  const addQuestionLog = async (logEntryData: Omit<QuestionLogEntry, 'date'>) => {
    if (user && db) {
      const newQuestionLog: QuestionLogEntry = { ...logEntryData, date: new Date().toISOString() };
      const updatedQuestionLogs = [...(user.questionLogs || []), newQuestionLog];
      try {
        await update(ref(db, `users/${user.id}`), { questionLogs: updatedQuestionLogs });
      } catch (error) {
        console.error("Error adding question log:", error);
        toast({ title: "Erro ao Salvar Desempenho", description: "Não foi possível salvar o registro de questões.", variant: "destructive" });
      } 
    }
  };

  const addRevisionSchedule = async (compositeTopicId: string, daysToReview: number) => {
    if (user && db) {
      const scheduledDate = formatISO(addDays(new Date(), daysToReview));
      const newScheduleEntry: RevisionScheduleEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        compositeTopicId,
        scheduledDate,
        isReviewed: false,
        reviewedDate: null,
      };
      const updatedRevisionSchedules = [...(user.revisionSchedules || []), newScheduleEntry];
      try {
        await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
      } catch (error) {
        console.error("Error adding revision schedule:", error);
        toast({ title: "Erro ao Agendar Revisão", description: "Não foi possível salvar o agendamento.", variant: "destructive" });
      }
    }
  };

  const toggleRevisionReviewedStatus = async (revisionId: string) => {
     if (user && db) {
      let updatedRevisionSchedules = [...(user.revisionSchedules || [])];
      const scheduleIndex = updatedRevisionSchedules.findIndex(rs => rs.id === revisionId);
      
      if (scheduleIndex > -1) {
        const currentStatus = updatedRevisionSchedules[scheduleIndex].isReviewed;
        updatedRevisionSchedules[scheduleIndex] = {
          ...updatedRevisionSchedules[scheduleIndex],
          isReviewed: !currentStatus,
          reviewedDate: !currentStatus ? new Date().toISOString() : null,
        };
        try {
          await update(ref(db, `users/${user.id}`), { revisionSchedules: updatedRevisionSchedules });
        } catch (error) {
          console.error("Error toggling revision status:", error);
          toast({ title: "Erro ao Atualizar Revisão", description: "Não foi possível salvar o status da revisão.", variant: "destructive" });
        }
      }
    }
  };
  
    const addNote = async (compositeTopicId: string, text: string) => {
        if (user && db) {
            const newNote: NoteEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                compositeTopicId,
                date: new Date().toISOString(),
                text,
            };
            const updatedNotes = [...(user.notes || []), newNote];
            try {
                await update(ref(db, `users/${user.id}`), { notes: updatedNotes });
                toast({ title: "Anotação Salva!", description: "Sua anotação foi salva com sucesso.", variant: "default", className: "bg-accent text-accent-foreground" });
            } catch (error) {
                console.error("Error adding note:", error);
                toast({ title: "Erro ao Salvar", description: "Não foi possível salvar sua anotação.", variant: "destructive" });
            }
        }
    };

    const deleteNote = async (noteId: string) => {
        if (user && db) {
            const updatedNotes = (user.notes || []).filter(note => note.id !== noteId);
            try {
                await update(ref(db, `users/${user.id}`), { notes: updatedNotes });
                toast({ title: "Anotação Excluída", description: "Sua anotação foi removida.", variant: "default" });
            } catch (error) {
                console.error("Error deleting note:", error);
                toast({ title: "Erro ao Excluir", description: "Não foi possível remover a anotação.", variant: "destructive" });
            }
        }
    };

  const isPlanoCargoWithinGracePeriod = (): boolean => {
    return false;
  };

  const changeCargoForPlanoCargo = async (newCargoCompositeId: string) => {
    toast({ title: "Função Indisponível", description: "A troca de cargo para planos existentes não está disponível no momento.", variant: "destructive" });
    return;
  };

  const cancelSubscription = async () => {
    if (!user || !user.activePlans || user.activePlans.length === 0 || !db) {
      toast({ title: "Nenhuma Assinatura Ativa", description: "Você não possui um plano ativo para cancelar.", variant: "default" });
      return;
    }
   
    const trialPlan = user.activePlans.find(p => p.planId === 'plano_trial');
    if (trialPlan) {
        const updatedActivePlans = user.activePlans.filter(p => p.planId !== 'plano_trial');
        const updates: any = { activePlans: updatedActivePlans };

        if (updatedActivePlans.length === 0) {
            updates.activePlan = null;
        }

        try {
            await update(ref(db, `users/${user.id}`), updates);
            toast({ title: "Teste Cancelado", description: "Seu teste gratuito foi cancelado.", variant: "default" });
        } catch(e) {
            toast({ title: "Erro", description: "Não foi possível cancelar o teste.", variant: "destructive" });
        }
    } else {
       toast({ title: "Ação Indisponível", description: "O cancelamento de planos pagos deve ser gerenciado através do suporte.", variant: "default" });
    }
  };

  const startFreeTrial = async () => {
    if (!user) {
      toast({ title: "Usuário não logado", description: "Faça login para iniciar seu teste.", variant: "destructive" });
      router.push("/login?redirect=/planos");
      return;
    }
    if (!db) {
        toast({ title: "Erro de Conexão", description: "Não foi possível se conectar ao banco de dados.", variant: "destructive" });
        return;
    }
    if (user.hasHadFreeTrial) {
      toast({ title: "Teste Já Utilizado", description: "Você já utilizou seu período de teste gratuito.", variant: "default" });
      return;
    }
    if (user.activePlans?.some(p => p.planId !== 'plano_trial')) {
      toast({ title: "Plano Ativo", description: "Você já possui um plano pago ativo.", variant: "default" });
      return;
    }

    const now = new Date();
    const trialPlanDetails: PlanDetails = {
      planId: 'plano_trial',
      startDate: formatISO(now),
      expiryDate: formatISO(addDays(now, TRIAL_DURATION_DAYS)),
    };

    const updatedActivePlans = [...(user.activePlans || []).filter(p => p.planId !== 'plano_trial'), trialPlanDetails];

    try {
      await update(ref(db, `users/${user.id}`), { 
        activePlan: 'plano_trial',
        activePlans: updatedActivePlans,
        hasHadFreeTrial: true 
      });
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
  };

  const setRankingParticipation = async (participate: boolean) => {
    if (user && db) {
      try {
        await update(ref(db, `users/${user.id}`), { isRankingParticipant: participate });
        toast({
          title: "Preferência de Ranking Salva!",
          description: participate
            ? "Você agora está participando do ranking."
            : "Você escolheu não participar do ranking. Seus dados permanecerão anônimos.",
          variant: "default",
          className: "bg-accent text-accent-foreground",
        });
      } catch (error) {
        console.error("Error setting ranking participation:", error);
        toast({ title: "Erro", description: "Não foi possível salvar sua preferência de ranking.", variant: "destructive" });
        throw error;
      }
    }
  };
  
  const requestPlanRefund = async (paymentIntentId: string) => {
    if (!user || !user.activePlans || !db) {
      toast({ title: "Erro", description: "Usuário, planos ou conexão com DB não encontrados.", variant: "destructive" });
      return;
    }
    
    const planIndex = user.activePlans.findIndex(p => p.stripePaymentIntentId === paymentIntentId);
    if (planIndex === -1) {
        toast({ title: "Erro", description: "Plano não encontrado para solicitar reembolso.", variant: "destructive" });
        return;
    }

    const updatedPlans = [...user.activePlans];
    updatedPlans[planIndex] = {
      ...updatedPlans[planIndex],
      status: 'refundRequested',
      requestDate: new Date().toISOString(),
    };
    
    try {
      await update(ref(db, `users/${user.id}`), { activePlans: updatedPlans });
      toast({
        title: "Solicitação Enviada",
        description: "Sua solicitação de reembolso foi enviada ao administrador. O processo pode levar alguns dias.",
        variant: "default",
        className: "bg-accent text-accent-foreground",
      });
    } catch (error) {
      console.error("Error requesting plan refund:", error);
      toast({ title: "Erro ao Solicitar", description: "Não foi possível enviar sua solicitação.", variant: "destructive" });
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, isAdmin, loading, login, register, sendPasswordReset, logout, updateUser, 
      registerForCargo, unregisterFromCargo, toggleTopicStudyStatus, addStudyLog, 
      deleteStudyLog,
      addQuestionLog, addRevisionSchedule, toggleRevisionReviewedStatus,
      addNote, deleteNote,
      cancelSubscription, startFreeTrial, changeCargoForPlanoCargo, isPlanoCargoWithinGracePeriod,
      setRankingParticipation, requestPlanRefund
    }}>
      {children}
    </AuthContext.Provider>
  );
};
