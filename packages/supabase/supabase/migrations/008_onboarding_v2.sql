-- Onboarding v2: new seller fields for redesigned flow
-- Owner info
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS gender TEXT;

-- Niche (5 launch niches: snacks, bakery, coaching, spiritual_healing, other)
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS niche TEXT;

-- Structured address (Google Places)
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_zip TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_country_code TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_lat NUMERIC;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_lng NUMERIC;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Delivery type
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'pickup_only';

-- AI-generated content
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS ai_tagline TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS launch_offer TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS ai_product_descriptions JSONB;

-- Onboarding tracking
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
