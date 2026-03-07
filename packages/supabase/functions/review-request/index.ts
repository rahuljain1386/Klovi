import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReviewRequestPayload {
  order_id: string
}

async function sendViaGupshup(destination: string, message: string) {
  const apiKey = Deno.env.get('GUPSHUP_API_KEY')!
  const appName = Deno.env.get('GUPSHUP_APP_NAME')!

  const params = new URLSearchParams({
    channel: 'whatsapp',
    source: appName,
    destination,
    'message.type': 'text',
    message,
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
    console.error('Gupshup send failed:', await response.text())
  }
  return response.ok
}

async function sendViaTelnyx(to: string, text: string) {
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('TELNYX_API_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('TELNYX_MESSAGING_PROFILE_ID')!,
      to,
      text,
    }),
  })

  if (!response.ok) {
    console.error('Telnyx send failed:', await response.text())
  }
  return response.ok
}

async function sendViaChannel(phone: string, channel: string, message: string) {
  if (channel === 'whatsapp' || channel === 'instagram' || channel === 'facebook') {
    return sendViaGupshup(phone, message)
  } else if (channel === 'sms') {
    return sendViaTelnyx(phone, message)
  }
  return sendViaGupshup(phone, message)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: ReviewRequestPayload = await req.json()
    const { order_id } = payload

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, seller_id, customer_id, items, total, status')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, phone, channel')
      .eq('id', order.customer_id)
      .single()

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Look up seller
    const { data: seller } = await supabase
      .from('sellers')
      .select('id, business_name, slug')
      .eq('id', order.seller_id)
      .single()

    if (!seller) {
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build the review link
    const reviewLink = `https://klovi.com/${seller.slug}?review=${order_id}`

    // Build the personalized message
    const customerName = customer.name ?? 'there'
    const message = `Hi ${customerName}! How was your order from ${seller.business_name}? We'd love your feedback: ${reviewLink}`

    // Send via the customer's conversation channel
    if (customer.phone) {
      await sendViaChannel(customer.phone, customer.channel ?? 'whatsapp', message)
    }

    // Find the conversation to save the outbound message
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('seller_id', order.seller_id)
      .eq('customer_id', customer.id)
      .limit(1)
      .single()

    // Save outbound message
    if (conversation) {
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        seller_id: order.seller_id,
        customer_id: customer.id,
        role: 'assistant',
        body: message,
        channel: customer.channel ?? 'whatsapp',
        status: 'sent',
        intent: 'review_request',
        created_at: new Date().toISOString(),
      })
    }

    // Create a journey_task record to track this touchpoint
    await supabase.from('journey_tasks').insert({
      seller_id: order.seller_id,
      customer_id: customer.id,
      type: 'review_request',
      status: 'completed',
      data: {
        order_id,
        review_link: reviewLink,
        message_sent: true,
      },
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        message_sent: true,
        review_link: reviewLink,
        customer_id: customer.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('review-request error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
