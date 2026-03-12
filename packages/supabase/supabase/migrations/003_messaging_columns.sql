-- Add missing columns to messages table for handle-message compatibility
ALTER TABLE messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS role TEXT; -- 'customer', 'assistant', 'seller'
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_type TEXT; -- 'customer', 'ai', 'seller'
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS intent TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS confidence NUMERIC;

-- Add missing columns to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message TEXT;

-- Public read policy for conversations (seller's own)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_own_read') THEN
    CREATE POLICY messages_own_read ON messages FOR SELECT USING (
      seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_own_insert') THEN
    CREATE POLICY messages_own_insert ON messages FOR INSERT WITH CHECK (
      seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
    );
  END IF;
END $$;
