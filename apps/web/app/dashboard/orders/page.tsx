'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Order = {
  id: string;
  order_number: string;
  status: string;
  total: number;
  currency: string;
  fulfillment_type: string;
  created_at: string;
  items: { product_name: string; quantity: number }[];
  customer: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  placed: 'bg-amber/10 text-amber',
  confirmed: 'bg-blue/10 text-blue',
  preparing: 'bg-purple/10 text-purple',
  ready: 'bg-teal/10 text-teal',
  collected: 'bg-green/10 text-green',
  delivered: 'bg-green/10 text-green',
  cancelled: 'bg-rose/10 text-rose',
};

const NEXT_STATUS: Record<string, { next: string; label: string }> = {
  placed: { next: 'confirmed', label: 'Confirm' },
  confirmed: { next: 'preparing', label: 'Start Preparing' },
  preparing: { next: 'ready', label: 'Mark Ready' },
  ready: { next: 'collected', label: 'Mark Collected' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [sellerId, setSellerId] = useState('');

  useEffect(() => {
    loadOrders();
  }, [filter]);

  const loadOrders = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;
    setSellerId(seller.id);

    const statusMap = {
      active: ['placed', 'confirmed', 'preparing', 'ready'],
      completed: ['collected', 'delivered'],
      cancelled: ['cancelled'],
    };

    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, total, currency, fulfillment_type, created_at, items, customer:customers(name)')
      .eq('seller_id', seller.id)
      .in('status', statusMap[filter])
      .order('created_at', { ascending: false })
      .limit(50);

    setOrders((data as unknown as Order[]) || []);
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    const supabase = createClient();
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
    loadOrders();
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-ink mb-6">Orders</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['active', 'completed', 'cancelled'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-ink text-white'
                : 'bg-white text-warm-gray border border-[#e7e0d4] hover:text-ink'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray text-lg">No {filter} orders</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const flow = NEXT_STATUS[order.status];
            return (
              <div key={order.id} className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-ink">{order.order_number}</span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[order.status] || ''}`}>
                      {order.status}
                    </span>
                  </div>
                  <span className="text-sm text-warm-gray">{timeAgo(order.created_at)}</span>
                </div>

                <p className="font-medium text-ink">{order.customer?.name || 'Walk-in customer'}</p>

                {order.items?.length > 0 && (
                  <p className="text-sm text-warm-gray mt-1">
                    {order.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                  </p>
                )}

                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-bold text-ink">
                    {order.currency === 'INR' ? '\u20B9' : '$'}{order.total}
                  </span>

                  {flow && (
                    <button
                      onClick={() => updateStatus(order.id, flow.next)}
                      className="px-5 py-2 bg-ink text-white rounded-lg text-sm font-semibold hover:bg-ink/90 transition-colors min-h-[40px]"
                    >
                      {flow.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
