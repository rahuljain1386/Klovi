import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { businessType, city, country } = await request.json();
    if (!businessType) return NextResponse.json({ error: 'Business type required' }, { status: 400 });

    const currency = country === 'india' ? 'INR' : 'USD';
    const priceGuide = currency === 'INR'
      ? 'Prices in INR (typical range ₹50-₹2000 for home businesses)'
      : 'Prices in USD (typical range $5-$100 for home businesses)';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You generate product catalogs for small home-based businesses in ${city || 'India'}.
Given a business type, create 8-12 realistic products that such a business would sell.

For each product return:
- name: product name (short, clear)
- description: 1-line selling description
- category: sub-category within this business
- highlight: 1 catchy selling phrase
- priceMin: minimum price (number)
- priceMax: maximum price (number)
- variants: array of variant names (e.g. sizes, colors) — can be empty
- pexelsQuery: a search query that would find a good photo of this product on Pexels (in English, be specific)

${priceGuide}

Return ONLY a JSON array: [{"name":"...","description":"...","category":"...","highlight":"...","priceMin":100,"priceMax":300,"variants":[],"pexelsQuery":"..."}]
No markdown, no explanation. Just the JSON array.`,
        },
        {
          role: 'user',
          content: `Business type: "${businessType}"`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const products = JSON.parse(cleaned);
    return NextResponse.json({ products, businessType });
  } catch {
    return NextResponse.json({ error: 'Failed to generate catalog' }, { status: 500 });
  }
}
