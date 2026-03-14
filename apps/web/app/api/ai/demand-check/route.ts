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

    // Detect input language from the product text
    const hasHindi = /[\u0900-\u097F]/.test(product);
    const hasEnglish = /[a-zA-Z]{3,}/.test(product);
    const inputLang = hasHindi && hasEnglish ? 'mixed (Hinglish)' : hasHindi ? 'Hindi' : 'English';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a friendly business advisor for HOME-BASED businesses (selling from home, not restaurants or shops).

LANGUAGE RULE (CRITICAL — FOLLOW EXACTLY):
The user typed in ${inputLang}. You MUST respond in EXACTLY that language.
- If input is in English → ALL text fields MUST be in English. Do NOT use Hindi.
- If input is in Hindi → respond in Hindi.
- If mixed/Hinglish → use the same mix.
The country being India does NOT mean you should use Hindi. Follow the INPUT language only.

SIMPLICITY RULE (CRITICAL):
This person is considering starting from HOME. They have ZERO experience with business.
- NEVER suggest: FSSAI, licenses, GST, Swiggy, Zomato, legal registration, permits, trademark, business cards, packaging suppliers, or anything bureaucratic.
- NEVER make it sound complicated. A 55-year-old homemaker should read your steps and think "I can do this TODAY."
- The steps must be things they can do RIGHT NOW from their kitchen/home with zero paperwork.

Return ONLY a valid JSON object with these exact fields:
{
  "demand_level": "HIGH" | "MEDIUM" | "LOW",
  "demand_summary": "One encouraging sentence about demand in their area",
  "competitor_price_low": number,
  "competitor_price_high": number,
  "suggested_price": number,
  "competitor_analysis": "2-3 sentences about local competition",
  "insight": "2-3 sentences of actionable, encouraging insight",
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

suggested_menu: Suggest 4-6 specific products/items they should offer with realistic local prices in ${currency}. Items that sell well in their specific neighborhood.

how_to_start: 4 SIMPLE steps anyone can do TODAY from home. Examples of GOOD steps:
- "Make 3-5 samples and take nice photos in natural light"
- "Post photos on your WhatsApp Status and ask friends to share"
- "Tell 10 neighbors and offer a free tasting/sample"
- "Start a WhatsApp group for orders — share your Klovi shop link"
- "Set up your Klovi page with photos and prices (takes 5 min)"
Examples of BAD steps (NEVER suggest these):
- "Register on Swiggy/Zomato" ← TOO COMPLEX
- "Get FSSAI license" ← SCARES PEOPLE AWAY
- "Register your business" ← UNNECESSARY FOR HOME BUSINESS
- "Create a website" ← THEY HAVE KLOVI

where_to_sell: 3-4 simple channels — WhatsApp groups, neighborhood aunties, society WhatsApp groups, Instagram stories, nearby offices/PGs, local events. Be specific to their area.

tips: 3 practical, non-obvious tips. Keep them simple and encouraging.

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
