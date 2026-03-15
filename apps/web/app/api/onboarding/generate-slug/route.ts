import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''"]/g, '')        // remove apostrophes/quotes
    .replace(/[^a-z0-9\s-]/g, '') // remove special chars
    .replace(/\s+/g, '-')         // spaces to hyphens
    .replace(/-+/g, '-')          // collapse hyphens
    .replace(/^-|-$/g, '');       // trim hyphens
}

export async function POST(request: Request) {
  const { businessName, city } = await request.json();

  if (!businessName) {
    return NextResponse.json({ error: 'businessName required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const base = slugify(businessName);

  if (!base) {
    return NextResponse.json({ slug: `shop-${Date.now().toString(36)}` });
  }

  // Try base slug first
  const { data: existing } = await supabase
    .from('sellers')
    .select('slug')
    .eq('slug', base)
    .limit(1);

  if (!existing || existing.length === 0) {
    return NextResponse.json({ slug: base });
  }

  // Try with city
  if (city) {
    const withCity = `${base}-${slugify(city)}`;
    const { data: existing2 } = await supabase
      .from('sellers')
      .select('slug')
      .eq('slug', withCity)
      .limit(1);

    if (!existing2 || existing2.length === 0) {
      return NextResponse.json({ slug: withCity });
    }
  }

  // Numeric fallback
  for (let i = 2; i <= 20; i++) {
    const candidate = city ? `${base}-${slugify(city)}-${i}` : `${base}-${i}`;
    const { data: existing3 } = await supabase
      .from('sellers')
      .select('slug')
      .eq('slug', candidate)
      .limit(1);

    if (!existing3 || existing3.length === 0) {
      return NextResponse.json({ slug: candidate });
    }
  }

  // Ultimate fallback
  return NextResponse.json({ slug: `${base}-${Date.now().toString(36)}` });
}
