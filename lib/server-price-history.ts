import 'server-only';

export type ServerHistoryStats = {
  samples: number;
  firstDate: string;
  lastDate: string;
  average: number;
  minimum: number;
  maximum: number;
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

  const prices = rows.map(x => Number(x.price)).filter(x => Number.isFinite(x) && x > 0);
  if (!prices.length) return null;

  return {
    samples: prices.length,
    firstDate: rows[0].observed_date,
    lastDate: rows[rows.length - 1].observed_date,
    average: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),
    minimum: Math.min(...prices),
    maximum: Math.max(...prices)
  };
}
