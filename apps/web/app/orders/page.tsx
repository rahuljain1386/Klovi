'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Package, Clock, CheckCircle } from 'lucide-react';

export default function CustomerPortal() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const lookupOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: API call to fetch orders by phone
    setOrders([]);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-cream">
      <nav className="px-6 py-4 bg-white border-b border-border"><Link href="/" className="font-display text-xl font-black"><span className="text-amber">K</span>LOVI</Link></nav>
      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="font-display text-2xl font-black mb-2">Your Orders</h1>
        <p className="text-sm text-warm-gray mb-8">Enter your phone number to see your orders.</p>
        <form onSubmit={lookupOrders} className="flex gap-2 mb-8">
          <input type="tel" placeholder="Your phone or WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 bg-white border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber/50" required />
          <button type="submit" disabled={loading} className="bg-ink text-amber px-5 py-3 rounded-xl text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-50">{loading ? '...' : 'Look up'}</button>
        </form>
        {orders !== null && orders.length === 0 && (
          <div className="text-center py-12 text-warm-gray"><Package className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-sm">No orders found for this number.</p></div>
        )}
      </div>
    </main>
  );
}
