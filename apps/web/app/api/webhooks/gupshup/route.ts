import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Gupshup Webhook - receives WhatsApp / Instagram / Facebook messages
// All messages come to Klovi's single WhatsApp number (918854054503).
// Seller routing: extract slug from message text (klovi/seller-slug).
// ---------------------------------------------------------------------------

// GET handler for Gupshup webhook URL validation
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

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

function resolveChannel(type: string | undefined): string {
  if (!type) return 'whatsapp';
  const t = type.toLowerCase();
  if (t.includes('instagram')) return 'instagram';
  if (t.includes('facebook') || t.includes('fb')) return 'facebook';
  return 'whatsapp';
}

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

/**
 * Extract seller slug from message text.
 * Looks for patterns like:
 * - "klovi/renu-stitching"
 * - "(klovi/renu-stitching)"
 * - "from *Renu Stitching* (klovi/renu-stitching)"
 */
function extractSlug(text: string): string | null {
  // Match kloviapp.com/slug-name (new format, natural URL in message)
  const urlMatch = text.match(/kloviapp\.com\/([a-z0-9-]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  // Fallback: klovi/slug-name (old format)
  const legacyMatch = text.match(/klovi\/([a-z0-9-]+)/i);
  return legacyMatch ? legacyMatch[1].toLowerCase() : null;
}

/**
 * Extract business name from message text as fallback.
 * Looks for: "from *Business Name*" or "ordering from *Business Name*"
 */
function extractBusinessName(text: string): string | null {
  const match = text.match(/from\s+\*([^*]+)\*/i);
  return match ? match[1].trim() : null;
}

/**
 * Send a reply to a customer via Gupshup WhatsApp.
 */
async function sendGupshupReply(destination: string, message: string) {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const sourceNumber = process.env.GUPSHUP_WHATSAPP_NUMBER;
  if (!apiKey || !sourceNumber) return;

  const params = new URLSearchParams({
    channel: 'whatsapp',
    source: sourceNumber,
    destination: destination.replace(/\D/g, ''),
    'src.name': process.env.GUPSHUP_APP_NAME || 'KloviApp',
    'message': JSON.stringify({ type: 'text', text: message }),
  });

  await fetch('https://api.gupshup.io/wa/api/v1/msg', {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  }).catch(err => console.error('sendGupshupReply error:', err));
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // --- Log incoming webhook for debugging ------------------------------------
  try {
    const logSupabase = createServiceRoleClient();
    await logSupabase.from('webhook_logs').insert({
      source: 'gupshup',
      payload: rawBody.substring(0, 4000),
      headers: JSON.stringify({
        'content-type': request.headers.get('content-type'),
        'x-gupshup-signature': request.headers.get('x-gupshup-signature'),
        'user-agent': request.headers.get('user-agent'),
      }),
      created_at: new Date().toISOString(),
    });
  } catch {
    // Logging should never block the webhook — table may not exist yet
  }

  // --- Signature verification ------------------------------------------------
  // Log for debugging but don't block — Gupshup v2 signing varies
  const gupshupApiKey = process.env.GUPSHUP_API_KEY;
  const signature = request.headers.get('x-gupshup-signature');
  if (gupshupApiKey && signature) {
    const sigValid = verifyGupshupSignature(rawBody, signature, gupshupApiKey);
    if (!sigValid) {
      console.warn('Gupshup webhook: signature mismatch (proceeding anyway)');
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
    const outerPayload = body.payload as Record<string, unknown> | undefined;
    if (!outerPayload) {
      return NextResponse.json({ status: 'ok' });
    }

    const messageType = outerPayload.type as string | undefined;
    const messageId = outerPayload.id as string | undefined;
    const source = outerPayload.source as string | undefined;
    const destination = outerPayload.destination as string | undefined;

    const innerPayload = outerPayload.payload as Record<string, unknown> | undefined;
    const text = (innerPayload?.text as string) || '';
    const mediaUrl = extractMediaUrl(innerPayload);
    const channel = resolveChannel(messageType);

    if (!source) {
      console.warn('Gupshup webhook: no source in payload, skipping');
      return NextResponse.json({ status: 'ok' });
    }

    const supabase = createServiceRoleClient();

    // --- Route to seller: extract slug from message text ---------------------
    let seller: { id: string; business_name: string; phone: string | null } | null = null;

    // Method 1: Extract slug from message (e.g., "klovi/renu-stitching")
    const slug = extractSlug(text);
    if (slug) {
      const { data } = await supabase
        .from('sellers')
        .select('id, business_name, phone')
        .eq('slug', slug)
        .eq('status', 'active')
        .single();
      seller = data;
    }

    // Method 2: Extract business name — only use if EXACTLY 1 match
    if (!seller) {
      const bizName = extractBusinessName(text);
      if (bizName) {
        const { data: matches } = await supabase
          .from('sellers')
          .select('id, business_name, phone')
          .ilike('business_name', `%${bizName}%`)
          .eq('status', 'active')
          .limit(5);

        if (matches?.length === 1) {
          seller = matches[0];
        } else if (matches && matches.length > 1) {
          // Ambiguous — ask customer to clarify
          const options = matches.map((s, i) => `${i + 1}. ${s.business_name}`).join('\n');
          const clarifyMsg = `Hi! I found multiple sellers matching that name:\n\n${options}\n\nPlease reply with the number to connect you. 🙏`;
          await sendGupshupReply(source!, clarifyMsg);

          // Save as unrouted conversation for owner to see (table may not exist yet)
          try {
            await supabase.from('unrouted_messages').insert({
              from_phone: source, message_text: text, reason: 'ambiguous_match',
              candidate_sellers: matches.map(s => ({ id: s.id, name: s.business_name })),
              channel, created_at: new Date().toISOString(),
            });
          } catch {}

          return NextResponse.json({ status: 'ok' });
        }
      }
    }

    // Method 3: Check if this customer has an existing conversation with a seller
    if (!seller) {
      const normalizedSource = (source || '').replace(/^\+/, '');
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('seller_id')
        .or(`phone.eq.${normalizedSource},phone.eq.+${normalizedSource}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCustomer) {
        const { data } = await supabase
          .from('sellers')
          .select('id, business_name, phone')
          .eq('id', existingCustomer.seller_id)
          .single();
        seller = data;
      }
    }

    // Unrouted — save for owner to manually assign
    if (!seller) {
      console.warn(`Gupshup webhook: unrouted message from ${source}: "${text.substring(0, 100)}"`);

      // Send a helpful reply
      const helpMsg = `Hi! Welcome to Klovi 🙏\n\nI couldn't find which seller you're looking for. Could you share the store link or name?\n\nOr browse sellers at kloviapp.com`;
      await sendGupshupReply(source!, helpMsg);

      // Save unrouted message for owner dashboard (table may not exist yet)
      try {
        await supabase.from('unrouted_messages').insert({
          from_phone: source, message_text: text, reason: 'no_match',
          channel, created_at: new Date().toISOString(),
        });
      } catch {}

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
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Gupshup webhook error:', error);
    return NextResponse.json({ status: 'ok' });
  }
}
