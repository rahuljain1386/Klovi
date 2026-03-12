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
  extracted_items?: { product_id: string; quantity: number }[]
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
    .select('id, name, price, description, status, variants')
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

  const systemPrompt = `You are a warm, helpful sales assistant for "${seller?.business_name}", a ${seller?.category} business in ${seller?.city}.

Business description: ${seller?.description}

Available products:
${buildProductCatalog(products)}

${knowledge.length > 0 ? `FAQ:\n${knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')}` : ''}

FULFILLMENT: ${fulfillmentModes.join(' and ')} available
DEPOSIT: ${depositPct}% deposit required to confirm orders
CURRENCY: ${currency}

YOUR JOB — follow this order flow:

1. GREETING: Be warm. Introduce the business briefly. Ask what they'd like to order.

2. ORDER TAKING: When customer mentions products:
   - Confirm each item, quantity, and variant (if applicable)
   - Show itemized summary with prices
   - Ask: "Shall I confirm this order?"

3. ORDER CONFIRMATION: When customer says yes:
   - Show final summary: items, quantities, prices, total
   - Calculate deposit: ${depositPct}% of total
   - Say: "To confirm, please pay the ${depositPct}% deposit of ${currency}[amount]. I'll send you the payment link now."
   - Set intent to "order"

4. FULFILLMENT: After order is placed, ask:
${fulfillmentModes.includes('pickup') && fulfillmentModes.includes('delivery')
  ? '   - "Would you like pickup or delivery?"'
  : fulfillmentModes.includes('delivery')
  ? '   - "What is your delivery address?"'
  : '   - "When would you like to pick up? We can arrange a convenient time."'
}

5. PICKUP/DELIVERY DETAILS:
   - For PICKUP: Get preferred date and time. Parse natural language ("tomorrow 5pm", "Saturday morning").
   - For DELIVERY: Get full delivery address.

RULES:
- Be warm, concise, and helpful. Use the customer's language.
- Never make up products or prices — only offer what's in the catalog above.
- If unsure about something, set confidence low and the seller will review.
- Always confirm the order summary before finalizing.
- For pricing inquiries, give exact prices from the catalog.

Respond in JSON format:
{
  "reply": "your message to the customer",
  "confidence": 0.0 to 1.0,
  "intent": "order" | "inquiry" | "complaint" | "greeting" | "other",
  "extracted_items": [{"product_id": "uuid", "quantity": 1}],
  "fulfillment_type": "pickup" | "delivery",
  "pickup_date": "YYYY-MM-DD",
  "pickup_time": "HH:MM",
  "delivery_address": "full address string"
}

Notes on fields:
- extracted_items: only when intent is "order" and customer confirmed
- fulfillment_type: only when customer specified pickup or delivery
- pickup_date/pickup_time: only when customer gave a date/time. Convert relative dates (tomorrow, Saturday) to actual dates. Today is ${new Date().toISOString().split('T')[0]}.
- delivery_address: only when customer gave their address`

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
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
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
  items: { product_id: string; quantity: number }[],
  fulfillmentType?: string,
  pickupDate?: string,
  pickupTime?: string,
  deliveryAddress?: string
) {
  // Fetch product prices to calculate total
  const productIds = items.map((i) => i.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, price')
    .in('id', productIds)

  if (!products || products.length === 0) {
    throw new Error('No valid products found for order')
  }

  // Get seller deposit percentage
  const { data: seller } = await supabase
    .from('sellers')
    .select('deposit_percentage, country')
    .eq('id', sellerId)
    .single()

  const depositPct = seller?.deposit_percentage ?? 50
  const currency = seller?.country === 'india' ? 'INR' : 'USD'

  const productMap = new Map(products.map((p) => [p.id, p]))

  const orderItems = items
    .filter((i) => productMap.has(i.product_id))
    .map((i) => {
      const product = productMap.get(i.product_id)!
      return {
        product_id: i.product_id,
        name: product.name,
        price: product.price,
        quantity: i.quantity,
        subtotal: product.price * i.quantity,
      }
    })

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

  try {
    const payload: IncomingMessage = await req.json()
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

    // 3. Save inbound message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      seller_id,
      customer_id: customer.id,
      role: 'customer',
      body,
      channel,
      media_url: media_url ?? null,
      created_at: new Date().toISOString(),
    })

    // 4. Get context for AI
    const [sellerContext, history] = await Promise.all([
      getSellerContext(seller_id),
      getConversationHistory(conversationId),
    ])

    // 5. Generate AI reply
    const aiResponse = await generateAIReply(body, sellerContext, history)

    // 6. Determine message status based on confidence
    const isConfident = aiResponse.confidence > 0.85
    const messageStatus = isConfident ? 'sent' : 'draft'

    // 7. If confident, send the reply
    if (isConfident) {
      await sendReply(channel, from, aiResponse.reply)
    }

    // 8. Save outbound message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      seller_id,
      customer_id: customer.id,
      role: 'assistant',
      body: aiResponse.reply,
      channel,
      status: messageStatus,
      intent: aiResponse.intent,
      confidence: aiResponse.confidence,
      created_at: new Date().toISOString(),
    })

    // 9. If intent is order, create the order + send confirmation + deposit link
    let order = null
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

        // Build and send order confirmation message
        const sellerName = sellerContext.seller?.business_name || 'Shop'
        const confirmationMsg = buildOrderConfirmation(
          order,
          sellerName,
          order.items || aiResponse.extracted_items
        )

        // Send order confirmation via WhatsApp
        if (isConfident) {
          await sendReply(channel, from, confirmationMsg)

          // Save confirmation message
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            seller_id,
            customer_id: customer.id,
            role: 'assistant',
            body: confirmationMsg,
            channel,
            status: 'sent',
            intent: 'order_confirmation',
            confidence: 1.0,
            created_at: new Date().toISOString(),
          })

          // Generate and send deposit payment link
          const paymentUrl = await generateDepositLink(order.id)
          if (paymentUrl) {
            const sym = order.currency === 'INR' ? '₹' : '$'
            const paymentMsg = `💳 *Pay Deposit: ${sym}${order.deposit_amount}*\n\n${paymentUrl}\n\nYour order will be confirmed once the deposit is received.`
            await sendReply(channel, from, paymentMsg)

            await supabase.from('messages').insert({
              conversation_id: conversationId,
              seller_id,
              customer_id: customer.id,
              role: 'assistant',
              body: paymentMsg,
              channel,
              status: 'sent',
              intent: 'payment_link',
              confidence: 1.0,
              created_at: new Date().toISOString(),
            })
          }
        }
      } catch (err) {
        console.error('Order creation failed:', err)
      }
    }

    // 10. If NOT confident — alert seller
    if (!isConfident) {
      await alertSeller(seller_id, customer.id, from, body, channel)
    }

    // 11. Update conversation
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

    // 12. Update order with fulfillment details if provided separately
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
