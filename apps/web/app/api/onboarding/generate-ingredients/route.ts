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

  const foodCategories = ['snacks', 'food', 'bakery', 'tiffin', 'pickle'];
  const isFood = foodCategories.some(c => category.toLowerCase().includes(c));
  const isService = ['coaching', 'spiritual_healing', 'healing', 'beauty', 'fitness', 'services'].some(c => category.toLowerCase().includes(c));
  const isPhysical = ['jewelry', 'crafts', 'stitching', 'art'].some(c => category.toLowerCase().includes(c));

  let contextRules = '';
  if (isFood) {
    contextRules = `This is a FOOD business. List ingredients for each product.
- Use Indian ingredient names with English in parentheses: "besan (gram flour)", "poha (flattened rice)", "hing (asafoetida)"
- Be specific about oil type (mustard oil, groundnut oil, ghee), sugar type (powdered sugar, jaggery), flour type (maida, atta, besan)
- Include 6-12 key ingredients per product, comma-separated`;
  } else if (isPhysical) {
    contextRules = `This is a ${category} business. List MATERIALS used for each product.
- For jewelry: metal type (gold-plated, sterling silver, brass, copper), stones (kundan, pearl, semi-precious), other materials (thread, enamel, meenakari)
- For crafts: base material (wood, clay, fabric, resin), finishing (paint, lacquer, embroidery)
- For stitching: fabric type, thread, embellishments, lining
- Include 3-8 materials per product, comma-separated`;
  } else if (isService) {
    contextRules = `This is a ${category} SERVICE business. List KEY DETAILS for each service.
- For coaching: what's covered, mode (online/offline), duration, level, materials provided
- For healing: modality, duration, what to expect, what to bring
- For beauty: products/brands used, duration, what's included
- Include 4-8 key details per service, comma-separated`;
  } else {
    contextRules = `List the key details, materials, or components for each product/service. 4-8 items, comma-separated.`;
  }

  const prompt = `For each product/service below, list the key details as a comma-separated string.

Business type: ${category}
Products/Services:
${productList}

${contextRules}

Return JSON: {"products": [{"name": "product name", "ingredients": "detail1, detail2, ..."}]}`;

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
