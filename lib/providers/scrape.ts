import * as cheerio from 'cheerio';
import type { Offer, StoreId } from '@/lib/types';

export type RetailSource = { id: Exclude<StoreId,'custom'>; name: string; url: string };

export const retailSources: RetailSource[] = [
  { id: 'aldi', name: 'ALDI', url: 'https://www.aldi.hu/szuper-akciok-mindennap' },
  { id: 'lidl', name: 'Lidl', url: 'https://www.lidl.hu/' },
  { id: 'penny', name: 'PENNY', url: 'https://www.penny.hu/ajanlatok' },
  { id: 'tesco', name: 'Tesco', url: 'https://bevasarlas.tesco.hu/shop/hu-HU/buylists/weekly-offers/weekly-offers/top-offer' },
  { id: 'spar', name: 'SPAR', url: 'https://www.spar.hu/akcioterv' },
  { id: 'auchan', name: 'Auchan', url: 'https://auchan.hu/shop' },
  { id: 'ikea', name: 'IKEA', url: 'https://www.ikea.com/hu/hu/offers/' },
  { id: 'decathlon', name: 'Decathlon', url: 'https://www.decathlon.hu/deals' },
  { id: 'obi', name: 'OBI', url: 'https://www.obi.hu/ajanlatok/' },
  { id: 'praktiker', name: 'Praktiker', url: 'https://www.praktiker.hu/ajanlatok' },
  { id: 'deichmann', name: 'Deichmann', url: 'https://www.deichmann.com/hu-hu/c/akcio-akcios-cipok-481' },
  { id: 'jysk', name: 'JYSK', url: 'https://jysk.hu/' }
];

function clean(s: string) { return s.replace(/\s+/g, ' ').replace(/ /g, ' ').trim(); }
function num(s: string) { return Number(s.replace(/[ .]/g, '')); }
function slug(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60); }
function future(days=7){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function today(){ return new Date().toISOString().slice(0,10); }

function categoryFor(name: string) {
  const s=name.toLowerCase();
  if(/csirke|sertés|marha|hús|sonka|szalámi|kolbász|hal|lazac/.test(s)) return 'Élelmiszer · Hús';
  if(/tej|sajt|vaj|joghurt|tejföl|tojás|túró/.test(s)) return 'Élelmiszer · Tejtermék';
  if(/alma|banán|paradicsom|paprika|uborka|szőlő|áfonya|avokádó|zöldség|gyümölcs|tök/.test(s)) return 'Élelmiszer · Zöldség-gyümölcs';
  if(/kenyér|zsemle|kifli|pogácsa|péks/.test(s)) return 'Élelmiszer · Pékáru';
  if(/víz|üdítő|kávé|tea|ital|sör|bor/.test(s)) return 'Élelmiszer · Ital';
  if(/cipő|sneaker|csizma|szandál|papucs|bakancs/.test(s)) return 'Divat · Cipő';
  if(/kerékpár|futó|fitness|fitnesz|sport|sátor|horgász|labda|roller|túra/.test(s)) return 'Sport';
  if(/fúr|csavar|szerszám|fűnyíró|festék|laminált|csempe|burkolat|tömlő|medence/.test(s)) return 'Barkács';
  if(/ágy|matrac|szék|asztal|szekrény|polc|lámpa|paplan|párna|szőnyeg|függöny/.test(s)) return 'Otthon · Lakberendezés';
  if(/kert|kerti|kaspó|virágláda/.test(s)) return 'Otthon · Kert';
  if(/mosó|öblítő|tisztító|papír|mécses/.test(s)) return 'Háztartás';
  return 'Egyéb';
}

function unitLabelFrom(text: string) {
  const m=text.match(/\b(\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|db|darab|csomag|pár))\b/i);
  return m ? clean(m[1]) : '1 db';
}

function parsePrices(text: string, source: StoreId) {
  const all=[...text.matchAll(/(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft\b/gi)].map(m=>num(m[1])).filter(n=>n>10 && n<2000000);
  if(!all.length) return null;
  let price=all[0], oldPrice: number|undefined, loyaltyOnly=false;

  const club=text.match(/(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft\s*(?:Clubcarddal|kártyával)/i);
  if(club){ price=num(club[1]); loyaltyOnly=true; const larger=all.find(n=>n>price); if(larger) oldPrice=larger; }

  if(source==='penny'){
    const card=text.match(/PENNY\s*Kártyával\s*(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft/i);
    const without=text.match(/PENNY\s*Kártya\s*nélkül\s*(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft/i);
    if(card){price=num(card[1]);loyaltyOnly=true;if(without)oldPrice=num(without[1]);}
  }

  const previous=text.match(/(?:korábbi ár|előző ár)\s*(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft/i);
  if(previous){
    oldPrice=num(previous[1]);
    const after=text.slice((previous.index||0)+previous[0].length);
    const current=after.match(/(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft\b/i);
    if(current) price=num(current[1]);
    if(price===oldPrice){ const lower=all.find(n=>n<oldPrice!); if(lower) price=lower; }
  }

  if(!oldPrice){
    const bigger=all.find((n,i)=>i>0 && n>price && n<price*4);
    if(bigger) oldPrice=bigger;
    const lower=all.find((n,i)=>i>0 && n<price && n>price*.15);
    if(lower && !oldPrice){oldPrice=price;price=lower;}
  }
  return {price,oldPrice,loyaltyOnly};
}

function imageFrom($: cheerio.CheerioAPI, node: any, base: string){
  const img=$(node).find('img').first();
  const raw=img.attr('src')||img.attr('data-src')||img.attr('data-original')||img.attr('srcset')?.split(' ')[0]||'';
  if(!raw) return 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=640&q=80';
  try{return new URL(raw,base).toString()}catch{return raw}
}

export async function scrapeRetailer(source: RetailSource): Promise<Offer[]> {
  const response=await fetch(source.url,{headers:{'user-agent':'Mozilla/5.0 (compatible; MultiAkciok/1.0; +https://vercel.app)','accept-language':'hu-HU,hu;q=0.9,en;q=0.7'},next:{revalidate:60*60*12},signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const html=await response.text();
  const $=cheerio.load(html);
  const offers: Offer[]=[];
  const seen=new Set<string>();

  $('h2,h3,h4,[data-testid*=product] [class*=title],[class*=product] h2,[class*=product] h3').each((_,heading)=>{
    const name=clean($(heading).text());
    if(name.length<3||name.length>150||/ajánlat|akció|kategória|szűrés|termékek|heti|aktuális|rendezés/i.test(name)) return;
    let node: any = heading;
    let text='';
    for(let i=0;i<7;i++){
      const parent=$(node).parent().get(0); if(!parent) break; node=parent; text=clean($(node).text());
      if(/\d[\d .]*\s*Ft\b/i.test(text) && text.length<2200) break;
    }
    const parsed=parsePrices(text,source.id); if(!parsed) return;
    if(parsed.price<30 || parsed.price>1500000) return;
    const key=`${source.id}-${slug(name)}-${parsed.price}`; if(seen.has(key)) return; seen.add(key);
    const unit=unitLabelFrom(text);
    const unitMatch=text.match(/(\d{1,3}(?:[ .]\d{3})*|\d+)\s*Ft\s*\/\s*(?:1\s*)?(?:kg|l|db)/i);
    offers.push({
      id:key,
      name,
      category:categoryFor(name),
      store:source.id,
      price:parsed.price,
      oldPrice:parsed.oldPrice,
      unitLabel:unit,
      unitPrice:unitMatch?num(unitMatch[1]):undefined,
      validFrom:today(),
      validTo:future(7),
      image:imageFrom($,node,source.url),
      loyaltyOnly:parsed.loyaltyOnly,
      sourceUrl:source.url
    });
  });
  return offers.slice(0,80);
}
