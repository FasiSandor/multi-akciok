import { NextResponse } from 'next/server';
import { collectLiveOffers } from '@/lib/providers';
import { collectCampaigns } from '@/lib/providers/campaigns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [live, campaigns] = await Promise.all([
    collectLiveOffers(),
    collectCampaigns()
  ]);
  return NextResponse.json({
    offers: live.offers,
    campaigns,
    refreshedAt: new Date().toISOString(),
    sourceStates: live.sources,
    mode: live.offers.length ? 'live' : 'unavailable'
  });
}
