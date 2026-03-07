import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET: Fetch reviews for a seller (seller-facing)
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get('seller_id');

  if (!sellerId) {
    // Authenticated seller viewing their own reviews
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: seller } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*, customer:customers(name)')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ reviews: reviews || [] });
  }

  // Public reviews for a seller page
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, customer:customers(name)')
    .eq('seller_id', sellerId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({ reviews: reviews || [] });
}

// POST: Customer submitting a review
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const body = await request.json();
  const { order_id, rating, comment } = body;

  if (!order_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Valid order_id and rating (1-5) required' }, { status: 400 });
  }

  // Look up the order
  const { data: order } = await supabase
    .from('orders')
    .select('id, seller_id, customer_id')
    .eq('id', order_id)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Check if review already exists
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', order_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'Review already submitted for this order' }, { status: 409 });
  }

  // AI sentiment analysis
  let aiSentiment = 'neutral';
  let aiCategory = 'general';

  if (comment) {
    try {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'Analyze this review and respond with JSON: { "sentiment": "positive"|"neutral"|"negative", "category": "quality"|"service"|"delivery"|"value"|"general" }',
            },
            { role: 'user', content: `Rating: ${rating}/5\nReview: ${comment}` },
          ],
          temperature: 0,
          max_tokens: 50,
          response_format: { type: 'json_object' },
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const analysis = JSON.parse(aiData.choices[0].message.content);
        aiSentiment = analysis.sentiment;
        aiCategory = analysis.category;
      }
    } catch {
      // Fallback to simple sentiment
      aiSentiment = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';
    }
  }

  // Insert review
  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      seller_id: order.seller_id,
      customer_id: order.customer_id,
      order_id: order.id,
      rating,
      comment: comment || null,
      ai_sentiment: aiSentiment,
      ai_category: aiCategory,
      is_public: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }

  // If rating <= 2, trigger recovery flow — notify seller immediately
  if (rating <= 2) {
    await supabase.from('notifications').insert({
      seller_id: order.seller_id,
      type: 'review_alert',
      title: `Low review alert: ${rating} stars`,
      body: comment || 'Customer left a low rating',
      priority: 'critical',
      data: { review_id: review.id, customer_id: order.customer_id },
    });
  }

  return NextResponse.json({ review });
}
