import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const fd = await request.formData();
    const file = fd.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const text = await file.text();
    if (!text.trim()) return NextResponse.json({ error: 'Empty file' }, { status: 400 });

    // Send first 5000 chars to AI for column mapping and extraction
    const sample = text.slice(0, 5000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You parse CSV/TSV/Excel data into a product inventory. Given raw tabular data:
1. Identify which columns map to: name, price, quantity/stock, category, description
2. Extract all products as JSON array

Return ONLY JSON: {"products":[{"name":"...","price":0,"stock":null,"category":"...","description":"..."}]}
- price should be a number (remove currency symbols)
- stock should be a number or null if not available
- category should be inferred if not in data
- No markdown, no explanation.`,
        },
        { role: 'user', content: sample },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}
