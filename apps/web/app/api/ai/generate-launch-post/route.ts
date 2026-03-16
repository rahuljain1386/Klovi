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

    const type = businessType || 'local business';
    const location = city || 'local area';

    const prompt = `A stunning, emotional Instagram announcement card for "${businessName}" — a home-based ${type} business launching in ${location}.

Visual style: Warm luxury aesthetic. Think handcrafted, personal, real.
Background: soft bokeh of a warm kitchen/workspace with golden hour lighting, NOT a white studio.
Dominant colors: cream, warm amber, terracotta, gold accents.

Large elegant text overlay (center): "${businessName}"
Subtext below: "${type} · ${location}"
Bottom text: "Now Taking Orders"
${products ? `Small tasteful product mention at bottom: "${products}"` : ''}

Mood: Celebratory, warm, intimate. Like a friend announcing their dream coming true. NOT corporate. NOT stock photo. NOT a flyer template.
Feel proud, feel personal, feel real.

Square format 1:1. Cinematic warm lighting. No watermarks. No logos. No clip art. No generic stock elements.`;

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'No image generated' }, { status: 500 });

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch {
    return NextResponse.json({ error: 'Failed to generate post' }, { status: 500 });
  }
}
