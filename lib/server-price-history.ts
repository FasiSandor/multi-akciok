import 'server-only';

import type { Offer } from '@/lib/types';

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

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

export function serverHistoryConfigured() {
  return !!config();
}

export async function saveOfferSnapshots(offers: Offer[]) {
  const cfg = config();
  if (!cfg || !offers.length) return { enabled: false, stored: 0 };

  const observedDate = new Date().toISOString().slice(0, 10);
  const rows = offers
    .filter(o => Number.isFinite(o.price) && o.price > 0)
    .map(o => ({
      observed_date: observedDate,
      offer_key: o.id,
      store: o.store,
      name: o.name,
      category: o.category,
      price: Math.round(o.price),
      old_price: o.oldPrice ? Math.round(o.oldPrice) : null,
      unit_label: o.unitLabel,
      unit_price: o.unitPrice ? Math.round(o.unitPrice) : null,
      valid_to: o.validTo || null,
      condition_text: o.conditionText || null,
      source_url: o.sourceUrl || null
    }));

  if (!rows.length) return { enabled: true, stored: 0 };

  const response = await fetch(
    `${cfg.url}/rest/v1/offer_snapshots?on_conflict=observed_date,offer_key`,
    {
      method: 'POST',
      headers: {
        ...headers(cfg.key),
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Supabase snapshot write failed: ${response.status} ${detail}`);
  }

  return { enabled: true, stored: rows.length };
}

export async function readOfferHistoryStats(offerKey: string, days = 90): Promise<ServerHistoryStats | null> {
  const cfg = config();
  if (!cfg || !offerKey) return null;

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, Math.min(365, days)));
  const params = new URLSearchParams({
    select: 'observed_date,price',
    offer_key: `eq.${offerKey}`,
    observed_date: `gte.${cutoff.toISOString().slice(0,10)}`,
    order: 'observed_date.asc'
  });

  const response = await fetch(`${cfg.url}/rest/v1/offer_snapshots?${params}`, {
    headers: headers(cfg.key),
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
