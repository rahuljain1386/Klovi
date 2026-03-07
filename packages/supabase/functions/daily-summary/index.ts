import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DailySummaryPayload {
  seller_id?: string
}

interface SummaryStats {
  orders_today: number
  orders_yesterday: number
  order_trend: 'up' | 'down' | 'flat'
  revenue_today: number
  revenue_yesterday: number
  revenue_trend: 'up' | 'down' | 'flat'
  new_customers: number
  unread_messages: number
  pending_reviews: number
  low_stock_items: { name: string; stock: number }[]
}

function getTrend(today: number, yesterday: number): 'up' | 'down' | 'flat' {
  if (today > yesterday) return 'up'
  if (today < yesterday) return 'down'
  return 'flat'
}

function trendArrow(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return '(up)'
  if (trend === 'down') return '(down)'
  return '(same)'
}

async function aggregateStats(sellerId: string): Promise<SummaryStats> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const todayStr = todayStart.toISOString()
  const yesterdayStr = yesterdayStart.toISOString()

  // Fetch today's and yesterday's orders in parallel
  const [
    todayOrdersResult,
    yesterdayOrdersResult,
    newCustomersResult,
    unreadResult,
    pendingReviewsResult,
    lowStockResult,
  ] = await Promise.all([
    // Today's orders
    supabase
      .from('orders')
      .select('total', { count: 'exact' })
      .eq('seller_id', sellerId)
      .gte('created_at', todayStr),

    // Yesterday's orders
    supabase
      .from('orders')
      .select('total', { count: 'exact' })
      .eq('seller_id', sellerId)
      .gte('created_at', yesterdayStr)
      .lt('created_at', todayStr),

    // New customers today
    supabase
      .from('customers')
      .select('id', { count: 'exact' })
      .eq('seller_id', sellerId)
      .gte('created_at', todayStr),

    // Unread conversations
    supabase
      .from('conversations')
      .select('unread_count')
      .eq('seller_id', sellerId)
      .gt('unread_count', 0),

    // Pending reviews
    supabase
      .from('reviews')
      .select('id', { count: 'exact' })
      .eq('seller_id', sellerId)
      .eq('status', 'pending'),

    // Low stock items (stock > 0 but < 5)
    supabase
      .from('products')
      .select('name, stock')
      .eq('seller_id', sellerId)
      .eq('track_stock', true)
      .lt('stock', 5)
      .gt('stock', 0),
  ])

  const todayOrders = todayOrdersResult.data ?? []
  const yesterdayOrders = yesterdayOrdersResult.data ?? []

  const revenueToday = todayOrders.reduce(
    (sum, o) => sum + (typeof o.total === 'number' ? o.total : 0),
    0
  )
  const revenueYesterday = yesterdayOrders.reduce(
    (sum, o) => sum + (typeof o.total === 'number' ? o.total : 0),
    0
  )

  const ordersToday = todayOrdersResult.count ?? 0
  const ordersYesterday = yesterdayOrdersResult.count ?? 0

  const unreadMessages = (unreadResult.data ?? []).reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0
  )

  return {
    orders_today: ordersToday,
    orders_yesterday: ordersYesterday,
    order_trend: getTrend(ordersToday, ordersYesterday),
    revenue_today: revenueToday,
    revenue_yesterday: revenueYesterday,
    revenue_trend: getTrend(revenueToday, revenueYesterday),
    new_customers: newCustomersResult.count ?? 0,
    unread_messages: unreadMessages,
    pending_reviews: pendingReviewsResult.count ?? 0,
    low_stock_items: (lowStockResult.data ?? []) as { name: string; stock: number }[],
  }
}

async function generateCoachTip(
  stats: SummaryStats,
  businessName: string
): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a friendly, encouraging business coach for small business owners. Given daily stats for "${businessName}", provide a brief, actionable tip in 1-2 sentences. Be warm and specific to their numbers. Don't use emojis.`,
          },
          {
            role: 'user',
            content: `Today's stats:
- Orders: ${stats.orders_today} (yesterday: ${stats.orders_yesterday})
- Revenue: ${stats.revenue_today} (yesterday: ${stats.revenue_yesterday})
- New customers: ${stats.new_customers}
- Unread messages: ${stats.unread_messages}
- Pending reviews: ${stats.pending_reviews}
- Low stock items: ${stats.low_stock_items.length > 0 ? stats.low_stock_items.map((i) => `${i.name} (${i.stock} left)`).join(', ') : 'None'}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 120,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text())
      return 'Keep up the great work! Consistency is key to growing your business.'
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (err) {
    console.error('Coach tip generation failed:', err)
    return 'Keep up the great work! Consistency is key to growing your business.'
  }
}

function formatSummaryBody(stats: SummaryStats, coachTip: string, businessName: string): string {
  const lines: string[] = [
    `Daily Summary for ${businessName}`,
    '',
    `Orders: ${stats.orders_today} ${trendArrow(stats.order_trend)} (yesterday: ${stats.orders_yesterday})`,
    `Revenue: ${stats.revenue_today} ${trendArrow(stats.revenue_trend)} (yesterday: ${stats.revenue_yesterday})`,
    `New customers: ${stats.new_customers}`,
    `Unread messages: ${stats.unread_messages}`,
    `Pending reviews: ${stats.pending_reviews}`,
  ]

  if (stats.low_stock_items.length > 0) {
    lines.push(
      `Low stock alert: ${stats.low_stock_items.map((i) => `${i.name} (${i.stock} left)`).join(', ')}`
    )
  }

  lines.push('')
  lines.push(`Coach tip: ${coachTip}`)

  return lines.join('\n')
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

async function processSeller(sellerId: string): Promise<{ seller_id: string; success: boolean; stats?: SummaryStats }> {
  try {
    // Get seller info
    const { data: seller } = await supabase
      .from('sellers')
      .select('id, business_name, push_token, email')
      .eq('id', sellerId)
      .single()

    if (!seller) {
      return { seller_id: sellerId, success: false }
    }

    // Aggregate stats
    const stats = await aggregateStats(sellerId)

    // Generate AI coach tip
    const coachTip = await generateCoachTip(stats, seller.business_name)

    // Format the summary
    const title = `Daily Summary - ${seller.business_name}`
    const body = formatSummaryBody(stats, coachTip, seller.business_name)

    // Send push notification
    if (seller.push_token) {
      await sendPushNotification(seller.push_token, title, body, {
        type: 'daily_summary',
        stats,
      })
    }

    // Save notification to the database
    await supabase.from('notifications').insert({
      seller_id: sellerId,
      type: 'daily_summary',
      title,
      body,
      data: {
        stats,
        coach_tip: coachTip,
      },
      read: false,
      created_at: new Date().toISOString(),
    })

    // Also save coach suggestion
    await supabase.from('coach_suggestions').insert({
      seller_id: sellerId,
      type: 'daily_tip',
      title: 'Daily Coach Tip',
      body: coachTip,
      data: { stats },
      created_at: new Date().toISOString(),
    })

    return { seller_id: sellerId, success: true, stats }
  } catch (err) {
    console.error(`Failed to process seller ${sellerId}:`, err)
    return { seller_id: sellerId, success: false }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: DailySummaryPayload = await req.json()
    const { seller_id } = payload

    let sellerIds: string[] = []

    if (seller_id) {
      // Process single seller
      sellerIds = [seller_id]
    } else {
      // Process all active sellers
      const { data: activeSellers, error } = await supabase
        .from('sellers')
        .select('id')
        .eq('status', 'active')

      if (error) throw new Error(`Failed to fetch active sellers: ${error.message}`)
      sellerIds = (activeSellers ?? []).map((s) => s.id)
    }

    if (sellerIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No active sellers found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process each seller (in sequence to avoid rate limiting on OpenAI)
    const results: { seller_id: string; success: boolean; stats?: SummaryStats }[] = []

    for (const id of sellerIds) {
      const result = await processSeller(id)
      results.push(result)
    }

    const successCount = results.filter((r) => r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('daily-summary error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
