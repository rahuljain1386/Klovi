import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CATALOG_PRODUCTS } from '@/data/product-catalog';

/**
 * POST /api/admin/sync-catalog-ingredients
 * Syncs ingredients from static CATALOG_PRODUCTS to the catalog_products DB table.
 * Only updates products where DB ingredients is null/empty.
 */
export async function POST() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceRoleClient();

  // Get all catalog products from DB
  const { data: dbProducts, error: fetchErr } = await supabase
    .from('catalog_products')
    .select('id, name, ingredients');

  if (fetchErr) {
    // If ingredients column doesn't exist, try to add it
    if (fetchErr.message?.includes('ingredients')) {
      return NextResponse.json({
        error: 'The ingredients column does not exist in catalog_products. Run this SQL first:\nALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS ingredients text;',
      }, { status: 400 });
    }
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!dbProducts?.length) {
    return NextResponse.json({ error: 'No catalog products found in DB' }, { status: 404 });
  }

  // Build a map of static products by name for fast lookup
  const staticMap = new Map(CATALOG_PRODUCTS.map(p => [p.name.toLowerCase(), p]));

  let updated = 0;
  let skipped = 0;
  const results: { name: string; status: string }[] = [];

  for (const dbProd of dbProducts) {
    // Skip if already has ingredients
    if (dbProd.ingredients && dbProd.ingredients.trim()) {
      skipped++;
      continue;
    }

    const staticProd = staticMap.get(dbProd.name.toLowerCase());
    if (staticProd?.ingredients) {
      const { error: updateErr } = await supabase
        .from('catalog_products')
        .update({ ingredients: staticProd.ingredients })
        .eq('id', dbProd.id);

      if (!updateErr) {
        updated++;
        results.push({ name: dbProd.name, status: 'updated' });
      } else {
        results.push({ name: dbProd.name, status: `error: ${updateErr.message}` });
      }
    }
  }

  return NextResponse.json({
    success: true,
    total: dbProducts.length,
    updated,
    skipped,
    noMatch: dbProducts.length - updated - skipped,
    results: results.slice(0, 20),
  });
}
