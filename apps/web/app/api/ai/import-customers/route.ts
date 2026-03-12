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

    const sample = text.slice(0, 5000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You parse CSV/TSV/Excel data into a customer list. Given raw tabular data:
1. Identify columns for: name, phone, email, notes/preferences, order history
2. Extract all customers as JSON

Return ONLY JSON:
{
  "customers": [{"name":"...","phone":"...","notes":"...","orderCount":0}],
  "insights": {
    "total": 0,
    "topCustomer": "name of most frequent buyer",
    "topCount": 0,
    "inactive": 0,
    "birthdays": 0
  }
}
- orderCount: number of orders if available, else 0
- inactive: customers with no activity in 30+ days (estimate from data)
- birthdays: customers with birthdays this month (if birthday data exists)
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
