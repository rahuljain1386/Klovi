import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Debug: Create the webhook_logs table if it doesn't exist.
 * GET /api/debug/setup-log-table
 */
export async function GET() {
  const supabase = createServiceRoleClient();

  // Use rpc to run raw SQL to create the table
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        source text,
        payload text,
        headers text,
        created_at timestamptz DEFAULT now()
      );
    `,
  });

  if (error) {
    // rpc may not exist — try inserting directly (table auto-creates in some Supabase configs)
    // Otherwise, user needs to create table in Supabase SQL editor
    return NextResponse.json({
      error: error.message,
      manual_step: 'Please run this SQL in Supabase SQL Editor (https://supabase.com/dashboard/project/potxkjsflrnnengwougl/sql):',
      sql: `CREATE TABLE IF NOT EXISTS webhook_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text,
  payload text,
  headers text,
  created_at timestamptz DEFAULT now()
);`,
    });
  }

  return NextResponse.json({ status: 'table created' });
}
