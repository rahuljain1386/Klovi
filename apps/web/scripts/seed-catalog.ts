/**
 * Seed catalog_categories and catalog_products tables from static product-catalog.ts
 * Run: npx tsx scripts/seed-catalog.ts
 */
import { CATALOG_CATEGORIES, CATALOG_PRODUCTS } from '../data/product-catalog';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://potxkjsflrnnengwougl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates',
};

async function seedCategories() {
  const rows = CATALOG_CATEGORIES.map((c, i) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    enabled: true,
    sort_order: i,
  }));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_categories`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    console.error('Failed to seed categories:', await res.text());
  } else {
    console.log(`Seeded ${rows.length} categories`);
  }
}

async function seedProducts() {
  const rows = CATALOG_PRODUCTS.map((p, i) => ({
    name: p.name,
    category: p.category,
    parent_category: p.parentCategory,
    title: p.title,
    description: p.description,
    highlights: p.highlights,
    variants: p.variants,
    quantity: p.quantity,
    price_min: p.priceMin,
    price_max: p.priceMax,
    dietary: p.dietary,
    pexels_query: p.pexelsQuery || null,
    image_url: null,
    enabled: true,
    sort_order: i,
  }));

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/catalog_products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      console.error(`Failed to seed products batch ${i}:`, await res.text());
    } else {
      console.log(`Seeded products ${i + 1}–${i + batch.length}`);
    }
  }
}

async function main() {
  console.log('Seeding catalog to:', SUPABASE_URL);
  await seedCategories();
  await seedProducts();
  console.log('Done!');
}

main();
