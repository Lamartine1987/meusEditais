
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Edital } from '@/types';

export async function GET() {
  try {
    const editaisRef = adminDb.ref('editais/editais');
    const snapshot = await editaisRef.get();

    if (snapshot.exists()) {
      const data = snapshot.val();
      const editaisArray: Edital[] = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      return NextResponse.json(editaisArray);
    } else {
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error("API Error fetching editais:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch editais." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
