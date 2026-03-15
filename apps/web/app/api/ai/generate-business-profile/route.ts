import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { businessName, niche, city, country, products, ownerName, gender } =
    await request.json();

  if (!businessName || !niche) {
    return NextResponse.json({ error: 'businessName and niche required' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
  }

  const currency = country === 'india' || country === 'IN' ? '₹' : '$';
  const countryName = country === 'india' || country === 'IN' ? 'India' : 'USA';
  const productList = (products || []).join(', ');

  const prompt = `You are a business branding expert for home-based businesses.

Business: "${businessName}"
Owner: ${ownerName || 'not provided'} (${gender || 'not specified'})
Niche: ${niche}
City: ${city || 'not specified'}
Country: ${countryName}
Currency: ${currency}
Products they selected: ${productList || 'not yet selected'}

Generate the following in JSON format:
{
  "tagline": "A catchy 5-8 word tagline for their storefront",
  "description": "A warm 2-sentence business description for the storefront",
  "productDescriptions": {
    "Product Name": "Appetizing 1-line description"
  },
  "pricingSuggestions": {
    "Product Name": { "min": number, "max": number, "suggested": number }
  },
  "launchOffer": "A compelling first-order offer (e.g., '10% off your first order')",
  "topSellingTip": "One sentence about what sells best in this niche in this city/country"
}

Rules:
- Tagline must feel personal and warm, not corporate
- Pricing must be realistic for HOME-BASED ${niche} in ${city || countryName} (use ${currency})
- ${countryName === 'India' ? 'Indian pricing: snacks ₹50-₹500, bakery ₹100-₹2000, coaching ₹500-₹5000/session' : 'US pricing: snacks $5-$30, bakery $10-$80, coaching $50-$200/session'}
- Product descriptions should make the customer HUNGRY or EXCITED
- Launch offer should be simple, not complicated coupons
- Response language should match the likely customer base (English for USA, English for India unless Hindi name)
- Return ONLY valid JSON, no markdown`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const profile = JSON.parse(jsonStr);

    return NextResponse.json(profile);
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Failed to generate profile', detail: e.message },
      { status: 500 }
    );
  }
}
