export type MessageChannel = 'whatsapp' | 'instagram' | 'facebook' | 'sms' | 'email' | 'web';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageSender = 'customer' | 'seller' | 'ai';
export type MessageStatus = 'received' | 'ai_replied' | 'flagged' | 'seller_replied' | 'resolved';

export interface Conversation {
  id: string;
  seller_id: string;
  customer_id: string;
  channel: MessageChannel;
  status: MessageStatus;
  last_message_at: string;
  ai_can_handle: boolean;
  needs_seller_attention: boolean;
  flagged_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender: MessageSender;
  content: string;
  media_url: string | null;
  media_type: string | null;
  external_message_id: string | null;
  ai_confidence: number | null;
  ai_intent: string | null;
  read: boolean;
  created_at: string;
}
