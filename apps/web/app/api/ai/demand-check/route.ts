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
          content: `You are a hyperlocal business advisor for home-based businesses. Given a product/service idea and a location, create a comprehensive startup guide. Be encouraging but honest. Use REAL local context — pricing, competitors, and suggestions must reflect the actual neighborhood/city.

IMPORTANT: The user may type in Hindi, Hinglish, or their local language. ALWAYS respond in the SAME language they used. If they typed in Hindi, respond in Hindi. If English, respond in English. If mixed, use the same mix.

Return ONLY a valid JSON object with these exact fields:
{
  "demand_level": "HIGH" | "MEDIUM" | "LOW",
  "demand_summary": "One punchy sentence about demand in their area — in user's language",
  "competitor_price_low": number,
  "competitor_price_high": number,
  "suggested_price": number,
  "competitor_analysis": "2-3 sentences about local competition — in user's language",
  "insight": "2-3 sentences of actionable insight — in user's language",
  "product_name": "A catchy business name suggestion (keep it simple, brandable)",
  "pivot_suggestions": ["alternative idea 1", "alternative idea 2", "alternative idea 3"],
  "suggested_menu": [
    { "name": "item name", "price": number, "why": "one line why this sells well here" }
  ],
  "how_to_start": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ...",
    "Step 4: ..."
  ],
  "where_to_sell": [
    "Specific place/method near their location to find customers"
  ],
  "best_times": "When demand peaks (e.g., 'Weekend mornings', 'Festival season')",
  "startup_cost": "Estimated initial investment to start (e.g., '₹2,000 - ₹5,000')",
  "monthly_potential": "Realistic monthly revenue if they get 3-5 orders/day",
  "tips": [
    "Practical tip 1",
    "Practical tip 2",
    "Practical tip 3"
  ],
  "language_detected": "en" | "hi" | "mixed"
}

suggested_menu: Suggest 4-6 specific products/items they should offer with realistic local prices in ${currency}. These should be items that sell well in their specific area.
how_to_start: 4-5 concrete steps specific to their business and location. Not generic — mention actual things like "register on Swiggy/Zomato" or "post in local Facebook groups" etc.
where_to_sell: 3-4 specific channels/places — nearby offices, housing societies, WhatsApp groups, Instagram, local markets, etc. Be specific to their location.
tips: 3 practical, non-obvious tips specific to their business type and location.

All prices in ${currency}. No markdown, no code fences.`,
        },
        {
          role: 'user',
          content: `Product/service idea: ${product}\nLocation: ${city}\nCountry: ${country || 'usa'}`,
        },
      ],
      max_tokens: 2000,
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
