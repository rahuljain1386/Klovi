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

  const { searchParams } = new URL(request.url);
  const segment = searchParams.get('segment');

  let query = supabase
    .from('customers')
    .select('*')
    .eq('seller_id', seller.id)
    .order('last_order_at', { ascending: false });

  if (segment && segment !== 'all') {
    query = query.eq('segment', segment);
  }

  const { data: customers } = await query;
  return NextResponse.json({ customers: customers || [] });
}
