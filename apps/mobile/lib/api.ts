import { supabase } from './supabase';

export async function getCurrentSeller() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('sellers').select('*').eq('user_id', user.id).single();
  return data;
}

export async function getTodayOrders(sellerId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('orders').select('*, customers(name, phone)').eq('seller_id', sellerId).eq('pickup_date', today).order('pickup_time_slot');
  return data || [];
}

export async function getAllOrders(sellerId: string) {
  const { data } = await supabase.from('orders').select('*, customers(name, phone)').eq('seller_id', sellerId).order('created_at', { ascending: false });
  return data || [];
}

export async function getConversations(sellerId: string) {
  const { data } = await supabase.from('conversations').select('*, customers(name, phone), messages(content, created_at, sender)').eq('seller_id', sellerId).order('last_message_at', { ascending: false });
  return data || [];
}

export async function getFlaggedConversations(sellerId: string) {
  const { data } = await supabase.from('conversations').select('*, customers(name, phone)').eq('seller_id', sellerId).eq('needs_seller_attention', true).order('last_message_at', { ascending: false });
  return data || [];
}

export async function getSellerProducts(sellerId: string) {
  const { data } = await supabase.from('products').select('*').eq('seller_id', sellerId).neq('status', 'deleted').order('sort_order');
  return data || [];
}

export async function markOrderReady(orderId: string) {
  return supabase.from('orders').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', orderId).select().single();
}

export async function markOrderCollected(orderId: string) {
  return supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId).select().single();
}

export async function updateProductStock(productId: string, quantity: number | null) {
  return supabase.from('products').update({ stock_quantity: quantity, status: quantity === 0 ? 'sold_out' : 'active' }).eq('id', productId).select().single();
}

export async function getCoachSuggestions(sellerId: string) {
  const { data } = await supabase.from('coach_suggestions').select('*').eq('seller_id', sellerId).eq('status', 'pending').gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(3);
  return data || [];
}
