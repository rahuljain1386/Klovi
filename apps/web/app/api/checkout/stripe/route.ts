import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const body = await request.json();
  const { order_id, seller_id, items, currency, success_url, cancel_url } = body;

  if (!order_id || !items?.length) {
    return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Get seller info for Stripe Connect (if applicable)
  const { data: seller } = await supabase
    .from('sellers')
    .select('business_name, stripe_account_id')
    .eq('id', seller_id)
    .single();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
    (item: { product_name: string; price: number; quantity: number }) => ({
      price_data: {
        currency: currency || 'usd',
        product_data: { name: item.product_name },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    })
  );

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    metadata: { order_id, seller_id },
    success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order_id}?success=true`,
    cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_APP_URL}/orders/${order_id}?cancelled=true`,
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  // Update order with Stripe session ID
  await supabase
    .from('orders')
    .update({ payment_id: session.id })
    .eq('id', order_id);

  return NextResponse.json({ checkout_url: session.url });
}
