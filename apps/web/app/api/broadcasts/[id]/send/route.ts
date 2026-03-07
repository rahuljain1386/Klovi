import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { data: broadcast } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('id', params.id)
    .eq('seller_id', seller.id)
    .single();

  if (!broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
  if (broadcast.status === 'sent' || broadcast.status === 'sending') {
    return NextResponse.json({ error: 'Broadcast already sent or in progress' }, { status: 400 });
  }

  // Mark as sending
  await supabase
    .from('broadcasts')
    .update({ status: 'sending' })
    .eq('id', broadcast.id);

  // Get recipients
  let query = supabase
    .from('customers')
    .select('id, name, phone, whatsapp_id, instagram_id, segment')
    .eq('seller_id', seller.id);

  if (!broadcast.segments.includes('all')) {
    query = query.in('segment', broadcast.segments);
  }

  const { data: customers } = await query;

  let delivered = 0;

  for (const customer of customers || []) {
    try {
      // Send via each selected channel
      for (const channel of broadcast.channels) {
        if (channel === 'whatsapp' && customer.whatsapp_id) {
          await sendWhatsApp(customer.whatsapp_id, broadcast.message, broadcast.media_url);
          delivered++;
          break; // One delivery per customer
        }
        if (channel === 'sms' && customer.phone) {
          await sendSMS(customer.phone, broadcast.message);
          delivered++;
          break;
        }
      }
    } catch {
      // Continue with next customer on failure
    }
  }

  // Update broadcast stats
  await supabase
    .from('broadcasts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      delivered,
    })
    .eq('id', broadcast.id);

  return NextResponse.json({ delivered, total: customers?.length || 0 });
}

async function sendWhatsApp(to: string, message: string, mediaUrl?: string | null) {
  const apiKey = process.env.GUPSHUP_API_KEY;
  const appName = process.env.GUPSHUP_APP_NAME;
  if (!apiKey || !appName) return;

  const body = new URLSearchParams({
    channel: 'whatsapp',
    source: appName,
    destination: to,
    'src.name': appName,
    message: JSON.stringify(
      mediaUrl
        ? { type: 'image', originalUrl: mediaUrl, caption: message }
        : { type: 'text', text: message }
    ),
  });

  await fetch('https://api.gupshup.io/wa/api/v1/msg', {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
}

async function sendSMS(to: string, message: string) {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) return;

  await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.TELNYX_MESSAGING_PROFILE_ID,
      to,
      text: message,
    }),
  });
}
