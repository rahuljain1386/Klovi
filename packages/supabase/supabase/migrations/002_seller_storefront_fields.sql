-- Add storefront-related fields to sellers table
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS tagline TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS about_text TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS facebook_handle TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS launch_card_bg_url TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS allows_custom_orders BOOLEAN DEFAULT FALSE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS offers_gift_wrap BOOLEAN DEFAULT FALSE;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Public read policy so storefront page can load without auth
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sellers' AND policyname = 'sellers_public_read') THEN
    CREATE POLICY sellers_public_read ON sellers FOR SELECT USING (status = 'active');
  END IF;
END $$;
