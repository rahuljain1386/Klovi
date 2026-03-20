import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const formData = await request.formData();
  const niche = formData.get('niche') as string || 'food';
  const files = formData.getAll('images') as File[];

  if (!files.length) return NextResponse.json({ error: 'No images uploaded' }, { status: 400 });
  if (files.length > 5) return NextResponse.json({ error: 'Max 5 images' }, { status: 400 });

  // Convert images to base64 parts for Gemini
  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) continue; // skip > 5MB
    const buffer = Buffer.from(await file.arrayBuffer());
    imageParts.push({
      inlineData: {
        mimeType: file.type || 'image/jpeg',
        data: buffer.toString('base64'),
      },
    });
  }

  if (!imageParts.length) return NextResponse.json({ error: 'No valid images' }, { status: 400 });

  const prompt = `You are a product extraction assistant. Extract ALL products/items visible in these images.
These images could be: menu cards, flyers, price lists, product photos, WhatsApp catalog screenshots, or any business promotional material.

Business type: ${niche}

For EACH product found, extract:
- name: product/item name
- description: one-line description (from image or infer based on the product)
- price: number (0 if not visible)
- category: product category if visible
- quantity: size/unit if visible (e.g., "1kg", "6pc", "1hr session")
- ingredients: key ingredients/materials if visible (comma-separated)

RULES:
- Extract EVERY product you can see, even if partially visible
- If a flyer shows prices in ₹, extract the number only
- If you see variants (e.g., "Small ₹200, Large ₹400"), create separate entries OR put the base price and note variants in description
- For product photos without text, identify the food/item and give it an appropriate name
- Return a JSON array of products

Return: [{"name": "...", "description": "...", "price": 0, "category": "...", "quantity": "...", "ingredients": "..."}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              ...imageParts,
            ],
          }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini Vision error:', err);
      return NextResponse.json({ error: 'AI extraction failed' }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: 'No response from AI' }, { status: 500 });

    let products = JSON.parse(text);
    if (!Array.isArray(products)) products = products.products || [];

    // Clean up
    products = products.map((p: any) => ({
      name: p.name || 'Unknown Product',
      description: p.description || '',
      price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
      category: p.category || '',
      quantity: p.quantity || '',
      ingredients: p.ingredients || '',
    }));

    return NextResponse.json({ products, count: products.length, source: 'images' });
  } catch (err: any) {
    console.error('Extract from images error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
