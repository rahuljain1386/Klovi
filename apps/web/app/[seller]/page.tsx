import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Star, Shield, Clock, MapPin, MessageSquare } from 'lucide-react';

interface Props { params: Promise<{ seller: string }>; }

export async function generateMetadata({ params }: Props) {
  const { seller: slug } = await params;
  const supabase = await createClient();
  const { data: seller } = await supabase.from('sellers').select('business_name, description, city, category').eq('slug', slug).eq('status', 'active').single();
  if (!seller) return { title: 'Not Found - Klovi' };
  return { title: `${seller.business_name} - Klovi`, description: seller.description || `Order from ${seller.business_name} in ${seller.city}` };
}

export default async function SellerBookingPage({ params }: Props) {
  const { seller: slug } = await params;
  const supabase = await createClient();
  const { data: seller } = await supabase.from('sellers').select('*').eq('slug', slug).eq('status', 'active').single();
  if (!seller) notFound();

  const { data: products } = await supabase.from('products').select('*').eq('seller_id', seller.id).eq('status', 'active').order('sort_order');
  const { data: reviews } = await supabase.from('reviews').select('*, customers(name)').eq('seller_id', seller.id).eq('status', 'published').order('created_at', { ascending: false }).limit(10);

  const sym = seller.country === 'india' ? '₹' : '$';

  return (
    <main className="min-h-screen bg-cream">
      <div className="bg-ink text-white">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href="/" className="text-xs text-amber font-semibold tracking-wider mb-4 block">KLOVI</Link>
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-2xl bg-amber/20 flex items-center justify-center text-3xl">{seller.business_name.charAt(0)}</div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-black">{seller.business_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-stone-400">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {seller.city}</span>
                <span className="capitalize">{seller.category}</span>
              </div>
              {seller.average_rating > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Star className="w-4 h-4 fill-amber text-amber" />
                  <span className="text-sm font-semibold text-amber">{Number(seller.average_rating).toFixed(1)}</span>
                  <span className="text-xs text-stone-400">({seller.total_orders} orders)</span>
                </div>
              )}
            </div>
          </div>
          {seller.description && <p className="mt-4 text-sm text-stone-300 leading-relaxed">{seller.description}</p>}
          <div className="flex flex-wrap gap-2 mt-4">
            {seller.phone_verified && <span className="inline-flex items-center gap-1 bg-white/10 text-xs px-2.5 py-1 rounded-full"><Shield className="w-3 h-3 text-green-400" /> Verified</span>}
            {seller.total_orders >= 10 && <span className="inline-flex items-center gap-1 bg-white/10 text-xs px-2.5 py-1 rounded-full">{seller.total_orders}+ orders</span>}
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="font-display text-xl font-black mb-4">{seller.category === 'food' ? 'Menu' : 'Catalog'}</h2>
        <div className="space-y-3">
          {products?.map((product: any) => (
            <div key={product.id} className="bg-white rounded-2xl border border-border p-4 flex gap-4 hover:shadow-md transition-shadow">
              <div className="w-24 h-24 rounded-xl bg-amber-light flex items-center justify-center flex-shrink-0 text-2xl">📦</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-sm">{product.name}</h3>
                  <span className="font-display font-bold text-amber-dark text-sm whitespace-nowrap ml-2">{sym}{product.price}</span>
                </div>
                {product.description && <p className="text-xs text-warm-gray mt-1 line-clamp-2">{product.description}</p>}
                {product.status === 'sold_out' && <span className="text-xs bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full font-medium mt-2 inline-block">Sold Out</span>}
              </div>
            </div>
          ))}
          {(!products || products.length === 0) && <div className="text-center py-12 text-warm-gray text-sm">No items available right now.</div>}
        </div>
        <div className="mt-6 sticky bottom-4">
          <a href={`https://wa.me/${seller.whatsapp_number || seller.phone}?text=Hi! I'd like to place an order.`} target="_blank" rel="noopener noreferrer" className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl text-center font-semibold flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 transition-colors">
            <MessageSquare className="w-5 h-5" /> Order on WhatsApp
          </a>
        </div>
        {reviews && reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-black mb-4">Reviews</h2>
            <div className="space-y-3">
              {reviews.map((review: any) => (
                <div key={review.id} className="bg-white rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">{[1,2,3,4,5].map((s) => <Star key={s} className={`w-4 h-4 ${s <= review.rating ? 'fill-amber text-amber' : 'text-gray-200'}`} />)}</div>
                    <span className="text-xs text-warm-gray">{review.customers?.name}</span>
                  </div>
                  {review.comment && <p className="text-sm text-warm-gray">{review.comment}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="mt-10 bg-white rounded-2xl border border-border p-6">
          <h3 className="font-semibold text-sm mb-3">Your order is safe</h3>
          <div className="space-y-2 text-xs text-warm-gray">
            <div className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /><span>Deposit secures your order. Pickup address shared only after payment.</span></div>
            <div className="flex items-start gap-2"><Shield className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /><span>Klovi verified seller with real reviews from real customers.</span></div>
          </div>
        </section>
        <div className="text-center mt-10 mb-6">
          <Link href="/" className="text-xs text-warm-gray hover:text-ink transition-colors">Powered by <span className="font-semibold">Klovi</span></Link>
        </div>
      </div>
    </main>
  );
}
