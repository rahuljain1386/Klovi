import { NextResponse } from 'next/server';

/**
 * Debug: Test Gupshup WhatsApp API connectivity
 * GET /api/debug/gupshup-test?phone=919999999999  (dry run, shows config)
 * GET /api/debug/gupshup-test?phone=917698154300&send=true  (actually sends a test message)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone') || '';
  const send = searchParams.get('send') === 'true';

  const config = {
    GUPSHUP_API_KEY: process.env.GUPSHUP_API_KEY ? `SET (${process.env.GUPSHUP_API_KEY.substring(0, 8)}...)` : 'MISSING',
    GUPSHUP_WHATSAPP_NUMBER: process.env.GUPSHUP_WHATSAPP_NUMBER || 'MISSING',
    GUPSHUP_APP_NAME: process.env.GUPSHUP_APP_NAME || 'MISSING',
  };

  if (!send) {
    return NextResponse.json({
      config,
      usage: 'Add &send=true&phone=91XXXXXXXXXX to actually send a test message',
    });
  }

  if (!phone) {
    return NextResponse.json({ error: 'phone parameter required (e.g. phone=917698154300)', config });
  }

  const apiKey = process.env.GUPSHUP_API_KEY;
  const sourceNumber = process.env.GUPSHUP_WHATSAPP_NUMBER;
  const appName = process.env.GUPSHUP_APP_NAME || 'KloviApp';

  if (!apiKey || !sourceNumber) {
    return NextResponse.json({ error: 'GUPSHUP_API_KEY or GUPSHUP_WHATSAPP_NUMBER not set', config });
  }

  // Try sending a test message
  const testMessage = `Hello from Klovi! This is a test message to verify WhatsApp connectivity. Time: ${new Date().toISOString()}`;

  const params = new URLSearchParams({
    channel: 'whatsapp',
    source: sourceNumber,
    destination: phone.replace(/\D/g, ''),
    'src.name': appName,
    'message': JSON.stringify({ type: 'text', text: testMessage }),
  });

  try {
    const res = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const responseText = await res.text();
    let responseJson: unknown = null;
    try { responseJson = JSON.parse(responseText); } catch {}

    return NextResponse.json({
      config,
      send_attempt: {
        to: phone,
        from: sourceNumber,
        app_name: appName,
        http_status: res.status,
        response: responseJson || responseText,
        success: res.ok,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      config,
      send_attempt: {
        error: err.message,
        to: phone,
        from: sourceNumber,
      },
    });
  }
}
