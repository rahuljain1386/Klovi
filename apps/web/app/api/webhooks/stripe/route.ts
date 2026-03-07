import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    // TODO: Verify Stripe signature
    const event = JSON.parse(body);
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const orderId = pi.metadata?.order_id;
      if (orderId) {
        await supabase.from('orders').update({
          payment_status: pi.metadata?.is_deposit === 'true' ? 'deposit_paid' : 'fully_paid',
          status: pi.metadata?.is_deposit === 'true' ? 'deposit_paid' : 'balance_paid',
        }).eq('id', orderId);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
