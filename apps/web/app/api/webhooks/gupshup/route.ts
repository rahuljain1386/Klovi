import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: Process Gupshup webhook (WhatsApp/Instagram/Facebook messages)
    // 1. Find or create customer
    // 2. Find or create conversation
    // 3. Save message
    // 4. Run AI reply logic
    // 5. Send notification if AI can't handle
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Gupshup webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
