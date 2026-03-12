import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Generate a deposit payment link for an order.
 * Called by the AI after order confirmation to send deposit link via WhatsApp.
 *
 * POST /api/checkout/deposit
 * Body: { order_id }
 * Returns: { payment_url, deposit_amount, total, currency }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { order_id } = body;

  if (!order_id) {
    return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Fetch order with seller info
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, sellers(business_name, deposit_percentage, country, stripe_account_id, razorpay_account_id, upi_id)')
    .eq('id', order_id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const seller = order.sellers as any;
  const depositPct = seller?.deposit_percentage ?? 50;
  const depositAmount = Math.ceil(order.total * depositPct / 100);
  const currency = order.currency || (seller?.country === 'india' ? 'INR' : 'USD');
  const isIndia = currency === 'INR';

  // Update order with deposit/balance amounts
  await supabase
    .from('orders')
    .update({
      deposit_amount: depositAmount,
      balance_amount: order.total - depositAmount,
    })
    .eq('id', order_id);

  // Generate payment link based on country
  if (isIndia) {
    // Razorpay for India
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      // Fallback: return UPI deep link if seller has UPI
      if (seller?.upi_id) {
        const upiLink = `upi://pay?pa=${seller.upi_id}&pn=${encodeURIComponent(seller.business_name)}&am=${depositAmount}&cu=INR&tn=${encodeURIComponent(`Deposit for order ${order.order_number}`)}`;
        return NextResponse.json({
          payment_url: upiLink,
          payment_method: 'upi',
          deposit_amount: depositAmount,
          balance_amount: order.total - depositAmount,
          total: order.total,
          currency,
        });
      }
      return NextResponse.json({ error: 'Payment not configured. Please pay via cash.' }, { status: 500 });
    }

    const rzpRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(depositAmount * 100),
        currency: 'INR',
        description: `Deposit for order ${order.order_number} from ${seller.business_name}`,
        notes: { order_id, seller_id: order.seller_id, is_deposit: 'true' },
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://klovi.com'}/orders/${order_id}?success=true`,
        callback_method: 'get',
      }),
    });

    if (!rzpRes.ok) {
      return NextResponse.json({ error: 'Failed to create payment link' }, { status: 502 });
    }

    const rzpLink = await rzpRes.json();

    await supabase
      .from('orders')
      .update({ razorpay_order_id: rzpLink.id, payment_method: 'razorpay' })
      .eq('id', order_id);

    return NextResponse.json({
      payment_url: rzpLink.short_url,
      payment_method: 'razorpay',
      deposit_amount: depositAmount,
      balance_amount: order.total - depositAmount,
      total: order.total,
      currency,
    });
  } else {
    // Stripe for USA/other
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
          product_data: { name: `Deposit — ${seller.business_name} Order ${order.order_number}` },
          unit_amount: Math.round(depositAmount * 100),
        },
        quantity: 1,
      }],
      metadata: { order_id, seller_id: order.seller_id, is_deposit: 'true' },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://klovi.com'}/orders/${order_id}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://klovi.com'}/orders/${order_id}?cancelled=true`,
    });

    await supabase
      .from('orders')
      .update({ stripe_payment_intent_id: session.id, payment_method: 'stripe' })
      .eq('id', order_id);

    return NextResponse.json({
      payment_url: session.url,
      payment_method: 'stripe',
      deposit_amount: depositAmount,
      balance_amount: order.total - depositAmount,
      total: order.total,
      currency,
    });
  }
}
