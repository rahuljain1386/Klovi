import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Save edited knowledge base entries for a seller.
 * Called during onboarding when user edits auto-generated FAQs.
 *
 * POST /api/onboarding/save-knowledge
 * Body: { sellerId, entries: [{ id?, question, answer }] }
 */
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sellerId, entries } = await request.json();
  if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 });
  if (!Array.isArray(entries)) return NextResponse.json({ error: 'entries[] required' }, { status: 400 });

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

  // Delete all existing entries for this seller and replace with edited ones
  await supabase.from('knowledge_base').delete().eq('seller_id', sellerId);

  // Filter out entries with empty questions
  const validEntries = entries.filter((e: any) => e.question?.trim() && e.answer?.trim());

  if (validEntries.length === 0) {
    return NextResponse.json({ success: true, count: 0 });
  }

  const inserts = validEntries.map((e: any) => ({
    seller_id: sellerId,
    question: e.question.trim(),
    answer: e.answer.trim(),
    source: 'ai_onboarding_edited',
    created_at: new Date().toISOString(),
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('knowledge_base')
    .insert(inserts)
    .select('id');

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: inserted?.length || 0 });
}
