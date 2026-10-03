import type { Offer } from './types';
import { normalizeSearch, searchScore } from './search';
import { packInfo } from './optimizer';

export type ParsedShoppingItem = {
  raw: string;
  query: string;
  quantity: number;
  unit: 'pack' | 'db' | 'g' | 'kg' | 'ml' | 'l';
};

export type ShoppingMatch = {
  item: ParsedShoppingItem;
  offer?: Offer;
  packs: number;
  confidence: number;
  alternatives: Offer[];
};

function cleanPart(value:string){
  return value.replace(/^[-•*]\s*/,'').replace(/\s+/g,' ').trim();
}

function parseOne(raw:string):ParsedShoppingItem|null{
  let text=cleanPart(raw);
  if(!text) return null;

  let quantity=1;
  let unit:ParsedShoppingItem['unit']='pack';

  const leading=text.match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|db|darab|x)?\s+(.+)$/i);
  if(leading){
    quantity=Math.max(0.01,Number(leading[1].replace(',','.')));
    const rawUnit=(leading[2]||'').toLowerCase();
    unit=rawUnit==='kg'?'kg':rawUnit==='g'?'g':rawUnit==='ml'?'ml':rawUnit==='l'?'l':rawUnit==='db'||rawUnit==='darab'||rawUnit==='x'?'db':'pack';
    text=leading[3].trim();
  }else{
    const trailing=text.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|db|darab)$/i);
    if(trailing){
      text=trailing[1].trim();
      quantity=Math.max(0.01,Number(trailing[2].replace(',','.')));
      const rawUnit=trailing[3].toLowerCase();
      unit=rawUnit==='kg'?'kg':rawUnit==='g'?'g':rawUnit==='ml'?'ml':rawUnit==='l'?'l':'db';
    }
  }

  const query=normalizeSearch(text);
  if(!query) return null;
  return {raw:cleanPart(raw),query,quantity,unit};
}

export function parseShoppingText(value:string):ParsedShoppingItem[]{
  return value
    .split(/[\n,;]+/)
    .map(parseOne)
    .filter((x):x is ParsedShoppingItem=>!!x)
    .slice(0,40);
}

export function packsForShoppingItem(item:ParsedShoppingItem,offer:Offer){
  if(item.unit==='pack'||item.unit==='db'){
    if(item.unit==='db'){
      const pack=packInfo(offer);
      if(pack.kind==='count'&&pack.amount>0) return Math.max(1,Math.ceil(item.quantity/pack.amount));
    }
    return Math.max(1,Math.ceil(item.quantity));
  }

  const pack=packInfo(offer);
  const wanted=
    item.unit==='kg'?item.quantity*1000:
    item.unit==='g'?item.quantity:
    item.unit==='l'?item.quantity*1000:
    item.quantity;

  const expectedKind=item.unit==='kg'||item.unit==='g'?'mass':'volume';
  if(pack.kind===expectedKind&&pack.amount>0) return Math.max(1,Math.ceil(wanted/pack.amount));
  return 1;
}

export function matchShoppingItem(item:ParsedShoppingItem,offers:Offer[]):ShoppingMatch{
  const ranked=offers
    .map(offer=>({offer,score:searchScore(offer,item.query)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||a.offer.price-b.offer.price)
    .slice(0,6);

  if(!ranked.length) return {item,packs:1,confidence:0,alternatives:[]};

  const top=ranked[0];
  const second=ranked[1];
  const normalizedName=normalizeSearch(top.offer.name);
  const exactish=normalizedName===item.query||normalizedName.includes(item.query);
  const gap=top.score-(second?.score??0);

  let confidence=0;
  if(exactish&&top.score>=100) confidence=0.96;
  else if(top.score>=130&&gap>=20) confidence=0.9;
  else if(top.score>=100&&gap>=30) confidence=0.82;
  else if(top.score>=84&&gap>=20) confidence=0.7;
  else confidence=Math.min(0.64,top.score/180);

  const pack=packInfo(top.offer);
  if((item.unit==='kg'||item.unit==='g')&&pack.kind!=='mass') confidence*=0.55;
  if((item.unit==='l'||item.unit==='ml')&&pack.kind!=='volume') confidence*=0.55;

  return {
    item,
    offer:confidence>=0.68?top.offer:undefined,
    packs:packsForShoppingItem(item,top.offer),
    confidence,
    alternatives:ranked.slice(0,4).map(x=>x.offer)
  };
}

export function formatShoppingAmount(item:ParsedShoppingItem){
  const n=Number.isInteger(item.quantity)?String(item.quantity):String(item.quantity).replace('.',',');
  if(item.unit==='pack') return n+'×';
  return n+' '+item.unit;
}
