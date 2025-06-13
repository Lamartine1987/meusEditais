
"use client";

import type { User as AppUser, StudyLogEntry, QuestionLogEntry, RevisionScheduleEntry } from '@/types';
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
import { auth as firebaseAuthService } from '@/lib/firebase'; // Renomeado para evitar conflito
import { addDays, formatISO } from 'date-fns';
import { useRouter } from 'next/navigation'; // Para redirecionamento

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => Promise<void>; // Ajustado para Firebase
  registerForCargo: (editalId: string, cargoId: string) => Promise<void>;
  unregisterFromCargo: (editalId: string, cargoId: string) => Promise<void>;
  toggleTopicStudyStatus: (compositeTopicId: string) => Promise<void>;
  addStudyLog: (compositeTopicId: string, duration: number) => Promise<void>;
  addQuestionLog: (logEntry: Omit<QuestionLogEntry, 'date'>) => Promise<void>;
  addRevisionSchedule: (compositeTopicId: string, daysToReview: number) => Promise<void>;
  toggleRevisionReviewedStatus: (compositeTopicId: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuthService, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        // Usuário está logado via Firebase
        // TODO: No futuro, aqui você buscaria os dados customizados do usuário (registeredCargoIds, etc.) do Firestore
        // Por agora, inicializamos com valores padrão ou vazios para a estrutura do AppUser
        const appUser: AppUser = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || 'Usuário',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || undefined,
          registeredCargoIds: [], // Inicializa vazio, será populado do Firestore no futuro
          studiedTopicIds: [],    // Inicializa vazio
          studyLogs: [],          // Inicializa vazio
          questionLogs: [],       // Inicializa vazio
          revisionSchedules: [],  // Inicializa vazio
        };
        setUser(appUser);
      } else {
        // Usuário não está logado
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    await signInWithEmailAndPassword(firebaseAuthService, email, pass);
    // onAuthStateChanged cuidará de definir o usuário e setLoading(false)
  };

  const register = async (name: string, email: string, pass: string) => {
    setLoading(true);
    const userCredential = await createUserWithEmailAndPassword(firebaseAuthService, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
    // onAuthStateChanged cuidará de definir o usuário e setLoading(false)
  };
  
  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(firebaseAuthService, email);
  };

  const logout = async () => {
    setLoading(true);
    await signOut(firebaseAuthService);
    router.push('/login'); // Redireciona para login após logout
    // onAuthStateChanged cuidará de definir o usuário como null e setLoading(false)
  };
  
  const updateUser = async (updatedInfo: { name?: string; email?: string; avatarUrl?: string }) => {
    const currentUser = firebaseAuthService.currentUser;
    if (currentUser) {
      setLoading(true);
      if (updatedInfo.name || updatedInfo.avatarUrl) {
        await updateProfile(currentUser, {
          displayName: updatedInfo.name || currentUser.displayName,
          photoURL: updatedInfo.avatarUrl || currentUser.photoURL,
        });
      }
      // A atualização de e-mail é mais complexa e pode exigir reautenticação, omitida por simplicidade agora.
      // Se você implementar, use `updateEmail(currentUser, updatedInfo.email)`.

      // Atualiza o estado local do usuário para refletir imediatamente as mudanças
      setUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          name: updatedInfo.name || prevUser.name,
          avatarUrl: updatedInfo.avatarUrl || prevUser.avatarUrl,
        };
      });
      setLoading(false);
    } else {
      throw new Error("Nenhum usuário logado para atualizar.");
    }
  };

  // Funções de dados específicos da aplicação (registeredCargoIds, studyLogs, etc.)
  // ATENÇÃO: Estas funções agora operam sobre um estado 'user' que é reinicializado no login/logout.
  // A persistência real desses dados deve ser feita no Firestore ou similar, associada ao user.id (Firebase UID).
  // Por agora, elas modificarão o estado local do `user` que não persistirá entre sessões de forma robusta sem Firestore.

  const registerForCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simula async
      const compositeId = `${editalId}_${cargoId}`;
      const registeredCargoIds = [...(user.registeredCargoIds || [])];
      if (!registeredCargoIds.includes(compositeId)) {
        registeredCargoIds.push(compositeId);
      }
      const updatedUser = { ...user, registeredCargoIds };
      setUser(updatedUser);
      // TODO: Salvar 'updatedUser.registeredCargoIds' no Firestore para o 'user.id'
      setLoading(false);
    }
  };

  const unregisterFromCargo = async (editalId: string, cargoId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      const compositeId = `${editalId}_${cargoId}`;
      const registeredCargoIds = (user.registeredCargoIds || []).filter(id => id !== compositeId);
      const updatedUser = { ...user, registeredCargoIds };
      setUser(updatedUser);
      // TODO: Salvar 'updatedUser.registeredCargoIds' no Firestore
      setLoading(false);
    }
  };

  const toggleTopicStudyStatus = async (compositeTopicId: string) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      let studiedTopicIds = [...(user.studiedTopicIds || [])];
      const topicIndex = studiedTopicIds.indexOf(compositeTopicId);
      if (topicIndex > -1) {
        studiedTopicIds.splice(topicIndex, 1); 
      } else {
        studiedTopicIds.push(compositeTopicId); 
      }
      const updatedUser = { ...user, studiedTopicIds };
      setUser(updatedUser);
      // TODO: Salvar 'updatedUser.studiedTopicIds' no Firestore
      setLoading(false);
    }
  };

  const addStudyLog = async (compositeTopicId: string, duration: number) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      const newLog: StudyLogEntry = {
        compositeTopicId,
        date: new Date().toISOString(),
        duration,
      };
      const studyLogs = [...(user.studyLogs || []), newLog];
      const updatedUser = { ...user, studyLogs };
      setUser(updatedUser);
      // TODO: Salvar 'updatedUser.studyLogs' no Firestore
      setLoading(false);
    }
  };

  const addQuestionLog = async (logEntryData: Omit<QuestionLogEntry, 'date'>) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      const newQuestionLog: QuestionLogEntry = {
        ...logEntryData,
        date: new Date().toISOString(),
      };
      const questionLogs = [...(user.questionLogs || []), newQuestionLog];
      const updatedUser = { ...user, questionLogs };
      setUser(updatedUser);
      // TODO: Salvar 'updatedUser.questionLogs' no Firestore
      setLoading(false);
    }
  };

  const addRevisionSchedule = async (compositeTopicId: string, daysToReview: number) => {
    if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      const scheduledDate = formatISO(addDays(new Date(), daysToReview));
      let revisionSchedules = [...(user.revisionSchedules || [])];
      const existingScheduleIndex = revisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      if (existingScheduleIndex > -1) {
        revisionSchedules[existingScheduleIndex] = {
          ...revisionSchedules[existingScheduleIndex],
          scheduledDate,
          isReviewed: false,
          reviewedDate: null,
        };
      } else {
        revisionSchedules.push({
          compositeTopicId,
          scheduledDate,
          isReviewed: false,
          reviewedDate: null,
        });
      }
      const updatedUser = { ...user, revisionSchedules };
      setUser(updatedUser);
      // TODO: Salvar 'updatedUser.revisionSchedules' no Firestore
      setLoading(false);
    }
  };

  const toggleRevisionReviewedStatus = async (compositeTopicId: string) => {
     if (user) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 50));
      let revisionSchedules = [...(user.revisionSchedules || [])];
      const scheduleIndex = revisionSchedules.findIndex(rs => rs.compositeTopicId === compositeTopicId);
      if (scheduleIndex > -1) {
        const currentStatus = revisionSchedules[scheduleIndex].isReviewed;
        revisionSchedules[scheduleIndex] = {
          ...revisionSchedules[scheduleIndex],
          isReviewed: !currentStatus,
          reviewedDate: !currentStatus ? new Date().toISOString() : null,
        };
        const updatedUser = { ...user, revisionSchedules };
        setUser(updatedUser);
        // TODO: Salvar 'updatedUser.revisionSchedules' no Firestore
      }
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register,
      sendPasswordReset,
      logout, 
      updateUser, 
      registerForCargo, 
      unregisterFromCargo, 
      toggleTopicStudyStatus, 
      addStudyLog, 
      addQuestionLog,
      addRevisionSchedule,
      toggleRevisionReviewedStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
};
