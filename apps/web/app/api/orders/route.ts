import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET: Fetch orders for authenticated seller
export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('orders')
    .select('*, customer:customers(name, phone)')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: orders } = await query;
  return NextResponse.json({ orders: orders || [] });
}

// POST: Create a new order (from booking page or AI messaging)
export async function POST(request: Request) {
  const supabase = createServerClient();
  const body = await request.json();
  const { seller_id, customer_name, customer_phone, items, fulfillment_type, delivery_address, scheduled_date, scheduled_time, payment_method, notes } = body;

  if (!seller_id || !items?.length) {
    return NextResponse.json({ error: 'Seller ID and items required' }, { status: 400 });
  }

  // Get seller info for currency
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, country')
    .eq('id', seller_id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const currency = seller.country === 'india' ? 'INR' : 'USD';

  // Find or create customer
  let customerId: string | null = null;
  if (customer_phone) {
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('seller_id', seller_id)
      .eq('phone', customer_phone)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          seller_id,
          name: customer_name || 'Customer',
          phone: customer_phone,
          channel: 'web',
          segment: 'new',
        })
        .select('id')
        .single();

      customerId = newCustomer?.id || null;
    }
  }

  // Calculate total from product prices
  const productIds = items.map((i: any) => i.product_id);
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', productIds);

  const priceMap = new Map(products?.map((p) => [p.id, p]) || []);
  let total = 0;
  const orderItems = items.map((item: any) => {
    const product = priceMap.get(item.product_id);
    const price = product?.price || item.price || 0;
    total += price * item.quantity;
    return {
      product_id: item.product_id,
      product_name: product?.name || item.product_name,
      quantity: item.quantity,
      price,
      variant: item.variant || null,
    };
  });

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      seller_id,
      customer_id: customerId,
      items: orderItems,
      total,
      currency,
      status: 'placed',
      payment_method: payment_method || 'cod',
      payment_status: payment_method === 'cod' ? 'pending' : 'pending',
      fulfillment_type: fulfillment_type || 'pickup',
      delivery_address: delivery_address || null,
      scheduled_date: scheduled_date || null,
      scheduled_time: scheduled_time || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  return NextResponse.json({ order });
}
