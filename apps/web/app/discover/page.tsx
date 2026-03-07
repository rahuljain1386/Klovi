import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Star, MapPin, Search } from 'lucide-react';

export const metadata = { title: 'Discover Home Sellers - Klovi', description: 'Find verified home-based sellers near you.' };

export default async function DiscoverPage() {
  const supabase = await createClient();
  const { data: sellers } = await supabase.from('sellers').select('id, business_name, slug, description, category, city, country, avatar_url, average_rating, total_orders, phone_verified').eq('status', 'active').order('total_orders', { ascending: false }).limit(24);

  return (
    <main className="min-h-screen bg-cream">
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 bg-white border-b border-border">
        <Link href="/" className="font-display text-2xl font-black"><span className="text-amber">K</span>LOVI</Link>
        <Link href="/login" className="text-sm font-medium text-warm-gray hover:text-ink">I&apos;m a seller</Link>
      </nav>
      <div className="max-w-6xl mx-auto px-6 md:px-12 py-10">
        <h1 className="font-display text-3xl md:text-4xl font-black mb-2">Find home sellers near you</h1>
        <p className="text-warm-gray mb-8">Discover verified home businesses in your city.</p>
        <div className="flex flex-col sm:flex-row gap-3 mb-10">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-gray" />
            <input type="text" placeholder="Search by name, city, or category..." className="w-full bg-white border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber/50" />
          </div>
          <select className="bg-white border border-border rounded-xl px-4 py-3 text-sm text-warm-gray focus:outline-none">
            <option value="">All Categories</option>
            <option value="food">Food & Baking</option>
            <option value="coaching">Coaching & Tutoring</option>
            <option value="jewelry">Jewelry</option>
            <option value="crafts">Crafts</option>
            <option value="beauty">Beauty</option>
            <option value="fitness">Fitness</option>
          </select>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {sellers?.map((s: any) => (
            <Link key={s.id} href={`/${s.slug}`} className="bg-white rounded-2xl border border-border p-5 hover:shadow-lg hover:-translate-y-1 transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center text-xl font-display font-black text-amber">{s.business_name.charAt(0)}</div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate group-hover:text-amber-dark transition-colors">{s.business_name}</h3>
                  <div className="flex items-center gap-2 text-xs text-warm-gray">
                    <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {s.city}</span>
                    <span className="capitalize">{s.category}</span>
                  </div>
                </div>
              </div>
              {s.description && <p className="text-xs text-warm-gray line-clamp-2 mb-3">{s.description}</p>}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {s.average_rating > 0 && <><Star className="w-3.5 h-3.5 fill-amber text-amber" /><span className="text-xs font-semibold">{Number(s.average_rating).toFixed(1)}</span></>}
                  {s.total_orders > 0 && <span className="text-xs text-warm-gray ml-1">({s.total_orders} orders)</span>}
                </div>
                {s.phone_verified && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Verified</span>}
              </div>
            </Link>
          ))}
        </div>
        {(!sellers || sellers.length === 0) && (
          <div className="text-center py-20 text-warm-gray">
            <p className="text-lg mb-2">No sellers yet in your area</p>
            <p className="text-sm">Be the first! <Link href="/get-started" className="text-amber font-semibold hover:underline">Start your home business on Klovi</Link></p>
          </div>
        )}
      </div>
    </main>
  );
}
