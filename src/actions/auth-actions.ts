'use server';

import { adminDb, auth as adminAuth } from '@/lib/firebase-admin';
import { type User as AppUser } from '@/types';
import { get, query, ref, orderByChild, equalTo } from "firebase/database";

interface RegisterUserInput {
  name: string;
  email: string;
  cpf: string;
  password: string;
}

interface RegisterUserResult {
  uid?: string;
  error?: string;
}

export async function registerUser(input: RegisterUserInput): Promise<RegisterUserResult> {
  const { name, email, cpf, password } = input;

  try {
    // 1. Check for CPF uniqueness in Realtime Database
    const usersRef = ref(adminDb, 'users');
    const cpfQuery = query(usersRef, orderByChild('cpf'), equalTo(cpf));
    const snapshot = await get(cpfQuery);

    if (snapshot.exists()) {
      return { error: 'Este CPF já está cadastrado.' };
    }

    // 2. Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // 3. Save user data (including CPF) in Realtime Database
    const userRefDb = ref(adminDb, `users/${userRecord.uid}`);
    const newUserDbData: Omit<AppUser, 'id'> = {
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
    
    await adminDb.ref(`users/${userRecord.uid}`).set(newUserDbData);
    
    return { uid: userRecord.uid };
  } catch (error: any) {
    let errorMessage = 'Não foi possível realizar o cadastro.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Este e-mail já está em uso.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'O formato do e-mail é inválido.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'A senha é muito fraca. Tente uma senha mais forte.';
    }
    console.error('[AuthAction Register] Error:', error);
    return { error: errorMessage };
  }
}
