import { NextResponse } from 'next/server';

/**
 * Send a message to a customer via Gupshup (WhatsApp) or Telnyx (SMS).
 * Called from the seller dashboard inbox when a seller replies manually.
 *
 * POST /api/send-message
 * Body: { to: string, message: string, channel: 'whatsapp' | 'sms' }
 */
export async function POST(request: Request) {
  const { to, message, channel } = await request.json();

  if (!to || !message) {
    return NextResponse.json({ error: 'Missing to or message' }, { status: 400 });
  }

  try {
    if (channel === 'sms') {
      // Send via Telnyx
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
      // Send via Gupshup (WhatsApp / Instagram / Facebook)
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
