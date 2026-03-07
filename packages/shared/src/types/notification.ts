export type NotificationPriority = 'critical' | 'important' | 'daily';
export type NotificationType =
  | 'new_order'
  | 'payment_received'
  | 'message_flagged'
  | 'bad_review'
  | 'hot_lead'
  | 'low_stock'
  | 'pickup_approaching'
  | 'daily_summary'
  | 'ai_suggestion'
  | 'interest_threshold';

export interface Notification {
  id: string;
  seller_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  data: Record<string, any> | null;
  read: boolean;
  sent_at: string | null;
  created_at: string;
}
