import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Save intake questions + packages for a service-business seller.
 * Stored as JSON on the seller record (intake_questions, intake_packages columns).
 *
 * POST /api/onboarding/save-intake
 * Body: { sellerId, questions: [...], packages: [...] }
 */
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sellerId, questions, packages } = await request.json();
  if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 });

  const supabase = createServiceRoleClient();

  // Verify ownership
  const { data: seller } = await supabase
    .from('sellers')
    .select('id, user_id')
    .eq('id', sellerId)
    .single();

  if (!seller || seller.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found or not owned' }, { status: 403 });
  }

  // Save intake config as JSON on the seller record
  const updates: Record<string, unknown> = {};
  if (Array.isArray(questions)) updates.intake_questions = questions;
  if (Array.isArray(packages)) updates.intake_packages = packages;

  const { error: updateErr } = await supabase
    .from('sellers')
    .update(updates)
    .eq('id', sellerId);

  if (updateErr) {
    // If columns don't exist yet, that's OK — they'll be created later
    console.error('Save intake error:', updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
