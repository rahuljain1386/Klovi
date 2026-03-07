export type CustomerSegment = 'new' | 'active' | 'loyal' | 'dormant';

export interface Customer {
  id: string;
  seller_id: string;
  name: string;
  phone: string;
  email: string | null;
  whatsapp_id: string | null;
  instagram_id: string | null;
  facebook_id: string | null;
  segment: CustomerSegment;
  total_orders: number;
  total_spent: number;
  last_order_date: string | null;
  average_order_value: number;
  preferred_channel: 'whatsapp' | 'instagram' | 'facebook' | 'sms' | 'email';
  language: string;
  city: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
