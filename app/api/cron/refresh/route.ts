import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Daily price snapshots are owned by Supabase Cron + Edge Function.
// This legacy Vercel cron endpoint is intentionally disabled.
export async function GET() {
  return NextResponse.json(
    { ok: false, scheduler: 'supabase', message: 'Legacy Vercel cron disabled.' },
    { status: 410 }
  );
}
