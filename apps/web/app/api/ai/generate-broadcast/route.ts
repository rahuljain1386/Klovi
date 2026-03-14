import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { prompt, businessName, category, city, country } = await request.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const isIndia = country === 'india';
    const currency = isIndia ? 'INR (₹)' : 'USD ($)';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a marketing copywriter for small home-based businesses. Write broadcast messages that are warm, personal, and drive action.

Business: ${businessName}
Category: ${category || 'general'}
Location: ${city || 'unknown'}, ${isIndia ? 'India' : 'USA'}
Currency: ${currency}

Rules:
- Keep title under 50 characters, catchy and clear
- Message should be 2-4 sentences, friendly tone
- Include a clear call-to-action
- If it's a promotion, suggest realistic prices in ${currency}
- ${isIndia ? 'Can mix Hindi words naturally (like "ji", "aapke liye")' : 'Keep it in English'}
- Use emojis sparingly (1-2 max)
- Don't use hashtags — this is a direct message, not social media

Return JSON: { "title": "...", "message": "..." }`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'No response' }, { status: 500 });

    const result = JSON.parse(content);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 });
  }
}
