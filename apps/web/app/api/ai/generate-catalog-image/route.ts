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
    const { productId, name, category } = await request.json();
    if (!productId || !name) {
      return NextResponse.json({ error: 'productId and name required' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Professional product photo of "${name}" (${category || 'food'}). Clean white background, soft natural lighting, slightly elevated camera angle. Realistic, appetizing, high-quality commercial photography style. Show only the product — no text, labels, watermarks, decorations, or other objects.`,
      n: 1,
      size: '1024x1024',
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
