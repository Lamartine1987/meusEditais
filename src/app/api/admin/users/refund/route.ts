import { NextResponse } from 'next/server';
import { processRefund as processRefundAction } from '@/actions/admin-actions';

export async function POST(req: Request) {
    try {
        const { userId, paymentIntentId } = await req.json();
        
        const headersList = req.headers;
        const authorization = headersList.get('authorization');
        
        if (!authorization || !authorization.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Authorization token is missing or malformed.' }, { status: 401 });
        }
        
        const idToken = authorization.split('Bearer ')[1];
        
        if (!idToken) {
            return NextResponse.json({ error: 'Firebase ID token is missing.' }, { status: 401 });
        }
        
        await processRefundAction({ userId, paymentIntentId, idToken });
        
        return NextResponse.json({ message: 'Reembolso processado com sucesso.' });
        
    } catch (error: any) {
        console.error("[API /refund] Error processing refund:", error);
        return NextResponse.json(
            { error: 'Falha interna do servidor ao processar o reembolso.', details: error.message },
            { status: 500 }
        );
    }
}
