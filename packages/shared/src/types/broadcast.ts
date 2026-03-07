export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type BroadcastSegment = 'all' | 'loyal' | 'dormant' | 'new';

export interface Broadcast {
  id: string;
  seller_id: string;
  title: string;
  message: string;
  media_url: string | null;
  segments: BroadcastSegment[];
  channels: ('whatsapp' | 'instagram' | 'sms')[];
  status: BroadcastStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  delivered: number;
  read: number;
  replies: number;
  orders_generated: number;
  created_at: string;
}
