export type OrderStatus =
  | 'pending_deposit'
  | 'deposit_paid'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'balance_paid'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'stripe' | 'razorpay' | 'upi' | 'cod';
export type PaymentStatus = 'pending' | 'deposit_paid' | 'fully_paid' | 'refunded' | 'failed';
export type FulfillmentType = 'pickup' | 'self_delivery' | 'third_party_delivery';

export interface OrderItem {
  product_id: string;
  product_name: string;
  variant: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  seller_id: string;
  customer_id: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: 'USD' | 'INR' | 'CAD';
  deposit_amount: number;
  balance_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  stripe_payment_intent_id: string | null;
  razorpay_order_id: string | null;
  is_cod: boolean;
  fulfillment_type: FulfillmentType;
  pickup_date: string | null;
  pickup_time_slot: string | null;
  delivery_address: string | null;
  delivery_tracking_url: string | null;
  status: OrderStatus;
  special_notes: string | null;
  source_channel: 'whatsapp' | 'instagram' | 'facebook' | 'web' | 'sms';
  conversation_id: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}
