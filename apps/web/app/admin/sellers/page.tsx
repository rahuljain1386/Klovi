'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Seller {
  id: string;
  business_name: string;
  slug: string;
  category: string;
  city: string;
  country: string;
  phone: string;
  status: string;
  plan: string;
  total_orders: number;
  total_revenue: number;
  average_rating: number;
  created_at: string;
  whatsapp_number: string | null;
}

export default function AdminSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'onboarding' | 'paused'>('all');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      let query = supabase
        .from('sellers')
        .select('id, business_name, slug, category, city, country, phone, status, plan, total_orders, total_revenue, average_rating, created_at, whatsapp_number')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data } = await query;
      setSellers(data || []);
      setLoading(false);
    };
    load();
  }, [filter]);

  const statusCounts = sellers.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <h1 className="text-2xl font-display text-white mb-6">All Sellers</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'onboarding', 'paused'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="text-[10px] ml-1 opacity-50">
              ({f === 'all' ? sellers.length : (statusCounts[f] || 0)})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 py-12 text-center">Loading sellers...</div>
      ) : sellers.length === 0 ? (
        <div className="text-center text-white/30 py-16 bg-[#161822] rounded-xl border border-white/10">
          No sellers yet. Share the onboarding link to get started.
        </div>
      ) : (
        <div className="bg-[#161822] rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="text-[11px] text-white/40 font-medium px-4 py-3">SELLER</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3">CATEGORY</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3">LOCATION</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3">STATUS</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3">PLAN</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3 text-right">ORDERS</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3 text-right">REVENUE</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3">JOINED</th>
                <th className="text-[11px] text-white/40 font-medium px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sellers.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white font-medium">{s.business_name}</div>
                    <div className="text-[10px] text-white/30">/{s.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{s.category}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{s.city}, {s.country?.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      s.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      s.status === 'onboarding' ? 'bg-amber/20 text-amber' :
                      s.status === 'paused' ? 'bg-white/10 text-white/40' :
                      'bg-rose/20 text-rose'
                    }`}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">{s.plan}</td>
                  <td className="px-4 py-3 text-sm text-white/60 text-right">{s.total_orders}</td>
                  <td className="px-4 py-3 text-sm text-white/60 text-right">₹{(s.total_revenue || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-[10px] text-white/30">
                    {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${s.slug}`}
                      target="_blank"
                      className="text-xs text-amber hover:underline"
                    >
                      View ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
