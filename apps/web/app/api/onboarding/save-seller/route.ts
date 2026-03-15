import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sellerId, updates } = body;

  if (!updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'updates object required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Creating new seller
  if (!sellerId) {
    const { data: newSeller, error: insertErr } = await supabase
      .from('sellers')
      .insert({ user_id: user.id, ...updates })
      .select('id, slug')
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: `Insert failed: ${insertErr.message}`, code: insertErr.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, seller: newSeller });
  }

  // Updating existing seller — verify ownership
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, user_id')
    .eq('id', sellerId)
    .single();

  if (!seller || seller.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Seller not found or not owned by user', sellerId, userId: user.id },
      { status: 403 }
    );
  }

  const { data: updated, error: updateErr } = await supabase
    .from('sellers')
    .update(updates)
    .eq('id', sellerId)
    .select('id, slug, business_name')
    .single();

  if (updateErr) {
    return NextResponse.json(
      { error: `Update failed: ${updateErr.message}`, code: updateErr.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, seller: updated });
}
