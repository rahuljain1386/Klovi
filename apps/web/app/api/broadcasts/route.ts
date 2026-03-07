import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ broadcasts: broadcasts || [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, plan')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
  if (seller.plan === 'free') {
    return NextResponse.json({ error: 'Broadcasts require Growth or Pro plan' }, { status: 403 });
  }

  const body = await request.json();
  const { title, message, media_url, segments, channels, scheduled_at } = body;

  if (!title || !message || !segments?.length || !channels?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Count recipients based on segments
  let query = supabase
    .from('customers')
    .select('id', { count: 'exact' })
    .eq('seller_id', seller.id);

  if (!segments.includes('all')) {
    query = query.in('segment', segments);
  }

  const { count: recipientCount } = await query;

  const { data: broadcast, error } = await supabase
    .from('broadcasts')
    .insert({
      seller_id: seller.id,
      title,
      message,
      media_url: media_url || null,
      segments,
      channels,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      total_recipients: recipientCount || 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 });
  }

  return NextResponse.json({ broadcast });
}
