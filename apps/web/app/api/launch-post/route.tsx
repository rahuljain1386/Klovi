import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return new Response('slug required', { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, tagline, ai_tagline, city, niche, owner_name, launch_offer, category')
    .eq('slug', slug)
    .single();

  if (!seller) {
    return new Response('Seller not found', { status: 404 });
  }

  // Get products WITH images
  const { data: products } = await supabase
    .from('products')
    .select('name, price, currency, images')
    .eq('seller_id', seller.id)
    .eq('status', 'active')
    .order('sort_order')
    .limit(6);

  const productList = (products || []).slice(0, 6);
  const businessName = seller.business_name || 'My Shop';
  const tagline = seller.tagline || seller.ai_tagline || '';
  const launchOffer = seller.launch_offer || '';
  const cityName = seller.city || '';
  const niche = seller.niche || seller.category || 'snacks';

  // Collect product images
  const productImages: string[] = [];
  for (const p of productList) {
    if (p.images && Array.isArray(p.images) && p.images[0]) {
      productImages.push(p.images[0]);
    }
  }

  // Niche-specific warm color palettes — rich and premium
  const palettes: Record<string, { bg: string; bgEnd: string; accent: string; text: string; sub: string; glow: string }> = {
    snacks:            { bg: '#2d1810', bgEnd: '#1a0f08', accent: '#f59e0b', text: '#fff8e1', sub: '#d4a574', glow: 'rgba(245,158,11,0.3)' },
    bakery:            { bg: '#2d1020', bgEnd: '#1a0812', accent: '#f472b6', text: '#fef1f7', sub: '#d4a0b8', glow: 'rgba(244,114,182,0.3)' },
    tiffin:            { bg: '#1a2010', bgEnd: '#0f1408', accent: '#84cc16', text: '#f7fee7', sub: '#a8c878', glow: 'rgba(132,204,22,0.3)' },
    coaching:          { bg: '#0f1a2d', bgEnd: '#08101a', accent: '#60a5fa', text: '#eff6ff', sub: '#7da0c4', glow: 'rgba(96,165,250,0.3)' },
    spiritual_healing: { bg: '#1a102d', bgEnd: '#10081a', accent: '#a78bfa', text: '#f5f3ff', sub: '#9a8ab8', glow: 'rgba(167,139,250,0.3)' },
    beauty:            { bg: '#2d1a20', bgEnd: '#1a1012', accent: '#fb7185', text: '#fff1f2', sub: '#c89098', glow: 'rgba(251,113,133,0.3)' },
    jewelry:           { bg: '#1a1a2d', bgEnd: '#0f0f1a', accent: '#c4b5fd', text: '#f5f3ff', sub: '#9a94b8', glow: 'rgba(196,181,253,0.3)' },
    crafts:            { bg: '#1a2420', bgEnd: '#0f1612', accent: '#34d399', text: '#ecfdf5', sub: '#7ab898', glow: 'rgba(52,211,153,0.3)' },
    food:              { bg: '#2d1810', bgEnd: '#1a0f08', accent: '#f59e0b', text: '#fff8e1', sub: '#d4a574', glow: 'rgba(245,158,11,0.3)' },
    healing:           { bg: '#1a102d', bgEnd: '#10081a', accent: '#a78bfa', text: '#f5f3ff', sub: '#9a8ab8', glow: 'rgba(167,139,250,0.3)' },
    services:          { bg: '#0f1a2d', bgEnd: '#08101a', accent: '#60a5fa', text: '#eff6ff', sub: '#7da0c4', glow: 'rgba(96,165,250,0.3)' },
  };
  const c = palettes[niche] || palettes.snacks;

  const hasImages = productImages.length >= 1;
  const productNames = productList.map(p => p.name).slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(170deg, ${c.bg} 0%, ${c.bgEnd} 100%)`,
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow behind the name */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 80,
            left: '50%',
            width: 600,
            height: 600,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
            transform: 'translateX(-50%)',
          }}
        />

        {/* Top accent line */}
        <div style={{ display: 'flex', width: '100%', height: 4, background: `linear-gradient(90deg, transparent 10%, ${c.accent} 50%, transparent 90%)` }} />

        {/* ─── Top Section: Business Identity ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '70px 60px 20px', zIndex: 1 }}>
          {/* Small "NOW OPEN" badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: `2px solid ${c.accent}`,
              borderRadius: 999,
              padding: '8px 28px',
              marginBottom: 28,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: c.accent, letterSpacing: 4, textTransform: 'uppercase' as const }}>
              Now Taking Orders
            </span>
          </div>

          {/* Business name — large, elegant */}
          <div style={{ display: 'flex', marginBottom: 16, textAlign: 'center' as const }}>
            <span
              style={{
                fontSize: businessName.length > 20 ? 64 : businessName.length > 14 ? 76 : 88,
                fontWeight: 900,
                color: c.text,
                letterSpacing: -1,
                lineHeight: 1.1,
              }}
            >
              {businessName}
            </span>
          </div>

          {/* Tagline */}
          {tagline ? (
            <div style={{ display: 'flex', marginBottom: 10, maxWidth: 800, textAlign: 'center' as const }}>
              <span style={{ fontSize: 26, color: c.sub, fontStyle: 'italic' as const, lineHeight: 1.4 }}>
                {tagline.length > 80 ? tagline.slice(0, 77) + '...' : tagline}
              </span>
            </div>
          ) : null}

          {/* City */}
          {cityName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 20, color: c.sub, fontWeight: 500 }}>
                {cityName}
              </span>
            </div>
          ) : null}
        </div>

        {/* ─── Middle Section: Product Images or Names ─── */}
        {hasImages ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: '30px 50px', zIndex: 1, flexWrap: 'wrap' }}>
            {productImages.slice(0, 4).map((imgUrl, i) => {
              const count = Math.min(productImages.length, 4);
              const size = count <= 2 ? 340 : count === 3 ? 260 : 220;
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    width: size,
                    height: size,
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: `3px solid rgba(255,255,255,0.1)`,
                    boxShadow: `0 12px 40px rgba(0,0,0,0.4)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt=""
                    width={size}
                    height={size}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // No images — show product names elegantly
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 80px', gap: 12, zIndex: 1 }}>
            {productNames.map((name, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '14px 40px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span style={{ fontSize: 24, color: c.text, fontWeight: 600 }}>{name}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─── Bottom Section: Offer + CTA ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 60px', marginTop: 'auto', marginBottom: 60, zIndex: 1 }}>
          {/* Launch offer */}
          {launchOffer ? (
            <div
              style={{
                display: 'flex',
                background: c.accent,
                borderRadius: 14,
                padding: '14px 36px',
                marginBottom: 28,
                boxShadow: `0 4px 20px ${c.glow}`,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{launchOffer}</span>
            </div>
          ) : null}

          {/* Order button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${c.accent}, ${c.accent}dd)`,
              borderRadius: 60,
              padding: '24px 72px',
              marginBottom: 20,
              boxShadow: `0 8px 32px ${c.glow}`,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>Order Now</span>
          </div>

          {/* URL */}
          <div style={{ display: 'flex' }}>
            <span style={{ fontSize: 20, color: c.sub, letterSpacing: 1 }}>kloviapp.com/{slug}</span>
          </div>
        </div>

        {/* Bottom accent line */}
        <div style={{ display: 'flex', width: '100%', height: 4, background: `linear-gradient(90deg, transparent 10%, ${c.accent} 50%, transparent 90%)`, position: 'absolute', bottom: 0 }} />
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
