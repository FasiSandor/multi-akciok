import { NextResponse } from 'next/server';
import { readOfferHistoryStats, serverHistoryConfigured } from '@/lib/server-price-history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offerKey = url.searchParams.get('offerKey')?.trim() || '';
  const days = Number(url.searchParams.get('days') || '90');

  if (!offerKey) {
    return NextResponse.json({ history: null, configured: serverHistoryConfigured() }, { status: 400 });
  }

  const history = await readOfferHistoryStats(offerKey, Number.isFinite(days) ? days : 90);
  return NextResponse.json({
    history,
    configured: serverHistoryConfigured()
  });
}
