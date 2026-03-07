import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Razorpay Webhook - handles payment events
// ---------------------------------------------------------------------------

/**
 * Verify the Razorpay webhook signature.
 * Razorpay signs the raw body with HMAC-SHA256 using the webhook secret
 * and sends the hex digest in `x-razorpay-signature`.
 */
function verifyRazorpaySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // --- Signature verification ------------------------------------------------
  const razorpaySecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!razorpaySecret) {
    console.error('Razorpay webhook: RAZORPAY_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const signature = request.headers.get('x-razorpay-signature');
  if (!verifyRazorpaySignature(rawBody, signature, razorpaySecret)) {
    console.error('Razorpay webhook: invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // --- Parse payload ---------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = body.event as string | undefined;
  const payloadWrapper = body.payload as Record<string, unknown> | undefined;
  const paymentEntity = (payloadWrapper?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;

  if (!paymentEntity) {
    // Non-payment event -- acknowledge
    return NextResponse.json({ status: 'ok' });
  }

  const notes = paymentEntity.notes as Record<string, string> | undefined;
  const orderId = notes?.order_id;
  const sellerId = notes?.seller_id;
  const isDeposit = notes?.is_deposit === 'true';
  const razorpayPaymentId = paymentEntity.id as string | undefined;
  const amount = paymentEntity.amount as number | undefined; // in paise
  const errorDescription = (paymentEntity.error_description as string) || 'Payment failed';

  const supabase = createServiceRoleClient();

  try {
    switch (eventType) {
      // ----- payment.captured ------------------------------------------------
      case 'payment.captured': {
        if (!orderId) {
          console.warn('Razorpay webhook: payment.captured without order_id in notes');
          break;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: isDeposit ? 'deposit_paid' : 'confirmed',
            payment_status: isDeposit ? 'deposit_paid' : 'paid',
            payment_provider: 'razorpay',
            payment_id: razorpayPaymentId,
            payment_amount: amount ? amount / 100 : undefined, // convert paise to rupees
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Razorpay webhook: failed to update order', orderId, updateError);
        } else {
          console.log(`Razorpay webhook: order ${orderId} confirmed (payment.captured)`);
        }

        // Notify seller
        if (sellerId) {
          await supabase.from('notifications').insert({
            seller_id: sellerId,
            type: 'order_paid',
            title: 'Payment received',
            body: `Order ${orderId} has been paid via Razorpay.`,
            metadata: { order_id: orderId, event_type: eventType, payment_id: razorpayPaymentId },
          }).then(({ error }) => {
            if (error) console.error('Razorpay webhook: notification insert error', error);
          });
        }
        break;
      }

      // ----- payment.failed --------------------------------------------------
      case 'payment.failed': {
        if (!orderId) {
          console.warn('Razorpay webhook: payment.failed without order_id in notes');
          break;
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            payment_error: errorDescription,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Razorpay webhook: failed to update order', orderId, updateError);
        }

        // Notify seller about failure
        if (sellerId) {
          await supabase.from('notifications').insert({
            seller_id: sellerId,
            type: 'payment_failed',
            title: 'Payment failed',
            body: `Payment for order ${orderId} failed: ${errorDescription}`,
            metadata: { order_id: orderId, event_type: eventType, error: errorDescription },
          }).then(({ error }) => {
            if (error) console.error('Razorpay webhook: notification insert error', error);
          });
        }

        console.warn(`Razorpay webhook: order ${orderId} payment failed - ${errorDescription}`);
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
  }
}
