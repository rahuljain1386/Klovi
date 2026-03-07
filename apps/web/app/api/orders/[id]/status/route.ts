import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID_TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['collected', 'delivered'],
  collected: [],
  delivered: [],
  cancelled: [],
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { status: newStatus } = await request.json();

  // Get current order
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, customer_id')
    .eq('id', params.id)
    .eq('seller_id', seller.id)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Validate status transition
  const allowedTransitions = VALID_TRANSITIONS[order.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${order.status} to ${newStatus}` },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // Notify customer about status change
  if (order.customer_id) {
    await supabase.from('notifications').insert({
      seller_id: seller.id,
      type: 'order_update',
      title: `Order ${newStatus}`,
      body: `Your order has been ${newStatus}`,
      priority: 'important',
      data: { order_id: order.id, status: newStatus },
    });
  }

  return NextResponse.json({ order: updated });
}
