import type { Offer } from './types';

export type WatchHit = {
  term: string;
  offer: Offer;
  previousBest?: number;
  status: 'new' | 'lower' | 'active';
  attention: boolean;
  acknowledged: boolean;
  dismissed: boolean;
  checkedAt: string;
};

type WatchState = {
  bestPrice?: number;
  offerId?: string;
  acknowledgedOfferId?: string;
  acknowledgedPrice?: number;
  dismissedOfferId?: string;
  checkedAt?: string;
};

const STATE_KEY = 'multi-akciok-watch-state-v2';

function normalize(value: string) {
  return value.toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function readState(): Record<string, WatchState> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');
    return parsed && typeof parsed==='object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(value: Record<string,WatchState>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATE_KEY,JSON.stringify(value));
}

function keyFor(term:string){
  return normalize(term);
}

export function evaluateWatchTerms(offers: Offer[], terms: string[]): WatchHit[] {
  if (typeof window === 'undefined') return [];
  const state=readState();
  const now=new Date().toISOString();
  const hits:WatchHit[]=[];

  for(const raw of terms){
    const term=keyFor(raw);
    if(!term) continue;
    const words=term.split(' ').filter(Boolean);
    const matches=offers.filter(offer=>{
      const hay=normalize(`${offer.name} ${offer.category} ${offer.store}`);
      return words.every(word=>hay.includes(word));
    });
    if(!matches.length) continue;

    matches.sort((a,b)=>a.price-b.price);
    const offer=matches[0];
    const old=state[term]||{};
    const changedOffer=!!old.offerId && old.offerId!==offer.id;
    const lower=old.bestPrice!=null && offer.price<old.bestPrice;
    const status:WatchHit['status']=old.offerId==null||changedOffer?'new':lower?'lower':'active';

    const acknowledged=old.acknowledgedOfferId===offer.id &&
      (old.acknowledgedPrice==null || offer.price>=old.acknowledgedPrice);
    const dismissed=old.dismissedOfferId===offer.id &&
      (old.acknowledgedPrice==null || offer.price>=old.acknowledgedPrice);
    const attention=!acknowledged&&!dismissed;

    hits.push({
      term:raw,
      offer,
      previousBest:old.bestPrice,
      status,
      attention,
      acknowledged,
      dismissed,
      checkedAt:now
    });

    state[term]={
      ...old,
      bestPrice:offer.price,
      offerId:offer.id,
      checkedAt:now,
      ...(changedOffer?{dismissedOfferId:undefined}:null)
    };
  }

  writeState(state);
  return hits.sort((a,b)=>{
    if(a.attention!==b.attention) return a.attention?-1:1;
    const priority={lower:0,new:1,active:2} as const;
    return priority[a.status]-priority[b.status]||a.offer.price-b.offer.price;
  });
}

export function acknowledgeWatchHit(term:string,offer:Offer){
  if(typeof window==='undefined') return;
  const state=readState();
  const key=keyFor(term);
  const old=state[key]||{};
  state[key]={
    ...old,
    bestPrice:offer.price,
    offerId:offer.id,
    acknowledgedOfferId:offer.id,
    acknowledgedPrice:offer.price,
    dismissedOfferId:undefined,
    checkedAt:new Date().toISOString()
  };
  writeState(state);
}

export function dismissWatchHit(term:string,offer:Offer){
  if(typeof window==='undefined') return;
  const state=readState();
  const key=keyFor(term);
  const old=state[key]||{};
  state[key]={
    ...old,
    bestPrice:offer.price,
    offerId:offer.id,
    acknowledgedOfferId:offer.id,
    acknowledgedPrice:offer.price,
    dismissedOfferId:offer.id,
    checkedAt:new Date().toISOString()
  };
  writeState(state);
}

export function clearWatchState(term:string){
  if(typeof window==='undefined') return;
  const state=readState();
  delete state[keyFor(term)];
  writeState(state);
}
