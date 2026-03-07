import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { message, seller_id } = await request.json();
    const [sellerRes, productsRes, kbRes] = await Promise.all([
      supabase.from('sellers').select('*').eq('id', seller_id).single(),
      supabase.from('products').select('*').eq('seller_id', seller_id).eq('status', 'active'),
      supabase.from('knowledge_base').select('*').eq('seller_id', seller_id),
    ]);

    const seller = sellerRes.data;
    const products = productsRes.data || [];
    const kb = kbRes.data || [];
    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    const sym = seller.country === 'india' ? '₹' : '$';
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are ${seller.business_name}'s friendly assistant. Help customers with ordering, pricing, availability.\n\nProducts:\n${products.map((p: any) => `- ${p.name}: ${sym}${p.price}${p.status === 'sold_out' ? ' [SOLD OUT]' : ''}`).join('\n')}\n\nKnowledge:\n${kb.map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join('\n')}\n\nRules: Be warm and concise. Reply in customer's language. If unsure, say [NEEDS_SELLER]. Suggest booking at klovi.com/${seller.slug}.` },
        { role: 'user', content: message },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || '[NEEDS_SELLER]';
    const needsSeller = reply.includes('[NEEDS_SELLER]');

    return NextResponse.json({ reply: needsSeller ? null : reply, needs_seller: needsSeller, confidence: needsSeller ? 0 : 0.85 });
  } catch (error) {
    console.error('AI reply error:', error);
    return NextResponse.json({ error: 'AI error' }, { status: 500 });
  }
}
