import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, plan')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
  if (seller.plan !== 'pro') {
    return NextResponse.json({ error: 'AI Coach requires Pro plan' }, { status: 403 });
  }

  const { data: suggestions } = await supabase
    .from('coach_suggestions')
    .select('*')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ suggestions: suggestions || [] });
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
  if (seller.plan !== 'pro') {
    return NextResponse.json({ error: 'AI Coach requires Pro plan' }, { status: 403 });
  }

  // Gather business data for AI analysis
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    { data: recentOrders },
    { data: products },
    { data: reviews },
    { data: customers },
    { count: dormantCount },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('total, status, created_at, items')
      .eq('seller_id', seller.id)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('products')
      .select('name, price, stock_quantity, is_available')
      .eq('seller_id', seller.id),
    supabase
      .from('reviews')
      .select('rating, comment, created_at')
      .eq('seller_id', seller.id)
      .gte('created_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('customers')
      .select('segment, total_orders, total_spent, last_order_at')
      .eq('seller_id', seller.id),
    supabase
      .from('customers')
      .select('id', { count: 'exact' })
      .eq('seller_id', seller.id)
      .eq('segment', 'dormant'),
  ]);

  const totalRevenue = recentOrders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
  const completedOrders = recentOrders?.filter(o => ['collected', 'delivered'].includes(o.status)) || [];
  const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
  const avgRating = reviews?.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const lowStockItems = products?.filter(p => p.stock_quantity !== null && p.stock_quantity < 5) || [];

  const prompt = `You are an AI business coach for small home-based businesses. Analyze this data and provide ONE actionable suggestion.

Business: ${seller.business_name} (${seller.category})
Country: ${seller.country}

Last 30 days:
- Orders: ${completedOrders.length} completed, ${recentOrders?.length || 0} total
- Revenue: ${seller.country === 'india' ? '₹' : '$'}${totalRevenue.toFixed(0)}
- Average order value: ${seller.country === 'india' ? '₹' : '$'}${avgOrderValue.toFixed(0)}
- Reviews: ${reviews?.length || 0} (avg rating: ${avgRating.toFixed(1)}/5)
- Total customers: ${customers?.length || 0}
- Dormant customers: ${dormantCount || 0}
- Low stock items: ${lowStockItems.map(p => p.name).join(', ') || 'none'}
- Products: ${products?.length || 0} total, ${products?.filter(p => !p.is_available).length || 0} unavailable

Respond with JSON:
{
  "type": "growth" | "retention" | "pricing" | "product" | "marketing",
  "title": "Short actionable title (under 10 words)",
  "description": "2-3 sentence explanation with specific data-backed advice",
  "priority": "high" | "medium" | "low",
  "action_type": "broadcast" | "price_change" | "restock" | "new_product" | "review_campaign" | null,
  "action_data": {} // optional structured data for the action
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful business coach. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 502 });
  }

  const data = await response.json();
  let suggestion;
  try {
    suggestion = JSON.parse(data.choices[0].message.content);
  } catch {
    return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 });
  }

  // Save suggestion
  const { data: saved, error } = await supabase
    .from('coach_suggestions')
    .insert({
      seller_id: seller.id,
      type: suggestion.type,
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
      action_type: suggestion.action_type,
      action_data: suggestion.action_data || {},
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to save suggestion' }, { status: 500 });
  }

  return NextResponse.json({ suggestion: saved });
}
