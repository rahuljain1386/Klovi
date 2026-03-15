import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Debug endpoint: Simulates a customer WhatsApp message and shows what would happen.
 * Usage: GET /api/debug/webhook-test?slug=omni&msg=Hi+I+want+to+order
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'omni';
  const msg = searchParams.get('msg') || `Hi! I'd like to order from this shop.\nMenu: kloviapp.com/${slug}`;

  const results: Record<string, unknown> = {
    step1_input: { slug, msg },
  };

  // Step 1: Check slug extraction
  const urlMatch = msg.match(/kloviapp\.com\/([a-z0-9-]+)/i);
  const legacyMatch = msg.match(/klovi\/([a-z0-9-]+)/i);
  const extractedSlug = urlMatch?.[1]?.toLowerCase() || legacyMatch?.[1]?.toLowerCase() || null;
  results.step2_slug_extraction = { extractedSlug, urlMatch: !!urlMatch, legacyMatch: !!legacyMatch };

  // Step 2: Find seller
  const supabase = createServiceRoleClient();
  const { data: seller, error: sellerErr } = await supabase
    .from('sellers')
    .select('id, business_name, phone, whatsapp_number, status, slug')
    .eq('slug', slug)
    .single();

  results.step3_seller_lookup = seller ? {
    id: seller.id,
    business_name: seller.business_name,
    status: seller.status,
    phone: seller.phone,
    whatsapp_number: seller.whatsapp_number,
  } : { error: sellerErr?.message || 'Not found' };

  // Step 3: Check products
  if (seller) {
    const { data: products, count } = await supabase
      .from('products')
      .select('id, name, price', { count: 'exact' })
      .eq('seller_id', seller.id)
      .eq('status', 'active')
      .limit(5);
    results.step4_products = { count, sample: products?.map(p => `${p.name} (${p.price})`) };
  }

  // Step 4: Check env vars
  results.step5_env_vars = {
    GUPSHUP_API_KEY: process.env.GUPSHUP_API_KEY ? 'SET' : 'MISSING',
    GUPSHUP_WHATSAPP_NUMBER: process.env.GUPSHUP_WHATSAPP_NUMBER || 'MISSING',
    GUPSHUP_APP_NAME: process.env.GUPSHUP_APP_NAME || 'MISSING',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY ? 'SET' : 'MISSING',
  };

  // Step 5: Try calling handle-message edge function (dry run check)
  if (seller) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('handle-message', {
        body: {
          channel: 'whatsapp',
          from: '919999999999',
          to: process.env.GUPSHUP_WHATSAPP_NUMBER || '918854054503',
          body: msg,
          media_url: null,
          message_id: 'debug-test-' + Date.now(),
          seller_id: seller.id,
          provider: 'gupshup',
          raw: { debug: true },
        },
      });
      results.step6_edge_function = fnError
        ? { error: fnError.message, context: fnError.context }
        : { success: true, data: fnData };
    } catch (e: any) {
      results.step6_edge_function = { error: e.message };
    }
  }

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
