import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Instagram Graph API Webhook
// Handles verification (GET) and incoming DMs (POST)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new Response(challenge || '', { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Log to webhook_logs for debugging
  try {
    const supabase = createServiceRoleClient();
    await supabase.from('webhook_logs').insert({
      source: 'instagram',
      payload: rawBody.substring(0, 4000),
      headers: JSON.stringify({
        'content-type': request.headers.get('content-type'),
        'x-hub-signature-256': request.headers.get('x-hub-signature-256'),
        'user-agent': request.headers.get('user-agent'),
      }),
      created_at: new Date().toISOString(),
    });
  } catch {
    // Logging should never block the webhook
  }

  // Parse and process messaging events
  try {
    const body = JSON.parse(rawBody);
    const entries = body.entry || [];

    for (const entry of entries) {
      const messaging = entry.messaging || [];
      for (const event of messaging) {
        const senderId = event.sender?.id;
        const messageText = event.message?.text;
        const timestamp = event.timestamp;

        console.log('[Instagram webhook] Message:', {
          senderId,
          messageText: messageText?.substring(0, 200),
          timestamp,
          hasAttachments: !!event.message?.attachments?.length,
        });
      }
    }
  } catch (err) {
    console.error('[Instagram webhook] Parse error:', err);
  }

  return NextResponse.json({ status: 'ok' });
}
