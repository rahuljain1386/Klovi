import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { order_id, seller_id, amount, currency } = body;

  if (!order_id || !amount) {
    return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 });
  }

  // Create Razorpay order
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100), // Razorpay expects paise
      currency: currency || 'INR',
      receipt: order_id,
      notes: { order_id, seller_id },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to create Razorpay order' }, { status: 502 });
  }

  const rzpOrder = await response.json();

  // Update order with Razorpay order ID
  const supabase = createServerClient();
  await supabase
    .from('orders')
    .update({ payment_id: rzpOrder.id })
    .eq('id', order_id);

  return NextResponse.json({
    razorpay_order_id: rzpOrder.id,
    razorpay_key: keyId,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
  });
}
