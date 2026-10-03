import type { Offer, StoreId } from './types';

export type PackInfo = {
  kind: 'mass' | 'volume' | 'count' | 'unknown';
  amount: number;
};

export type EquivalentCandidate = {
  offer: Offer;
  confidence: number;
  requiredPacks: number;
};

const STOP = new Set([
  'friss','akcios','termek','felnott','gyerek','ferfi','noi','csomag','darab','db',
  'kg','ml','liter','litre','plus','ajanlat','online','meret','szinben'
]);

export function normalizeProduct(value:string){
  return value.toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function tokens(value:string){
  return [...new Set(normalizeProduct(value).split(' ').filter(x=>x.length>=3 && !STOP.has(x) && !/^\d+$/.test(x)))];
}

export function packInfo(offer:Offer):PackInfo{
  const raw=(offer.unitLabel+' '+offer.name)
    .toLocaleLowerCase('hu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/,/g,'.')
    .replace(/\s+/g,' ')
    .trim();

  const mass=raw.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g)(?:\b|\/)/i);
  if(mass){
    const n=Number(mass[1]);
    if(Number.isFinite(n)&&n>0) return {kind:'mass',amount:mass[2].toLowerCase()==='kg'?n*1000:n};
  }

  const volume=raw.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(l|ml)(?:\b|\/)/i);
  if(volume){
    const n=Number(volume[1]);
    if(Number.isFinite(n)&&n>0) return {kind:'volume',amount:volume[2].toLowerCase()==='l'?n*1000:n};
  }

  const count=raw.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(db|darab|par)(?:\b|\/)/i);
  if(count){
    const n=Number(count[1]);
    if(Number.isFinite(n)&&n>0) return {kind:'count',amount:n};
  }

  if(/\/\s*kg\b/i.test(raw)||normalizeProduct(offer.unitLabel)==='1 kg') return {kind:'mass',amount:1000};
  if(/\/\s*l\b/i.test(raw)||normalizeProduct(offer.unitLabel)==='1 l') return {kind:'volume',amount:1000};
  return {kind:'unknown',amount:1};
}

function categoryCompatible(a:Offer,b:Offer){
  if(a.category===b.category) return true;
  const aa=normalizeProduct(a.category).split(' ');
  const bb=normalizeProduct(b.category).split(' ');
  return aa.some(x=>x.length>=4&&bb.includes(x));
}

export function similarity(source:Offer,candidate:Offer){
  if(source.id===candidate.id) return 1;
  if(!categoryCompatible(source,candidate)) return 0;

  const a=tokens(source.name);
  const b=tokens(candidate.name);
  if(!a.length||!b.length) return 0;

  const common=a.filter(x=>b.some(y=>x===y||x.includes(y)||y.includes(x))).length;
  const lexical=common/Math.min(a.length,b.length);
  if(common===0||lexical<0.5) return 0;

  const pa=packInfo(source),pb=packInfo(candidate);
  if(pa.kind!==pb.kind && pa.kind!=='unknown' && pb.kind!=='unknown') return 0;
  if(pa.kind==='unknown'||pb.kind==='unknown'){
    if(normalizeProduct(source.unitLabel)!==normalizeProduct(candidate.unitLabel)) return 0;
    return lexical*0.9;
  }

  const ratio=Math.min(pa.amount,pb.amount)/Math.max(pa.amount,pb.amount);
  const packScore=ratio>=0.95?1:ratio>=0.5?0.8:ratio>=0.25?0.55:0.25;
  return lexical*0.72+packScore*0.28;
}

export function requiredPacks(source:Offer,sourcePacks:number,candidate:Offer){
  if(source.id===candidate.id) return Math.max(1,Math.round(sourcePacks));
  const a=packInfo(source),b=packInfo(candidate);
  if(a.kind!=='unknown'&&a.kind===b.kind&&a.amount>0&&b.amount>0){
    return Math.max(1,Math.ceil((a.amount*Math.max(1,sourcePacks))/b.amount));
  }
  return Math.max(1,Math.round(sourcePacks));
}

export function equivalentCandidates(source:Offer,offers:Offer[],sourcePacks:number,store?:StoreId):EquivalentCandidate[]{
  return offers
    .filter(candidate=>(!store||candidate.store===store))
    .map(candidate=>({
      offer:candidate,
      confidence:similarity(source,candidate),
      requiredPacks:requiredPacks(source,sourcePacks,candidate)
    }))
    .filter(candidate=>candidate.offer.id===source.id||candidate.confidence>=0.64);
}
