-- Already applied manually — sellers_public_read policy exists
-- This is a no-op migration for tracking purposes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'sellers_public_read' AND tablename = 'sellers'
  ) THEN
    CREATE POLICY "sellers_public_read" ON sellers FOR SELECT USING (status IN ('active', 'onboarding'));
  END IF;
END $$;
