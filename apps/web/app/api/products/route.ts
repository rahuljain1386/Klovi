import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get('seller_id');

  if (sellerId) {
    // Public product listing for a seller
    const { data: products } = await supabase
      .from('products')
      .select('id, name, description, price, currency, image_url, variants, is_available, category')
      .eq('seller_id', sellerId)
      .eq('is_available', true)
      .order('sort_order');

    return NextResponse.json({ products: products || [] });
  }

  // Authenticated seller viewing their own products
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', seller.id)
    .order('sort_order');

  return NextResponse.json({ products: products || [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const body = await request.json();
  const { name, description, price, currency, image_url, variants, category, track_stock, stock_quantity } = body;

  if (!name || !price) {
    return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
  }

  // Get max sort order
  const { data: lastProduct } = await supabase
    .from('products')
    .select('sort_order')
    .eq('seller_id', seller.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      seller_id: seller.id,
      name,
      description: description || null,
      price,
      currency: currency || 'USD',
      image_url: image_url || null,
      variants: variants || [],
      category: category || null,
      track_stock: track_stock || false,
      stock_quantity: track_stock ? (stock_quantity || 0) : null,
      is_available: true,
      sort_order: (lastProduct?.sort_order || 0) + 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }

  return NextResponse.json({ product });
}
