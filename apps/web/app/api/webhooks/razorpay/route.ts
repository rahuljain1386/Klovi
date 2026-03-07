import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: Verify Razorpay signature
    if (body.event === 'payment.captured') {
      const orderId = body.payload?.payment?.entity?.notes?.order_id;
      if (orderId) {
        const isDeposit = body.payload?.payment?.entity?.notes?.is_deposit === 'true';
        await supabase.from('orders').update({
          payment_status: isDeposit ? 'deposit_paid' : 'fully_paid',
          status: isDeposit ? 'deposit_paid' : 'balance_paid',
        }).eq('id', orderId);
      }
    }
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 });
  }
}
