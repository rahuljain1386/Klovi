import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, category, description')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { template, product_names, occasion } = await request.json();

  const templateDescriptions: Record<string, string> = {
    announcement: 'a general business announcement or new product launch',
    flash_sale: 'a limited-time flash sale or special discount',
    seasonal: 'a seasonal special, holiday offer, or festive promotion',
    social_proof: 'a post highlighting customer reviews, testimonials, or milestones',
    restock: 'a restock announcement for popular items that were sold out',
  };

  const prompt = `Write an engaging Instagram caption for ${seller.business_name} (${seller.category} business).

${seller.description ? `About: ${seller.description}` : ''}

Post type: ${templateDescriptions[template] || template}
${product_names?.length ? `Products featured: ${product_names.join(', ')}` : ''}
${occasion ? `Occasion/context: ${occasion}` : ''}

Requirements:
- Keep it under 150 words
- Use a warm, personal tone (like talking to a friend)
- Include 2-3 relevant hashtags at the end
- Include a clear call-to-action (order now, DM us, link in bio, etc.)
- Make it feel authentic, not corporate
- If relevant, add an emoji or two (but don't overdo it)`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          content: 'You are a social media copywriter who creates warm, authentic captions for small business owners. Never use corporate jargon. Write like a real person.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
  }

  const data = await response.json();
  const caption = data.choices[0]?.message?.content?.trim() || '';

  return NextResponse.json({ caption });
}
