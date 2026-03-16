import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Auto-generate ingredients for all products of a seller using AI.
 * Called during onboarding after products are saved.
 *
 * POST /api/onboarding/generate-ingredients
 * Body: { sellerId }
 * Returns: { products: [{ id, name, ingredients }] }
 */
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sellerId } = await request.json();
  if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  // Verify ownership
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, user_id, business_name, niche, category')
    .eq('id', sellerId)
    .single();

  if (!seller || seller.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or not owned' }, { status: 403 });
  }

  // Get products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, category')
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .limit(30);

  if (!products || products.length === 0) {
    return NextResponse.json({ success: true, products: [] });
  }

  const category = seller.niche || seller.category || 'food';
  const productList = products.map(p => `${p.name}${p.description ? ` (${p.description})` : ''}${p.category ? ` [${p.category}]` : ''}`).join('\n');

  const prompt = `For each product below, list the typical Indian homemade ingredients as a comma-separated string.

Business type: ${category}
Products:
${productList}

RULES:
- Use Indian ingredient names with English in parentheses where helpful: "besan (gram flour)", "poha (flattened rice)", "hing (asafoetida)"
- Be specific: mention the type of oil (mustard oil, groundnut oil, ghee), type of sugar (powdered sugar, jaggery), type of flour (maida, atta, besan)
- Include all key ingredients a customer would want to know about
- Keep each product's ingredients to 6-12 items, comma-separated
- For non-food items (services, coaching, etc.), return empty string

Return JSON: {"products": [{"name": "product name", "ingredients": "ingredient1, ingredient2, ..."}]}`;

  try {
    // Try Gemini first (faster), fall back to OpenAI
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    let result: { name: string; ingredients: string }[] = [];

    if (geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            result = parsed.products || parsed;
          }
        }
      } catch (e) {
        console.error('Gemini ingredients error:', e);
      }
    }

    // Fallback to OpenAI
    if (result.length === 0 && openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You generate ingredient lists for Indian homemade food products. Return only JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices[0]?.message?.content;
        const parsed = JSON.parse(content);
        result = parsed.products || parsed;
      }
    }

    if (!Array.isArray(result) || result.length === 0) {
      return NextResponse.json({ error: 'No ingredients generated' }, { status: 500 });
    }

    // Update each product with generated ingredients
    const updates: { id: string; name: string; ingredients: string }[] = [];
    for (const item of result) {
      const product = products.find(p => p.name.toLowerCase() === item.name?.toLowerCase());
      if (product && item.ingredients) {
        const { error } = await supabase
          .from('products')
          .update({ ingredients: item.ingredients })
          .eq('id', product.id);
        if (!error) {
          updates.push({ id: product.id, name: product.name, ingredients: item.ingredients });
        }
      }
    }

    return NextResponse.json({ success: true, products: updates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
