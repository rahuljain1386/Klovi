export type InterestPageStatus = 'active' | 'converted' | 'archived';

export interface InterestPage {
  id: string;
  seller_id: string;
  slug: string;
  product_name: string;
  product_description: string;
  city: string;
  demand_level: 'low' | 'medium' | 'high' | null;
  suggested_price: number | null;
  competitor_analysis: string | null;
  ai_insights: string | null;
  signup_count: number;
  threshold: number;
  threshold_reached: boolean;
  status: InterestPageStatus;
  pivot_suggestions: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface InterestSignup {
  id: string;
  interest_page_id: string;
  name: string;
  phone: string;
  whatsapp_id: string | null;
  created_at: string;
}
