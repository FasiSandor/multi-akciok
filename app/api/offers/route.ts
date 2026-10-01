import { NextResponse } from 'next/server';
import { collectLiveOffers } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const live = await collectLiveOffers();
  return NextResponse.json({
    offers: live.offers,
    refreshedAt: new Date().toISOString(),
    sourceStates: live.sources,
    mode: live.offers.length ? 'live' : 'unavailable'
  });
}
