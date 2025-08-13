// src/app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { auth } from 'firebase-admin';
import type { User as AppUser } from '@/types';


export const dynamic = 'force-dynamic';

async function verifyAdmin(idToken: string): Promise<boolean> {
    try {
        // Verifica o token de ID do Firebase para obter o UID
        const decodedToken = await auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Verifica se o UID existe no nó 'admins' do Realtime Database
        const adminRef = adminDb.ref(`admins/${uid}`);
        const snapshot = await adminRef.once('value');
        
        // Se snapshot.exists() for true, o valor pode ser qualquer coisa (ex: true, ou um objeto).
        // A simples existência da chave é suficiente para confirmar o status de admin.
        return snapshot.exists();
    } catch (error) {
        console.error("Falha na verificação de admin:", error);
        return false;
    }
}

export async function GET() {
    try {
        const headersList = headers();
        const authorization = headersList.get('authorization');

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Token de autorização ausente ou mal formatado.' }, { status: 401 });
        }

        const idToken = authorization.split('Bearer ')[1];
        const isAdmin = await verifyAdmin(idToken);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Acesso negado. Requer privilégios de administrador.' }, { status: 403 });
        }

        const usersRef = adminDb.ref('users');
        const snapshot = await usersRef.once('value');
        const usersData = snapshot.val();

        if (!usersData) {
            return NextResponse.json([]);
        }

        const usersArray: AppUser[] = Object.keys(usersData).map(key => {
            const userData = usersData[key];
            return {
                id: key,
                ...userData,
                // Garante que a flag isAdmin seja definida com base no nó 'admins'
                // Esta parte é redundante se a verificação de admin já foi feita, 
                // mas pode ser útil para exibir na UI do admin.
                // Vou remover para simplificar, a verificação é no acesso.
            };
        });

        // Adiciona a flag `isAdmin` a cada usuário para exibição no painel
        const adminsRef = adminDb.ref('admins');
        const adminsSnapshot = await adminsRef.once('value');
        const adminUids = adminsSnapshot.exists() ? Object.keys(adminsSnapshot.val()) : [];

        const usersWithAdminFlag = usersArray.map(user => ({
            ...user,
            isAdmin: adminUids.includes(user.id),
        }));

        return NextResponse.json(usersWithAdminFlag);

    } catch (error: any) {
        console.error("Erro na API /api/admin/users:", error);
        return NextResponse.json(
            { error: 'Erro interno do servidor ao buscar usuários.', details: error.message },
            { status: 500 }
        );
    }
}
