import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Temporary debug endpoint — tests each step of the bot pipeline
export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check env vars
  results.env = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GUPSHUP_API_KEY: !!process.env.GUPSHUP_API_KEY,
    GUPSHUP_WHATSAPP_NUMBER: process.env.GUPSHUP_WHATSAPP_NUMBER || 'NOT SET',
    NEXT_PUBLIC_KLOVI_WA_NUMBER: process.env.NEXT_PUBLIC_KLOVI_WA_NUMBER || 'NOT SET',
    supabase_url_value: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'NONE').substring(0, 40),
  };

  // 2. Test Supabase connection — list ALL sellers
  try {
    const supabase = createServiceRoleClient();
    const { data: sellers, error } = await supabase
      .from('sellers')
      .select('id, business_name, slug, status, phone, whatsapp_number')
      .limit(10);

    results.sellers = error ? { error: error.message } : sellers?.map(s => ({
      id: s.id,
      name: s.business_name,
      slug: s.slug,
      status: s.status,
      phone: s.phone || 'NOT SET',
      wa: s.whatsapp_number || 'NOT SET',
    }));

    // 3. Count products for EACH seller
    if (sellers && sellers.length > 0) {
      const productResults: Record<string, unknown> = {};
      for (const s of sellers) {
        const { data: products, error: pErr } = await supabase
          .from('products')
          .select('id, name, status, price')
          .eq('seller_id', s.id);
        productResults[s.slug] = pErr
          ? { error: pErr.message }
          : { count: products?.length, items: products?.map(p => ({ name: p.name, status: p.status, price: p.price })) };
      }
      results.products = productResults;
    }
  } catch (e: any) {
    results.supabase_error = e.message;
  }

  // 4. Test Supabase Edge Function connectivity
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.functions.invoke('handle-message', {
      body: {
        channel: 'whatsapp',
        from: '919999999999',
        to: '918854054503',
        body: 'test ping',
        seller_id: '00000000-0000-0000-0000-000000000000', // fake ID, will fail gracefully
        provider: 'gupshup',
      },
    });
    results.edge_function = error ? { error: error.message } : { status: 'reachable', response: data };
  } catch (e: any) {
    results.edge_function = { error: e.message };
  }

  // 5. Test Gupshup API connectivity (just a ping, no actual message)
  try {
    const res = await fetch('https://api.gupshup.io/wa/health/check', {
      headers: { 'apikey': process.env.GUPSHUP_API_KEY || '' },
    });
    results.gupshup = { status: res.status, ok: res.ok };
  } catch (e: any) {
    results.gupshup = { error: e.message };
  }

  return NextResponse.json(results);
}
