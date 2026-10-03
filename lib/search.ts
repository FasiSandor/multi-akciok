import type { Offer } from './types';
import { stores } from './stores';

export function normalizeSearch(value:string){
  return value.toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function distance(a:string,b:string){
  if(a===b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let diagonal=prev[0];
    prev[0]=i;
    for(let j=1;j<=b.length;j++){
      const old=prev[j];
      prev[j]=Math.min(
        prev[j]+1,
        prev[j-1]+1,
        diagonal+(a[i-1]===b[j-1]?0:1)
      );
      diagonal=old;
    }
  }
  return prev[b.length];
}

function wordScore(query:string,word:string){
  if(!query||!word) return 0;
  if(word===query) return 100;
  if(word.startsWith(query)||query.startsWith(word)) return 84;
  if(word.includes(query)||query.includes(word)) return 72;
  if(query.length>=4&&word.length>=4){
    const d=distance(query,word);
    if(d===1) return 68;
    if(d===2&&Math.max(query.length,word.length)>=7) return 54;
  }
  return 0;
}

export function searchScore(offer:Offer,query:string){
  const normalized=normalizeSearch(query);
  if(!normalized) return 1;

  const queryWords=normalized.split(' ').filter(Boolean);
  const hay=normalizeSearch(`${offer.name} ${offer.category} ${stores[offer.store].name}`);
  const words=hay.split(' ').filter(Boolean);

  let total=0;
  for(const q of queryWords){
    let best=0;
    for(const word of words) best=Math.max(best,wordScore(q,word));
    if(best===0) return 0;
    total+=best;
  }

  const name=normalizeSearch(offer.name);
  if(name.includes(normalized)) total+=45;
  const store=normalizeSearch(stores[offer.store].name);
  if(store===normalized) total+=80;

  return total;
}

export function rankOffers(offers:Offer[],query:string){
  const q=normalizeSearch(query);
  if(!q) return offers;
  return offers
    .map(offer=>({offer,score:searchScore(offer,q)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||a.offer.price-b.offer.price)
    .map(x=>x.offer);
}
