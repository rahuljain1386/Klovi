-- Klovi Database Schema v1.0
-- Complete schema for home business SaaS platform

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- SELLERS
-- ============================================
CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'food',
  city TEXT NOT NULL,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'india',
  language TEXT NOT NULL DEFAULT 'en',
  phone TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'onboarding',
  fulfillment_modes TEXT[] DEFAULT ARRAY['pickup'],
  pickup_address TEXT,
  delivery_radius_km NUMERIC,
  delivery_fee NUMERIC DEFAULT 0,
  whatsapp_path TEXT DEFAULT 'shared',
  whatsapp_number TEXT,
  whatsapp_connected BOOLEAN DEFAULT FALSE,
  instagram_connected BOOLEAN DEFAULT FALSE,
  facebook_connected BOOLEAN DEFAULT FALSE,
  stripe_account_id TEXT,
  razorpay_account_id TEXT,
  upi_id TEXT,
  avatar_url TEXT,
  cover_photo_url TEXT,
  story_text TEXT,
  video_url TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  photo_verified BOOLEAN DEFAULT FALSE,
  orders_milestone INT DEFAULT 0,
  average_rating NUMERIC DEFAULT 0,
  is_active_seller BOOLEAN DEFAULT FALSE,
  member_since TIMESTAMPTZ DEFAULT NOW(),
  max_orders_per_day INT,
  max_orders_per_week INT,
  deposit_percentage INT DEFAULT 50,
  cod_enabled BOOLEAN DEFAULT FALSE,
  auto_reply_enabled BOOLEAN DEFAULT TRUE,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  total_orders INT DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  on_time_percentage NUMERIC DEFAULT 100,
  expo_push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_country CHECK (country IN ('usa', 'india', 'canada')),
  CONSTRAINT valid_language CHECK (language IN ('en', 'hi', 'es')),
  CONSTRAINT valid_status CHECK (status IN ('aspiring', 'onboarding', 'active', 'paused', 'suspended')),
  CONSTRAINT valid_plan CHECK (plan IN ('free', 'growth', 'pro')),
  CONSTRAINT valid_whatsapp_path CHECK (whatsapp_path IN ('shared', 'virtual_dedicated', 'own_number'))
);

CREATE INDEX idx_sellers_user_id ON sellers(user_id);
CREATE INDEX idx_sellers_slug ON sellers(slug);
CREATE INDEX idx_sellers_city_country ON sellers(city, country);
CREATE INDEX idx_sellers_category ON sellers(category);
CREATE INDEX idx_sellers_status ON sellers(status);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  category TEXT,
  variants JSONB,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  enhanced_images TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  stock_quantity INT,
  lead_time_hours INT,
  available_days TEXT[],
  seasonal BOOLEAN DEFAULT FALSE,
  seasonal_start DATE,
  seasonal_end DATE,
  min_order_quantity INT DEFAULT 1,
  max_order_quantity INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_product_status CHECK (status IN ('active', 'sold_out', 'hidden', 'deleted'))
);

CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  whatsapp_id TEXT,
  instagram_id TEXT,
  facebook_id TEXT,
  segment TEXT NOT NULL DEFAULT 'new',
  total_orders INT DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  average_order_value NUMERIC DEFAULT 0,
  preferred_channel TEXT DEFAULT 'whatsapp',
  language TEXT DEFAULT 'en',
  city TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_customer_per_seller_phone UNIQUE (seller_id, phone)
);

CREATE INDEX idx_customers_seller_id ON customers(seller_id);
CREATE INDEX idx_customers_segment ON customers(segment);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  delivery_fee NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  deposit_amount NUMERIC DEFAULT 0,
  balance_amount NUMERIC DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  razorpay_order_id TEXT,
  is_cod BOOLEAN DEFAULT FALSE,
  fulfillment_type TEXT NOT NULL DEFAULT 'pickup',
  pickup_date DATE,
  pickup_time_slot TEXT,
  delivery_address TEXT,
  delivery_tracking_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_deposit',
  special_notes TEXT,
  source_channel TEXT DEFAULT 'web',
  conversation_id UUID,
  confirmed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_order_status CHECK (status IN (
    'pending_deposit', 'deposit_paid', 'confirmed', 'preparing',
    'ready', 'balance_paid', 'picked_up', 'delivered', 'completed',
    'cancelled', 'refunded'
  )),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'failed'))
);

CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_pickup_date ON orders(pickup_date);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================
-- CONVERSATIONS
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  ai_can_handle BOOLEAN DEFAULT TRUE,
  needs_seller_attention BOOLEAN DEFAULT FALSE,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_needs_attention ON conversations(needs_seller_attention) WHERE needs_seller_attention = TRUE;

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  external_message_id TEXT,
  ai_confidence NUMERIC,
  ai_intent TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  is_recovered BOOLEAN DEFAULT FALSE,
  recovery_offer TEXT,
  original_rating INT,
  ai_sentiment TEXT,
  ai_category TEXT,
  ai_summary TEXT,
  seller_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_seller_id ON reviews(seller_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'daily',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_seller_id ON notifications(seller_id);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- INTEREST PAGES (Phase 0)
-- ============================================
CREATE TABLE interest_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT,
  city TEXT NOT NULL,
  demand_level TEXT,
  suggested_price NUMERIC,
  competitor_analysis TEXT,
  ai_insights TEXT,
  signup_count INT DEFAULT 0,
  threshold INT DEFAULT 10,
  threshold_reached BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  pivot_suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interest_pages_seller_id ON interest_pages(seller_id);
CREATE INDEX idx_interest_pages_slug ON interest_pages(slug);

-- ============================================
-- INTEREST SIGNUPS
-- ============================================
CREATE TABLE interest_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interest_page_id UUID NOT NULL REFERENCES interest_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interest_signups_page_id ON interest_signups(interest_page_id);

-- ============================================
-- BROADCASTS
-- ============================================
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  media_url TEXT,
  segments TEXT[] DEFAULT ARRAY['all'],
  channels TEXT[] DEFAULT ARRAY['whatsapp'],
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INT DEFAULT 0,
  delivered INT DEFAULT 0,
  read_count INT DEFAULT 0,
  replies INT DEFAULT 0,
  orders_generated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_seller_id ON broadcasts(seller_id);

-- ============================================
-- POSTS
-- ============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'feed',
  caption TEXT NOT NULL,
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  enhanced_image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  rendered_image_url TEXT,
  instagram_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ai_generated_caption BOOLEAN DEFAULT FALSE,
  ai_suggested BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_seller_id ON posts(seller_id);

-- ============================================
-- AI COACH SUGGESTIONS
-- ============================================
CREATE TABLE coach_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_label TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  reasoning TEXT,
  potential_revenue NUMERIC,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coach_suggestions_seller_id ON coach_suggestions(seller_id);
CREATE INDEX idx_coach_suggestions_status ON coach_suggestions(status) WHERE status = 'pending';

-- ============================================
-- KNOWLEDGE BASE (AI Learning Loop)
-- ============================================
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source TEXT DEFAULT 'seller',
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_base_seller_id ON knowledge_base(seller_id);

-- ============================================
-- JOURNEY TASKS (Automated Customer Journey)
-- ============================================
CREATE TABLE journey_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  message_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journey_tasks_scheduled ON journey_tasks(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_journey_tasks_seller_id ON journey_tasks(seller_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_tasks ENABLE ROW LEVEL SECURITY;

-- Sellers
CREATE POLICY "sellers_own" ON sellers FOR ALL USING (auth.uid() = user_id);

-- Products
CREATE POLICY "products_seller" ON products FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);
CREATE POLICY "products_public_read" ON products FOR SELECT USING (status = 'active');

-- Customers
CREATE POLICY "customers_seller" ON customers FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Orders
CREATE POLICY "orders_seller" ON orders FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Conversations
CREATE POLICY "conversations_seller" ON conversations FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Messages
CREATE POLICY "messages_seller" ON messages FOR ALL USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE seller_id IN (
      SELECT id FROM sellers WHERE user_id = auth.uid()
    )
  )
);

-- Reviews
CREATE POLICY "reviews_seller" ON reviews FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (status = 'published');

-- Notifications
CREATE POLICY "notifications_seller" ON notifications FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Interest pages
CREATE POLICY "interest_pages_seller" ON interest_pages FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);
CREATE POLICY "interest_pages_public_read" ON interest_pages FOR SELECT USING (status = 'active');

-- Interest signups
CREATE POLICY "interest_signups_public_insert" ON interest_signups FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "interest_signups_seller_read" ON interest_signups FOR SELECT USING (
  interest_page_id IN (
    SELECT id FROM interest_pages WHERE seller_id IN (
      SELECT id FROM sellers WHERE user_id = auth.uid()
    )
  )
);

-- Broadcasts
CREATE POLICY "broadcasts_seller" ON broadcasts FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Posts
CREATE POLICY "posts_seller" ON posts FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Coach suggestions
CREATE POLICY "coach_suggestions_seller" ON coach_suggestions FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Knowledge base
CREATE POLICY "knowledge_base_seller" ON knowledge_base FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- Journey tasks
CREATE POLICY "journey_tasks_seller" ON journey_tasks FOR ALL USING (
  seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid())
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sellers_updated BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_conversations_updated BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_reviews_updated BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_interest_pages_updated BEFORE UPDATE ON interest_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_knowledge_base_updated BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-increment interest signup count
CREATE OR REPLACE FUNCTION handle_interest_signup()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE interest_pages
  SET signup_count = signup_count + 1,
      threshold_reached = CASE WHEN signup_count + 1 >= threshold THEN TRUE ELSE threshold_reached END
  WHERE id = NEW.interest_page_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_interest_signup AFTER INSERT ON interest_signups FOR EACH ROW EXECUTE FUNCTION handle_interest_signup();

-- Update seller stats on order completion
CREATE OR REPLACE FUNCTION update_seller_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE sellers SET
      total_orders = total_orders + 1,
      total_revenue = total_revenue + NEW.total,
      is_active_seller = TRUE
    WHERE id = NEW.seller_id;
    UPDATE customers SET
      total_orders = total_orders + 1,
      total_spent = total_spent + NEW.total,
      last_order_date = NOW(),
      average_order_value = (total_spent + NEW.total) / (total_orders + 1)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_completed AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_seller_stats();

-- Update seller average rating
CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sellers SET average_rating = (
    SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE seller_id = NEW.seller_id AND status = 'published'
  ) WHERE id = NEW.seller_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_review_rating AFTER INSERT OR UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

-- Update product stock on order confirmation
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      UPDATE products SET
        stock_quantity = CASE
          WHEN stock_quantity IS NOT NULL THEN GREATEST(0, stock_quantity - (item->>'quantity')::INT)
          ELSE stock_quantity
        END,
        status = CASE
          WHEN stock_quantity IS NOT NULL AND stock_quantity - (item->>'quantity')::INT <= 0 THEN 'sold_out'
          ELSE status
        END
      WHERE id = (item->>'product_id')::UUID;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_stock AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INT)), 0) + 1
  INTO next_num FROM orders WHERE seller_id = NEW.seller_id;
  NEW.order_number = 'KLV-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_order_number BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();
