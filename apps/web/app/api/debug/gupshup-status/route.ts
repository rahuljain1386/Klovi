import { NextResponse } from 'next/server';

/**
 * Debug: Check Gupshup message delivery status and account health.
 * GET /api/debug/gupshup-status?msgId=xxx  (check specific message)
 * GET /api/debug/gupshup-status  (check account/app health)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const msgId = searchParams.get('msgId');
  const apiKey = process.env.GUPSHUP_API_KEY;
  const appName = process.env.GUPSHUP_APP_NAME || 'KloviApp';

  if (!apiKey) {
    return NextResponse.json({ error: 'GUPSHUP_API_KEY not set' });
  }

  const results: Record<string, unknown> = {};

  // Check app/wallet health
  try {
    const walletRes = await fetch(`https://api.gupshup.io/wa/app/${appName}`, {
      headers: { 'apikey': apiKey },
    });
    const walletText = await walletRes.text();
    let walletJson: unknown = null;
    try { walletJson = JSON.parse(walletText); } catch {}
    results.app_info = {
      http_status: walletRes.status,
      response: walletJson || walletText,
    };
  } catch (e: any) {
    results.app_info = { error: e.message };
  }

  // Check template list (to see if account is active)
  try {
    const tplRes = await fetch(`https://api.gupshup.io/wa/app/${appName}/template`, {
      headers: { 'apikey': apiKey },
    });
    const tplText = await tplRes.text();
    let tplJson: unknown = null;
    try { tplJson = JSON.parse(tplText); } catch {}
    results.templates = {
      http_status: tplRes.status,
      response: tplJson || tplText,
    };
  } catch (e: any) {
    results.templates = { error: e.message };
  }

  // Check wallet balance
  try {
    const balRes = await fetch('https://api.gupshup.io/wa/wallet/balance', {
      headers: { 'apikey': apiKey },
    });
    const balText = await balRes.text();
    let balJson: unknown = null;
    try { balJson = JSON.parse(balText); } catch {}
    results.wallet_balance = {
      http_status: balRes.status,
      response: balJson || balText,
    };
  } catch (e: any) {
    results.wallet_balance = { error: e.message };
  }

  // Check specific message status if provided
  if (msgId) {
    try {
      const statusRes = await fetch(`https://api.gupshup.io/wa/msg/${msgId}/status`, {
        headers: { 'apikey': apiKey },
      });
      const statusText = await statusRes.text();
      let statusJson: unknown = null;
      try { statusJson = JSON.parse(statusText); } catch {}
      results.message_status = {
        msgId,
        http_status: statusRes.status,
        response: statusJson || statusText,
      };
    } catch (e: any) {
      results.message_status = { error: e.message };
    }
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
