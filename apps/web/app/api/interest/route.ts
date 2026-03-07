import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Phase 0: Interest page management
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { data: pages } = await supabase
    .from('interest_pages')
    .select('*, signups:interest_signups(count)')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ pages: pages || [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, slug, category, country')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const body = await request.json();
  const { title, description, product_ideas, target_price_range } = body;

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // AI-powered demand analysis
  let demandLevel = 'unknown';
  let suggestedPrice = null;
  let pivotSuggestions: string[] = [];

  try {
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a market research analyst. Respond with valid JSON only.',
          },
          {
            role: 'user',
            content: `Analyze this business idea for a home-based ${seller.category} business in ${seller.country}:

Title: ${title}
Description: ${description || 'N/A'}
Product ideas: ${product_ideas?.join(', ') || 'N/A'}
Target price range: ${target_price_range || 'N/A'}

Respond with JSON:
{
  "demand_level": "high" | "medium" | "low",
  "suggested_price": number or null,
  "pivot_suggestions": ["string", "string"],
  "threshold_recommendation": number (suggested number of signups before launching),
  "reasoning": "brief explanation"
}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const analysis = JSON.parse(aiData.choices[0].message.content);
      demandLevel = analysis.demand_level;
      suggestedPrice = analysis.suggested_price;
      pivotSuggestions = analysis.pivot_suggestions || [];
    }
  } catch {
    // Continue without AI analysis
  }

  const { data: page, error } = await supabase
    .from('interest_pages')
    .insert({
      seller_id: seller.id,
      title,
      description: description || null,
      product_ideas: product_ideas || [],
      target_price_range: target_price_range || null,
      demand_level: demandLevel,
      suggested_price: suggestedPrice,
      pivot_suggestions: pivotSuggestions,
      threshold: 20, // Default, can be customized
      signup_count: 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create interest page' }, { status: 500 });
  }

  return NextResponse.json({ page });
}
