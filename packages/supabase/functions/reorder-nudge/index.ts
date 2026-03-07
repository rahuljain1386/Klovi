import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReorderNudgePayload {
  seller_id: string
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
    const payload: ReorderNudgePayload = await req.json()
    const { seller_id } = payload

    if (!seller_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: seller_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get seller info
    const { data: seller } = await supabase
      .from('sellers')
      .select('id, business_name, slug')
      .eq('id', seller_id)
      .single()

    if (!seller) {
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find customers who ordered 7+ days ago but haven't reordered
    // Only include 'active' or 'loyal' segment customers
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: eligibleCustomers } = await supabase
      .from('customers')
      .select('id, name, phone, channel, segment')
      .eq('seller_id', seller_id)
      .in('segment', ['active', 'loyal'])

    if (!eligibleCustomers?.length) {
      return new Response(
        JSON.stringify({ success: true, nudges_sent: 0, message: 'No eligible customers found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let nudgesSent = 0
    const nudgedCustomers: string[] = []

    for (const customer of eligibleCustomers) {
      // Check if customer has been nudged in last 14 days
      const { data: recentNudge } = await supabase
        .from('journey_tasks')
        .select('id')
        .eq('seller_id', seller_id)
        .eq('customer_id', customer.id)
        .eq('type', 'reorder_nudge')
        .gte('created_at', fourteenDaysAgo)
        .limit(1)

      if (recentNudge && recentNudge.length > 0) {
        continue // Skip - already nudged recently
      }

      // Get the customer's most recent order
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('id, items, created_at')
        .eq('seller_id', seller_id)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!lastOrder) continue

      // Check if the last order was 7+ days ago
      const lastOrderDate = new Date(lastOrder.created_at)
      if (lastOrderDate > new Date(sevenDaysAgo)) {
        continue // Ordered too recently
      }

      // Check if they have placed any order after the last order (i.e., already reordered)
      // Since we got the most recent order, we just need to check the date
      // The check above already ensures 7+ days gap

      // Extract item names from last order
      const items = lastOrder.items as { name: string }[]
      const itemNames = items
        .map((i) => i.name)
        .slice(0, 3) // Limit to 3 items for message brevity
        .join(', ')

      // Build personalized message
      const customerName = customer.name ?? 'there'
      const message = `Hi ${customerName}! Missing your favorites from ${seller.business_name}? Your usual ${itemNames} are available. Want to reorder?`

      // Send the nudge via customer's preferred channel
      if (customer.phone) {
        const sent = await sendViaChannel(customer.phone, customer.channel ?? 'whatsapp', message)

        if (sent) {
          nudgesSent++
          nudgedCustomers.push(customer.id)

          // Save journey_task record
          await supabase.from('journey_tasks').insert({
            seller_id,
            customer_id: customer.id,
            type: 'reorder_nudge',
            status: 'completed',
            data: {
              last_order_id: lastOrder.id,
              item_names: itemNames,
              message,
            },
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        nudges_sent: nudgesSent,
        nudged_customers: nudgedCustomers,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('reorder-nudge error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
