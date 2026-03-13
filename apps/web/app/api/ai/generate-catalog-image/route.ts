import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

const OWNER_EMAILS = ['meetrj1386@gmail.com', 'shefalijain@gmail.com'];

export async function POST(request: Request) {
  // Verify admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !OWNER_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
  }

  try {
    const { productId, name, category, description } = await request.json();
    if (!productId || !name) {
      return NextResponse.json({ error: 'productId and name required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    // Step 1: Use GPT-4o to write a culturally-accurate DALL-E prompt
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert product photographer who specializes in Indian and South Asian products.
Your job is to write a DALL-E 3 image generation prompt for a product listing.

CRITICAL RULES:
- You deeply understand Indian products. For example:
  - "Blouse" in Indian context = a short, fitted saree blouse (choli), NOT a Western button-up blouse
  - "Kurti" = a long Indian tunic for women
  - "Ladoo/Laddu" = round Indian sweet balls
  - "Thali" = a round steel plate with small bowls of different dishes
  - "Dosa" = thin crispy South Indian crepe
- Describe the product with precise visual details so DALL-E generates the CORRECT item
- Always specify it's a product-only photo: no people, no hands, no mannequins
- Specify: clean white/light background, studio lighting, flat lay or 45-degree angle
- Keep the prompt under 200 words
- Output ONLY the prompt text, nothing else`
        },
        {
          role: 'user',
          content: `Product: "${name}"\nCategory: ${category || 'general'}\nDescription: ${description || 'none'}`
        }
      ],
      max_tokens: 300,
    });

    const dallePrompt = gptResponse.choices[0]?.message?.content?.trim();
    if (!dallePrompt) {
      return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 });
    }

    // Step 2: Generate image with DALL-E 3 using the smart prompt
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'b64_json',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

    // Upload to Supabase storage
    const serviceClient = createServiceRoleClient();
    const buffer = Buffer.from(b64, 'base64');
    const path = `catalog/${productId}/ai-${Date.now()}.png`;

    const { error: uploadError } = await serviceClient.storage
      .from('product-images')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = serviceClient.storage
      .from('product-images')
      .getPublicUrl(path);

    // Update catalog product
    await serviceClient.from('catalog_products').update({ image_url: urlData.publicUrl }).eq('id', productId);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err: any) {
    console.error('Generate catalog image error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate image' }, { status: 500 });
  }
}
