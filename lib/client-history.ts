import type { Offer } from './types';

export type HistoryStats = {
  samples: number;
  firstDate: string;
  lastDate: string;
  average: number;
  minimum: number;
  maximum: number;
};

type PricePoint = { date: string; price: number };
type HistoryStore = Record<string, PricePoint[]>;

const STORAGE_KEY = 'multi-akciok-price-history-v1';

function normalize(value: string) {
  return value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}

function keyFor(offer: Offer) {
  return `${offer.store}|${normalize(offer.name)}|${normalize(offer.unitLabel)}`;
}

function readStore(): HistoryStore {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as HistoryStore;
  } catch {
    return {};
  }
}

export function recordOfferHistory(offers: Offer[]) {
  if (typeof window === 'undefined') return;
  const store = readStore();
  const today = new Date().toISOString().slice(0,10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate()-90);
  const cutoffKey = cutoff.toISOString().slice(0,10);

  for (const offer of offers) {
    if (!Number.isFinite(offer.price) || offer.price <= 0) continue;
    const key = keyFor(offer);
    const points = (store[key] || []).filter(p => p.date >= cutoffKey);
    const existing = points.find(p => p.date === today);
    if (existing) existing.price = offer.price;
    else points.push({date:today,price:offer.price});
    store[key] = points.sort((a,b)=>a.date.localeCompare(b.date));
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readOfferHistoryStats(offer: Offer): HistoryStats | null {
  if (typeof window === 'undefined') return null;
  const points = readStore()[keyFor(offer)] || [];
  if (!points.length) return null;
  const prices = points.map(p=>p.price);
  return {
    samples: points.length,
    firstDate: points[0].date,
    lastDate: points[points.length-1].date,
    average: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length),
    minimum: Math.min(...prices),
    maximum: Math.max(...prices)
  };
}
