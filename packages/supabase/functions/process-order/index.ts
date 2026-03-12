import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
  product_id: string
  quantity: number
}

interface ProcessOrderPayload {
  action: 'create' | 'confirm' | 'ready' | 'complete' | 'cancel'
  order_id?: string
  seller_id: string
  customer_id?: string
  items?: OrderItem[]
  fulfillment_type?: string
}

const STATUS_MAP: Record<string, string> = {
  confirm: 'confirmed',
  ready: 'ready',
  complete: 'completed',
  cancel: 'cancelled',
}

const STATUS_MESSAGES: Record<string, string> = {
  confirmed: 'Your order has been confirmed! We\'re working on it now. ✅',
  ready: 'Great news! Your order is ready! 🎉',
  completed: 'Your order is complete. Thank you for your business! ⭐',
  cancelled: 'Your order has been cancelled. Please reach out if you have any questions.',
}

async function generateBalanceLink(orderId: string): Promise<string | null> {
  const appUrl = Deno.env.get('APP_URL') || Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://klovi.com'
  try {
    const res = await fetch(`${appUrl}/api/checkout/balance`, {
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

async function getCustomerWithChannel(customerId: string) {
  const { data } = await supabase
    .from('customers')
    .select('id, name, phone, channel, push_token, email')
    .eq('id', customerId)
    .single()
  return data
}

async function getSellerInfo(sellerId: string) {
  const { data } = await supabase
    .from('sellers')
    .select('id, business_name, slug, phone')
    .eq('id', sellerId)
    .single()
  return data
}

async function sendNotificationToCustomer(
  sellerId: string,
  customerId: string,
  message: string,
  channel: string
) {
  // Send via appropriate channel
  if (channel === 'whatsapp' || channel === 'instagram' || channel === 'facebook') {
    const customer = await getCustomerWithChannel(customerId)
    if (!customer?.phone) return

    const apiKey = Deno.env.get('GUPSHUP_API_KEY')!
    const sourceNumber = Deno.env.get('GUPSHUP_WHATSAPP_NUMBER')!

    const params = new URLSearchParams({
      channel: 'whatsapp',
      source: sourceNumber,
      destination: customer.phone,
      'src.name': Deno.env.get('GUPSHUP_APP_NAME') || 'KloviApp',
      'message': JSON.stringify({ type: 'text', text: message }),
    })

    await fetch('https://api.gupshup.io/wa/api/v1/msg', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
  } else if (channel === 'sms') {
    const customer = await getCustomerWithChannel(customerId)
    if (!customer?.phone) return

    await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('TELNYX_API_KEY')!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('TELNYX_MESSAGING_PROFILE_ID')!,
        to: customer.phone,
        text: message,
      }),
    })
  }
}

async function createOrder(
  sellerId: string,
  customerId: string,
  items: OrderItem[],
  fulfillmentType?: string
) {
  // Fetch product details and prices
  const productIds = items.map((i) => i.product_id)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, track_stock, stock')
    .in('id', productIds)

  if (productsError || !products?.length) {
    throw new Error('Failed to fetch products or no valid products found')
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

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      seller_id: sellerId,
      customer_id: customerId,
      items: orderItems,
      total,
      status: 'placed',
      fulfillment_type: fulfillmentType ?? 'delivery',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create order: ${error.message}`)
  return order
}

async function updateOrderStatus(orderId: string, action: string) {
  const newStatus = STATUS_MAP[action]
  if (!newStatus) throw new Error(`Invalid action: ${action}`)

  const { data: order, error } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select('*, customer:customers(id, name, phone, channel, push_token)')
    .single()

  if (error) throw new Error(`Failed to update order: ${error.message}`)
  return order
}

async function restoreStock(orderId: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('items')
    .eq('id', orderId)
    .single()

  if (!order?.items) return

  const items = order.items as { product_id: string; quantity: number }[]

  for (const item of items) {
    // Check if product tracks stock
    const { data: product } = await supabase
      .from('products')
      .select('id, track_stock, stock')
      .eq('id', item.product_id)
      .single()

    if (product?.track_stock) {
      await supabase
        .from('products')
        .update({ stock: (product.stock ?? 0) + item.quantity })
        .eq('id', item.product_id)
    }
  }
}

async function scheduleReviewRequest(orderId: string, sellerId: string) {
  // Schedule a review request for 2 hours from now
  const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  // Use the Supabase edge function invocation to schedule
  // In practice this could be a pg_cron job or a scheduled function call
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Create a notification record that will be picked up by a scheduler
  await supabase.from('notifications').insert({
    seller_id: sellerId,
    type: 'review_request',
    data: { order_id: orderId },
    scheduled_at: scheduledAt,
    status: 'scheduled',
    created_at: new Date().toISOString(),
  })

  // Also invoke the review-request function directly after delay
  // In production, this would use pg_cron or a queue
  setTimeout(async () => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/review-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
      })
    } catch (err) {
      console.error('Failed to trigger review request:', err)
    }
  }, 2 * 60 * 60 * 1000) // 2 hours
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: ProcessOrderPayload = await req.json()
    const { action, order_id, seller_id, customer_id, items, fulfillment_type } = payload

    if (!action || !seller_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, seller_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let order: Record<string, unknown> | null = null

    if (action === 'create') {
      // Create a new order
      if (!customer_id || !items?.length) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields for create: customer_id, items' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      order = await createOrder(seller_id, customer_id, items, fulfillment_type)

      // Notify customer
      const customer = await getCustomerWithChannel(customer_id)
      const seller = await getSellerInfo(seller_id)
      if (customer && seller) {
        const message = `Your order from ${seller.business_name} has been placed! Order total: ${order.total}. We'll update you on the status.`
        await sendNotificationToCustomer(seller_id, customer_id, message, customer.channel ?? 'whatsapp')
      }
    } else {
      // Status change actions
      if (!order_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: order_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Handle cancellation - restore stock first
      if (action === 'cancel') {
        await restoreStock(order_id)
      }

      order = await updateOrderStatus(order_id, action)

      // Send notification to customer about status change
      const newStatus = STATUS_MAP[action]
      const statusMessage = STATUS_MESSAGES[newStatus]

      if (order && statusMessage) {
        const customerData = order.customer as { id: string; channel?: string } | null
        if (customerData) {
          await sendNotificationToCustomer(
            seller_id,
            customerData.id,
            statusMessage,
            customerData.channel ?? 'whatsapp'
          )

          // For 'ready' orders — send balance payment link
          if (action === 'ready' && order.balance_amount > 0) {
            const balanceUrl = await generateBalanceLink(order_id)
            if (balanceUrl) {
              const sym = order.currency === 'INR' ? '₹' : '$'
              const balanceMsg = `💳 *Balance Due: ${sym}${order.balance_amount}*\n\nPay here: ${balanceUrl}\n\nYour order is ready and waiting for you!`
              await sendNotificationToCustomer(
                seller_id,
                customerData.id,
                balanceMsg,
                customerData.channel ?? 'whatsapp'
              )
            }
          }
        }
      }

      // For completed orders, schedule review request
      if (action === 'complete' && order) {
        await scheduleReviewRequest(order_id, seller_id)
      }
    }

    return new Response(
      JSON.stringify({ success: true, order }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('process-order error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
