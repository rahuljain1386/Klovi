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

  // Deep category-specific FAQ prompts — cover EVERY real customer question A-to-Z
  const categoryContext: Record<string, string> = {
    food: `This is a HOME FOOD business. You MUST cover ALL of these customer concerns:

INGREDIENTS & DIETARY:
- What ingredients/oil do you use? (mustard oil, refined, groundnut, ghee, coconut oil — be specific per product type)
- Do you use preservatives? (homemade = NO preservatives, freshly made)
- Veg or non-veg? Any non-veg items?
- Do you have Jain-friendly options? (no onion, no garlic)
- Gluten-free options available?
- Sugar-free / jaggery-based alternatives?
- Nut-free options for allergies?
- What's the spice level — can I customize (mild/medium/hot)?
- Can you adjust salt/sugar/spice as per my preference?
- Do you use MSG or artificial flavors?
- Is it suitable for kids / elderly?

ORDERING & QUANTITY:
- Is there a minimum order? (answer: no minimum, order even 1 piece)
- How do I place an order? (just message here on WhatsApp)
- How much advance notice do you need?
- Available sizes/pack sizes for each item
- Can I order a mix of different items?
- Do you take bulk orders for parties/events (50-100+ pieces)?
- Advance booking for festivals (Diwali, Holi, Rakhi, weddings)?
- Can I get a sample/trial order first?

DELIVERY & FULFILLMENT:
- What is your delivery area?
- Do you deliver to my area?
- Delivery charges?
- Can I pick up from your location?
- Do you ship outside the city / PAN India?
- What time do you deliver?
- Packaging — is it leak-proof / secure?

QUALITY & FRESHNESS:
- Shelf life of each product?
- How should I store it?
- Is it freshly made or pre-made?
- When was this batch made?
- Do you have a freshness guarantee?

CUSTOMIZATION & SPECIAL:
- Can you make custom items not on the menu?
- Gift packing available?
- Corporate / bulk gifting for festivals?
- Combo offers or discounts for large orders?
- Do you cater for parties/events?
- Festive special items (seasonal menus)?`,

    snacks: `This is a HOMEMADE SNACKS business. You MUST cover ALL of these customer concerns:

INGREDIENTS & DIETARY:
- Which oil do you use — groundnut / mustard / refined / ghee?
- Any preservatives? (homemade = zero preservatives)
- Are all items vegetarian? Jain-friendly?
- Gluten-free snacks available?
- Sugar-free / diet-friendly options?
- What's the spice level? Can I get less spicy?
- Nut-free options (for allergies)?
- Do you use palm oil or vanaspati?
- Are ingredients sourced locally/organic?

SHELF LIFE & STORAGE:
- How long do snacks last? (typically 15-30 days for dry snacks, less for moist)
- How should I store them? (airtight container, room temperature)
- Do they come in sealed packaging?
- Will taste change after 2 weeks?
- Best consumed within how many days?

ORDERING & QUANTITY:
- Minimum order quantity?
- Available sizes — 250gm, 500gm, 1kg?
- Can I mix different snacks in one order?
- Bulk orders for events, gifting, weddings?
- How much advance notice for large orders (50+ packets)?
- Can I get a small trial pack first?
- Weekly/monthly subscription available?

DELIVERY & SHIPPING:
- Delivery area and charges?
- Do you ship PAN India / outside city?
- Will snacks survive shipping without breaking?
- Packaging for shipping — is it crush-proof?
- Cash on delivery available?

GIFTING & SPECIAL:
- Gift boxes / hamper packaging?
- Corporate gifting options?
- Festival special items (Diwali namkeen, etc.)?
- Custom assortment boxes?
- Can you add a personalized note?`,

    bakery: `This is a HOME BAKERY. You MUST cover ALL of these customer concerns:

BASICS:
- Do you make eggless cakes? (MOST home bakers in India do both)
- Egg vs eggless — is there a taste difference?
- What flavors are available?
- Fondant or cream finish?
- Buttercream or whipped cream?

CAKES & CUSTOM:
- Can you make a custom design / photo cake / theme cake?
- Minimum cake size? (usually 0.5kg or 1kg)
- Tiered cakes for weddings — do you make them?
- How many people does a 1kg cake serve? (8-10 usually)
- Can you write a message on the cake?
- Can I send a reference photo for the design?
- Sugar-free / diabetic-friendly cake?

ORDERING:
- How much advance notice? (usually 2-3 days, 1 week for elaborate designs)
- Minimum order for cupcakes? (usually 6-12)
- Can I order just 1-2 cupcakes?
- Midnight delivery available?
- Same-day order possible?
- How do I place an order?

PRICING & QUANTITY:
- Starting price for a 1kg cake?
- Extra charge for fondant / photo cake / tiers?
- Cupcake price per piece vs box?
- Bulk discount for 50+ pieces?

DELIVERY:
- Do you deliver? What areas?
- How is the cake packaged for delivery?
- Will the cake survive in hot weather?
- Can I pick up instead?

OTHER:
- Do you make brownies, cookies, pastries too?
- Gift wrapping / cake boxes included?
- Can I do a tasting before ordering?
- Allergens — nut-free options?
- Return/refund if cake is damaged?`,

    pickle: `This is a HOMEMADE PICKLE/PRESERVES business. You MUST cover ALL of these:

INGREDIENTS & QUALITY:
- Which oil — mustard oil, sesame oil, groundnut oil?
- Any preservatives? (homemade = NO preservatives, just traditional methods)
- Is it organic?
- How is it different from store-bought?
- Rock salt or regular salt?
- Spice level — mild, medium, or hot?
- Can you make it less spicy?
- Do you use vinegar or only traditional preservation?
- Is it sun-dried traditionally?

SHELF LIFE & STORAGE:
- How long does it last? (6-12 months for oil-based, less for curd-based)
- Storage — fridge or room temperature?
- Glass jar or plastic container?
- Will it get spoiled in summer heat?
- Can I keep it after opening for how long?

ORDERING & SIZES:
- Available sizes — 250gm, 500gm, 1kg, 5kg?
- Minimum order?
- Can I order a sampler pack with different varieties?
- Combo offers?
- Bulk order for weddings / functions?

SHIPPING:
- Do pickles ship well?
- Leak-proof packaging?
- PAN India shipping?
- Will oil leak during transit?
- Shipping charges?

VARIETIES & CUSTOM:
- What varieties do you have? (mango, lemon, mixed, chili, garlic, etc.)
- Seasonal items? (raw mango season, green chili season)
- Can you make sugar-free / low-salt version?
- Gift hampers for festivals?
- Corporate gifting?`,

    coaching: `This is a COACHING/TUTORING/TRAINING business. You MUST cover ALL of these:

CLASSES & SCHEDULE:
- What are the batch timings? Morning / evening / weekend?
- Online or offline classes?
- How long is each session?
- How many classes per week?
- Batch size — how many students?
- One-on-one or group?

TEACHER & QUALITY:
- What are the teacher's qualifications?
- Years of experience?
- Success rate / results of previous students?
- Do you guarantee results?
- Any trial / demo class available?

CURRICULUM:
- What syllabus do you cover?
- Which boards — CBSE / ICSE / State?
- Which exams do you prepare for?
- Study material provided?
- Practice tests included?
- Doubt-clearing sessions?

FEES & PAYMENT:
- Monthly fees / per-class charges?
- Any registration fee?
- Installment payment option?
- Sibling discount / group discount?
- Refund policy if I want to stop?

AGE GROUPS & LEVELS:
- What age groups do you teach?
- Beginner to advanced — all levels?
- Separate batches for different age groups?
- Is it suitable for adults / working professionals?
- Gender-specific batches?

PROGRESS & SUPPORT:
- How do you track student progress?
- Regular parent updates?
- Can I attend a class with my child?
- Makeup classes if a student is absent?
- Extra help for weak students?
- Homework / assignments given?

FOR FITNESS/YOGA COACHING specifically:
- Do you include a diet plan?
- Weight loss guarantee / timeline?
- What equipment is needed?
- Safe for people with injuries / medical conditions?
- Can pregnant women join?
- Do you do body assessment first?
- Home visits available?
- Corporate wellness programs?`,

    spiritual_healing: `This is a SPIRITUAL HEALING/WELLNESS business. You MUST cover ALL of these:

SESSIONS & TYPES:
- What types of sessions do you offer? (Reiki, crystal healing, tarot, numerology, past life regression, chakra balancing, pranic healing, etc.)
- Online sessions or in-person only?
- Session duration?
- How often should I come?
- Can I combine multiple healing modalities?

FIRST TIME:
- What should I expect in my first session?
- Do I need to prepare anything?
- What should I wear?
- Is there a free consultation?
- How do I know which type of healing is right for me?
- Will I feel something during the session?

QUALIFICATIONS & TRUST:
- What are your certifications / training?
- How many years of experience?
- Is this scientifically proven?
- Can this replace medical treatment? (always answer: complementary, not replacement)
- How is this different from therapy?
- Is everything confidential?

PRICING:
- Cost per session?
- Package deals for multiple sessions?
- Group session rates?
- Corporate wellness packages?
- Do you offer sliding scale / student discounts?

RESULTS & FOLLOW-UP:
- How many sessions will I need?
- When will I see results?
- What if I don't feel anything?
- Can it help with anxiety / depression / stress?
- Can it help with physical pain?
- Follow-up support between sessions?
- Emergency sessions available?

PRACTICAL:
- Do you do distance / remote healing?
- Timings and availability?
- Can I gift a session to someone?
- Group / couple sessions?
- Workshops / courses to learn healing?`,

    healing: `This is a SPIRITUAL HEALING/WELLNESS business. Cover: types of sessions (reiki/crystal/tarot/numerology/chakra/pranic healing), online vs in-person, session duration, first-time expectations, free consultation, what to wear/prepare, package deals, how many sessions needed, when to expect results, qualifications/certifications, confidentiality, can it help with anxiety/depression/physical pain, complementary to medical treatment (not replacement), distance healing available, group sessions, corporate wellness, workshops, pricing, gift sessions, follow-up support.`,

    beauty: `This is a HOME BEAUTY/SALON business. You MUST cover ALL of these:

SERVICES:
- Full services list?
- Do you offer home visits / doorstep service?
- What brands/products do you use?
- Do you use organic / herbal products?
- Bridal packages available?
- Party / group makeup?
- Pre-bridal packages (how many sessions)?

SKIN & SAFETY:
- Do you do a patch test first?
- Products for sensitive skin?
- Any chemical-free options?
- Clean / sanitized tools guaranteed?

BOOKING:
- How to book an appointment?
- Advance booking needed?
- Cancellation / reschedule policy?
- Timings — early morning / late evening available?
- Home visit charges?

PRICING:
- Price list for common services?
- Package deals?
- Group booking discount?
- Bridal package cost?
- Men's services available?

OTHER:
- Do you serve at the client's home?
- Separate room / privacy?
- Can I see before/after photos?
- Makeup trial before wedding?`,

    jewelry: `This is a HANDMADE JEWELRY business. Cover: materials (gold/silver/artificial/semi-precious), customization options, engraving, size guide / adjustment, return/exchange policy, gift wrapping, bulk orders for weddings/events, delivery and shipping (fragile packaging), care instructions, warranty/guarantee, hallmark certification, allergic-safe metals (nickel-free), repair services, matching sets, bridal jewelry packages, corporate gifting, personalization (name/initials), gold/silver purity details, stone authenticity, cleaning tips, insurance for expensive pieces.`,

    stitching: `This is a STITCHING/TAILORING business. Cover: measurement process (home visit or come to shop), can I bring my own fabric, delivery time (standard vs rush), alteration charges, fitting sessions included, rush/urgent orders surcharge, bulk orders for weddings/uniforms, design consultation, price range by garment type, latest design catalog/reference photos, cancellation policy, embroidery/hand-work charges, blouse stitching included with saree, kids clothing, men's clothing, western wear alterations, lining charges, button/zip replacement.`,

    crafts: `This is a HANDMADE CRAFTS business. Cover: materials used (eco-friendly/sustainable), customization and personalization, lead time per item, bulk orders for events/corporate, gift wrapping, shipping (fragile packaging, bubble wrap), return/exchange policy, care instructions, personalization options (names/dates/messages), wedding favors, corporate gifts, workshop/class availability, made-to-order vs ready stock, color/size variations, international shipping, wholesale pricing, raw materials sourced from where.`,

    fitness: `This is a FITNESS business. You MUST cover ALL of these:

CLASSES:
- Batch timings? Morning / evening / weekend?
- Online or offline?
- Trial / demo class available?
- Group or personal training?
- Session duration?
- Equipment needed?

PROGRAMS:
- Weight loss program?
- Muscle building?
- Yoga / meditation?
- Zumba / dance fitness?
- Post-pregnancy fitness?
- Senior citizen programs?
- Kids fitness?

HEALTH & SAFETY:
- Safe for people with injuries / back pain / knee issues?
- Medical conditions — diabetes, BP, thyroid?
- Do you assess fitness level first?
- Diet plan included?
- Nutrition guidance?
- Body composition analysis?

FEES & COMMITMENT:
- Monthly / quarterly / yearly plans?
- Personal training rates?
- Group discount?
- Family package?
- Refund if I quit?
- Freeze membership option?

RESULTS:
- Weight loss guarantee / realistic timeline?
- Before/after results of clients?
- How often should I train?
- How soon will I see results?
- Do you track progress?

PRACTICAL:
- Home training available?
- What to wear / bring?
- Parking available?
- Shower facilities?
- Corporate wellness programs?
- Instructor gender preference?`,
  };

  const industryHints = categoryContext[category] || categoryContext['food'] || '';

  const prompt = `Generate 20-25 comprehensive FAQ entries for "${seller.business_name}", a ${seller.category} business in ${seller.city}.

${industryHints}

Their products/services:
${productList || 'Not specified yet'}

Fulfillment: ${fulfillment.join(', ')}
Currency: ${sym}

Generate realistic Q&A pairs that REAL customers would ask on WhatsApp. These should cover the FULL RANGE of customer concerns — not just basics.

MANDATORY COVERAGE (generate at least 2-3 for each):
1. Ingredients / materials / what goes into each product (5-6 questions)
2. Dietary / health / allergy concerns (3-4)
3. Ordering process — how to order, minimum qty, advance notice (3-4)
4. Pricing / sizes / bulk orders / packages (3-4)
5. Delivery / pickup / shipping / areas covered (2-3)
6. Quality / freshness / shelf life / storage (2-3)
7. Customization / special requests / personalization (2-3)
8. Festival / event / gifting / corporate orders (2-3)

RULES:
- Answers should be helpful, warm, and concise (1-3 sentences max)
- Sound like a real small business owner replying on WhatsApp, not corporate
- Use ${sym} for prices where relevant
- For specific details you don't know (exact ingredients per product), give helpful generic answers like "All our items are freshly homemade with quality ingredients. For specific ingredients of any item, just ask!"
- Don't make up specific prices — use "Please check our menu for current prices" if needed
- Include the business name naturally where it fits
- Cover both the OBVIOUS questions AND the non-obvious ones real customers ask
- Include questions in the casual way customers actually ask on WhatsApp (e.g., "do u deliver to my area?" not "What are your delivery zones?")

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
      .select('id, question, answer');

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Return the generated FAQs so onboarding UI can show them for editing
    return NextResponse.json({
      success: true,
      count: inserted?.length || 0,
      entries: (inserted || []).map(e => ({ id: e.id, question: e.question, answer: e.answer })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
