-- Leads — what customers want to buy (one per order attempt)
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  customer_id UUID REFERENCES customers(id),
  seller_id UUID REFERENCES sellers(id),
  product_name TEXT,
  variant TEXT,
  quantity INT DEFAULT 1,
  price NUMERIC,
  status TEXT DEFAULT 'new',
  -- new → confirmed → forwarded → completed → cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_seller_id ON leads(seller_id);
CREATE INDEX idx_leads_conversation_id ON leads(conversation_id);
CREATE INDEX idx_leads_status ON leads(status);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_seller" ON leads FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Service role can read all (for admin dashboard)
CREATE POLICY "leads_service_read" ON leads FOR SELECT USING (true);
