-- Catalog categories — founder-managed, controls what sellers see during onboarding
CREATE TABLE catalog_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT DEFAULT '',
  color TEXT DEFAULT 'CCCCCC',
  enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catalog products — founder-managed template products
CREATE TABLE catalog_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  parent_category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  highlights TEXT,
  variants TEXT[] DEFAULT ARRAY[]::TEXT[],
  quantity TEXT,
  price_min NUMERIC DEFAULT 0,
  price_max NUMERIC DEFAULT 0,
  dietary TEXT[] DEFAULT ARRAY[]::TEXT[],
  pexels_query TEXT,
  image_url TEXT,
  enabled BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_catalog_products_parent_category ON catalog_products(parent_category);

-- RLS — public read, service_role write
ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_categories_read" ON catalog_categories FOR SELECT USING (true);
CREATE POLICY "catalog_products_read" ON catalog_products FOR SELECT USING (true);
