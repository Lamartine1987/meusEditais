
import { NextResponse } from 'next/server';
import { mockEditais } from '@/lib/mock-data';

export async function GET() {
  try {
    // This is a temporary solution for local development.
    // It returns mock data because the Admin SDK may not have credentials
    // in a local environment. When deployed to Firebase App Hosting, the
    // original code to fetch from the database will work correctly.
    
    // Simulate a network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return the mock data array
    return NextResponse.json(mockEditais);

  } catch (error) {
    console.error("API Error returning mock editais:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to fetch mock editais." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
