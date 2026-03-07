import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.data?.event_type === 'message.received') {
      // TODO: Process incoming SMS/MMS
      // 1. Find customer by phone
      // 2. Find or create conversation
      // 3. Save message
      // 4. Run AI reply logic
    }
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Telnyx webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
