import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { product, city, country } = await request.json();

    if (!product || !city) {
      return NextResponse.json({ error: 'Product and city are required' }, { status: 400 });
    }

    const currency = country === 'india' ? 'INR (₹)' : 'USD ($)';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a market research analyst for home-based businesses. Given a product/service idea and a city, analyze the local demand and competition. Be encouraging but honest. Use local context — pricing should reflect the actual city and country.

Return ONLY a valid JSON object with these exact fields:
{
  "demand_level": "HIGH" | "MEDIUM" | "LOW",
  "demand_summary": "One sentence about demand in this area",
  "competitor_price_low": number,
  "competitor_price_high": number,
  "suggested_price": number,
  "competitor_analysis": "2-3 sentences about local competition",
  "insight": "2-3 sentences of actionable insight — what makes this opportunity good or what to watch out for",
  "product_name": "A catchy, clean product/business name suggestion based on what they described",
  "pivot_suggestions": ["alternative idea 1", "alternative idea 2", "alternative idea 3"]
}

All prices in ${currency}. No markdown, no code fences.`,
        },
        {
          role: 'user',
          content: `Product/service idea: ${product}\nCity: ${city}\nCountry: ${country || 'usa'}`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const data = JSON.parse(cleaned);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }
  } catch (error) {
    console.error('Demand check error:', error);
    return NextResponse.json({ error: 'Failed to analyze demand' }, { status: 500 });
  }
}
