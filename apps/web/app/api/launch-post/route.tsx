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

  const { data: products } = await supabase
    .from('products')
    .select('name, price, currency')
    .eq('seller_id', seller.id)
    .eq('status', 'active')
    .order('sort_order')
    .limit(8);

  const productList = (products || []).slice(0, 8);
  const businessName = seller.business_name || 'My Shop';
  const tagline = seller.tagline || seller.ai_tagline || '';
  const launchOffer = seller.launch_offer || '';
  const cityName = seller.city || '';
  const niche = seller.niche || seller.category || 'snacks';
  const currency = productList[0]?.currency === 'USD' ? '$' : '₹';

  // Niche-specific palettes
  const palettes: Record<string, { bg: string; bgEnd: string; accent: string; accentSoft: string; text: string; sub: string; glow: string; cardBg: string; divider: string }> = {
    snacks:            { bg: '#1c1108', bgEnd: '#0f0a04', accent: '#f59e0b', accentSoft: '#f59e0b30', text: '#fff8e1', sub: '#c9a06a', glow: 'rgba(245,158,11,0.15)', cardBg: 'rgba(245,158,11,0.08)', divider: 'rgba(245,158,11,0.2)' },
    bakery:            { bg: '#1e0a16', bgEnd: '#10050c', accent: '#f472b6', accentSoft: '#f472b630', text: '#fef1f7', sub: '#c48aa8', glow: 'rgba(244,114,182,0.15)', cardBg: 'rgba(244,114,182,0.08)', divider: 'rgba(244,114,182,0.2)' },
    tiffin:            { bg: '#0f1a08', bgEnd: '#080e04', accent: '#84cc16', accentSoft: '#84cc1630', text: '#f7fee7', sub: '#8aac5e', glow: 'rgba(132,204,22,0.15)', cardBg: 'rgba(132,204,22,0.08)', divider: 'rgba(132,204,22,0.2)' },
    coaching:          { bg: '#080f1e', bgEnd: '#040810', accent: '#60a5fa', accentSoft: '#60a5fa30', text: '#eff6ff', sub: '#6d90b8', glow: 'rgba(96,165,250,0.15)', cardBg: 'rgba(96,165,250,0.08)', divider: 'rgba(96,165,250,0.2)' },
    spiritual_healing: { bg: '#100820', bgEnd: '#080410', accent: '#a78bfa', accentSoft: '#a78bfa30', text: '#f5f3ff', sub: '#8a7aaa', glow: 'rgba(167,139,250,0.15)', cardBg: 'rgba(167,139,250,0.08)', divider: 'rgba(167,139,250,0.2)' },
    beauty:            { bg: '#1e0f14', bgEnd: '#10080a', accent: '#fb7185', accentSoft: '#fb718530', text: '#fff1f2', sub: '#b88090', glow: 'rgba(251,113,133,0.15)', cardBg: 'rgba(251,113,133,0.08)', divider: 'rgba(251,113,133,0.2)' },
    jewelry:           { bg: '#0f0f1e', bgEnd: '#080810', accent: '#c4b5fd', accentSoft: '#c4b5fd30', text: '#f5f3ff', sub: '#8a84aa', glow: 'rgba(196,181,253,0.15)', cardBg: 'rgba(196,181,253,0.08)', divider: 'rgba(196,181,253,0.2)' },
    crafts:            { bg: '#0a1a14', bgEnd: '#050e0a', accent: '#34d399', accentSoft: '#34d39930', text: '#ecfdf5', sub: '#6aaa88', glow: 'rgba(52,211,153,0.15)', cardBg: 'rgba(52,211,153,0.08)', divider: 'rgba(52,211,153,0.2)' },
    food:              { bg: '#1c1108', bgEnd: '#0f0a04', accent: '#f59e0b', accentSoft: '#f59e0b30', text: '#fff8e1', sub: '#c9a06a', glow: 'rgba(245,158,11,0.15)', cardBg: 'rgba(245,158,11,0.08)', divider: 'rgba(245,158,11,0.2)' },
    healing:           { bg: '#100820', bgEnd: '#080410', accent: '#a78bfa', accentSoft: '#a78bfa30', text: '#f5f3ff', sub: '#8a7aaa', glow: 'rgba(167,139,250,0.15)', cardBg: 'rgba(167,139,250,0.08)', divider: 'rgba(167,139,250,0.2)' },
    services:          { bg: '#080f1e', bgEnd: '#040810', accent: '#60a5fa', accentSoft: '#60a5fa30', text: '#eff6ff', sub: '#6d90b8', glow: 'rgba(96,165,250,0.15)', cardBg: 'rgba(96,165,250,0.08)', divider: 'rgba(96,165,250,0.2)' },
  };
  const c = palettes[niche] || palettes.snacks;

  // Split products into two columns
  const col1 = productList.slice(0, Math.ceil(productList.length / 2));
  const col2 = productList.slice(Math.ceil(productList.length / 2));

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
        {/* Decorative corner accents */}
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: 200, height: 200, borderBottom: `1px solid ${c.divider}`, borderRight: `1px solid ${c.divider}`, borderBottomRightRadius: 200 }} />
        <div style={{ display: 'flex', position: 'absolute', bottom: 0, right: 0, width: 200, height: 200, borderTop: `1px solid ${c.divider}`, borderLeft: `1px solid ${c.divider}`, borderTopLeftRadius: 200 }} />

        {/* Large glow behind business name */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            top: 40,
            left: '50%',
            width: 700,
            height: 400,
            borderRadius: 9999,
            background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
            transform: 'translateX(-50%)',
          }}
        />

        {/* Top accent line */}
        <div style={{ display: 'flex', width: '100%', height: 3, background: `linear-gradient(90deg, transparent 5%, ${c.accent} 50%, transparent 95%)` }} />

        {/* ─── Header: Badge + Business Name + Tagline ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '52px 60px 0', zIndex: 1 }}>
          {/* Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: `1.5px solid ${c.accent}`,
              borderRadius: 999,
              padding: '6px 24px',
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: c.accent, letterSpacing: 4, textTransform: 'uppercase' as const }}>
              Now Taking Orders
            </span>
          </div>

          {/* Business name */}
          <span
            style={{
              fontSize: businessName.length > 20 ? 56 : businessName.length > 14 ? 68 : 80,
              fontWeight: 900,
              color: c.text,
              letterSpacing: -1,
              lineHeight: 1.1,
              textAlign: 'center' as const,
              marginBottom: 12,
            }}
          >
            {businessName}
          </span>

          {/* Tagline */}
          {tagline ? (
            <span style={{ fontSize: 22, color: c.sub, fontStyle: 'italic' as const, lineHeight: 1.4, textAlign: 'center' as const, maxWidth: 700 }}>
              {tagline.length > 80 ? tagline.slice(0, 77) + '...' : tagline}
            </span>
          ) : null}

          {/* City */}
          {cityName ? (
            <span style={{ fontSize: 16, color: c.sub, fontWeight: 500, marginTop: 8, letterSpacing: 2 }}>
              {cityName.toUpperCase()}
            </span>
          ) : null}
        </div>

        {/* Decorative divider */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 100px 16px', zIndex: 1 }}>
          <div style={{ display: 'flex', flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${c.divider})` }} />
          <span style={{ fontSize: 18, color: c.accent, padding: '0 16px' }}>✦</span>
          <span style={{ fontSize: 12, color: c.sub, letterSpacing: 3, padding: '0 8px', textTransform: 'uppercase' as const }}>
            Our Menu
          </span>
          <span style={{ fontSize: 18, color: c.accent, padding: '0 16px' }}>✦</span>
          <div style={{ display: 'flex', flex: 1, height: 1, background: `linear-gradient(90deg, ${c.divider}, transparent)` }} />
        </div>

        {/* ─── Product Menu: Two-column layout ─── */}
        <div style={{ display: 'flex', padding: '0 70px', gap: 24, zIndex: 1, flex: 1 }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
            {col1.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: c.cardBg,
                  borderRadius: 12,
                  padding: '14px 20px',
                  border: `1px solid ${c.divider}`,
                }}
              >
                <span style={{ fontSize: 20, color: c.text, fontWeight: 600, flex: 1 }}>
                  {p.name.length > 18 ? p.name.slice(0, 16) + '...' : p.name}
                </span>
                <span style={{ fontSize: 20, color: c.accent, fontWeight: 700, marginLeft: 12 }}>
                  {currency}{p.price}
                </span>
              </div>
            ))}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
            {col2.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: c.cardBg,
                  borderRadius: 12,
                  padding: '14px 20px',
                  border: `1px solid ${c.divider}`,
                }}
              >
                <span style={{ fontSize: 20, color: c.text, fontWeight: 600, flex: 1 }}>
                  {p.name.length > 18 ? p.name.slice(0, 16) + '...' : p.name}
                </span>
                <span style={{ fontSize: 20, color: c.accent, fontWeight: 700, marginLeft: 12 }}>
                  {currency}{p.price}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Bottom: Offer + CTA ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 60px 50px', zIndex: 1 }}>
          {/* Launch offer */}
          {launchOffer ? (
            <div
              style={{
                display: 'flex',
                background: c.accentSoft,
                borderRadius: 12,
                padding: '10px 32px',
                marginBottom: 20,
                border: `1px solid ${c.divider}`,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: c.accent }}>
                {launchOffer}
              </span>
            </div>
          ) : null}

          {/* Order CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: c.accent,
              borderRadius: 50,
              padding: '18px 64px',
              marginBottom: 16,
              boxShadow: `0 8px 32px ${c.glow}`,
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>
              Order on WhatsApp
            </span>
          </div>

          {/* URL */}
          <span style={{ fontSize: 18, color: c.sub, letterSpacing: 1 }}>
            kloviapp.com/{slug}
          </span>
        </div>

        {/* Bottom accent line */}
        <div style={{ display: 'flex', width: '100%', height: 3, background: `linear-gradient(90deg, transparent 5%, ${c.accent} 50%, transparent 95%)`, position: 'absolute', bottom: 0 }} />
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
