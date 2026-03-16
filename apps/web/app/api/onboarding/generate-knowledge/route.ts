import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Auto-generate industry-specific FAQ/knowledge base for a seller.
 * Called during onboarding after products are saved.
 *
 * POST /api/onboarding/generate-knowledge
 * Body: { sellerId }
 */
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sellerId } = await request.json();
  if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  // Verify ownership
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, user_id, business_name, category, city, country, description, fulfillment_modes, niche')
    .eq('id', sellerId)
    .single();

  if (!seller || seller.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or not owned' }, { status: 403 });
  }

  // Get products for context
  const { data: products } = await supabase
    .from('products')
    .select('name, description, price, category, variants')
    .eq('seller_id', sellerId)
    .eq('status', 'active')
    .limit(30);

  const productList = (products || []).map(p => {
    let line = `${p.name} (${p.price})`;
    if (p.description) line += ` — ${p.description}`;
    return line;
  }).join('\n');

  const category = (seller.category || seller.niche || 'general').toLowerCase();
  const fulfillment = seller.fulfillment_modes || ['pickup'];
  const currency = seller.country === 'india' ? 'INR' : 'USD';
  const sym = currency === 'INR' ? '₹' : '$';

  // Category-specific FAQ prompts
  const categoryContext: Record<string, string> = {
    food: `This is a HOME FOOD business. Customers ask about: ingredients, oil type (mustard/refined/groundnut), spice level, sugar content, preservatives (homemade = no preservatives), shelf life, storage instructions, minimum order, bulk/party orders (50-100+ pieces), advance booking time, delivery area, packaging, if they can customize spice/salt/sugar levels, allergens (nuts/gluten/dairy), veg/non-veg, Jain-friendly options, festive special items, gift packing, taste samples.`,
    snacks: `This is a HOMEMADE SNACKS business. Customers ask about: ingredients, which oil (groundnut/mustard/refined), preservatives (homemade = none), shelf life (usually 15-30 days), storage (airtight container), minimum order qty, bulk orders for events/gifting, advance notice needed, packaging options, gift boxes, spice level, sugar-free options, diet-friendly, gluten-free, allergens, delivery area, shipping availability, freshness guarantee.`,
    bakery: `This is a HOME BAKERY. Customers ask about: egg/eggless options, fondant vs cream, custom designs, flavors available, minimum cake size, advance booking (usually 2-3 days), delivery/pickup, allergens (nuts/gluten/dairy), sugar-free options, cupcake minimum order, bulk orders for parties, photo cakes, theme cakes, tier cakes, packaging, shelf life, storage, cancellation/refund.`,
    pickle: `This is a HOMEMADE PICKLE/PRESERVES business. Customers ask about: which oil (mustard/sesame/groundnut), preservatives (none - homemade), shelf life (6-12 months), storage instructions, spice level (mild/medium/hot), sugar content, salt content, organic ingredients, minimum order, bulk orders, gift packing, shipping (does pickle ship well?), glass vs plastic jar, allergens, vegan options.`,
    coaching: `This is a COACHING/TUTORING business. Customers ask about: batch timings, online vs offline, fees structure, demo class, syllabus covered, teacher qualifications, batch size, individual attention, study material provided, exam preparation, progress tracking, parent updates, makeup classes if missed, refund policy, payment installments.`,
    spiritual_healing: `This is a SPIRITUAL HEALING/WELLNESS business. Customers ask about: types of sessions (reiki/crystal/tarot/numerology), online vs in-person, session duration, what to expect, first-time guidance, free consultation, package discounts, privacy/confidentiality, qualifications/certifications, follow-up sessions, group sessions, corporate wellness programs.`,
    healing: `This is a SPIRITUAL HEALING/WELLNESS business. Customers ask about: types of sessions, online vs in-person, session duration, free consultation, package deals, what to expect in first session, privacy, qualifications, follow-up sessions.`,
    beauty: `This is a HOME BEAUTY/SALON business. Customers ask about: services list, prices, appointment booking, home service available?, products used (brands), bridal packages, party makeup, skin type consultation, patch test, group bookings, cancellation policy.`,
    jewelry: `This is a HANDMADE JEWELRY business. Customers ask about: materials (gold/silver/artificial), customization, engraving, size adjustment, return/exchange, gift wrapping, bulk orders for wedding, delivery, care instructions, warranty, hallmark certification.`,
    stitching: `This is a STITCHING/TAILORING business. Customers ask about: measurement process, fabric provided or bring own, delivery time, alteration charges, fitting sessions, rush orders, bulk orders (wedding), design consultation, price range by garment type, cancellation policy.`,
    crafts: `This is a HANDMADE CRAFTS business. Customers ask about: materials used, customization, lead time, bulk orders, gift wrapping, shipping, fragile item packaging, return policy, care instructions, personalization options.`,
    fitness: `This is a FITNESS business. Customers ask about: batch timings, online vs offline, trial class, fees, equipment needed, group vs personal training, diet plan included, progress tracking, makeup classes, instructor qualifications.`,
  };

  const industryHints = categoryContext[category] || categoryContext['food'] || '';

  const prompt = `Generate 15-20 FAQ entries for "${seller.business_name}", a ${seller.category} business in ${seller.city}.

${industryHints}

Their products/services:
${productList || 'Not specified yet'}

Fulfillment: ${fulfillment.join(', ')}
Currency: ${sym}

Generate realistic Q&A pairs that REAL customers would ask on WhatsApp. Cover:
1. Product/ingredient questions (4-5)
2. Ordering process questions (3-4)
3. Pricing/quantity/bulk questions (2-3)
4. Delivery/pickup/shipping questions (2-3)
5. Quality/freshness/shelf life (2-3)
6. Customization/special requests (2-3)

RULES:
- Answers should be helpful, warm, and concise (1-3 sentences max)
- Use ${sym} for prices where relevant
- If you don't know specifics (like exact ingredients), give a generic but helpful answer like "All our items are freshly homemade with quality ingredients. For specific ingredients of any item, just ask!"
- Don't make up specific prices — use "Please check our menu for current prices" if needed
- Include the business name naturally where it fits

Return JSON array: [{"question": "...", "answer": "..."}, ...]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You generate realistic FAQ entries for small businesses. Return only a JSON array.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: 'AI generation failed', details: err }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const parsed = JSON.parse(content);
    const faqs: { question: string; answer: string }[] = parsed.faqs || parsed.questions || parsed;

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return NextResponse.json({ error: 'No FAQs generated', raw: content }, { status: 500 });
    }

    // Delete existing knowledge base for this seller (fresh generation)
    await supabase.from('knowledge_base').delete().eq('seller_id', sellerId);

    // Insert new entries
    const inserts = faqs.map(faq => ({
      seller_id: sellerId,
      question: faq.question,
      answer: faq.answer,
      source: 'ai_onboarding',
      created_at: new Date().toISOString(),
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('knowledge_base')
      .insert(inserts)
      .select('id');

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: inserted?.length || 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
