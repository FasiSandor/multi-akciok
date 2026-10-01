import { NextResponse } from 'next/server';
import { collectLiveOffers } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) return new NextResponse('Unauthorized', { status: 401 });
  const live=await collectLiveOffers();
  return NextResponse.json({ok:true,checkedAt:new Date().toISOString(),offers:live.offers.length,sources:live.sources});
}
