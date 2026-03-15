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
    .select('id, business_name, tagline, ai_tagline, city, niche, owner_name, launch_offer')
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
    .limit(4);

  const productList = (products || []).slice(0, 4);
  const businessName = seller.business_name || 'My Shop';
  const tagline = seller.tagline || seller.ai_tagline || '';
  const launchOffer = seller.launch_offer || '';
  const cityName = seller.city || '';

  // Collect product images (from DALL-E catalog)
  const productImages: string[] = [];
  for (const p of productList) {
    if (p.images && Array.isArray(p.images) && p.images[0]) {
      productImages.push(p.images[0]);
    }
  }

  // Pick warm niche colors
  const nicheColors: Record<string, { bg1: string; bg2: string; accent: string }> = {
    snacks: { bg1: '#fef3c7', bg2: '#fff7ed', accent: '#d97706' },
    bakery: { bg1: '#fce7f3', bg2: '#fff1f2', accent: '#db2777' },
    coaching: { bg1: '#dbeafe', bg2: '#eff6ff', accent: '#2563eb' },
    spiritual_healing: { bg1: '#ede9fe', bg2: '#f5f3ff', accent: '#7c3aed' },
  };
  const colors = nicheColors[seller.niche || ''] || nicheColors.snacks;

  // Determine if we have product images to show
  const hasImages = productImages.length >= 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(180deg, ${colors.bg1} 0%, ${colors.bg2} 50%, white 100%)`,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Top accent bar */}
        <div style={{ display: 'flex', width: '100%', height: 8, background: colors.accent }} />

        {/* Header section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 60px 30px' }}>
          {/* Business name — big and bold */}
          <div style={{ display: 'flex', marginBottom: 12 }}>
            <span style={{ fontSize: 72, fontWeight: 900, color: '#1a1a1a', letterSpacing: -2 }}>
              {businessName}
            </span>
          </div>

          {/* Tagline */}
          {tagline ? (
            <div style={{ display: 'flex', marginBottom: 8 }}>
              <span style={{ fontSize: 28, color: '#6b7280', fontStyle: 'italic' as const }}>
                {tagline}
              </span>
            </div>
          ) : null}

          {/* City */}
          {cityName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 22, color: colors.accent, fontWeight: 600 }}>
                {cityName}
              </span>
            </div>
          ) : null}
        </div>

        {/* Product images grid — the hero visual */}
        {hasImages ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, padding: '20px 60px 30px', flexWrap: 'wrap' }}>
            {productImages.slice(0, 4).map((imgUrl, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  width: productImages.length <= 2 ? 400 : 220,
                  height: productImages.length <= 2 ? 400 : 220,
                  borderRadius: 24,
                  overflow: 'hidden',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt=""
                  width={productImages.length <= 2 ? 400 : 220}
                  height={productImages.length <= 2 ? 400 : 220}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
          </div>
        ) : (
          // No images — show product names in a clean list
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 80px', gap: 16 }}>
            {productList.map((p: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'white',
                  borderRadius: 16,
                  padding: '16px 40px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ fontSize: 26, color: '#1a1a1a', fontWeight: 600 }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Launch offer banner */}
        {launchOffer ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 80px', marginBottom: 20 }}>
            <div style={{ display: 'flex', background: colors.accent, borderRadius: 16, padding: '14px 40px' }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{launchOffer}</span>
            </div>
          </div>
        ) : null}

        {/* CTA — big green WhatsApp button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 60px', marginTop: 'auto', marginBottom: 50 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#25D366',
              borderRadius: 30,
              padding: '22px 64px',
              marginBottom: 16,
              boxShadow: '0 6px 24px rgba(37, 211, 102, 0.35)',
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 800, color: 'white' }}>Order Now</span>
          </div>
          <div style={{ display: 'flex' }}>
            <span style={{ fontSize: 22, color: '#9ca3af' }}>kloviapp.com/{slug}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
