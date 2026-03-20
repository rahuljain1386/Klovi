import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const { url, niche } = await request.json();
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid URL required (https://...)' }, { status: 400 });
  }

  // Fetch the page
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KloviBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Could not access website (${res.status}). Try uploading screenshots instead.` }, { status: 400 });
    }
    html = await res.text();
  } catch {
    return NextResponse.json({ error: 'Could not access this website. Try uploading screenshots of your product pages instead.' }, { status: 400 });
  }

  // Extract useful text from HTML
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
  const pageTitle = titleMatch?.[1] || '';
  const pageDescription = metaMatch?.[1] || '';

  // Strip scripts, styles, nav, footer, then all tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  if (text.length < 50) {
    return NextResponse.json({ error: 'Could not extract content from this page. The site may require JavaScript. Try uploading screenshots instead.' }, { status: 400 });
  }

  const prompt = `You are a product extraction assistant. Extract ALL products/items from this website content.

Business type: ${niche || 'general'}
Page title: ${pageTitle}
Page description: ${pageDescription}

Website content:
${text}

For EACH product found, extract:
- name: product/item name
- description: one-line description
- price: number (0 if not found)
- category: product category if visible
- quantity: size/unit if visible
- ingredients: key ingredients/materials if visible (comma-separated)

RULES:
- Extract EVERY product/service mentioned
- Prices in ₹ or $ — extract number only
- If you see menu sections/categories, use them as the category field
- Ignore navigation items, footer text, blog posts — only extract products/services for sale

Return: [{"name": "...", "description": "...", "price": 0, "category": "...", "quantity": "...", "ingredients": "..."}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'AI extraction failed' }, { status: 500 });
    }

    const data = await res.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return NextResponse.json({ error: 'No response from AI' }, { status: 500 });

    let products = JSON.parse(responseText);
    if (!Array.isArray(products)) products = products.products || [];

    products = products.map((p: any) => ({
      name: p.name || 'Unknown Product',
      description: p.description || '',
      price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
      category: p.category || '',
      quantity: p.quantity || '',
      ingredients: p.ingredients || '',
    }));

    return NextResponse.json({ products, count: products.length, source: 'website' });
  } catch (err: any) {
    console.error('Extract from website error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
