import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { businessName, businessType, city, products } = await request.json();
    if (!businessName) return NextResponse.json({ error: 'Business name required' }, { status: 400 });

    const prompt = `Create a beautiful, modern social media launch announcement post for a small business called "${businessName}".
Business type: ${businessType || 'local business'}.
Location: ${city || 'local area'}.
${products ? `Featured products: ${products}.` : ''}

Design style: Clean, modern, warm and inviting. Use soft warm tones (cream, amber, brown).
Include the business name prominently. Show it as a real business launch poster.
Include a tagline like "Now Open" or "Grand Opening" or "Now Taking Orders".
Make it look professional but personal — like a proud small business owner's first post.
No stock photo feel. No generic clipart. Make it feel authentic and celebratory.
Square format (1:1 ratio). No placeholder text like "lorem ipsum".`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'No image generated' }, { status: 500 });

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch {
    return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 });
  }
}
