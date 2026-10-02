import { NextResponse } from 'next/server';
import { collectLiveOffers } from '@/lib/providers';
import { saveOfferSnapshots } from '@/lib/server-price-history';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const live = await collectLiveOffers();
  let history: { enabled: boolean; stored: number; error?: string } = { enabled: false, stored: 0 };

  try {
    history = await saveOfferSnapshots(live.offers);
  } catch (error) {
    history = {
      enabled: true,
      stored: 0,
      error: error instanceof Error ? error.message : 'Ismeretlen árhistorika-hiba'
    };
  }

  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    offers: live.offers.length,
    sources: live.sources,
    history
  });
}
