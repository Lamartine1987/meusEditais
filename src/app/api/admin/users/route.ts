// src/app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import { adminDb, auth } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import type { User as AppUser } from '@/types';

export const dynamic = 'force-dynamic';

async function verifyAdmin(idToken: string): Promise<boolean> {
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        const adminRef = adminDb.ref(`admins/${uid}`);
        const snapshot = await adminRef.once('value');
        
        return snapshot.exists();
    } catch (error) {
        console.error("[API verifyAdmin] CRITICAL: Admin verification failed:", error);
        return false;
    }
}

export async function GET() {
    try {
        const headersList = headers();
        const authorization = headersList.get('authorization');

        if (!authorization || !authorization.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authorization token is missing or malformed.' }, { status: 401 });
        }

        const idToken = authorization.split('Bearer ')[1];
        const isAdmin = await verifyAdmin(idToken);

        if (!isAdmin) {
            return NextResponse.json({ error: 'Access denied. Administrator privileges required.' }, { status: 403 });
        }

        const usersRef = adminDb.ref('users');
        const snapshot = await usersRef.once('value');
        const usersData = snapshot.val();

        if (!usersData) {
            return NextResponse.json([]);
        }

        const usersArray: AppUser[] = Object.keys(usersData).map(key => ({
            id: key,
            ...usersData[key],
        }));
        
        const adminsRef = adminDb.ref('admins');
        const adminsSnapshot = await adminsRef.once('value');
        const adminUids = adminsSnapshot.exists() ? Object.keys(adminsSnapshot.val()) : [];

        const usersWithAdminFlag = usersArray.map(user => ({
            ...user,
            isAdmin: adminUids.includes(user.id),
        }));
        
        return NextResponse.json(usersWithAdminFlag);

    } catch (error: any) {
        console.error("[API GET] CRITICAL error in /api/admin/users route handler:", error);
        return NextResponse.json(
            { error: 'Internal server error while fetching users.', details: error.message },
            { status: 500 }
        );
    }
}
