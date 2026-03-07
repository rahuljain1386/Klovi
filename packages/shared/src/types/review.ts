export type ReviewStatus = 'pending' | 'published' | 'hidden' | 'flagged';

export interface Review {
  id: string;
  seller_id: string;
  customer_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  status: ReviewStatus;
  is_recovered: boolean;
  recovery_offer: string | null;
  original_rating: number | null;
  ai_sentiment: 'positive' | 'neutral' | 'negative' | null;
  ai_category: string | null;
  ai_summary: string | null;
  seller_response: string | null;
  created_at: string;
  updated_at: string;
}
