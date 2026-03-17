import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IncomingMessage {
  channel: 'whatsapp' | 'sms' | 'instagram' | 'facebook'
  from: string
  body: string
  seller_id: string
  media_url?: string
}

interface AIResponse {
  reply: string
  confidence: number
  intent: 'order' | 'inquiry' | 'complaint' | 'greeting' | 'other'
  extracted_items?: { product_id: string; quantity: number; product_name?: string; variant?: string; price?: number }[]
  fulfillment_type?: 'pickup' | 'delivery'
  pickup_date?: string
  pickup_time?: string
  delivery_address?: string
}

async function findOrCreateCustomer(
  phone: string,
  channel: string,
  sellerId: string
): Promise<{ id: string; name: string | null }> {
  const { data: existing } = await supabase
    .from('customers')
    .select('id, name')
    .eq('seller_id', sellerId)
    .eq('phone', phone)
    .single()

  if (existing) return existing

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      seller_id: sellerId,
      phone,
      name: phone,
      preferred_channel: channel,
      segment: 'new',
      created_at: new Date().toISOString(),
    })
    .select('id, name')
    .single()

  if (error) throw new Error(`Failed to create customer: ${error.message}`)
  return created!
}

async function findOrCreateConversation(
  sellerId: string,
  customerId: string,
  channel: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('seller_id', sellerId)
    .eq('customer_id', customerId)
    .eq('channel', channel)
    .single()

  if (existing) return existing.id

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      seller_id: sellerId,
      customer_id: customerId,
      channel,
      unread_count: 0,
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create conversation: ${error.message}`)
  return created!.id
}

async function getConversationHistory(conversationId: string, limit = 20) {
  const { data } = await supabase
    .from('messages')
    .select('role, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).reverse()
}

async function getSellerContext(sellerId: string) {
  const { data: seller } = await supabase
    .from('sellers')
    .select('business_name, description, category, city, country, language, deposit_percentage, fulfillment_modes, phone, whatsapp_number')
    .eq('id', sellerId)
    .single()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, description, status, variants, ingredients')
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .limit(50)

  const { data: knowledge } = await supabase
    .from('knowledge_base')
    .select('question, answer')
    .eq('seller_id', sellerId)
    .limit(30)

  return { seller, products: products ?? [], knowledge: knowledge ?? [] }
}

function buildProductCatalog(products: any[]): string {
  return products.map((p) => {
    let line = `- ${p.name}: ${p.price}`
    if (p.description) line += ` — ${p.description}`
    if (p.ingredients) line += ` [Ingredients: ${p.ingredients}]`
    line += ` (ID: ${p.id})`
    // Parse variants if available
    try {
      const v = typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants
      if (Array.isArray(v) && v.length > 0) {
        const variantStr = v.map((vr: any) => `${vr.label}: ${vr.price}`).join(', ')
        line += ` [Variants: ${variantStr}]`
      }
    } catch {}
    return line
  }).join('\n')
}

async function generateAIReply(
  message: string,
  sellerContext: Awaited<ReturnType<typeof getSellerContext>>,
  history: { role: string; body: string }[]
): Promise<AIResponse> {
  const { seller, products, knowledge } = sellerContext
  const depositPct = seller?.deposit_percentage ?? 50
  const fulfillmentModes = seller?.fulfillment_modes ?? ['pickup']
  const currency = seller?.country === 'india' ? '₹' : '$'

  const categoryLC = (seller?.category || '').toLowerCase()

  // Service-based categories (no physical delivery — use online/in-person instead)
  const serviceCategories = ['coaching', 'tutoring', 'spiritual_healing', 'healing', 'spiritual', 'beauty', 'fitness', 'yoga', 'meditation', 'astrology', 'counseling', 'consulting', 'therapy']
  const isServiceCategory = serviceCategories.includes(categoryLC)

  // Dynamic quick-reply options based on business category
  const categoryOptions: Record<string, string> = {
    'snacks': '1️⃣ View Menu\n2️⃣ Place an Order\n3️⃣ Today\'s Specials\n4️⃣ Bulk/Party Orders\n5️⃣ Talk to Us',
    'food': '1️⃣ View Menu\n2️⃣ Place an Order\n3️⃣ Today\'s Specials\n4️⃣ Bulk/Party Orders\n5️⃣ Talk to Us',
    'bakery': '1️⃣ View Menu\n2️⃣ Order a Cake\n3️⃣ Custom Cake\n4️⃣ Party & Bulk Orders\n5️⃣ Talk to Us',
    'cake': '1️⃣ View Menu\n2️⃣ Order a Cake\n3️⃣ Custom Cake\n4️⃣ Party & Bulk Orders\n5️⃣ Talk to Us',
    'stitching': '1️⃣ Our Services\n2️⃣ Place an Order\n3️⃣ Book Measurements\n4️⃣ Alteration & Repairs\n5️⃣ Talk to Us',
    'tailoring': '1️⃣ Our Services\n2️⃣ Place an Order\n3️⃣ Book Measurements\n4️⃣ Alteration & Repairs\n5️⃣ Talk to Us',
    'coaching': '1️⃣ Our Programs\n2️⃣ Book a Session\n3️⃣ Batch Timings\n4️⃣ Fees & Packages\n5️⃣ Talk to Us',
    'tutoring': '1️⃣ Subjects Offered\n2️⃣ Book a Class\n3️⃣ Batch Timings\n4️⃣ Fees & Packages\n5️⃣ Talk to Us',
    'jewelry': '1️⃣ View Collection\n2️⃣ Place an Order\n3️⃣ Custom Design\n4️⃣ Pricing & Materials\n5️⃣ Talk to Us',
    'crafts': '1️⃣ View Collection\n2️⃣ Place an Order\n3️⃣ Custom Order\n4️⃣ Pricing & Shipping\n5️⃣ Talk to Us',
    'art': '1️⃣ View Collection\n2️⃣ Commission a Piece\n3️⃣ Custom Order\n4️⃣ Pricing & Shipping\n5️⃣ Talk to Us',
    'spiritual_healing': '1️⃣ Our Services\n2️⃣ Book a Session\n3️⃣ Online / In-Person\n4️⃣ Fees & Packages\n5️⃣ Talk to Us',
    'beauty': '1️⃣ Our Services\n2️⃣ Book an Appointment\n3️⃣ Packages & Combos\n4️⃣ Pricing\n5️⃣ Talk to Us',
    'fitness': '1️⃣ Our Programs\n2️⃣ Book a Session\n3️⃣ Batch Timings\n4️⃣ Fees & Packages\n5️⃣ Talk to Us',
  }

  const defaultOptions = '1️⃣ View Menu\n2️⃣ Place an Order\n3️⃣ Special Requests\n4️⃣ Pricing\n5️⃣ Talk to Us'
  const quickOptions = categoryOptions[categoryLC] || defaultOptions

  const sellerLanguage = seller?.language || 'English'

  const systemPrompt = `You are a professional, friendly assistant for "${seller?.business_name}", a ${seller?.category || 'home'} business in ${seller?.city}.

Business description: ${seller?.description || 'A trusted local business'}

LANGUAGE: The seller's preferred language is ${sellerLanguage}. Default to ${sellerLanguage} when the customer hasn't established a language preference yet. Once the customer writes in a specific language, match their language.

Available products/services:
${buildProductCatalog(products)}

${knowledge.length > 0 ? `FAQ:\n${knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')}` : ''}

${isServiceCategory ? `MODE: Online and In-Person sessions available
LOCATION: ${seller?.city} (in-person) / Virtual (online — PAN India / worldwide)` : `FULFILLMENT: ${fulfillmentModes.join(' and ')} available`}
DEPOSIT: ${depositPct}% deposit required to confirm orders
CURRENCY: ${currency}

YOUR JOB — follow this order flow:

1. GREETING (first message from a customer):
   Send a professional welcome with numbered options. Format EXACTLY like this:

   "Hello! 👋 Welcome to *${seller?.business_name}*.

   How can I help you today?

   ${quickOptions}"

   Keep it short and clean. No long introductions. Let the options guide the customer.

2. RESPONDING TO OPTIONS:
${isServiceCategory ? `   - If customer picks "Our Services/Programs" or "1": List all services with prices. End with "Reply with service name to book."
   - If customer picks "Book a Session/Class" or "2": Ask what service they want, preferred date/time, and whether online or in-person.
   - If customer picks "Online / In-Person" or "3": Explain that online sessions are available PAN India via video call, and in-person sessions in ${seller?.city}. Ask which they prefer.
   - If customer picks "Fees & Packages" or "4": Show detailed pricing with any package discounts or free consultation offers.
   - If customer asks about free consultation: Say "Yes! We offer a free initial consultation to understand your needs. Would you like to book one?" and collect their preferred date/time.
   - If customer picks "Talk to Us" or "5": Say "Let me connect you with ${seller?.business_name}. They'll be with you shortly!" and set confidence to 0.3 so the seller gets notified.` : `   - If customer picks "View Menu" or "1": List all products with prices in a clean format. Group by category if possible. End with "Reply with the item number or name to order."
   - If customer picks "Place an Order" or "2": Ask "What would you like to order?" and show top 3-5 popular items.
   - If customer picks a category-specific option (3 or 4): Handle appropriately for the business type.
   - If customer picks "Talk to Us" or "5": Say "Let me connect you with ${seller?.business_name}. They'll be with you shortly!" and set confidence to 0.3 so the seller gets notified.`}
   - If customer types a number or text that doesn't match: Try to understand intent naturally. Don't force them into the menu.
   - IMPORTANT — context switching: If you just showed the product/service list and the customer types a number like "3", it likely means product #3 from the list. But if they type "3" with a question like "today's specials?" or reference the original menu, take them to that main menu option instead. Use conversation context to decide.
   - MINIMUM ORDER: If customer asks about minimum quantity, minimum order, or "how much can I order", tell them there is no minimum — they can order any quantity.
   - VARIANTS: If a product has [Variants: ...] in the catalog, mention those exact options. NEVER invent sizes, weights, or prices that are not listed in the catalog. If no variants exist, just ask "How many would you like?" with the base price.

3. ${isServiceCategory ? 'BOOKING' : 'ORDER TAKING'}: When customer mentions ${isServiceCategory ? 'a service' : 'products'}:
   - Confirm ${isServiceCategory ? 'service, mode (online/in-person), preferred date & time' : 'each item, quantity, and variant (if applicable)'}
   - Show ${isServiceCategory ? 'booking' : 'itemized'} summary with prices in a clean format
   - Ask: "Shall I confirm this ${isServiceCategory ? 'booking' : 'order'}?"

4. ${isServiceCategory ? 'BOOKING' : 'ORDER'} CONFIRMATION: When customer says yes:
   - Show final summary: ${isServiceCategory ? 'service, date, time, mode, price' : 'items, quantities, prices, total'}
   - Calculate deposit: ${depositPct}% of total
   - Say: "To confirm, a ${depositPct}% deposit of ${currency}[amount] is needed. Sending payment link now."
   - Set intent to "order"

5. ${isServiceCategory ? 'SESSION DETAILS' : 'FULFILLMENT'}: After ${isServiceCategory ? 'booking' : 'order'} is placed:
${isServiceCategory ? `   - If online: "You'll receive a video call link before the session."
   - If in-person: "Please visit us at ${seller?.city}. We'll share the exact address."
   - Ask for any specific concerns or areas they'd like to focus on.` : `${fulfillmentModes.includes('pickup') && fulfillmentModes.includes('delivery')
  ? '   - "Would you prefer pickup or delivery?"'
  : fulfillmentModes.includes('delivery')
  ? '   - "Please share your delivery address."'
  : '   - "When would you like to pick up?"'
}`}

6. ${isServiceCategory ? 'FOLLOW-UP' : 'PICKUP/DELIVERY DETAILS'}:
${isServiceCategory ? `   - Confirm date, time, mode.
   - For online: Will share meeting link via WhatsApp before session.
   - For in-person: Share location/address.` : `   - For PICKUP: Get preferred date and time.
   - For DELIVERY: Get full delivery address.`}

RULES:
- Be professional but warm. Short messages. No walls of text.
- Use WhatsApp formatting: *bold* for emphasis, numbered lists for options.
- NEVER make up products, prices, sizes, weights, or variants. ONLY mention what is explicitly listed in the catalog above. If a product has no variants, don't invent any.
- Set confidence HIGH (0.8-1.0) for: greetings, product inquiries, menu questions, order-taking, pricing questions, delivery questions — anything you can answer from the catalog/FAQ.
- Set confidence LOW (below 0.5) ONLY for: complaints, requests to talk to a human, questions completely outside your knowledge, offensive messages, or when the customer is clearly frustrated.
- Always confirm the order summary before finalizing.
- Match the customer's language (Hindi, English, etc.).
- Don't repeat the welcome menu once the customer has started a conversation.

Respond in JSON format:
{
  "reply": "your message to the customer",
  "confidence": 0.0 to 1.0,
  "intent": "order" | "inquiry" | "complaint" | "greeting" | "other",
  "extracted_items": [{"product_id": "uuid", "product_name": "name", "variant": "variant label", "price": 500, "quantity": 1}],
  "fulfillment_type": "pickup" | "delivery",
  "pickup_date": "YYYY-MM-DD",
  "pickup_time": "HH:MM",
  "delivery_address": "full address string"
}

INTENT RULES:
- "greeting": first message or general hello — show the welcome menu
- "inquiry": customer mentions or asks about a product but hasn't confirmed yet
- "order": customer explicitly confirms. E.g. "yes confirm", "book it", "place the order"
- "complaint": customer is unhappy about something
- extracted_items: include whenever customer mentions products — for BOTH inquiry AND order intents
- fulfillment_type: only when customer specified pickup or delivery
- pickup_date/pickup_time: only when customer gave a date/time. Convert relative dates to actual dates. Today is ${new Date().toISOString().split('T')[0]}.
- delivery_address: only when customer gave their address`

  // Build conversation for Gemini format
  const geminiContents = [
    ...history.map((h) => ({
      role: h.role === 'customer' ? 'user' : 'model',
      parts: [{ text: h.body }],
    })),
    { role: 'user' as const, parts: [{ text: message }] },
  ]

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  // Try Gemini first (faster + cheaper), fall back to OpenAI
  if (geminiKey) {
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: geminiContents,
            generationConfig: {
              temperature: 0.7,
              responseMimeType: 'application/json',
            },
          }),
        }
      )

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json()
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          const parsed: AIResponse = JSON.parse(text)
          return parsed
        }
      }
      // If Gemini fails, fall through to OpenAI
      console.error('Gemini response not ok, falling back to OpenAI')
    } catch (geminiErr) {
      console.error('Gemini error, falling back to OpenAI:', geminiErr)
    }
  }

  // Fallback: OpenAI
  if (!openaiKey) throw new Error('No AI API key configured (neither GEMINI_API_KEY nor OPENAI_API_KEY)')

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({
      role: h.role === 'customer' ? 'user' : 'assistant',
      content: h.body,
    })),
    { role: 'user' as const, content: message },
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${errorBody}`)
  }

  const data = await response.json()
  const parsed: AIResponse = JSON.parse(data.choices[0].message.content)
  return parsed
}

async function sendViaGupshup(destination: string, message: string) {
  const apiKey = Deno.env.get('GUPSHUP_API_KEY')!
  const sourceNumber = Deno.env.get('GUPSHUP_WHATSAPP_NUMBER')!

  const params = new URLSearchParams({
    channel: 'whatsapp',
    source: sourceNumber,
    destination,
    'src.name': Deno.env.get('GUPSHUP_APP_NAME') || 'KloviApp',
    'message': JSON.stringify({ type: 'text', text: message }),
  })

  const response = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gupshup API error: ${response.status} ${errorBody}`)
  }

  return response.json()
}

async function sendViaTelnyx(to: string, text: string) {
  const apiKey = Deno.env.get('TELNYX_API_KEY')!
  const messagingProfileId = Deno.env.get('TELNYX_MESSAGING_PROFILE_ID')!

  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: messagingProfileId,
      to,
      text,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Telnyx API error: ${response.status} ${errorBody}`)
  }

  return response.json()
}

async function sendReply(
  channel: string,
  destination: string,
  message: string
) {
  if (channel === 'whatsapp' || channel === 'instagram' || channel === 'facebook') {
    return sendViaGupshup(destination, message)
  } else if (channel === 'sms') {
    return sendViaTelnyx(destination, message)
  }
  throw new Error(`Unsupported channel: ${channel}`)
}

async function createOrder(
  sellerId: string,
  customerId: string,
  conversationId: string,
  items: { product_id: string; quantity: number; product_name?: string; variant?: string; price?: number }[],
  fulfillmentType?: string,
  pickupDate?: string,
  pickupTime?: string,
  deliveryAddress?: string
) {
  // Fetch ALL active products for this seller so we can match by name if IDs fail
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, price')
    .eq('seller_id', sellerId)
    .eq('status', 'active')

  if (!allProducts || allProducts.length === 0) {
    throw new Error('No active products found for this seller')
  }

  // Build lookup maps: by ID and by lowercase name
  const byId = new Map(allProducts.map((p) => [p.id, p]))
  const byName = new Map(allProducts.map((p) => [p.name.toLowerCase(), p]))

  // Get seller deposit percentage
  const { data: seller } = await supabase
    .from('sellers')
    .select('deposit_percentage, country')
    .eq('id', sellerId)
    .single()

  const depositPct = seller?.deposit_percentage ?? 50
  const currency = seller?.country === 'india' ? 'INR' : 'USD'

  // Match each item — try ID first, then fall back to name matching
  const orderItems = items
    .map((i) => {
      let product = byId.get(i.product_id)
      if (!product && i.product_name) {
        product = byName.get(i.product_name.toLowerCase())
      }
      if (!product) return null
      return {
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: i.quantity,
        subtotal: product.price * i.quantity,
      }
    })
    .filter(Boolean) as { product_id: string; name: string; price: number; quantity: number; subtotal: number }[]

  if (orderItems.length === 0) {
    throw new Error('No valid products found for order')
  }

  const total = orderItems.reduce((sum, i) => sum + i.subtotal, 0)
  const depositAmount = Math.ceil(total * depositPct / 100)
  const balanceAmount = total - depositAmount

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      seller_id: sellerId,
      customer_id: customerId,
      conversation_id: conversationId,
      items: orderItems,
      subtotal: total,
      total,
      currency,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      status: 'pending_deposit',
      payment_status: 'pending',
      fulfillment_type: fulfillmentType ?? 'pickup',
      pickup_date: pickupDate ?? null,
      pickup_time_slot: pickupTime ?? null,
      delivery_address: deliveryAddress ?? null,
      source_channel: 'whatsapp',
      created_at: new Date().toISOString(),
    })
    .select('id, order_number, total, deposit_amount, balance_amount, currency')
    .single()

  if (error) throw new Error(`Failed to create order: ${error.message}`)
  return order
}

function buildOrderConfirmation(
  order: any,
  sellerName: string,
  items: any[]
): string {
  const sym = order.currency === 'INR' ? '₹' : '$'
  const itemLines = items.map((i: any) =>
    `${i.quantity}x ${i.name} — ${sym}${i.subtotal}`
  ).join('\n')

  return `✅ *Order Confirmed — ${sellerName}*
Order #${order.order_number}

${itemLines}

*Total: ${sym}${order.total}*
*Deposit (${Math.round(order.deposit_amount / order.total * 100)}%): ${sym}${order.deposit_amount}*
Balance due at pickup/delivery: ${sym}${order.balance_amount}

💳 Please pay the deposit to confirm your order. Payment link coming right up!`
}

async function generateDepositLink(orderId: string): Promise<string | null> {
  const appUrl = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://klovi.com'
  try {
    const res = await fetch(`${appUrl}/api/checkout/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.payment_url ?? null
  } catch {
    return null
  }
}

async function alertSeller(
  sellerId: string,
  customerId: string,
  customerPhone: string,
  message: string,
  channel: string
) {
  // Get seller's phone
  const { data: seller } = await supabase
    .from('sellers')
    .select('phone, whatsapp_number, business_name')
    .eq('id', sellerId)
    .single()

  if (!seller) return

  const sellerPhone = seller.whatsapp_number || seller.phone
  if (!sellerPhone) return

  // Create notification in DB
  await supabase.from('notifications').insert({
    seller_id: sellerId,
    type: 'needs_attention',
    title: 'Message needs your attention',
    body: `Customer ${customerPhone}: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
    data: { customer_id: customerId, channel },
    status: 'unread',
    created_at: new Date().toISOString(),
  })

  // Send WhatsApp alert to seller
  const alertMsg = `🔔 *New message needs your reply*\n\nFrom: ${customerPhone}\n"${message.substring(0, 200)}"\n\nThe AI wasn't confident enough to auto-reply. Please check your Klovi inbox.`

  try {
    await sendViaGupshup(sellerPhone, alertMsg)
  } catch (err) {
    console.error('Failed to alert seller:', err)
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Parse payload outside try so catch block can access it for fallback messaging
  let parsedPayload: IncomingMessage | null = null

  try {
    const payload: IncomingMessage = await req.json()
    parsedPayload = payload
    const { channel, from, body, seller_id, media_url } = payload

    if (!channel || !from || !body || !seller_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: channel, from, body, seller_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Find or create customer
    const customer = await findOrCreateCustomer(from, channel, seller_id)

    // 2. Find or create conversation
    const conversationId = await findOrCreateConversation(seller_id, customer.id, channel)

    // 3. Save inbound message + fetch AI context in PARALLEL (saves ~300ms)
    const [, sellerContext, history] = await Promise.all([
      supabase.from('messages').insert({
        conversation_id: conversationId,
        seller_id,
        customer_id: customer.id,
        direction: 'inbound',
        sender: from,
        content: body,
        role: 'customer',
        body,
        channel,
        media_url: media_url ?? null,
        created_at: new Date().toISOString(),
      }),
      getSellerContext(seller_id),
      getConversationHistory(conversationId),
    ])

    // 4b. FAST PATH — handle greetings and menu requests without AI (instant response)
    const bodyLower = body.trim().toLowerCase()
    const isGreeting = /^(hi|hello|hey|hii+|helo|namaste|namaskar|hola|yo|sup|good (morning|afternoon|evening)|gm|bhai|bhaiya|didi|madam|sir)[\s!.?]*$/i.test(bodyLower)
    const isMenuRequest = /^(1|menu|view menu|full menu|show menu|can i (get|see) ?(the |full |your )?menu|what do you (have|sell|offer)|products|catalog|list|price list|menu please|menu ?(card|list)?[\s?!.]*)$/i.test(bodyLower)
    const isFirstMessage = history.length === 0

    if ((isGreeting || isFirstMessage) && !isMenuRequest) {
      // Build greeting response directly — no AI needed
      const sellerName = sellerContext.seller?.business_name || 'our shop'
      const categoryLC = (sellerContext.seller?.category || '').toLowerCase()
      const categoryOptions: Record<string, string> = {
        'snacks': '1️⃣ View Menu\n2️⃣ Place an Order\n3️⃣ Today\'s Specials\n4️⃣ Bulk/Party Orders\n5️⃣ Talk to Us',
        'food': '1️⃣ View Menu\n2️⃣ Place an Order\n3️⃣ Today\'s Specials\n4️⃣ Bulk/Party Orders\n5️⃣ Talk to Us',
        'bakery': '1️⃣ View Menu\n2️⃣ Order a Cake\n3️⃣ Custom Cake\n4️⃣ Party & Bulk Orders\n5️⃣ Talk to Us',
        'coaching': '1️⃣ Our Programs\n2️⃣ Book a Session\n3️⃣ Batch Timings\n4️⃣ Fees & Packages\n5️⃣ Talk to Us',
        'spiritual_healing': '1️⃣ Our Services\n2️⃣ Book a Session\n3️⃣ Online / In-Person\n4️⃣ Fees & Packages\n5️⃣ Talk to Us',
        'beauty': '1️⃣ Our Services\n2️⃣ Book an Appointment\n3️⃣ Packages & Combos\n4️⃣ Pricing\n5️⃣ Talk to Us',
        'jewelry': '1️⃣ View Collection\n2️⃣ Place an Order\n3️⃣ Custom Design\n4️⃣ Pricing & Materials\n5️⃣ Talk to Us',
        'crafts': '1️⃣ View Collection\n2️⃣ Place an Order\n3️⃣ Custom Order\n4️⃣ Pricing & Shipping\n5️⃣ Talk to Us',
      }
      const quickOptions = categoryOptions[categoryLC] || '1️⃣ View Menu\n2️⃣ Place an Order\n3️⃣ Special Requests\n4️⃣ Pricing\n5️⃣ Talk to Us'
      const greetReply = `Hello! 👋 Welcome to *${sellerName}*!\n\nHow can I help you today?\n\n${quickOptions}`

      // Save + send directly, skip AI
      const { data: fastMsg } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        seller_id, customer_id: customer.id,
        direction: 'outbound', sender: 'ai',
        content: greetReply, role: 'assistant', body: greetReply,
        channel, status: 'pending', intent: 'greeting', confidence: 1.0,
        created_at: new Date().toISOString(),
      }).select('id').single()

      await sendReply(channel, from, greetReply)
      if (fastMsg) await supabase.from('messages').update({ status: 'sent' }).eq('id', fastMsg.id)

      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(), unread_count: 0,
        last_message: body, needs_seller_attention: false, ai_can_handle: true,
      }).eq('id', conversationId)

      return new Response(JSON.stringify({ success: true, message_status: 'sent', intent: 'greeting', confidence: 1.0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (isMenuRequest) {
      // Build menu response directly — no AI needed
      const catalog = buildProductCatalog(sellerContext.products)
      const sellerName = sellerContext.seller?.business_name || 'our shop'
      const menuReply = catalog
        ? `Here's our menu at *${sellerName}*:\n\n${catalog}\n\nReply with the item name to order!`
        : `We're still setting up our menu. Please message us directly and we'll help you!`

      const { data: fastMsg } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        seller_id, customer_id: customer.id,
        direction: 'outbound', sender: 'ai',
        content: menuReply, role: 'assistant', body: menuReply,
        channel, status: 'pending', intent: 'inquiry', confidence: 1.0,
        created_at: new Date().toISOString(),
      }).select('id').single()

      await sendReply(channel, from, menuReply)
      if (fastMsg) await supabase.from('messages').update({ status: 'sent' }).eq('id', fastMsg.id)

      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString(), unread_count: 0,
        last_message: body, needs_seller_attention: false, ai_can_handle: true,
      }).eq('id', conversationId)

      return new Response(JSON.stringify({ success: true, message_status: 'sent', intent: 'inquiry', confidence: 1.0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 5. Generate AI reply (for all non-trivial messages)
    const aiResponse = await generateAIReply(body, sellerContext, history)

    // 6. Determine message status based on confidence
    const isConfident = aiResponse.confidence > 0.5

    // 7. Create or update leads based on intent
    if (aiResponse.intent === 'inquiry' && aiResponse.extracted_items?.length) {
      // Create a lead for each extracted item
      for (const item of aiResponse.extracted_items) {
        // Check if a lead already exists for this product in this conversation
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('product_name', item.product_name ?? item.product_id)
          .in('status', ['new'])
          .limit(1)
          .single()

        if (!existingLead) {
          await supabase.from('leads').insert({
            conversation_id: conversationId,
            customer_id: customer.id,
            seller_id: seller_id,
            product_name: item.product_name ?? null,
            variant: item.variant ?? null,
            quantity: item.quantity ?? 1,
            price: item.price ?? null,
            status: 'new',
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    if (aiResponse.intent === 'order') {
      // Update existing leads for this conversation to 'confirmed'
      await supabase
        .from('leads')
        .update({ status: 'confirmed' })
        .eq('conversation_id', conversationId)
        .eq('status', 'new')
    }

    // 8. If intent is order, create the order BEFORE sending the AI reply
    let order = null
    let replyText = aiResponse.reply
    let orderCreationFailed = false
    if (aiResponse.intent === 'order' && aiResponse.extracted_items?.length) {
      try {
        order = await createOrder(
          seller_id,
          customer.id,
          conversationId,
          aiResponse.extracted_items,
          aiResponse.fulfillment_type,
          aiResponse.pickup_date,
          aiResponse.pickup_time,
          aiResponse.delivery_address
        )

        // Update leads to 'forwarded' now that order exists
        await supabase
          .from('leads')
          .update({ status: 'forwarded' })
          .eq('conversation_id', conversationId)
          .eq('status', 'confirmed')
      } catch (err) {
        console.error('Order creation failed:', err)
        orderCreationFailed = true
        // Override the AI reply since the order didn't actually get created
        replyText = "I'm having trouble processing your order right now. Let me connect you with the team — they'll sort this out quickly! 🙏"
      }
    }

    // 9. Save outbound message BEFORE sending (as 'pending'), then update to final status
    const messageStatus = isConfident ? 'pending' : 'draft'
    const { data: outboundMsg } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      seller_id,
      customer_id: customer.id,
      direction: 'outbound',
      sender: 'ai',
      content: replyText,
      role: 'assistant',
      body: replyText,
      channel,
      status: messageStatus,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      created_at: new Date().toISOString(),
    }).select('id').single()

    // 10. If confident, send the reply and update status to 'sent'
    if (isConfident) {
      try {
        await sendReply(channel, from, replyText)
        if (outboundMsg) {
          await supabase.from('messages').update({ status: 'sent' }).eq('id', outboundMsg.id)
        }
      } catch (sendErr) {
        console.error('Failed to send reply:', sendErr)
        if (outboundMsg) {
          await supabase.from('messages').update({ status: 'failed' }).eq('id', outboundMsg.id)
        }
      }
    }

    // 11. If confident and order was created, send confirmation + deposit link
    if (isConfident && order && !orderCreationFailed) {
      try {
        const sellerName = sellerContext.seller?.business_name || 'Shop'
        const confirmationMsg = buildOrderConfirmation(
          order,
          sellerName,
          order.items || aiResponse.extracted_items
        )

        // Save confirmation message as pending first
        const { data: confirmMsg } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          seller_id,
          customer_id: customer.id,
          direction: 'outbound',
          sender: 'ai',
          content: confirmationMsg,
          role: 'assistant',
          body: confirmationMsg,
          channel,
          status: 'pending',
          intent: 'order_confirmation',
          confidence: 1.0,
          created_at: new Date().toISOString(),
        }).select('id').single()

        // Send order confirmation via WhatsApp
        await sendReply(channel, from, confirmationMsg)
        if (confirmMsg) {
          await supabase.from('messages').update({ status: 'sent' }).eq('id', confirmMsg.id)
        }

        // Generate and send deposit payment link
        const paymentUrl = await generateDepositLink(order.id)
        if (paymentUrl) {
          const sym = order.currency === 'INR' ? '₹' : '$'
          const paymentMsg = `💳 *Pay Deposit: ${sym}${order.deposit_amount}*\n\n${paymentUrl}\n\nYour order will be confirmed once the deposit is received.`

          const { data: payMsg } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            seller_id,
            customer_id: customer.id,
            direction: 'outbound',
            sender: 'ai',
            content: paymentMsg,
            role: 'assistant',
            body: paymentMsg,
            channel,
            status: 'pending',
            intent: 'payment_link',
            confidence: 1.0,
            created_at: new Date().toISOString(),
          }).select('id').single()

          await sendReply(channel, from, paymentMsg)
          if (payMsg) {
            await supabase.from('messages').update({ status: 'sent' }).eq('id', payMsg.id)
          }
        }
      } catch (err) {
        console.error('Order confirmation send failed:', err)
      }
    }

    // 11b. If NOT confident — send holding message to customer, then alert seller
    if (!isConfident) {
      // Send a holding message so the customer isn't left in silence
      try {
        const holdingMsg = "Great question! Let me check with the team and get back to you shortly."
        const { data: holdMsg } = await supabase.from('messages').insert({
          conversation_id: conversationId,
          seller_id,
          customer_id: customer.id,
          direction: 'outbound',
          sender: 'ai',
          content: holdingMsg,
          role: 'assistant',
          body: holdingMsg,
          channel,
          status: 'pending',
          intent: 'holding',
          confidence: aiResponse.confidence,
          created_at: new Date().toISOString(),
        }).select('id').single()

        await sendReply(channel, from, holdingMsg)
        if (holdMsg) {
          await supabase.from('messages').update({ status: 'sent' }).eq('id', holdMsg.id)
        }
      } catch (holdErr) {
        console.error('Failed to send holding message:', holdErr)
      }

      await alertSeller(seller_id, customer.id, from, body, channel)
    }

    // 12. Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: isConfident ? 0 : 1,
        last_message: body,
        needs_seller_attention: !isConfident,
        ai_can_handle: isConfident,
      })
      .eq('id', conversationId)

    // 13. Update order with fulfillment details if provided separately
    if (!order && (aiResponse.fulfillment_type || aiResponse.pickup_date || aiResponse.delivery_address)) {
      // Check if there's an active order in this conversation
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('conversation_id', conversationId)
        .in('status', ['pending_deposit', 'deposit_paid', 'confirmed', 'preparing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (activeOrder) {
        const updates: Record<string, any> = {}
        if (aiResponse.fulfillment_type) updates.fulfillment_type = aiResponse.fulfillment_type
        if (aiResponse.pickup_date) updates.pickup_date = aiResponse.pickup_date
        if (aiResponse.pickup_time) updates.pickup_time_slot = aiResponse.pickup_time
        if (aiResponse.delivery_address) updates.delivery_address = aiResponse.delivery_address

        await supabase.from('orders').update(updates).eq('id', activeOrder.id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_status: messageStatus,
        intent: aiResponse.intent,
        confidence: aiResponse.confidence,
        order_id: order?.id ?? null,
        conversation_id: conversationId,
        customer_id: customer.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('handle-message error:', err)

    // Try to send a friendly fallback message to the customer
    try {
      if (parsedPayload?.from && parsedPayload?.channel && parsedPayload?.seller_id) {
        // Try to get business name for a personalized fallback
        let businessName = 'the team'
        try {
          const { data: s } = await supabase
            .from('sellers')
            .select('business_name')
            .eq('id', parsedPayload.seller_id)
            .single()
          if (s?.business_name) businessName = s.business_name
        } catch {}

        const fallbackMsg = `Sorry, I'm having a little trouble right now. Your message has been noted and someone from ${businessName} will get back to you shortly!`
        await sendReply(parsedPayload.channel, parsedPayload.from, fallbackMsg)
      }
    } catch (fallbackErr) {
      // Don't let the fallback attempt cause further issues
      console.error('Failed to send fallback message:', fallbackErr)
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
