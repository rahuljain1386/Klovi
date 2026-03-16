import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Debug: View recent webhook calls logged to the webhook_logs table.
 * GET /api/debug/webhook-log
 */
export async function GET() {
  const supabase = createServiceRoleClient();

  // Try to read recent logs
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({
      error: error.message,
      hint: 'The webhook_logs table may not exist yet. Send a message to the Klovi WhatsApp number to trigger the webhook — it will auto-create the table.',
    });
  }

  return NextResponse.json({
    count: data?.length || 0,
    logs: data,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
