import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Send a message to a customer via Gupshup (WhatsApp) or Telnyx (SMS).
 * Also saves the message to the DB using service role (bypasses RLS).
 *
 * POST /api/send-message
 * Body: { to, message, channel, conversation_id?, seller_id? }
 */
export async function POST(request: Request) {
  const { to, message, channel, conversation_id, seller_id } = await request.json();

  if (!to || !message) {
    return NextResponse.json({ error: 'Missing to or message' }, { status: 400 });
  }

  try {
    // Save message to DB using service role (bypasses RLS)
    if (conversation_id && seller_id) {
      const supabase = createServiceRoleClient();
      await supabase.from('messages').insert({
        conversation_id,
        seller_id,
        direction: 'outbound',
        role: 'seller',
        sender_type: 'seller',
        body: message,
        content: message,
        channel,
        status: 'sent',
        created_at: new Date().toISOString(),
      });

      // Update conversation
      await supabase
        .from('conversations')
        .update({
          last_message: message,
          last_message_at: new Date().toISOString(),
          needs_seller_attention: false,
        })
        .eq('id', conversation_id);
    }

    if (channel === 'sms') {
      const apiKey = process.env.TELNYX_API_KEY;
      const profileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
      if (!apiKey || !profileId) {
        return NextResponse.json({ error: 'SMS not configured' }, { status: 500 });
      }

      await fetch('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: profileId, to, text: message }),
      });
    } else {
      const apiKey = process.env.GUPSHUP_API_KEY;
      const sourceNumber = process.env.GUPSHUP_WHATSAPP_NUMBER;
      if (!apiKey || !sourceNumber) {
        return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 });
      }

      const params = new URLSearchParams({
        channel: 'whatsapp',
        source: sourceNumber,
        destination: to.replace(/\D/g, ''),
        'src.name': process.env.GUPSHUP_APP_NAME || 'KloviApp',
        'message': JSON.stringify({ type: 'text', text: message }),
      });

      const res = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error('Gupshup send error:', errBody);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 502 });
      }
    }

    return NextResponse.json({ status: 'sent' });
  } catch (error) {
    console.error('send-message error:', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
