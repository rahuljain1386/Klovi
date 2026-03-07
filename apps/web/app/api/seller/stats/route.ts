import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, total_orders, total_revenue, total_customers, avg_rating, review_count')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(1);

  const [todayData, weekData, monthData, pendingOrders, unreadConversations] = await Promise.all([
    supabase
      .from('orders')
      .select('total')
      .eq('seller_id', seller.id)
      .gte('created_at', todayStart.toISOString())
      .in('status', ['collected', 'delivered', 'confirmed', 'preparing', 'ready']),
    supabase
      .from('orders')
      .select('total')
      .eq('seller_id', seller.id)
      .gte('created_at', weekStart.toISOString())
      .in('status', ['collected', 'delivered']),
    supabase
      .from('orders')
      .select('total')
      .eq('seller_id', seller.id)
      .gte('created_at', monthStart.toISOString())
      .in('status', ['collected', 'delivered']),
    supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('seller_id', seller.id)
      .in('status', ['placed', 'confirmed']),
    supabase
      .from('conversations')
      .select('id', { count: 'exact' })
      .eq('seller_id', seller.id)
      .gt('unread_count', 0),
  ]);

  return NextResponse.json({
    all_time: {
      total_orders: seller.total_orders,
      total_revenue: seller.total_revenue,
      total_customers: seller.total_customers,
      avg_rating: seller.avg_rating,
      review_count: seller.review_count,
    },
    today: {
      orders: todayData.data?.length || 0,
      revenue: todayData.data?.reduce((s, o) => s + (o.total || 0), 0) || 0,
    },
    this_week: {
      orders: weekData.data?.length || 0,
      revenue: weekData.data?.reduce((s, o) => s + (o.total || 0), 0) || 0,
    },
    this_month: {
      orders: monthData.data?.length || 0,
      revenue: monthData.data?.reduce((s, o) => s + (o.total || 0), 0) || 0,
    },
    pending: {
      orders: pendingOrders.count || 0,
      unread_conversations: unreadConversations.count || 0,
    },
  });
}
