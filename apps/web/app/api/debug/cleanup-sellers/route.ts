import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Temporary endpoint to clean up duplicate seller records.
// Keeps the seller with the most products for each user_id, deletes the rest.
export async function GET() {
  const supabase = createServiceRoleClient();
  const results: Record<string, unknown> = {};

  // 1. Get all sellers grouped by user_id
  const { data: allSellers, error } = await supabase
    .from('sellers')
    .select('id, user_id, slug, business_name, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by user_id
  const byUser: Record<string, typeof allSellers> = {};
  for (const s of allSellers || []) {
    if (!s.user_id) continue;
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push(s);
  }

  const toDelete: string[] = [];

  for (const [userId, sellers] of Object.entries(byUser)) {
    if (sellers.length <= 1) continue;

    // Find which seller has products
    let keepId: string | null = null;
    let keepSlug = '';
    let maxProducts = 0;

    for (const s of sellers) {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', s.id);

      if ((count || 0) > maxProducts) {
        maxProducts = count || 0;
        keepId = s.id;
        keepSlug = s.slug;
      }
    }

    // If none have products, keep the oldest
    if (!keepId) {
      keepId = sellers[0].id;
      keepSlug = sellers[0].slug;
    }

    const duplicates = sellers.filter(s => s.id !== keepId);
    results[userId] = {
      keeping: { id: keepId, slug: keepSlug, products: maxProducts },
      deleting: duplicates.map(s => ({ id: s.id, slug: s.slug })),
    };

    toDelete.push(...duplicates.map(s => s.id));
  }

  // Delete duplicates
  if (toDelete.length > 0) {
    const { error: delError } = await supabase
      .from('sellers')
      .delete()
      .in('id', toDelete);

    if (delError) {
      results.deleteError = delError.message;
    } else {
      results.deleted = toDelete.length;
    }
  } else {
    results.message = 'No duplicates found';
  }

  return NextResponse.json(results);
}
