import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { chat, businessType } = await request.json();
    if (!chat) return NextResponse.json({ error: 'No chat text' }, { status: 400 });

    const sample = chat.slice(0, 6000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You extract customer information from a WhatsApp chat export. The business type is "${businessType || 'general'}".

Analyze the chat and identify unique customers (not the seller). For each customer extract:
- name: their WhatsApp display name
- phone: their phone number if visible in the chat
- notes: a brief note about their preferences, what they ordered, frequency, any special requests
- orderCount: estimated number of orders/interactions

Return ONLY JSON:
{"customers":[{"name":"...","phone":"...","notes":"...","orderCount":0}]}
- Only include actual customers, not the seller
- Deduplicate by name
- No markdown, no explanation.`,
        },
        { role: 'user', content: sample },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleaned);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to extract' }, { status: 500 });
  }
}
