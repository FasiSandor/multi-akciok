import 'server-only';

export type ServerPricePoint = {
  date: string;
  price: number;
};

export type ServerHistoryStats = {
  samples: number;
  firstDate: string;
  lastDate: string;
  average: number;
  minimum: number;
  maximum: number;
  points: ServerPricePoint[];
};

type SnapshotRow = {
  observed_date: string;
  price: number;
};

const DEFAULT_SUPABASE_URL = 'https://wopluslqeihwlnolfypm.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_f4FFiku_vqYePp8h1bXzcg_7iqRYlti';

function config() {
  const url = (process.env.MULTI_AKCIOK_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = process.env.MULTI_AKCIOK_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;
  return { url, key };
}

export function serverHistoryConfigured() {
  return true;
}

export async function readOfferHistoryStats(offerKey: string, days = 90): Promise<ServerHistoryStats | null> {
  if (!offerKey) return null;
  const cfg = config();

  const response = await fetch(`${cfg.url}/rest/v1/rpc/multi_akciok_offer_history`, {
    method: 'POST',
    headers: {
      apikey: cfg.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_offer_key: offerKey,
      p_days: Math.max(1, Math.min(365, days))
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) return null;

  const rows = await response.json() as SnapshotRow[];
  if (!Array.isArray(rows) || !rows.length) return null;

  const points = rows
    .map(row => ({ date: String(row.observed_date), price: Number(row.price) }))
    .filter(point => /^\d{4}-\d{2}-\d{2}/.test(point.date) && Number.isFinite(point.price) && point.price > 0)
    .map(point => ({ ...point, date: point.date.slice(0,10) }));

  if (!points.length) return null;
  const prices = points.map(x => x.price);

  return {
    samples: prices.length,
    firstDate: points[0].date,
    lastDate: points[points.length - 1].date,
    average: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),
    minimum: Math.min(...prices),
    maximum: Math.max(...prices),
    points
  };
}
