'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  channel: string;
  segment: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
};

const SEGMENT_COLORS: Record<string, string> = {
  new: 'bg-blue/10 text-blue',
  active: 'bg-green/10 text-green',
  loyal: 'bg-amber/10 text-amber',
  dormant: 'bg-warm-gray/10 text-warm-gray',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [segment, setSegment] = useState('all');

  useEffect(() => {
    loadCustomers();
  }, [segment]);

  const loadCustomers = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;

    let query = supabase
      .from('customers')
      .select('*')
      .eq('seller_id', seller.id)
      .order('last_order_at', { ascending: false });

    if (segment !== 'all') {
      query = query.eq('segment', segment);
    }

    const { data } = await query;
    setCustomers((data as Customer[]) || []);
  };

  return (
    <div>
      <h1 className="font-display text-2xl md:text-3xl text-ink mb-6">Customers</h1>

      {/* Segment filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {['all', 'new', 'active', 'loyal', 'dormant'].map((seg) => (
          <button
            key={seg}
            onClick={() => setSegment(seg)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              segment === seg
                ? 'bg-ink text-white'
                : 'bg-white text-warm-gray border border-[#e7e0d4] hover:text-ink'
            }`}
          >
            {seg.charAt(0).toUpperCase() + seg.slice(1)}
          </button>
        ))}
      </div>

      <p className="text-warm-gray mb-4">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>

      {customers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray text-lg">No customers yet</p>
        </div>
      ) : (
        <>
          {/* Mobile: card layout */}
          <div className="md:hidden space-y-3">
            {customers.map((c) => (
              <div key={c.id} className="bg-white rounded-xl p-4 border border-[#e7e0d4]">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-ink">{c.name}</p>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${SEGMENT_COLORS[c.segment] || ''}`}>
                    {c.segment}
                  </span>
                </div>
                <p className="text-sm text-warm-gray">{c.phone || c.email || '-'}</p>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="text-ink font-medium">{c.total_orders} orders</span>
                  <span className="text-ink font-medium">${c.total_spent}</span>
                  <span className="text-warm-gray ml-auto text-xs">
                    {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : 'No orders'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden md:block bg-white rounded-xl border border-[#e7e0d4] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e7e0d4] text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-warm-gray uppercase">Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-warm-gray uppercase">Contact</th>
                  <th className="px-6 py-3 text-xs font-semibold text-warm-gray uppercase">Segment</th>
                  <th className="px-6 py-3 text-xs font-semibold text-warm-gray uppercase">Orders</th>
                  <th className="px-6 py-3 text-xs font-semibold text-warm-gray uppercase">Total Spent</th>
                  <th className="px-6 py-3 text-xs font-semibold text-warm-gray uppercase">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-[#e7e0d4] last:border-0 hover:bg-cream/30">
                    <td className="px-6 py-4 font-medium text-ink">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-warm-gray">{c.phone || c.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${SEGMENT_COLORS[c.segment] || ''}`}>
                        {c.segment}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-ink">{c.total_orders}</td>
                    <td className="px-6 py-4 text-ink font-medium">${c.total_spent}</td>
                    <td className="px-6 py-4 text-sm text-warm-gray">
                      {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
