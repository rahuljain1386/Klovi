'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Stats {
  totalSellers: number;
  activeSellers: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  unresolvedUnrouted: number;
}

interface RecentSeller {
  id: string;
  business_name: string;
  slug: string;
  category: string;
  city: string;
  status: string;
  created_at: string;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    totalSellers: 0, activeSellers: 0, totalOrders: 0,
    totalRevenue: 0, totalCustomers: 0, unresolvedUnrouted: 0,
  });
  const [recentSellers, setRecentSellers] = useState<RecentSeller[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [sellers, activeSellers, orders, customers, unrouted] = await Promise.all([
        supabase.from('sellers').select('id', { count: 'exact', head: true }),
        supabase.from('sellers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('orders').select('id, total', { count: 'exact' }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('unrouted_messages').select('id', { count: 'exact', head: true }).eq('resolved', false),
      ]);

      const revenue = (orders.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0);

      setStats({
        totalSellers: sellers.count || 0,
        activeSellers: activeSellers.count || 0,
        totalOrders: orders.count || 0,
        totalRevenue: revenue,
        totalCustomers: customers.count || 0,
        unresolvedUnrouted: unrouted.count || 0,
      });

      const { data: recent } = await supabase
        .from('sellers')
        .select('id, business_name, slug, category, city, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentSellers(recent || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="text-warm-gray py-12 text-center">Loading stats...</div>;
  }

  const cards = [
    { label: 'Total Sellers', value: stats.totalSellers, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Sellers', value: stats.activeSellers, color: 'bg-green-50 text-green-600' },
    { label: 'Total Orders', value: stats.totalOrders, color: 'bg-amber-50 text-amber-600' },
    { label: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, color: 'bg-purple-50 text-purple-600' },
    { label: 'Customers', value: stats.totalCustomers, color: 'bg-teal-50 text-teal-600' },
    { label: 'Unrouted', value: stats.unresolvedUnrouted, color: stats.unresolvedUnrouted > 0 ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-gray-400' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display text-ink mb-6">Platform Overview</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl p-4 ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs opacity-70 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent sellers */}
      <div className="bg-white rounded-xl border border-border">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-ink font-medium">Recent Sellers</h2>
          <Link href="/admin/sellers" className="text-xs text-amber hover:underline">View all →</Link>
        </div>
        {recentSellers.length === 0 ? (
          <div className="p-8 text-center text-warm-gray">No sellers yet</div>
        ) : (
          <div className="divide-y divide-border">
            {recentSellers.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-amber/10 flex items-center justify-center text-lg font-medium text-amber">
                  {s.business_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink font-medium truncate">{s.business_name}</div>
                  <div className="text-xs text-warm-gray">{s.category} · {s.city}</div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  s.status === 'active' ? 'bg-green-50 text-green-600' :
                  s.status === 'onboarding' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {s.status.toUpperCase()}
                </span>
                <Link
                  href={`/${s.slug}`}
                  target="_blank"
                  className="text-xs text-warm-gray hover:text-ink"
                >
                  ↗
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
