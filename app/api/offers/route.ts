import { NextResponse } from 'next/server';
import { fallbackOffers } from '@/lib/fallback-offers';
import { collectLiveOffers } from '@/lib/providers';

export const revalidate = 60 * 60 * 12;

export async function GET() {
  const live=await collectLiveOffers();
  const isProd=process.env.NODE_ENV==='production';
  return NextResponse.json({
    offers: live.offers.length ? live.offers : (isProd ? [] : fallbackOffers),
    refreshedAt: new Date().toISOString(),
    sourceStates: live.sources,
    mode: live.offers.length ? 'live' : (isProd ? 'unavailable' : 'demo')
  });
}
