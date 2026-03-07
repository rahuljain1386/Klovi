import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, plan, instagram_access_token, instagram_business_id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
  if (seller.plan !== 'pro') {
    return NextResponse.json({ error: 'Instagram publishing requires Pro plan' }, { status: 403 });
  }
  if (!seller.instagram_access_token || !seller.instagram_business_id) {
    return NextResponse.json({ error: 'Instagram not connected' }, { status: 400 });
  }

  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('id', params.id)
    .eq('seller_id', seller.id)
    .single();

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  try {
    const imageUrl = post.rendered_image_url || post.enhanced_image_urls?.[0] || post.image_urls?.[0];
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image to publish' }, { status: 400 });
    }

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${seller.instagram_business_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: post.caption,
          access_token: seller.instagram_access_token,
        }),
      }
    );

    const containerData = await containerRes.json();
    if (!containerData.id) {
      return NextResponse.json({ error: 'Failed to create media container' }, { status: 502 });
    }

    // Step 2: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${seller.instagram_business_id}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: seller.instagram_access_token,
        }),
      }
    );

    const publishData = await publishRes.json();
    if (!publishData.id) {
      return NextResponse.json({ error: 'Failed to publish' }, { status: 502 });
    }

    // Update post record
    await supabase
      .from('posts')
      .update({
        status: 'published',
        instagram_post_id: publishData.id,
        published_at: new Date().toISOString(),
      })
      .eq('id', post.id);

    return NextResponse.json({ instagram_post_id: publishData.id });
  } catch {
    await supabase
      .from('posts')
      .update({ status: 'failed' })
      .eq('id', post.id);

    return NextResponse.json({ error: 'Publishing failed' }, { status: 500 });
  }
}
