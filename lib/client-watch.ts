import type { Offer } from './types';

export type WatchHit = {
  term: string;
  offer: Offer;
  previousBest?: number;
  status: 'new' | 'lower' | 'active';
};

const PRICE_KEY = 'multi-akciok-watch-prices-v1';

function normalize(value: string) {
  return value.toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function readPrices(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(PRICE_KEY) || '{}'); }
  catch { return {}; }
}

export function evaluateWatchTerms(offers: Offer[], terms: string[]): WatchHit[] {
  if (typeof window === 'undefined') return [];
  const previous = readPrices();
  const next = { ...previous };
  const hits: WatchHit[] = [];

  for (const raw of terms) {
    const term = normalize(raw);
    if (!term) continue;
    const words = term.split(' ').filter(Boolean);
    const matches = offers.filter(offer => {
      const hay = normalize(`${offer.name} ${offer.category}`);
      return words.every(word => hay.includes(word));
    });
    if (!matches.length) continue;

    matches.sort((a,b) => a.price - b.price);
    const offer = matches[0];
    const old = previous[term];
    const status: WatchHit['status'] = old == null ? 'new' : offer.price < old ? 'lower' : 'active';
    hits.push({ term: raw, offer, previousBest: old, status });
    next[term] = offer.price;
  }

  localStorage.setItem(PRICE_KEY, JSON.stringify(next));
  return hits.sort((a,b) => {
    const priority = { lower: 0, new: 1, active: 2 } as const;
    return priority[a.status] - priority[b.status] || a.offer.price - b.offer.price;
  });
}
