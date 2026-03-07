import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// AI Reply Suggestion - generates a context-aware reply for the seller
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_TEMPLATE = `You are a helpful assistant for {business_name}. You help customers with orders, product questions, and general inquiries. Be warm, concise, and professional. If asked about products, reference the actual menu/catalog. If someone wants to order, confirm items and ask for pickup/delivery preference.

{product_section}

{knowledge_section}

{order_context_section}

Rules:
- Be warm, concise, and professional.
- Reply in the customer's language when possible.
- Reference actual products and prices from the catalog above.
- If a customer wants to place an order, confirm the items, total price, and ask about pickup or delivery preference.
- If you genuinely cannot answer a question or it requires seller-specific knowledge you don't have, include [NEEDS_SELLER] in your response.
- Never fabricate prices or product details not listed above.
- Keep responses under 200 words.`;

/**
 * Detect the customer's likely intent from the conversation.
 */
function detectIntent(messages: Array<{ role: string; content: string }>): string {
  const lastCustomerMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'customer' || m.role === 'user');

  if (!lastCustomerMsg) return 'general';

  const text = lastCustomerMsg.content.toLowerCase();

  if (/\b(order|buy|purchase|want|get|add to cart|checkout)\b/.test(text)) return 'order';
  if (/\b(price|cost|how much|rate|pricing)\b/.test(text)) return 'pricing';
  if (/\b(menu|catalog|list|products?|items?|what do you (have|sell|offer))\b/.test(text)) return 'catalog';
  if (/\b(deliver|delivery|ship|shipping|pickup|pick up|collect)\b/.test(text)) return 'delivery';
  if (/\b(hour|open|close|timing|schedule|available|when)\b/.test(text)) return 'hours';
  if (/\b(cancel|refund|return|exchange|complaint|issue|problem)\b/.test(text)) return 'support';
  if (/\b(thank|thanks|bye|ok|okay|great|perfect)\b/.test(text)) return 'closing';
  if (/\b(hi|hello|hey|good morning|good evening)\b/.test(text)) return 'greeting';

  return 'general';
}

export async function POST(request: Request) {
  // --- Validate input --------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const conversationId = body.conversation_id as string | undefined;
  const sellerId = body.seller_id as string | undefined;

  if (!conversationId || !sellerId) {
    return NextResponse.json(
      { error: 'Missing required fields: conversation_id and seller_id' },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  try {
    // --- Fetch data in parallel ------------------------------------------------
    const [messagesRes, sellerRes, productsRes, kbRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('sellers')
        .select('id, business_name, phone, country, slug, business_description')
        .eq('id', sellerId)
        .single(),
      supabase
        .from('products')
        .select('name, price, description, category, status')
        .eq('seller_id', sellerId)
        .eq('status', 'active'),
      supabase
        .from('knowledge_base')
        .select('question, answer')
        .eq('seller_id', sellerId),
    ]);

    if (sellerRes.error || !sellerRes.data) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const seller = sellerRes.data;
    const messages = (messagesRes.data || []).reverse(); // chronological order
    const products = productsRes.data || [];
    const knowledgeBase = kbRes.data || [];
    const currencySymbol = seller.country === 'india' ? '₹' : '$';

    // --- Build system prompt ---------------------------------------------------
    const productSection = products.length > 0
      ? `Products/Menu:\n${products
          .map(
            (p: { name: string; price: number; category?: string; status?: string; description?: string }) =>
              `- ${p.name}: ${currencySymbol}${p.price}${p.category ? ` [${p.category}]` : ''}${p.status === 'sold_out' ? ' (SOLD OUT)' : ''}${p.description ? ` -- ${p.description}` : ''}`,
          )
          .join('\n')}`
      : 'No products currently listed.';

    const knowledgeSection = knowledgeBase.length > 0
      ? `FAQ / Knowledge Base:\n${knowledgeBase
          .map((k: { question: string; answer: string }) => `Q: ${k.question}\nA: ${k.answer}`)
          .join('\n\n')}`
      : '';

    // Check if there are recent orders for context
    const orderContextSection = seller.slug
      ? `Ordering link: klovi.com/${seller.slug}`
      : '';

    const systemPrompt = SYSTEM_PROMPT_TEMPLATE
      .replace('{business_name}', seller.business_name || 'the business')
      .replace('{product_section}', productSection)
      .replace('{knowledge_section}', knowledgeSection)
      .replace('{order_context_section}', orderContextSection);

    // --- Prepare conversation history for OpenAI -------------------------------
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      const role = msg.role === 'customer' || msg.role === 'user' ? 'user' : 'assistant';
      if (msg.content) {
        openaiMessages.push({ role, content: msg.content });
      }
    }

    // If the last message is from the assistant (seller), the AI has nothing to reply to
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role !== 'customer' && lastMsg.role !== 'user') {
      return NextResponse.json({
        reply: null,
        confidence: 0,
        detected_intent: 'none',
        message: 'Last message is from seller; no customer message to reply to.',
      });
    }

    // --- Detect intent ---------------------------------------------------------
    const detectedIntent = detectIntent(
      messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
    );

    // --- Call OpenAI -----------------------------------------------------------
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      max_tokens: 400,
      temperature: 0.7,
    });

    const replyContent = completion.choices[0]?.message?.content || '';
    const needsSeller = replyContent.includes('[NEEDS_SELLER]');

    // Clean up the reply (remove the [NEEDS_SELLER] marker if present)
    const cleanReply = needsSeller
      ? replyContent.replace(/\[NEEDS_SELLER\]/g, '').trim()
      : replyContent.trim();

    // Confidence heuristic: based on intent clarity & whether AI deferred
    let confidence = 0.85;
    if (needsSeller) confidence = 0.2;
    else if (detectedIntent === 'general') confidence = 0.7;
    else if (detectedIntent === 'greeting' || detectedIntent === 'closing') confidence = 0.95;
    else if (detectedIntent === 'order' && products.length > 0) confidence = 0.9;

    return NextResponse.json({
      reply: needsSeller ? null : cleanReply,
      confidence,
      detected_intent: detectedIntent,
      needs_seller: needsSeller,
    });
  } catch (error) {
    console.error('AI reply error:', error);

    const isOpenAIError = error instanceof Error && error.message?.includes('OpenAI');
    return NextResponse.json(
      {
        error: isOpenAIError ? 'AI service temporarily unavailable' : 'Internal server error',
        reply: null,
        confidence: 0,
        detected_intent: 'error',
      },
      { status: 500 },
    );
  }
}
