import { NextResponse } from 'next/server'

const messageCache = new Map<string, string>()

export async function POST(request: Request) {
  const body = await request.json()
  const {
    business_name,
    category,
    product_name,
    product_description,
    variant_label,
    variant_price,
    currency,
    quantity,
    location,
    allows_custom,
    delivery_type,
    seller_slug,
  } = body

  if (!product_name) {
    return NextResponse.json({ error: 'Missing product_name' }, { status: 400 })
  }

  const cacheKey = `${product_name}:${variant_label || ''}:${category || ''}:${seller_slug || ''}`
  if (messageCache.has(cacheKey)) {
    return NextResponse.json({ message: messageCache.get(cacheKey) })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    const fallback = buildFallback(product_name, business_name, seller_slug, variant_label, variant_price, currency, quantity)
    return NextResponse.json({ message: fallback })
  }

  const sym = currency === 'INR' ? '₹' : '$'
  const menuUrl = seller_slug ? `kloviapp.com/${seller_slug}` : ''

  const systemPrompt = `You write WhatsApp pre-fill messages for home business orders in India and USA. The customer is sending this to the seller.

Rules:
- Line 1: "Hi! I'd like to order *[Product]* — [Variant] ([Currency][Price]) from *[Business Name]*."
  If quantity > 1: "...order [Qty]x *[Product]*..."
  If no variant: just product name and price
- Line 2: "Menu: ${menuUrl}" (include this line exactly as shown)
- Lines 3-5: 2-3 short follow-up questions for THIS category
- Keep total under 6 lines
- Natural and conversational, not formal
- End with 🙏

Category-specific questions:
stitching/tailoring:
  → When do you need it ready?
  → Can I come for measurements — what days suit you?

bakery/cake:
  → What date do you need it?
  → Any message on the cake / theme?

food/snacks/sweets:
  → When do you need it by?
  → Pickup or delivery?

coaching/tutoring:
  → Which class / grade / level?
  → Preferred days and time?

healing/spiritual:
  → Any specific area you'd like to focus on?
  → In-person or online?

If category is unclear → ask 2 generic questions:
  → When do you need it?
  → Any special requirements?`

  const userPrompt = `Generate a WhatsApp order message for:
Business: ${business_name}
Category: ${category || 'general'}
Product: ${product_name}
${product_description ? `Description: ${product_description}` : ''}
${variant_label ? `Variant: ${variant_label}` : ''}
Price: ${sym}${variant_price || 'ask'}
${quantity > 1 ? `Quantity: ${quantity}` : ''}
Location: ${location || 'not specified'}
${allows_custom ? 'Custom orders allowed' : ''}
${delivery_type ? `Fulfillment: ${delivery_type}` : ''}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const fallback = buildFallback(product_name, business_name, seller_slug, variant_label, variant_price, currency, quantity)
      return NextResponse.json({ message: fallback })
    }

    const data = await res.json()
    let message = data.choices?.[0]?.message?.content?.trim() || buildFallback(product_name, business_name, seller_slug, variant_label, variant_price, currency, quantity)

    // Ensure menu URL is present — webhook uses kloviapp.com/{slug} to identify seller
    if (seller_slug && !message.includes(`kloviapp.com/${seller_slug}`)) {
      message = message + `\nMenu: kloviapp.com/${seller_slug}`
    }

    messageCache.set(cacheKey, message)
    return NextResponse.json({ message })
  } catch {
    const fallback = buildFallback(product_name, business_name, seller_slug, variant_label, variant_price, currency, quantity)
    return NextResponse.json({ message: fallback })
  }
}

function buildFallback(
  productName: string,
  businessName?: string,
  sellerSlug?: string,
  variantLabel?: string,
  variantPrice?: number,
  currency?: string,
  quantity?: number
): string {
  const sym = currency === 'INR' ? '₹' : '$'
  const qtyStr = quantity && quantity > 1 ? `${quantity}x ` : ''
  const varStr = variantLabel ? ` — ${variantLabel}` : ''
  const priceStr = variantPrice ? ` (${sym}${variantPrice})` : ''
  const fromStr = businessName ? ` from *${businessName}*` : ''
  const menuStr = sellerSlug ? `\nMenu: kloviapp.com/${sellerSlug}` : ''
  return `Hi! I'd like to order ${qtyStr}*${productName}*${varStr}${priceStr}${fromStr}.${menuStr}\nCan you share availability? 🙏`
}
