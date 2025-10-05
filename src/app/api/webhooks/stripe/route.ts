
// app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/actions/stripe-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    return await handleStripeWebhook(req);
  } catch (error: any) {
    console.error("Error in Stripe webhook POST handler:", error.message);
    return new NextResponse(JSON.stringify({ error: error.message || "Webhook processing error" }), {
      status: error.status || 500, // Use error status if available, otherwise 500
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Optional: If Stripe tries to use GET for some verification (rare, but good to have a handler)
export async function GET() {
  return new NextResponse(JSON.stringify({ message: "Webhook endpoint is active. Use POST for events." }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

    