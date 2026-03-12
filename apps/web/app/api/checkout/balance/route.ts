import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Generate a balance payment link for an order (after order is ready).
 *
 * POST /api/checkout/balance
 * Body: { order_id }
 * Returns: { payment_url, balance_amount, currency }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { order_id } = body;

  if (!order_id) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, sellers(business_name, country, stripe_account_id, upi_id)')
    .eq('id', order_id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const seller = order.sellers as any;
  const balanceAmount = order.balance_amount || (order.total - (order.deposit_amount || 0));
  const currency = order.currency || (seller?.country === 'india' ? 'INR' : 'USD');
  const isIndia = currency === 'INR';

  if (balanceAmount <= 0) {
    return NextResponse.json({ error: 'No balance remaining', balance_amount: 0 }, { status: 400 });
  }

  if (isIndia) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      if (seller?.upi_id) {
        const upiLink = `upi://pay?pa=${seller.upi_id}&pn=${encodeURIComponent(seller.business_name)}&am=${balanceAmount}&cu=INR&tn=${encodeURIComponent(`Balance for order ${order.order_number}`)}`;
        return NextResponse.json({
          payment_url: upiLink,
          payment_method: 'upi',
          balance_amount: balanceAmount,
          currency,
        });
      }
      return NextResponse.json({ error: 'Payment not configured' }, { status: 500 });
    }

    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(balanceAmount * 100),
        currency: 'INR',
        description: `Balance for order ${order.order_number} from ${seller.business_name}`,
        notes: { order_id, seller_id: order.seller_id, is_deposit: 'false' },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://klovi.com'}/orders/${order_id}?paid=true`,
        callback_method: 'get',
      }),
    });

    if (!rzpRes.ok) {
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 502 });
    }

    const rzpLink = await rzpRes.json();
    return NextResponse.json({
      payment_url: rzpLink.short_url,
      payment_method: 'razorpay',
      balance_amount: balanceAmount,
      currency,
    });
  } else {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Balance — ${seller.business_name} Order ${order.order_number}` },
          unit_amount: Math.round(balanceAmount * 100),
        },
        quantity: 1,
      }],
      metadata: { order_id, seller_id: order.seller_id, is_deposit: 'false' },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://klovi.com'}/orders/${order_id}?paid=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://klovi.com'}/orders/${order_id}`,
    });

    return NextResponse.json({
      payment_url: session.url,
      payment_method: 'stripe',
      balance_amount: balanceAmount,
      currency,
    });
  }
}
