import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, business_name, category, description')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const { template, product_names, occasion, businessName, businessType } = await request.json();

  const templateDescriptions: Record<string, string> = {
    announcement: 'a general business announcement or new product launch',
    flash_sale: 'a limited-time flash sale or special discount',
    seasonal: 'a seasonal special, holiday offer, or festive promotion',
    social_proof: 'a post highlighting customer reviews, testimonials, or milestones',
    restock: 'a restock announcement for popular items that were sold out',
    event: 'an event or special offer announcement',
    new_product: 'a new product launch',
  };

  const name = seller.business_name || businessName || 'My Business';
  const category = seller.category || businessType || '';

  const prompt = `Write a SHORT Instagram caption for ${name} (${category} business).

${seller.description ? `About: ${seller.description}` : ''}

Post type: ${templateDescriptions[template] || template}
${product_names?.length ? `Products featured: ${product_names.join(', ')}` : ''}
${occasion ? `Occasion/context: ${occasion}` : ''}

STRICT requirements:
- Maximum 3-4 lines of text (NOT an essay)
- 1 catchy opening line
- 1-2 lines of detail
- 1 call-to-action line
- 2-3 hashtags at the end
- Total must be under 40 words (excluding hashtags)
- Warm, personal tone
- DO NOT write paragraphs or long descriptions`;

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
      max_tokens: 120,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
  }

  const data = await response.json();
  const caption = data.choices[0]?.message?.content?.trim() || '';

  return NextResponse.json({ caption });
}
