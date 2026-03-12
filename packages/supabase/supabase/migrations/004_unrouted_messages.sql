-- Unrouted messages — messages that couldn't be matched to a seller
CREATE TABLE IF NOT EXISTS unrouted_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  message_text TEXT,
  reason TEXT, -- 'no_match', 'ambiguous_match'
  candidate_sellers JSONB, -- [{id, name}] for ambiguous matches
  channel TEXT DEFAULT 'whatsapp',
  assigned_seller_id UUID REFERENCES sellers(id),
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unrouted_resolved ON unrouted_messages(resolved);

-- Enable realtime on messages table for instant inbox updates
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
