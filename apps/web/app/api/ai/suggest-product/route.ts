import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { name, businessType, city } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You help small home-based sellers write product details. Given a product name, suggest:
- description: 1-line selling description (catchy, short)
- category: product category
- highlight: 1 short catchy phrase
- ingredients: array of 4-6 key ingredients ONLY for food/bakery/snack/meal products. For non-food products (jewelry, coaching, crafts, etc.) return empty array.

Return ONLY JSON: {"description":"...","category":"...","highlight":"...","ingredients":["..."]}.  No markdown.`,
        },
        {
          role: 'user',
          content: `Product: "${name}"\nBusiness type: ${businessType || 'general'}\nCity: ${city || 'unknown'}`,
        },
      ],
      max_tokens: 250,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
