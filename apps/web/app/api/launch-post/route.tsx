import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return new Response('slug required', { status: 400 });
  }

  // Use service role to bypass RLS for public access
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

  // Fetch top 4 products
  const { data: products } = await supabase
    .from('products')
    .select('name, price, currency')
    .eq('seller_id', seller.id)
    .eq('status', 'active')
    .order('sort_order')
    .limit(4);

  const tagline = seller.tagline || seller.ai_tagline || '';
  const nicheEmoji = seller.niche === 'snacks' ? '🥨' : seller.niche === 'bakery' ? '🧁' : seller.niche === 'coaching' ? '📚' : seller.niche === 'spiritual_healing' ? '🔮' : '✨';
  const productNames = (products || []).map((p: any) => p.name).slice(0, 4);
  const sym = (products?.[0]?.currency === 'USD') ? '$' : '₹';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.15)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex' }} />

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '80px', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '14px', color: '#f59e0b', letterSpacing: '3px', fontWeight: 700 }}>POWERED BY KLOVI</span>
          </div>
          <div style={{ fontSize: '72px', marginBottom: '12px', display: 'flex' }}>{nicheEmoji}</div>
          <h1 style={{ fontSize: '56px', fontWeight: 900, color: 'white', margin: 0, textAlign: 'center', lineHeight: 1.1, padding: '0 60px' }}>
            {seller.business_name}
          </h1>
          {tagline && (
            <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.65)', margin: '16px 0 0 0', fontStyle: 'italic', textAlign: 'center', padding: '0 80px' }}>
              {tagline}
            </p>
          )}
          {seller.city && (
            <p style={{ fontSize: '20px', color: '#f59e0b', margin: '12px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {seller.city}
            </p>
          )}
        </div>

        {/* Products */}
        {productNames.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 60px', flex: 1 }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', letterSpacing: '3px', fontWeight: 700, margin: '0 0 24px 0' }}>OUR SPECIALTIES</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', justifyContent: 'center' }}>
              {productNames.map((name: string, i: number) => (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '16px',
                    padding: '18px 32px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '22px', color: 'white', fontWeight: 600 }}>{name}</span>
                  {products?.[i]?.price && (
                    <span style={{ fontSize: '18px', color: '#f59e0b', fontWeight: 700 }}>{sym}{products[i].price}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 60px 60px' }}>
          <div
            style={{
              background: '#22c55e',
              borderRadius: '24px',
              padding: '24px 72px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '20px',
              boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
            }}
          >
            <span style={{ fontSize: '32px', fontWeight: 800, color: 'white' }}>Order on WhatsApp</span>
          </div>
          <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            kloviapp.com/{slug}
          </p>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
