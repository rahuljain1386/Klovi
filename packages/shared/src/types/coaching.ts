export type SuggestionType = 'occasion' | 'sales_pattern' | 'pricing' | 'trending' | 'reactivation';
export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'expired';

export interface CoachSuggestion {
  id: string;
  seller_id: string;
  type: SuggestionType;
  title: string;
  description: string;
  action_label: string;
  action_type: 'create_post' | 'send_broadcast' | 'update_price' | 'add_product' | 'send_message';
  action_data: Record<string, any>;
  status: SuggestionStatus;
  reasoning: string;
  potential_revenue: number | null;
  expires_at: string;
  created_at: string;
}
