import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Use service role client for public storefront — bypasses RLS so products always show
function getPublicClient() {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createServiceRoleClient();
    }
  } catch {}
  // Fallback: this won't work for public pages due to RLS but better than crashing
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
  console.log('[Storefront] slug:', slug, '| service role:', !!serviceClient);
  const { data: seller, error: sellerError } = await supabase.from('sellers').select('*').eq('slug', slug).in('status', ['active', 'onboarding']).single();
  if (sellerError) {
    console.error('[Storefront] Seller query error:', sellerError.message, '| slug:', slug);
  }
  if (!seller) notFound();

  // Products: use service role to bypass RLS, fetch all active products
  const { data: products, error: productsError } = await supabase.from('products').select('*').eq('seller_id', seller.id).eq('status', 'active').order('sort_order');
  if (productsError) {
    console.error('[Storefront] Products query error:', productsError.message, '| seller_id:', seller.id);
  }
  console.log('[Storefront]', seller.slug, '| products found:', products?.length ?? 0, '| using service role:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: reviews } = await supabase.from('reviews').select('*, customers(name)').eq('seller_id', seller.id).eq('status', 'published').order('created_at', { ascending: false }).limit(10);

  const sym = seller.country === 'india' ? '₹' : '$';

  // WhatsApp number logic:
  // Klovi AI number handles ALL customer messages (bot auto-replies, takes orders, alerts seller)
  // Seller's personal number is only for Klovi to send them notifications
  const KLOVI_WA_NUMBER = process.env.NEXT_PUBLIC_KLOVI_WA_NUMBER || '918854054503';
  const sellerPersonalWa = (seller.whatsapp_number || seller.phone || '').replace(/\D/g, '');
  // ALL orders go through Klovi AI number — bot handles conversations
  const orderWaNumber = KLOVI_WA_NUMBER;
  const hasWa = true; // Klovi number is always available
  // Contact bar also uses Klovi number (bot handles everything)
  const contactWaNumber = KLOVI_WA_NUMBER;
  const contactWaLink = contactWaNumber
    ? `https://wa.me/${contactWaNumber}?text=${encodeURIComponent(`Hi! I saw your shop on Klovi (${seller.slug}). 🙏`)}`
    : '';
  // Order flow WhatsApp link (sticky bar + storefront)
  const waLink = hasWa
    ? `https://wa.me/${orderWaNumber}?text=${encodeURIComponent(`Hi! I'm interested in ordering from *${seller.business_name}* (klovi/${seller.slug}). Can you help me? 🙏`)}`
    : '';
  const theme = getTheme(seller.category);
  const fulfillment = seller.fulfillment_modes || ['pickup'];
  const isVerified = seller.is_verified || seller.phone_verified;
  const hasPhone = !!seller.phone;
  const hasInsta = !!seller.instagram_handle;
  const hasFb = !!seller.facebook_handle;
  const productCount = products?.length || 0;

  // Hero photo: prefer seller's own cover/launch image, then first product image, then Pexels
  let heroUrl = seller.cover_photo_url || seller.launch_card_bg_url;
  if (!heroUrl) {
    // Try first product image
    const firstProductImg = products?.find(p => p.images?.[0] || p.enhanced_images?.[0]);
    if (firstProductImg) {
      heroUrl = firstProductImg.images?.[0] || firstProductImg.enhanced_images?.[0];
    }
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

  // Trust pills
  const pills = [
    { icon: '💬', label: 'WhatsApp Orders', show: hasWa },
    { icon: '🚚', label: 'Home Delivery', show: fulfillment.includes('delivery') },
    { icon: '📍', label: 'Pickup Available', show: fulfillment.includes('pickup') },
    { icon: '✨', label: 'Custom Orders', show: !!seller.allows_custom_orders },
    { icon: '🎁', label: 'Gift Wrapping', show: !!seller.offers_gift_wrap },
    { icon: '✅', label: 'Klovi Verified', show: isVerified },
    { icon: '💵', label: 'Cash OK', show: !!seller.cod_enabled },
  ].filter(p => p.show);

  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-[480px] mx-auto">

        {/* ═══ HERO — compact banner + info card ═══ */}
        <div className="relative h-[160px] overflow-hidden">
          {heroUrl ? (
            <>
              <img src={heroUrl} alt="" className="w-full h-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
            </>
          ) : (
            <>
              <div className={`w-full h-full bg-gradient-to-br ${theme.gradient}`} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
            </>
          )}

          {/* Top bar */}
          <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-10">
            <Link href="/" className="text-[10px] text-amber bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full font-bold tracking-wider">⚡ KLOVI</Link>
            <ShareButton businessName={seller.business_name} tagline={seller.tagline} />
          </div>
        </div>

        {/* ═══ BUSINESS INFO CARD — overlaps hero ═══ */}
        <div className="px-4 -mt-12 relative z-10 mb-3">
          <div className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {seller.avatar_url ? (
                <img src={seller.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-amber/30 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-amber/10 flex items-center justify-center text-2xl border-2 border-amber/20 flex-shrink-0">{theme.emoji}</div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-lg font-black text-ink leading-tight truncate">{seller.business_name}</h1>
                <p className="text-warm-gray text-xs mt-0.5">{theme.emoji} {(seller.category || '').charAt(0).toUpperCase() + (seller.category || '').slice(1)} · 📍 {seller.city}{seller.state ? `, ${seller.state}` : ''}</p>
                {seller.average_rating > 0 && (
                  <p className="text-amber text-xs font-bold mt-0.5">⭐ {Number(seller.average_rating).toFixed(1)} · <span className="text-warm-gray font-normal">{seller.total_orders} orders</span></p>
                )}
              </div>
            </div>
            {seller.tagline && (
              <p className="text-warm-gray text-xs italic mt-2 border-t border-border pt-2">&ldquo;{seller.tagline}&rdquo;</p>
            )}
          </div>
        </div>

        {/* ═══ CONTACT BAR — routes to Klovi AI bot ═══ */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-white">
          <a href={contactWaLink} target="_blank" rel="noopener noreferrer"
            className="flex-1 h-11 bg-green text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5">
            💬 WhatsApp
          </a>
          {hasPhone && (
            <a href={`tel:${seller.phone}`} className="w-11 h-11 bg-cream border border-border rounded-xl flex items-center justify-center text-base">📞</a>
          )}
          {hasInsta && (
            <a href={`https://instagram.com/${seller.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-cream border border-border rounded-xl flex items-center justify-center text-base">📸</a>
          )}
          {hasFb && (
            <a href={`https://facebook.com/${seller.facebook_handle}`} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-cream border border-border rounded-xl flex items-center justify-center text-base">👍</a>
          )}
        </div>
        {(hasPhone || hasInsta) && (
          <div className="px-4 py-1.5 text-[10px] text-warm-gray flex gap-2">
            {hasPhone && <span>{seller.phone}</span>}
            {hasInsta && <span>· @{seller.instagram_handle}</span>}
          </div>
        )}

        {/* ═══ TRUST PILLS ═══ */}
        {pills.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5 scrollbar-hide">
            {pills.map(p => (
              <span key={p.label} className="inline-flex items-center bg-white text-ink text-[10px] px-2.5 py-1 rounded-full font-medium whitespace-nowrap shadow-sm border border-border">
                {p.icon} {p.label}
              </span>
            ))}
          </div>
        )}

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
          <div className="px-4 pb-4">
            <div className="bg-white rounded-2xl border border-border p-10 text-center">
              <span className="text-4xl block mb-3">{theme.emoji}</span>
              <p className="text-warm-gray text-sm mb-4">Products coming soon — order directly on WhatsApp</p>
              {hasWa && <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-green text-white px-6 h-11 rounded-xl font-semibold text-sm">💬 Order on WhatsApp</a>}
            </div>
          </div>
        )}

        {/* ═══ ABOUT ═══ */}
        {seller.about_text && (
          <div className="mx-4 mb-4 bg-white rounded-2xl border border-border p-4">
            <p className="text-[10px] text-amber font-bold tracking-wider mb-2">OUR STORY</p>
            <p className="text-sm text-warm-gray leading-relaxed line-clamp-4">{seller.about_text}</p>
          </div>
        )}

        {/* ═══ REVIEWS ═══ */}
        {reviews && reviews.length > 0 && (
          <div className="px-4 pb-4">
            <h2 className="font-display text-base font-black text-ink mb-2">⭐ Reviews ({reviews.length})</h2>
            <div className="space-y-2">
              {reviews.map((r: any) => (
                <div key={r.id} className="bg-white rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-ink">{r.customers?.name || 'Customer'}</span>
                    <div className="flex">{[1,2,3,4,5].map(s => <span key={s} className={`text-[10px] ${s <= r.rating ? 'text-amber' : 'text-gray-200'}`}>★</span>)}</div>
                  </div>
                  {r.comment && <p className="text-[11px] text-warm-gray">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ TRUST ═══ */}
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl border border-border p-3 grid grid-cols-3 gap-2 text-center">
            <div><span className="text-base block">🔒</span><span className="text-[9px] text-warm-gray block">Safe Payment</span></div>
            <div><span className="text-base block">📍</span><span className="text-[9px] text-warm-gray block">{fulfillment.includes('delivery') ? 'Delivery' : 'Pickup'}</span></div>
            <div><span className="text-base block">✅</span><span className="text-[9px] text-warm-gray block">{isVerified ? 'Verified' : 'Klovi Seller'}</span></div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="px-4 pb-28 pt-4">
          <div className="bg-white rounded-2xl border border-border p-5 text-center">
            <p className="font-display text-sm font-bold text-ink mb-1">{seller.business_name}</p>
            <p className="text-[11px] text-warm-gray mb-3">{(seller.category || '').charAt(0).toUpperCase() + (seller.category || '').slice(1)} · {seller.city}</p>
            <div className="flex items-center justify-center gap-3 mb-3">
              {contactWaNumber && (
                <a href={contactWaLink} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-green/10 rounded-full flex items-center justify-center text-sm">💬</a>
              )}
              {hasPhone && (
                <a href={`tel:${seller.phone}`} className="w-9 h-9 bg-cream rounded-full flex items-center justify-center text-sm border border-border">📞</a>
              )}
              {hasInsta && (
                <a href={`https://instagram.com/${seller.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-purple/10 rounded-full flex items-center justify-center text-sm">📸</a>
              )}
              {hasFb && (
                <a href={`https://facebook.com/${seller.facebook_handle}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-blue/10 rounded-full flex items-center justify-center text-sm">📘</a>
              )}
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-[10px] text-warm-gray mb-1">🔗 kloviapp.com/{slug}</p>
              <a href="https://kloviapp.com" target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-amber hover:underline">⚡ Powered by Klovi · Start your free store →</a>
            </div>
          </div>
        </div>

        {/* ═══ STICKY BAR ═══ */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50">
          <div className="bg-white/95 backdrop-blur-xl border-t border-border px-4 py-2.5 flex gap-2.5">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green hover:bg-green/90 text-white h-12 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-green/20 active:scale-[0.98] transition-all">💬 Order on WhatsApp</a>
            {hasPhone && <a href={`tel:${seller.phone}`} className="w-14 h-12 rounded-2xl border-2 border-border bg-white flex items-center justify-center text-warm-gray hover:text-amber text-sm font-medium">📞</a>}
          </div>
        </div>
      </div>
    </main>
  );
}
