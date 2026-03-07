import { createServerClient } from './supabase/server';

export async function getAuthenticatedSeller() {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized', seller: null, supabase };
  }

  const { data: seller, error: sellerError } = await supabase
    .from('sellers')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (sellerError || !seller) {
    return { error: 'Seller not found', seller: null, supabase };
  }

  return { error: null, seller, supabase };
}
