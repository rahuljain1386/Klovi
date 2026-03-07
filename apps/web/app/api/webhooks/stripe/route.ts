import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Stripe Webhook - handles payment events
// ---------------------------------------------------------------------------

/**
 * Verify the Stripe webhook signature.
 * Stripe uses HMAC-SHA256: it signs "timestamp.rawBody" with the webhook secret
 * and sends the signature in the `stripe-signature` header.
 *
 * Header format: t=<timestamp>,v1=<signature>[,v0=<legacy_signature>]
 */
function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): { valid: boolean; timestamp?: number } {
  if (!signatureHeader) return { valid: false };

  const parts = signatureHeader.split(',');
  const timestampStr = parts.find((p) => p.startsWith('t='))?.slice(2);
  const signatures = parts
    .filter((p) => p.startsWith('v1='))
    .map((p) => p.slice(3));

  if (!timestampStr || signatures.length === 0) return { valid: false };

  const timestamp = Number(timestampStr);

  // Reject timestamps older than 5 minutes
  const tolerance = 300; // seconds
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    console.warn('Stripe webhook: timestamp outside tolerance', {
      eventTimestamp: timestamp,
      serverTime: now,
    });
    return { valid: false };
  }

  const signedPayload = `${timestampStr}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const isValid = signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(sig, 'hex'),
      );
    } catch {
      return false;
    }
  });

  return { valid: isValid, timestamp };
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // --- Signature verification ------------------------------------------------
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret) {
    console.error('Stripe webhook: STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const signatureHeader = request.headers.get('stripe-signature');
  const { valid } = verifyStripeSignature(rawBody, signatureHeader, stripeSecret);

  if (!valid) {
    console.error('Stripe webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // --- Parse event -----------------------------------------------------------
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.type as string;
  const dataObject = (event.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined;

  if (!dataObject) {
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (eventType) {
      // ----- checkout.session.completed ------------------------------------
      case 'checkout.session.completed': {
        const metadata = dataObject.metadata as Record<string, string> | undefined;
        const orderId = metadata?.order_id;
        const sellerId = metadata?.seller_id;

        if (!orderId) {
          console.warn('Stripe webhook: checkout.session.completed without order_id');
          break;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            payment_provider: 'stripe',
            payment_id: dataObject.payment_intent as string || dataObject.id as string,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Stripe webhook: failed to update order', orderId, updateError);
        } else {
          console.log(`Stripe webhook: order ${orderId} confirmed (checkout.session.completed)`);
        }

        // Notify the seller about the new paid order
        if (sellerId) {
          await supabase.from('notifications').insert({
            seller_id: sellerId,
            type: 'order_paid',
            title: 'Payment received',
            body: `Order ${orderId} has been paid via Stripe.`,
            metadata: { order_id: orderId, event_type: eventType },
          }).then(({ error }) => {
            if (error) console.error('Stripe webhook: notification insert error', error);
          });
        }
        break;
      }

      // ----- payment_intent.succeeded --------------------------------------
      case 'payment_intent.succeeded': {
        const metadata = dataObject.metadata as Record<string, string> | undefined;
        const orderId = metadata?.order_id;
        const sellerId = metadata?.seller_id;
        const isDeposit = metadata?.is_deposit === 'true';

        if (!orderId) {
          console.warn('Stripe webhook: payment_intent.succeeded without order_id');
          break;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: isDeposit ? 'deposit_paid' : 'confirmed',
            payment_status: isDeposit ? 'deposit_paid' : 'paid',
            payment_provider: 'stripe',
            payment_id: dataObject.id as string,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Stripe webhook: failed to update order', orderId, updateError);
        } else {
          console.log(`Stripe webhook: order ${orderId} payment succeeded`);
        }
        break;
      }

      // ----- payment_intent.payment_failed ---------------------------------
      case 'payment_intent.payment_failed': {
        const metadata = dataObject.metadata as Record<string, string> | undefined;
        const orderId = metadata?.order_id;
        const sellerId = metadata?.seller_id;
        const lastError = dataObject.last_payment_error as Record<string, unknown> | undefined;
        const failureMessage = (lastError?.message as string) || 'Payment failed';

        if (!orderId) {
          console.warn('Stripe webhook: payment_intent.payment_failed without order_id');
          break;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            payment_error: failureMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Stripe webhook: failed to update order', orderId, updateError);
        }

        // Notify seller about the failed payment
        if (sellerId) {
          await supabase.from('notifications').insert({
            seller_id: sellerId,
            type: 'payment_failed',
            title: 'Payment failed',
            body: `Payment for order ${orderId} failed: ${failureMessage}`,
            metadata: { order_id: orderId, event_type: eventType, failure_message: failureMessage },
          }).then(({ error }) => {
            if (error) console.error('Stripe webhook: notification insert error', error);
          });
        }

        console.warn(`Stripe webhook: order ${orderId} payment failed - ${failureMessage}`);
        break;
      }

      default:
        // Unhandled event type -- acknowledge silently
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
