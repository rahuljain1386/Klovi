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
      channel,
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
    .select('business_name, description, category, city, language')
    .eq('id', sellerId)
    .single()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, description, in_stock')
    .eq('seller_id', sellerId)
    .eq('in_stock', true)
    .limit(50)

  const { data: knowledge } = await supabase
    .from('knowledge_base')
    .select('question, answer')
    .eq('seller_id', sellerId)
    .limit(30)

  return { seller, products: products ?? [], knowledge: knowledge ?? [] }
}

async function generateAIReply(
  message: string,
  sellerContext: Awaited<ReturnType<typeof getSellerContext>>,
  history: { role: string; body: string }[]
): Promise<AIResponse> {
  const { seller, products, knowledge } = sellerContext

  const systemPrompt = `You are a helpful sales assistant for "${seller?.business_name}", a ${seller?.category} business in ${seller?.city}.

Business description: ${seller?.description}

Available products:
${products.map((p) => `- ${p.name}: ${p.price} (ID: ${p.id})`).join('\n')}

${knowledge.length > 0 ? `FAQ:\n${knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n')}` : ''}

Instructions:
- Be warm, helpful, and concise.
- If the customer wants to order, confirm items and quantities.
- If you're unsure about something, indicate low confidence.
- Always respond in the language the customer uses.

Respond in JSON format:
{
  "reply": "your message to the customer",
  "confidence": 0.0 to 1.0,
  "intent": "order" | "inquiry" | "complaint" | "greeting" | "other",
  "extracted_items": [{"product_id": "uuid", "quantity": 1}] // only if intent is "order"
}`

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
  const appName = Deno.env.get('GUPSHUP_APP_NAME')!

  const params = new URLSearchParams({
    channel: 'whatsapp',
    source: appName,
    destination,
    'message.type': 'text',
    message: message,
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
  items: { product_id: string; quantity: number }[]
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

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      seller_id: sellerId,
      customer_id: customerId,
      items: orderItems,
      total,
      status: 'placed',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create order: ${error.message}`)
  return order
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
    const messageStatus = aiResponse.confidence > 0.85 ? 'sent' : 'draft'

    // 7. If confident, send the reply
    if (aiResponse.confidence > 0.85) {
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

    // 9. If intent is order, create the order
    let order = null
    if (aiResponse.intent === 'order' && aiResponse.extracted_items?.length) {
      try {
        order = await createOrder(seller_id, customer.id, aiResponse.extracted_items)
      } catch (err) {
        console.error('Order creation failed:', err)
      }
    }

    // 10. Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: aiResponse.confidence > 0.85 ? 0 : 1,
        last_message: body,
      })
      .eq('id', conversationId)

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
