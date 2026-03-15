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
    .select('id, business_name, tagline, ai_tagline, city, category, niche, owner_name')
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
    .limit(4);

  const tagline = seller.tagline || seller.ai_tagline || '';
  const productList = (products || []).slice(0, 4);
  const sym = (productList[0]?.currency === 'USD') ? '$' : '₹';
  const businessName = seller.business_name || 'My Shop';
  const cityName = seller.city || '';

  // Build product pill elements (avoid conditional .map inside JSX)
  const productPills = productList.map((p: any, i: number) => (
    <div
      key={i}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 16,
        padding: '16px 28px',
      }}
    >
      <span style={{ fontSize: 22, color: 'white', fontWeight: 600 }}>{p.name}</span>
      {p.price > 0 ? (
        <span style={{ fontSize: 18, color: '#f59e0b', fontWeight: 700, marginLeft: 10 }}>{sym}{p.price}</span>
      ) : null}
    </div>
  ));

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top label */}
        <div style={{ display: 'flex', marginBottom: 24 }}>
          <span style={{ fontSize: 16, color: '#f59e0b', letterSpacing: 4, fontWeight: 700 }}>POWERED BY KLOVI</span>
        </div>

        {/* Business Name */}
        <div style={{ display: 'flex', marginBottom: 16, padding: '0 60px' }}>
          <span style={{ fontSize: 64, fontWeight: 900, color: 'white', textAlign: 'center' as const }}>
            {businessName}
          </span>
        </div>

        {/* Tagline */}
        {tagline ? (
          <div style={{ display: 'flex', marginBottom: 12, padding: '0 80px' }}>
            <span style={{ fontSize: 26, color: '#d1d5db', fontStyle: 'italic' as const }}>
              {tagline}
            </span>
          </div>
        ) : null}

        {/* City */}
        {cityName ? (
          <div style={{ display: 'flex', marginBottom: 40 }}>
            <span style={{ fontSize: 22, color: '#f59e0b' }}>
              {cityName}
            </span>
          </div>
        ) : null}

        {/* Products section */}
        {productList.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
            <div style={{ display: 'flex', marginBottom: 20 }}>
              <span style={{ fontSize: 14, color: '#9ca3af', letterSpacing: 4, fontWeight: 700 }}>OUR SPECIALTIES</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', padding: '0 60px' }}>
              {productPills}
            </div>
          </div>
        ) : null}

        {/* CTA button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#22c55e',
            borderRadius: 24,
            padding: '24px 72px',
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 800, color: 'white' }}>Order on WhatsApp</span>
        </div>

        {/* URL */}
        <div style={{ display: 'flex' }}>
          <span style={{ fontSize: 24, color: '#9ca3af' }}>kloviapp.com/{slug}</span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
