import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { type, content, image_url } = await request.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = 'Extract products from the input. Return ONLY a JSON array: [{"name": "...", "price": 0, "description": "...", "variants": null}]. No markdown.';

    const messages: any[] = type === 'image' && image_url
      ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: [{ type: 'text', text: 'Extract all items with prices from this image:' }, { type: 'image_url', image_url: { url: image_url } }] }]
      : [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Extract products from:\n\n${content}` }];

    const completion = await openai.chat.completions.create({ model: 'gpt-4o', messages, max_tokens: 2000, temperature: 0.2 });
    const raw = completion.choices[0]?.message?.content || '[]';

    let products;
    try { products = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); }
    catch { products = []; }

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Menu extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
