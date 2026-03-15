import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verify the user is authenticated
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { sellerId, products } = body;

  if (!sellerId || !Array.isArray(products) || products.length === 0) {
    return NextResponse.json(
      { error: 'sellerId and products[] required', sellerId, productCount: products?.length },
      { status: 400 }
    );
  }

  // Verify this seller belongs to the authenticated user
  const supabase = createServiceRoleClient();
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

  // Delete existing products for this seller (clean slate on re-onboard)
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('seller_id', sellerId);

  if (deleteError) {
    console.error('[save-products] Delete error:', deleteError.message);
  }

  // Insert new products using service role (bypasses RLS)
  const inserts = products.map((p: any, i: number) => ({
    seller_id: sellerId,
    name: p.name,
    description: p.description || null,
    price: p.price || 0,
    category: p.category || null,
    currency: p.currency || 'INR',
    sort_order: i,
    variants: p.variants || null,
    images: p.images || null,
    status: 'active',
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('products')
    .insert(inserts)
    .select('id, name');

  if (insertError) {
    console.error('[save-products] Insert error:', insertError.message, '| code:', insertError.code, '| details:', insertError.details);
    return NextResponse.json(
      { error: insertError.message, code: insertError.code, details: insertError.details },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    count: inserted?.length || 0,
    products: inserted,
  });
}
