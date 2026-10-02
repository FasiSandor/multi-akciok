import { NextResponse } from 'next/server';
import { collectLiveOffers } from '@/lib/providers';

export const dynamic = 'force-dynamic';

// Manual diagnostics only. Daily snapshots are scheduled by Supabase Cron.
export async function GET() {
  const live = await collectLiveOffers();
  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    offers: live.offers.length,
    sources: live.sources,
    historyScheduler: 'supabase'
  });
}
