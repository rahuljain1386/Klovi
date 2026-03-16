export const dynamic = 'force-dynamic';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

function getPublicClient() {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createServiceRoleClient();
    }
  } catch {}
  return null;
}
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import StorefrontProducts from './storefront-products';
import ShareButton from './share-button';

interface Props { params: Promise<{ seller: string }>; }

const CAT_THEME: Record<string, { emoji: string; gradient: string }> = {
  stitching: { emoji: '✂️', gradient: 'from-rose-900 via-pink-900 to-purple-900' },
  tailoring: { emoji: '✂️', gradient: 'from-rose-900 via-pink-900 to-purple-900' },
  food: { emoji: '🍽️', gradient: 'from-amber-900 via-orange-900 to-red-900' },
  bakery: { emoji: '🧁', gradient: 'from-amber-900 via-orange-900 to-pink-900' },
  snacks: { emoji: '🥨', gradient: 'from-yellow-900 via-amber-900 to-orange-900' },
  jewelry: { emoji: '💍', gradient: 'from-violet-900 via-purple-900 to-pink-900' },
  beauty: { emoji: '💄', gradient: 'from-pink-900 via-rose-900 to-red-900' },
  crafts: { emoji: '🎨', gradient: 'from-teal-900 via-cyan-900 to-blue-900' },
  coaching: { emoji: '📚', gradient: 'from-blue-900 via-indigo-900 to-violet-900' },
  tutoring: { emoji: '📚', gradient: 'from-blue-900 via-indigo-900 to-violet-900' },
  wellness: { emoji: '🧘', gradient: 'from-emerald-900 via-teal-900 to-cyan-900' },
  clothing: { emoji: '👗', gradient: 'from-fuchsia-900 via-pink-900 to-rose-900' },
  plants: { emoji: '🌿', gradient: 'from-green-900 via-emerald-900 to-teal-900' },
  fitness: { emoji: '💪', gradient: 'from-orange-900 via-red-900 to-rose-900' },
  candle: { emoji: '🕯️', gradient: 'from-amber-900 via-yellow-900 to-orange-900' },
  chocolate: { emoji: '🍫', gradient: 'from-amber-950 via-yellow-950 to-orange-950' },
  healing: { emoji: '🔮', gradient: 'from-violet-900 via-purple-900 to-indigo-900' },
  nutrition: { emoji: '🥗', gradient: 'from-green-900 via-emerald-900 to-teal-900' },
  services: { emoji: '🏪', gradient: 'from-slate-800 via-gray-900 to-zinc-900' },
};

const CATEGORY_BG_QUERIES: Record<string, string> = {
  bakery: 'homemade cake bakery beautiful pastel',
  tiffin: 'indian home cooked food thali meal',
  sweets: 'indian mithai sweets colorful festive',
  snacks: 'indian snacks chakli murukku colorful',
  pickle: 'indian pickle achar glass jar colorful',
  healthy: 'healthy snacks makhana energy bars',
  masala: 'indian spices masala colorful bowls',
  jewelry: 'handmade indian jewelry ethnic gold',
  hamper: 'gift hamper basket beautiful ribbon',
  chocolate: 'dark chocolate truffle luxury handmade',
  healing: 'crystals healing spiritual meditation',
  nutrition: 'healthy food nutrition coaching wellness',
  tutoring: 'study books education teaching warm',
  beauty: 'natural skincare beauty products flatlay',
  candle: 'luxury scented candles cozy aesthetic warm',
  plants: 'indoor plants succulents beautiful home',
  stitching: 'indian ethnic fabric textile colorful saree',
  tailoring: 'indian ethnic fabric textile colorful saree',
  clothing: 'indian ethnic fashion designer fabric',
  food: 'indian home cooked food delicious colorful',
  coaching: 'coaching mentoring education warm',
};

function getTheme(cat: string) {
  const l = (cat || '').toLowerCase();
  for (const [k, v] of Object.entries(CAT_THEME)) { if (l.includes(k)) return v; }
  return CAT_THEME.services;
}

function getBgQuery(seller: { category: string; city?: string }) {
  const cat = (seller.category || '').toLowerCase();
  const match = Object.keys(CATEGORY_BG_QUERIES).find(k => cat.includes(k));
  return match ? CATEGORY_BG_QUERIES[match] : `${seller.category} indian handmade beautiful`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seller: slug } = await params;
  const supabase = getPublicClient() || await createClient();
  const { data: s } = await supabase.from('sellers').select('business_name, tagline, description, city, category, launch_card_bg_url, avatar_url').eq('slug', slug).in('status', ['active', 'onboarding']).single();
  if (!s) return { title: 'Not Found - Klovi' };
  const desc = s.tagline || s.description || `${s.category} in ${s.city}`;
  return {
    title: `${s.business_name} — on Klovi`,
    description: desc,
    openGraph: { title: s.business_name, description: desc, images: s.launch_card_bg_url ? [s.launch_card_bg_url] : s.avatar_url ? [s.avatar_url] : [] },
  };
}

export default async function SellerStorefront({ params }: Props) {
  const { seller: slug } = await params;
  const serviceClient = getPublicClient();
  const supabase = serviceClient || await createClient();
  const { data: seller } = await supabase.from('sellers').select('*').eq('slug', slug).in('status', ['active', 'onboarding']).single();
  if (!seller) notFound();

  const { data: products } = await supabase.from('products').select('*').eq('seller_id', seller.id).eq('status', 'active').order('sort_order');
  const { data: reviews } = await supabase.from('reviews').select('*, customers(name)').eq('seller_id', seller.id).eq('status', 'published').order('created_at', { ascending: false }).limit(10);

  const sym = seller.country === 'india' ? '₹' : '$';
  const KLOVI_WA_NUMBER = process.env.NEXT_PUBLIC_KLOVI_WA_NUMBER || '918854054503';
  const orderWaNumber = KLOVI_WA_NUMBER;
  const contactWaNumber = KLOVI_WA_NUMBER;
  const contactWaLink = `https://wa.me/${contactWaNumber}?text=${encodeURIComponent(`Hi! I saw ${seller.business_name} on kloviapp.com/${seller.slug} and I'd like to know more!`)}`;
  const waLink = `https://wa.me/${orderWaNumber}?text=${encodeURIComponent(`Hi! I'd like to order from ${seller.business_name}.\nMenu: kloviapp.com/${seller.slug}`)}`;

  const theme = getTheme(seller.category);
  const fulfillment = seller.fulfillment_modes || ['pickup'];
  const isVerified = seller.is_verified || seller.phone_verified;
  const hasPhone = !!seller.phone;
  const hasInsta = !!seller.instagram_handle;
  const hasFb = !!seller.facebook_handle;
  const productCount = products?.length || 0;
  const catLabel = (seller.category || '').charAt(0).toUpperCase() + (seller.category || '').slice(1);
  const cityState = seller.city ? `${seller.city}${seller.state ? `, ${seller.state}` : ''}` : '';
  const fulfillmentLabel = fulfillment.includes('delivery') && fulfillment.includes('pickup') ? 'Pickup & Delivery' : fulfillment.includes('delivery') ? 'Home Delivery' : 'Pickup';
  const pickupAddress = seller.pickup_address || seller.address;

  // Hero image
  let heroUrl = seller.cover_photo_url || seller.launch_card_bg_url;
  if (!heroUrl) {
    const firstProductImg = products?.find(p => p.images?.[0] || p.enhanced_images?.[0]);
    if (firstProductImg) heroUrl = firstProductImg.images?.[0] || firstProductImg.enhanced_images?.[0];
  }
  if (!heroUrl) {
    try {
      const query = getBgQuery(seller);
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=portrait&size=large`,
        { headers: { Authorization: process.env.PEXELS_API_KEY! }, next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data.photos?.[1]?.src?.large2x || data.photos?.[0]?.src?.large2x;
        if (photo) {
          heroUrl = photo;
          supabase.from('sellers').update({ launch_card_bg_url: photo }).eq('id', seller.id);
        }
      }
    } catch {}
  }

  const aboutText = seller.about_text || seller.description;
  const isLongAbout = aboutText && aboutText.length > 120;

  return (
    <main className="min-h-screen bg-[#faf8f5]">
      <div className="max-w-[480px] mx-auto">

        {/* ═══ HERO — tall with overlaid business info ═══ */}
        <div className="relative h-[300px] overflow-hidden">
          {heroUrl ? (
            <>
              <img src={heroUrl} alt="" className="w-full h-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70" />
            </>
          ) : (
            <>
              <div className={`w-full h-full bg-gradient-to-br ${theme.gradient}`} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
            </>
          )}

          {/* Top bar */}
          <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-10">
            <Link href="/" className="text-[10px] text-amber bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full font-bold tracking-wider">KLOVI</Link>
            <ShareButton businessName={seller.business_name} tagline={seller.tagline} />
          </div>

          {/* Category pill — bottom left */}
          <div className="absolute bottom-20 left-4 z-10">
            <span className="text-[10px] bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full font-medium">
              {theme.emoji} {catLabel}{cityState ? ` · ${cityState}` : ''}
            </span>
          </div>

          {/* Business name + tagline on hero */}
          <div className="absolute bottom-4 left-4 right-20 z-10">
            <h1 className="font-display text-2xl font-black text-white leading-tight drop-shadow-lg">{seller.business_name}</h1>
            {seller.tagline && (
              <p className="text-white/80 text-sm italic mt-0.5 drop-shadow-md">{seller.tagline}</p>
            )}
          </div>

          {/* Avatar — overlapping bottom right */}
          <div className="absolute -bottom-9 right-5 z-20">
            {seller.avatar_url ? (
              <img src={seller.avatar_url} alt="" className="w-[72px] h-[72px] rounded-full object-cover border-[3px] border-white shadow-lg" />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full bg-amber/10 flex items-center justify-center text-3xl border-[3px] border-white shadow-lg bg-white">{theme.emoji}</div>
            )}
          </div>
        </div>

        {/* ═══ INFO STRIP — clean single line below hero ═══ */}
        <div className="bg-white px-4 pt-3 pb-2.5 border-b border-[#e7e0d4]">
          <div className="flex items-center gap-2 text-xs text-warm-gray flex-wrap pr-16">
            {seller.average_rating > 0 && (
              <span className="text-amber font-bold">⭐ {Number(seller.average_rating).toFixed(1)}</span>
            )}
            {seller.total_orders > 0 && (
              <span>{seller.total_orders}+ orders</span>
            )}
            {cityState && <span>📍 {cityState}</span>}
            <span className="text-[10px] bg-[#faf8f5] px-2 py-0.5 rounded-full font-medium">{fulfillmentLabel}</span>
          </div>

          {/* Description */}
          {aboutText && (
            <p className={`text-[13px] text-warm-gray mt-2 leading-relaxed ${isLongAbout ? 'line-clamp-2' : ''}`}>
              {aboutText}
            </p>
          )}

          {/* Address — real address builds trust */}
          {pickupAddress && (
            <p className="text-[11px] text-warm-gray/70 mt-1.5">📍 {pickupAddress}</p>
          )}
        </div>

        {/* ═══ CONTACT BAR ═══ */}
        <div className="px-4 py-3 bg-[#faf8f5]">
          <a href={contactWaLink} target="_blank" rel="noopener noreferrer"
            className={`${hasPhone || hasInsta || hasFb ? '' : 'w-full'} flex-1 h-11 bg-green text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm`}>
            💬 Message on WhatsApp
          </a>
          {(hasPhone || hasInsta || hasFb) && (
            <div className="flex gap-2 mt-2">
              {hasPhone && (
                <a href={`tel:${seller.phone}`} className="flex-1 h-9 bg-white border border-[#e7e0d4] rounded-xl flex items-center justify-center text-xs text-warm-gray gap-1.5 font-medium">📞 {seller.phone}</a>
              )}
              {hasInsta && (
                <a href={`https://instagram.com/${seller.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="flex-1 h-9 bg-white border border-[#e7e0d4] rounded-xl flex items-center justify-center text-xs text-warm-gray gap-1 font-medium">📸 @{seller.instagram_handle}</a>
              )}
            </div>
          )}
          <p className="text-[10px] text-warm-gray/60 mt-1.5 text-center">Usually replies within a few hours</p>
        </div>

        {/* ═══ PRODUCTS ═══ */}
        {productCount > 0 ? (
          <StorefrontProducts
            products={(products || []) as any}
            seller={seller as any}
            waNumber={orderWaNumber}
            businessName={seller.business_name}
            category={seller.category || ''}
            country={seller.country || ''}
          />
        ) : (
          <div className="px-4 py-6">
            <div className="bg-white rounded-2xl border border-[#e7e0d4] p-10 text-center">
              <span className="text-4xl block mb-3">{theme.emoji}</span>
              <p className="text-warm-gray text-sm mb-4">Products coming soon — order directly on WhatsApp</p>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green text-white px-6 h-11 rounded-xl font-semibold text-sm">💬 Order on WhatsApp</a>
            </div>
          </div>
        )}

        {/* ═══ ABOUT SECTION (full) ═══ */}
        {seller.about_text && seller.about_text.length > 120 && (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-2xl border border-[#e7e0d4] p-5">
              <p className="text-[10px] text-amber font-bold tracking-wider mb-2">ABOUT US</p>
              <p className="text-[13px] text-warm-gray leading-relaxed">{seller.about_text}</p>
            </div>
          </div>
        )}

        {/* ═══ REVIEWS ═══ */}
        {reviews && reviews.length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="font-display text-base font-black text-ink mb-3">Reviews ({reviews.length})</h2>
            <div className="space-y-2">
              {reviews.map((r: any) => (
                <div key={r.id} className="bg-white rounded-xl border border-[#e7e0d4] p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-ink">{r.customers?.name || 'Customer'}</span>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s <= r.rating ? 'text-amber' : 'text-gray-200'}`}>★</span>)}</div>
                  </div>
                  {r.comment && <p className="text-[12px] text-warm-gray leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TRUST GRID ═══ */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl border border-[#e7e0d4] p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <span className="text-lg block mb-0.5">📍</span>
              <span className="text-[12px] text-ink font-medium block leading-tight">{cityState || 'Local'}</span>
              {pickupAddress && <span className="text-[10px] text-warm-gray block mt-0.5 leading-tight">{pickupAddress.substring(0, 40)}</span>}
            </div>
            <div>
              <span className="text-lg block mb-0.5">⏰</span>
              <span className="text-[12px] text-ink font-medium block">{fulfillmentLabel}</span>
              <span className="text-[10px] text-warm-gray block mt-0.5">WhatsApp to order</span>
            </div>
            <div>
              <span className="text-lg block mb-0.5">✅</span>
              <span className="text-[12px] text-ink font-medium block">{isVerified ? 'Verified' : 'Klovi Seller'}</span>
              <span className="text-[10px] text-warm-gray block mt-0.5">Trusted business</span>
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="px-4 pb-28 pt-2">
          <div className="text-center py-4">
            <p className="font-display text-sm font-bold text-ink">{seller.business_name}</p>
            <p className="text-[11px] text-warm-gray mt-0.5">{catLabel}{cityState ? ` · ${cityState}` : ''}</p>
            <p className="text-[10px] text-warm-gray/50 mt-1">kloviapp.com/{slug}</p>
            <a href="https://kloviapp.com" target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] font-semibold text-amber hover:underline mt-3">Powered by Klovi · Start your free store →</a>
          </div>
        </div>

        {/* ═══ STICKY BAR ═══ */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50">
          <div className="bg-white/95 backdrop-blur-xl border-t border-[#e7e0d4] px-4 py-2">
            <p className="text-[10px] text-warm-gray text-center mb-1">Ordering from {seller.business_name}</p>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full bg-green hover:bg-green/90 text-white h-12 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green/20 active:scale-[0.98] transition-all">
              💬 Order on WhatsApp
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
