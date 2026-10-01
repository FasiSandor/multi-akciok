import type { Offer } from '@/lib/types';

export type SourceState = {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  checkedAt: string;
  count: number;
  note?: string;
};

const sources = [
  { id: 'aldi', name: 'ALDI', url: 'https://www.aldi.hu/' },
  { id: 'lidl', name: 'Lidl', url: 'https://www.lidl.hu/' },
  { id: 'penny', name: 'PENNY', url: 'https://www.penny.hu/' },
  { id: 'tesco', name: 'Tesco', url: 'https://www.tesco.hu/' },
  { id: 'spar', name: 'SPAR', url: 'https://www.spar.hu/' },
  { id: 'auchan', name: 'Auchan', url: 'https://auchan.hu/' },
  { id: 'ikea', name: 'IKEA', url: 'https://www.ikea.com/hu/hu/' },
  { id: 'decathlon', name: 'Decathlon', url: 'https://www.decathlon.hu/' },
  { id: 'obi', name: 'OBI', url: 'https://www.obi.hu/' },
  { id: 'praktiker', name: 'Praktiker', url: 'https://www.praktiker.hu/' },
  { id: 'deichmann', name: 'Deichmann', url: 'https://www.deichmann.com/hu-hu/' },
  { id: 'jysk', name: 'JYSK', url: 'https://jysk.hu/' }
] as const;

export async function collectLiveOffers(): Promise<{ offers: Offer[]; sources: SourceState[] }> {
  const checkedAt = new Date().toISOString();
  return {
    offers: [],
    sources: sources.map(source => ({
      ...source,
      ok: true,
      checkedAt,
      count: 0,
      note: 'Forrás csatlakoztatva; termékadapter fejlesztés alatt.'
    }))
  };
}

export async function checkSources() {
  return (await collectLiveOffers()).sources;
}
