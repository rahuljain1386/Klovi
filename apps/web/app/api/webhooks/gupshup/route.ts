import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Gupshup Webhook - receives WhatsApp / Instagram / Facebook messages
// ---------------------------------------------------------------------------

/**
 * Validate the Gupshup webhook signature.
 * Gupshup signs the raw body with HMAC-SHA512 using the API key and sends it
 * in the `x-gupshup-signature` header.
 */
function verifyGupshupSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex'),
  );
}

/**
 * Determine the messaging channel from the Gupshup payload type field.
 */
function resolveChannel(type: string | undefined): string {
  if (!type) return 'whatsapp';
  const t = type.toLowerCase();
  if (t.includes('instagram')) return 'instagram';
  if (t.includes('facebook') || t.includes('fb')) return 'facebook';
  return 'whatsapp';
}

/**
 * Extract a media URL from the Gupshup message payload if present.
 */
function extractMediaUrl(
  innerPayload: Record<string, unknown> | undefined,
): string | null {
  if (!innerPayload) return null;
  const msgType = (innerPayload.type as string) || '';
  if (['image', 'video', 'audio', 'file', 'document', 'sticker'].includes(msgType)) {
    return (innerPayload.url as string) || (innerPayload.originalUrl as string) || null;
  }
  return null;
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // --- Signature verification ------------------------------------------------
  const gupshupApiKey = process.env.GUPSHUP_API_KEY;
  if (gupshupApiKey) {
    const signature = request.headers.get('x-gupshup-signature');
    if (!verifyGupshupSignature(rawBody, signature, gupshupApiKey)) {
      console.error('Gupshup webhook: invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // --- Parse payload ---------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    // Gupshup sends: { app, payload: { type, id, source, payload: { text, type } } }
    const outerPayload = body.payload as Record<string, unknown> | undefined;
    if (!outerPayload) {
      // Could be a status callback (message-event) -- acknowledge and ignore
      return NextResponse.json({ status: 'ok' });
    }

    const messageType = outerPayload.type as string | undefined;
    const messageId = outerPayload.id as string | undefined;
    const source = outerPayload.source as string | undefined; // sender phone/id
    const destination = outerPayload.destination as string | undefined; // seller phone

    // The inner payload contains the actual message content
    const innerPayload = outerPayload.payload as Record<string, unknown> | undefined;
    const text = (innerPayload?.text as string) || '';
    const mediaUrl = extractMediaUrl(innerPayload);
    const channel = resolveChannel(messageType);

    if (!source) {
      console.warn('Gupshup webhook: no source in payload, skipping');
      return NextResponse.json({ status: 'ok' });
    }

    // --- Look up seller by connected phone number ----------------------------
    const supabase = createServiceRoleClient();

    // Normalize phone: strip leading '+' for matching
    const normalizedDestination = (destination || '').replace(/^\+/, '');

    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('id, business_name, phone')
      .or(`phone.eq.${normalizedDestination},phone.eq.+${normalizedDestination}`)
      .limit(1)
      .maybeSingle();

    if (sellerError) {
      console.error('Gupshup webhook: seller lookup error', sellerError);
      return NextResponse.json({ status: 'ok' }); // still 200 to prevent retries
    }

    if (!seller) {
      console.warn(`Gupshup webhook: no seller found for destination ${destination}`);
      return NextResponse.json({ status: 'ok' });
    }

    // --- Forward to Supabase edge function -----------------------------------
    const { error: fnError } = await supabase.functions.invoke('handle-message', {
      body: {
        channel,
        from: source,
        to: destination,
        body: text,
        media_url: mediaUrl,
        message_id: messageId,
        seller_id: seller.id,
        provider: 'gupshup',
        raw: body,
      },
    });

    if (fnError) {
      console.error('Gupshup webhook: handle-message invocation error', fnError);
      // Still return 200 so Gupshup doesn't retry aggressively
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Gupshup webhook error:', error);
    // Return 200 to avoid Gupshup retry storms; the error is logged for debugging
    return NextResponse.json({ status: 'ok' });
  }
}
