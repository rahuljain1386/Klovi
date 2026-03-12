import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const { name, category } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `A single "${name}" on a clean white surface, photographed from a slightly elevated angle. Natural soft daylight, minimal styling, realistic product photography. This must clearly and accurately depict a "${name}" — not a different product. No text, no labels, no watermarks, no decorations, no other objects. Just the product by itself.`,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'No image generated' }, { status: 500 });

    return NextResponse.json({ image: `data:image/png;base64,${b64}` });
  } catch {
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
