import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { products, whatYouSell, city } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 });
    }

    const productSummary = products
      .map((p: { name: string; description?: string; price: number; variants?: { label: string; price: number }[]; stock?: number | null }) => {
        let s = `- ${p.name}: $${p.price}`;
        if (p.description) s += ` — "${p.description}"`;
        if (p.variants && p.variants.length > 0)
          s += ` | Sizes: ${p.variants.map(v => `${v.label} = $${v.price}`).join(', ')}`;
        if (p.stock !== null && p.stock !== undefined) s += ` | ${p.stock} in stock`;
        return s;
      })
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a smart business coach for small home-based sellers. You give short, actionable, encouraging tips to help them sell more. Be specific to their products — never generic. Keep each tip to 1-2 sentences max. Return ONLY a JSON array of 4-5 tip strings. No markdown, no code fences, no explanation.`,
        },
        {
          role: 'user',
          content: `I sell: ${whatYouSell || 'various products'}
Location: ${city || 'not specified'}

My products:
${productSummary}

Give me 4-5 specific, actionable tips covering:
1. How to improve my product descriptions to attract more buyers
2. Whether my pricing looks right for what I'm selling
3. Any info customers would want that I'm missing
4. A smart marketing angle I could use
5. Whether I should offer bundles, combos, or volume discounts`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const tips = JSON.parse(cleaned);
      if (Array.isArray(tips)) {
        return NextResponse.json({
          tips: tips.filter((t: unknown) => typeof t === 'string').slice(0, 5),
        });
      }
    } catch {
      // If JSON parse fails, try to extract lines as tips
      const lines = cleaned.split('\n').filter(l => l.trim().length > 10).slice(0, 5);
      if (lines.length > 0) {
        return NextResponse.json({ tips: lines });
      }
    }

    return NextResponse.json({ error: 'Could not generate tips' }, { status: 500 });
  } catch (error) {
    console.error('Product tips error:', error);
    return NextResponse.json({ error: 'Failed to generate tips' }, { status: 500 });
  }
}
