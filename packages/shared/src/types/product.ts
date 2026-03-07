export type ProductStatus = 'active' | 'sold_out' | 'hidden' | 'deleted';

export interface ProductVariant {
  id: string;
  name: string;
  price_adjustment: number;
  available: boolean;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: 'USD' | 'INR' | 'CAD';
  category: string | null;
  variants: ProductVariant[] | null;
  images: string[];
  enhanced_images: string[];
  status: ProductStatus;
  stock_quantity: number | null;
  lead_time_hours: number | null;
  available_days: string[] | null;
  seasonal: boolean;
  seasonal_start: string | null;
  seasonal_end: string | null;
  min_order_quantity: number;
  max_order_quantity: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
