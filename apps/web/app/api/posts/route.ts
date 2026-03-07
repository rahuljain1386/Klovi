import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ posts: posts || [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, plan')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const body = await request.json();
  const { template, post_type, caption, image_urls, scheduled_at } = body;

  if (!template || !post_type) {
    return NextResponse.json({ error: 'Template and post type required' }, { status: 400 });
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      seller_id: seller.id,
      template,
      post_type,
      caption: caption || '',
      image_urls: image_urls || [],
      enhanced_image_urls: [],
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      ai_generated_caption: false,
      ai_suggested: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  }

  return NextResponse.json({ post });
}
