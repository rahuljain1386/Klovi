import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type NotificationType =
  | 'order_update'
  | 'review_request'
  | 'reorder_nudge'
  | 'broadcast'
  | 'daily_summary'
  | 'welcome'
  | 'milestone'

interface NotificationPayload {
  type: NotificationType
  seller_id: string
  customer_id?: string
  data: Record<string, unknown>
}

async function getCustomer(customerId: string) {
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, email, channel, push_token')
    .eq('id', customerId)
    .single()
  return data
}

async function getSeller(sellerId: string) {
  const { data } = await supabase
    .from('sellers')
    .select('id, user_id, business_name, slug, phone, push_token, email')
    .eq('id', sellerId)
    .single()
  return data
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
  // Default to WhatsApp
  return sendViaGupshup(phone, message)
}

async function sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, unknown>) {
  if (!pushToken) return false

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: pushToken,
      title,
      body,
      data: data ?? {},
      sound: 'default',
    }),
  })

  if (!response.ok) {
    console.error('Expo push failed:', await response.text())
  }
  return response.ok
}

async function sendEmail(to: string, subject: string, htmlBody: string) {
  if (!to) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Klovi <notifications@klovi.com>',
      to: [to],
      subject,
      html: htmlBody,
    }),
  })

  if (!response.ok) {
    console.error('Resend email failed:', await response.text())
  }
  return response.ok
}

async function saveNotification(
  sellerId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  customerId?: string
) {
  await supabase.from('notifications').insert({
    seller_id: sellerId,
    customer_id: customerId ?? null,
    type,
    title,
    body,
    data,
    read: false,
    created_at: new Date().toISOString(),
  })
}

async function buildDailySummary(sellerId: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString()

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString()

  // Today's orders
  const { data: todayOrders, count: todayOrderCount } = await supabase
    .from('orders')
    .select('total', { count: 'exact' })
    .eq('seller_id', sellerId)
    .gte('created_at', todayStr)

  // Yesterday's orders for comparison
  const { count: yesterdayOrderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact' })
    .eq('seller_id', sellerId)
    .gte('created_at', yesterdayStr)
    .lt('created_at', todayStr)

  const todayRevenue = (todayOrders ?? []).reduce(
    (sum, o) => sum + (typeof o.total === 'number' ? o.total : 0),
    0
  )

  // Yesterday's revenue
  const { data: yesterdayOrders } = await supabase
    .from('orders')
    .select('total')
    .eq('seller_id', sellerId)
    .gte('created_at', yesterdayStr)
    .lt('created_at', todayStr)

  const yesterdayRevenue = (yesterdayOrders ?? []).reduce(
    (sum, o) => sum + (typeof o.total === 'number' ? o.total : 0),
    0
  )

  // New customers today
  const { count: newCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact' })
    .eq('seller_id', sellerId)
    .gte('created_at', todayStr)

  // Unread messages
  const { data: unreadConversations } = await supabase
    .from('conversations')
    .select('unread_count')
    .eq('seller_id', sellerId)
    .gt('unread_count', 0)

  const unreadMessages = (unreadConversations ?? []).reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0
  )

  // Pending reviews
  const { count: pendingReviews } = await supabase
    .from('reviews')
    .select('id', { count: 'exact' })
    .eq('seller_id', sellerId)
    .eq('status', 'pending')

  // Low stock items
  const { data: lowStockItems } = await supabase
    .from('products')
    .select('name, stock')
    .eq('seller_id', sellerId)
    .eq('track_stock', true)
    .lt('stock', 5)
    .gt('stock', 0)

  const orderTrend = (todayOrderCount ?? 0) >= (yesterdayOrderCount ?? 0) ? 'up' : 'down'
  const revenueTrend = todayRevenue >= yesterdayRevenue ? 'up' : 'down'

  return {
    orders_today: todayOrderCount ?? 0,
    orders_yesterday: yesterdayOrderCount ?? 0,
    order_trend: orderTrend,
    revenue_today: todayRevenue,
    revenue_yesterday: yesterdayRevenue,
    revenue_trend: revenueTrend,
    new_customers: newCustomers ?? 0,
    unread_messages: unreadMessages,
    pending_reviews: pendingReviews ?? 0,
    low_stock_items: lowStockItems ?? [],
  }
}

function trendArrow(trend: string): string {
  return trend === 'up' ? '^' : 'v'
}

function formatSummaryMessage(summary: ReturnType<typeof buildDailySummary> extends Promise<infer T> ? T : never, coachTip: string): string {
  const lines = [
    `Daily Summary`,
    ``,
    `Orders: ${summary.orders_today} ${trendArrow(summary.order_trend)} (yesterday: ${summary.orders_yesterday})`,
    `Revenue: ${summary.revenue_today} ${trendArrow(summary.revenue_trend)} (yesterday: ${summary.revenue_yesterday})`,
    `New customers: ${summary.new_customers}`,
    `Unread messages: ${summary.unread_messages}`,
    `Pending reviews: ${summary.pending_reviews}`,
  ]

  if (summary.low_stock_items.length > 0) {
    lines.push(`Low stock: ${summary.low_stock_items.map((i) => `${i.name} (${i.stock})`).join(', ')}`)
  }

  lines.push(``)
  lines.push(`Tip: ${coachTip}`)

  return lines.join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: NotificationPayload = await req.json()
    const { type, seller_id, customer_id, data } = payload

    if (!type || !seller_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, seller_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const seller = await getSeller(seller_id)
    if (!seller) {
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: Record<string, boolean> = {}

    // --- Handle daily_summary (seller-facing) ---
    if (type === 'daily_summary') {
      const summary = await buildDailySummary(seller_id)

      // Generate AI coach tip
      let coachTip = 'Keep up the great work!'
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: 'You are a friendly business coach. Give a brief, actionable tip (1-2 sentences) based on these daily business stats. Be encouraging and specific.',
              },
              {
                role: 'user',
                content: JSON.stringify(summary),
              },
            ],
            temperature: 0.8,
            max_tokens: 100,
          }),
        })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          coachTip = aiData.choices[0].message.content.trim()
        }
      } catch (err) {
        console.error('AI coach tip generation failed:', err)
      }

      const title = 'Your Daily Summary'
      const body = formatSummaryMessage(summary, coachTip)

      // Send push notification to seller
      if (seller.push_token) {
        results.push = await sendPushNotification(
          seller.push_token,
          title,
          body,
          { type: 'daily_summary', summary }
        )
      }

      // Send email to seller
      if (seller.email) {
        results.email = await sendEmail(
          seller.email,
          `Daily Summary - ${seller.business_name}`,
          `<h2>Daily Summary</h2><pre>${body}</pre>`
        )
      }

      // Save notification
      await saveNotification(seller_id, type, title, body, { summary, coach_tip: coachTip })

      return new Response(
        JSON.stringify({ success: true, type, results, summary }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Handle customer-facing notifications ---
    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'Missing customer_id for customer-facing notification' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customer = await getCustomer(customer_id)
    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let title = ''
    let body = ''

    switch (type) {
      case 'order_update': {
        const status = (data.status as string) ?? 'updated'
        title = 'Order Update'
        body = (data.message as string) ?? `Your order has been ${status}.`
        break
      }
      case 'review_request': {
        title = 'How was your order?'
        body = (data.message as string) ?? `We'd love to hear your feedback on your recent order from ${seller.business_name}!`
        break
      }
      case 'reorder_nudge': {
        title = `Missing ${seller.business_name}?`
        body = (data.message as string) ?? `Your favorites are available! Want to reorder?`
        break
      }
      case 'broadcast': {
        title = (data.title as string) ?? seller.business_name
        body = (data.message as string) ?? ''
        break
      }
      case 'welcome': {
        title = `Welcome to ${seller.business_name}!`
        body = (data.message as string) ?? `Thanks for connecting with us. We're here to help!`
        break
      }
      case 'milestone': {
        title = (data.title as string) ?? 'Milestone reached!'
        body = (data.message as string) ?? `Congratulations on reaching a milestone with ${seller.business_name}!`
        break
      }
      default: {
        title = 'Notification'
        body = (data.message as string) ?? ''
      }
    }

    // Send via customer's preferred channel (WhatsApp/SMS)
    if (customer.phone) {
      results.channel = await sendViaChannel(customer.phone, customer.channel ?? 'whatsapp', body)
    }

    // Send push notification
    if (customer.push_token) {
      results.push = await sendPushNotification(customer.push_token, title, body, {
        type,
        seller_id,
        ...data,
      })
    }

    // Send email
    if (customer.email) {
      results.email = await sendEmail(
        customer.email,
        title,
        `<h2>${title}</h2><p>${body}</p><br><p>- ${seller.business_name}</p>`
      )
    }

    // Save notification record
    await saveNotification(seller_id, type, title, body, data, customer_id)

    return new Response(
      JSON.stringify({ success: true, type, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-notification error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
