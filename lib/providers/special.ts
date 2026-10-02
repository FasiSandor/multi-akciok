import { load } from 'cheerio';
import type { Offer, StoreId } from '@/lib/types';
import type { RetailSource } from './scrape';

function clean(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function lines(html: string) {
  return clean(html).split(/\n+/).map(x => x.trim()).filter(Boolean);
}

function number(value: string) {
  return Number(value.replace(/[^\d]/g, ''));
}

function slug(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoFuture(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function categoryFor(name: string) {
  const s = name.toLowerCase();
  if (/csirke|sertés|marha|hús|sonka|szalámi|kolbász|hal|lazac/.test(s)) return 'Élelmiszer · Hús';
  if (/tej|sajt|vaj|joghurt|tejföl|tojás|túró/.test(s)) return 'Élelmiszer · Tejtermék';
  if (/alma|banán|paradicsom|paprika|uborka|szőlő|áfonya|avokádó|zöldség|gyümölcs|tök|kivi/.test(s)) return 'Élelmiszer · Zöldség-gyümölcs';
  if (/kenyér|zsemle|kifli|pogácsa|péks/.test(s)) return 'Élelmiszer · Pékáru';
  if (/víz|üdítő|kávé|tea|ital|sör|bor|pezsgő/.test(s)) return 'Élelmiszer · Ital';
  if (/cipő|sneaker|csizma|szandál|papucs|bakancs|loafer/.test(s)) return 'Divat · Cipő';
  if (/kerékpár|futó|fitness|fitnesz|sport|sátor|horgász|labda|roller|túra/.test(s)) return 'Sport';
  if (/fúr|csavar|szerszám|fűnyíró|festék|laminált|csempe|burkolat|tömlő|medence/.test(s)) return 'Barkács';
  if (/ágy|matrac|szék|asztal|szekrény|polc|lámpa|paplan|párna|szőnyeg|függöny/.test(s)) return 'Otthon · Lakberendezés';
  if (/kert|kerti|kaspó|virágláda/.test(s)) return 'Otthon · Kert';
  if (/sampon|balzsam|dezodor|parfüm|tusfürdő|krém|kozmet|szempilla|rúzs|fogkrém|pelenka|törlőkendő|hajfesték|vitamin/.test(s)) return 'Drogéria';
  if (/mosó|öblítő|tisztító|papír|mécses|kapszula/.test(s)) return 'Háztartás';
  if (/tv|televízió|telefon|okosóra|laptop|notebook|tablet|porszívó|hűtő|mosógép|szárítógép|fejhallgató/.test(s)) return 'Műszaki';
  return 'Egyéb';
}

function unitFrom(values: string[]) {
  const joined = values.join(' ');
  const m = joined.match(/\b(\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|lt|db|darab|csomag|pár))\b/i);
  return m ? m[1].replace(/\blt\b/i, 'l') : '1 db';
}

function unitPriceLabelFrom(text:string){
  const slash=text.match(/Ft\s*\/\s*(kg|l|lt|db|darab|m2|m²|100\s*ml|100\s*g|liter|each)/i);
  if(slash){
    const raw=slash[1].toLowerCase().replace('liter','l').replace('each','db').replace('darab','db').replace('lt','l');
    return '/'+raw;
  }
  const one=text.match(/1\s*(kg|l|lt|db|darab)\s*(?:=|\s)/i);
  if(one){
    const raw=one[1].toLowerCase().replace('darab','db').replace('lt','l');
    return '/'+raw;
  }
  return undefined;
}

function parseIsoDate(text: string) {
  const m = text.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
}

function placeholder(store: StoreId, name: string) {
  const label = encodeURIComponent(name.slice(0, 28));
  const colors: Partial<Record<StoreId,string>> = { penny:'e40521', deichmann:'0082c8', auchan:'e31b23' };
  return `https://placehold.co/640x480/${colors[store] ?? 'e8edf3'}/ffffff?text=${label}`;
}


function imageNear(html: string, name: string, base: string, fallback: string) {
  const lower = html.toLocaleLowerCase('hu');
  const needle = name.toLocaleLowerCase('hu');
  const center = lower.indexOf(needle);
  if (center < 0) return fallback;
  const start = Math.max(0, center - 6000);
  const end = Math.min(html.length, center + 6000);
  const chunk = html.slice(start, end);
  const candidates: Array<{url:string;distance:number}> = [];
  const re = /(?:src|data-src|data-original)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(chunk))) {
    const raw = match[1].split(/\s+/)[0];
    const url = absoluteUrl(raw, base);
    if (!url || /logo|icon|sprite|placeholder|data:/i.test(url)) continue;
    if (!/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url) && !/image|cdn|asset|media/i.test(url)) continue;
    candidates.push({url,distance:Math.abs((start + (match.index ?? 0)) - center)});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates[0]?.url ?? fallback;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; MultiAkciok/1.0)',
      'accept-language': 'hu-HU,hu;q=0.9'
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

const SOURCE_PROXY_URL = 'https://wopluslqeihwlnolfypm.supabase.co/functions/v1/multi-akciok-source-proxy';
const SOURCE_PROXY_KEY = 'sb_publishable_f4FFiku_vqYePp8h1bXzcg_7iqRYlti';

async function fetchSourceProxy(source: 'spar' | 'auchan-weekly' | 'decathlon-sale') {
  const response = await fetch(SOURCE_PROXY_URL, {
    method: 'POST',
    headers: {
      apikey: SOURCE_PROXY_KEY,
      Authorization: `Bearer ${SOURCE_PROXY_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ source }),
    cache: 'no-store',
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Forrás-proxy hiba: ${response.status} ${detail}`);
  }
  return response;
}

function budapestDateFromEpoch(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(seconds * 1000));
  const get = (type: string) => parts.find(x => x.type === type)?.value;
  const y = get('year'), m = get('month'), d = get('day');
  return y && m && d ? `${y}-${m}-${d}` : undefined;
}


function pennyRange(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const back = (day + 3) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  const start = new Date(d);
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 6);
  const mmdd = (x: Date) => `${String(x.getUTCMonth()+1).padStart(2,'0')}${String(x.getUTCDate()).padStart(2,'0')}`;
  return { key: `${mmdd(start)}${mmdd(end)}`, start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) };
}

function pennyCouponRange(text:string){
  const m=text.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\s*-\s*(?:(20\d{2})[.\/-])?(\d{1,2})[.\/-](\d{1,2})/);
  if(!m) return undefined;
  return {
    start:m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'),
    end:(m[4]||m[1])+'-'+m[5].padStart(2,'0')+'-'+m[6].padStart(2,'0')
  };
}

function parsePennyCardPage(html:string,url:string,range:{start:string;end:string}):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];
  for(let i=0;i<data.length;i++){
    if(!/PENNY Kártya nélkül/i.test(data[i])) continue;
    const before=data.slice(Math.max(0,i-12),i);
    const name=[...before].reverse().find(x=>
      x.length>=3&&x.length<=120&&!/^\d/.test(x)&&
      !/termék|ajánlat|között|tól|ig|kárty|kg|ml|lt|db|sort|filter/i.test(x)
    );
    if(!name) continue;
    const after=data.slice(i+1,i+12);
    const regularLine=after.find(x=>/\d[\d .]*\s*Ft\b/i.test(x));
    const cardIndex=after.findIndex(x=>/PENNY Kártyával/i.test(x));
    if(!regularLine||cardIndex<0) continue;
    const cardLine=after.slice(cardIndex+1).find(x=>/\d[\d .]*\s*Ft\b/i.test(x));
    if(!cardLine) continue;
    const regular=number(regularLine);
    const price=number(cardLine);
    if(!price||!regular||price>regular||price>1_500_000) continue;
    const unitPriceLine=after.slice(cardIndex+1).find(x=>/1\s*(?:KG|LT|L|DB)\s+\d[\d .]*\s*Ft/i.test(x));
    const unitPrice=unitPriceLine?number(unitPriceLine.replace(/^.*?1\s*(?:KG|LT|L|DB)/i,'')):undefined;
    const context=[...before,...after];
    const dates=context.map(parseIsoDate).filter((x):x is string=>!!x);
    offers.push({
      id:'penny-'+slug(name),
      name,
      category:categoryFor(name),
      store:'penny',
      price,
      oldPrice:regular>price?regular:undefined,
      unitLabel:unitFrom(before),
      unitPrice,
      unitPriceLabel:unitPriceLine?unitPriceLabelFrom(unitPriceLine):undefined,
      validFrom:dates[0]??range.start,
      validTo:dates[1]??range.end,
      loyaltyOnly:true,
      conditionText:'PENNY Kártya',
      image:imageNear(html,name,url,placeholder('penny',name)),
      sourceUrl:url
    });
  }
  return offers;
}

function parsePennyFeaturedPage(html:string,url:string,range:{start:string;end:string}):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];
  for(let i=0;i<data.length;i++){
    if(!/(20\d{2})[.\/-]\d{1,2}[.\/-]\d{1,2}-tól/i.test(data[i])) continue;
    const before=data.slice(Math.max(0,i-7),i);
    const name=[...before].reverse().find(x=>
      x.length>=3&&x.length<=140 &&
      !/kiemelt ajánlat|heti ajánlat|termék|csak most|^\d+(?:[.,]\d+)?\s*(?:kg|g|ml|lt|l|db)$/i.test(x)
    );
    if(!name) continue;
    const after=data.slice(i+1,i+10);
    if(after.some(x=>/PENNY Kártya nélkül|PENNY Kártyával/i.test(x))) continue;
    const priceLines=after.filter(x=>/^\s*\d[\d .]*\s*Ft\s*$/i.test(x));
    if(!priceLines.length) continue;
    const price=number(priceLines[0]);
    if(!price||price>1_500_000) continue;
    const oldCandidates=priceLines.slice(1).map(number).filter(x=>x>price);
    const oldPrice=oldCandidates[0];
    const unitLine=after.find(x=>/1\s*(?:KG|LT|L|DB)\s+\d[\d .]*\s*Ft/i.test(x));
    const unitPrice=unitLine?number(unitLine.replace(/^.*?1\s*(?:KG|LT|L|DB)/i,'')):undefined;
    const from=parseIsoDate(data[i])??range.start;
    const toLine=after.find(x=>/(20\d{2})[.\/-]\d{1,2}[.\/-]\d{1,2}-ig/i.test(x));
    const to=toLine?parseIsoDate(toLine)??range.end:range.end;
    offers.push({
      id:'penny-'+slug(name),
      name,
      category:categoryFor(name),
      store:'penny',
      price,
      oldPrice,
      unitLabel:unitFrom(before),
      unitPrice,
      unitPriceLabel:unitLine?unitPriceLabelFrom(unitLine):undefined,
      validFrom:from,
      validTo:to,
      image:imageNear(html,name,url,placeholder('penny',name)),
      sourceUrl:url
    });
  }
  return offers;
}

function parsePennyCoupons(html:string,url:string):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];
  let currentRange:{start:string;end:string}|undefined;
  for(const line of data){
    if(/kuponok érvényessége/i.test(line)){
      currentRange=pennyCouponRange(line)??currentRange;
      continue;
    }
    const m=line.match(/^(.{3,180}?)\s+(\d[\d .]*)\s*Ft\s+helyett\s+(\d[\d .]*)\s*Ft(?:\s+További|$)/i);
    if(!m||!currentRange) continue;
    const name=m[1].trim();
    const oldPrice=number(m[2]);
    const price=number(m[3]);
    if(!price||!oldPrice||price>=oldPrice) continue;
    offers.push({
      id:'penny-'+slug(name),
      name,
      category:categoryFor(name),
      store:'penny',
      price,
      oldPrice,
      unitLabel:unitFrom([name]),
      validFrom:currentRange.start,
      validTo:currentRange.end,
      loyaltyOnly:true,
      conditionText:'PENNY Kártya + digitális kupon',
      image:imageNear(html,name,url,placeholder('penny',name)),
      sourceUrl:url
    });
  }
  return offers;
}

async function scrapePenny(source: RetailSource): Promise<Offer[]> {
  const range=pennyRange();
  const cardUrl='https://www.penny.hu/category/ajanlatok-'+range.key+'-koezoett-penny-kartyaval-olcsobb-termekek?pageSize=100';
  const featuredUrl='https://www.penny.hu/?tab=kiemelt-ajanlataink';
  const couponUrl='https://www.penny.hu/digikuponok';
  const pages=await Promise.allSettled([
    fetchHtml(cardUrl),
    fetchHtml(featuredUrl),
    fetchHtml(couponUrl)
  ]);
  const card=pages[0].status==='fulfilled'?parsePennyCardPage(pages[0].value,cardUrl,range):[];
  const featured=pages[1].status==='fulfilled'?parsePennyFeaturedPage(pages[1].value,featuredUrl,range):[];
  const coupons=pages[2].status==='fulfilled'?parsePennyCoupons(pages[2].value,couponUrl):[];
  return dedupe([...featured,...card,...coupons]).slice(0,220);
}

async function scrapeDeichmann(source: RetailSource): Promise<Offer[]> {
  const url = 'https://www.deichmann.com/hu-hu/c/akcio-477';
  const html = await fetchHtml(url);
  const data = lines(html);
  const offers: Offer[] = [];

  for (let i = 0; i < data.length; i++) {
    const pair = data[i].match(/(\d[\d .]*)\s*Ft\s+(\d[\d .]*)\s*Ft/i);
    if (!pair) continue;
    const price = number(pair[1]);
    const oldPrice = number(pair[2]);
    if (!price || !oldPrice || price >= oldPrice) continue;

    const around = data.slice(Math.max(0, i - 4), Math.min(data.length, i + 7))
      .filter(x => !/Ft|Akció|termék|Rendezés|Szűrés|KÓD:|Online exkluzív|Top termék|XXL/i.test(x))
      .filter(x => x.length >= 2 && x.length <= 100);
    const name = around.slice(-2).join(' ').trim() || around[0];
    if (!name) continue;

    offers.push({
      id: `deichmann-${slug(name)}`,
      name,
      category: 'Divat · Cipő',
      store: 'deichmann',
      price,
      oldPrice,
      unitLabel: '1 pár',
      validFrom: isoToday(),
      validTo: isoToday(),
      validityText: 'Ma ellenőrizve',
      image: imageNear(html, name, url, placeholder('deichmann', name)),
      sourceUrl: url
    });
  }
  return dedupe(offers).slice(0, 100);
}

function urlWithParams(url:string, params:Record<string,string|number>){
  const parsed=new URL(url);
  for(const [key,value] of Object.entries(params)) parsed.searchParams.set(key,String(value));
  return parsed.toString();
}

function absoluteUrl(href: string, base: string) {
  try { return new URL(href, base).toString(); } catch { return undefined; }
}

type AuchanWeeklyPayload = {
  catalog: { id:number; title:string; validFrom:string; validTo:string; cover?:string; sourceUrl:string };
  pageTexts: string[];
};

type AuchanPricePair = { oldPrice:number; price:number; oldUnit?:string; newUnit?:string };

function auchanPricePairs(text:string) {
  const pairs: AuchanPricePair[] = [];
  const re=/-\d{1,2}\s*%\s*([\d\s.\u00a0\u2000-\u200b\u202f]+)\s*Ft(?:\s*\/\s*(10\s*dkg|kg|l|db))?\s*Bizalomkártyával:\s*([\d\s.\u00a0\u2000-\u200b\u202f]+)\s*Ft(?:\s*\/\s*(10\s*dkg|kg|l|db))?/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(text))){
    const oldPrice=number(m[1]);
    const price=number(m[3]);
    if(!price||!oldPrice||price>=oldPrice||price>1_500_000) continue;
    pairs.push({oldPrice,price,oldUnit:m[2]?.replace(/\s+/g,' '),newUnit:m[4]?.replace(/\s+/g,' ')});
  }
  return pairs;
}

function auchanProductCandidates(text:string) {
  const candidates:Array<{name:string;index:number}>=[];
  const re=/\b([A-ZÁÉÍÓÖŐÚÜŰ][A-ZÁÉÍÓÖŐÚÜŰ0-9&+./'’() *-]{3,}?)(?=\s+(?:Ft\/|[a-záéíóöőúüű]|\d))/g;
  let m:RegExpExecArray|null;
  while((m=re.exec(text))){
    const name=m[1].replace(/\s+/g,' ').replace(/[ *.-]+$/g,'').trim();
    if(name.length<4||name.length>150) continue;
    if(/BIZALOM|KEDVEZMÉNY|PROMÓCIÓ|RÉSZLETEK|ÉRVÉNYES|FAGYASZTOTT TERMÉK|TÉNYLEG ENNYI/i.test(name)) continue;
    candidates.push({name,index:m.index});
  }
  return candidates;
}

function parseAuchanWeeklyPage(text:string,pageIndex:number,payload:AuchanWeeklyPayload):Offer[]{
  const codes=[...text.matchAll(/\b(\d{4,6}_(?:SS|MS|MM))\b/g)].map(x=>x[1]);
  const pairs=auchanPricePairs(text);
  if(!codes.length||pairs.length!==codes.length) return [];

  let lastPairEnd=0;
  const pairEndRe=/-\d{1,2}\s*%\s*[\d\s.\u00a0\u2000-\u200b\u202f]+\s*Ft(?:\s*\/\s*(?:10\s*dkg|kg|l|db))?\s*Bizalomkártyával:\s*[\d\s.\u00a0\u2000-\u200b\u202f]+\s*Ft(?:\s*\/\s*(?:10\s*dkg|kg|l|db))?/gi;
  let pm:RegExpExecArray|null;
  while((pm=pairEndRe.exec(text))) lastPairEnd=pm.index+pm[0].length;
  if(!lastPairEnd) return [];

  const suffix=text.slice(lastPairEnd);
  const names=auchanProductCandidates(suffix);
  if(names.length<codes.length) return [];

  return codes.map((code,i)=>{
    const candidate=names[i];
    const next=names[i+1];
    const block=suffix.slice(candidate.index,next?.index??suffix.length);
    const pair=pairs[i];
    const unitLine=block.match(/Bizalom[^:]{0,24}:\s*([\d\s.\u00a0\u2000-\u200b\u202f]+)\s*Ft\s*\/\s*(kg|l|db)/i);
    const unitPrice=unitLine?number(unitLine[1]):undefined;
    const unitPriceLabel=unitLine?'/'+unitLine[2].toLowerCase():pair.newUnit?'/'+pair.newUnit.toLowerCase():undefined;
    const unitLabel=unitFrom([block]);

    return {
      id:`auchan-${code.toLowerCase()}`,
      name:candidate.name,
      category:categoryFor(candidate.name),
      store:'auchan' as const,
      price:pair.price,
      oldPrice:pair.oldPrice,
      unitLabel,
      unitPrice,
      unitPriceLabel,
      priceScope:pair.newUnit?`Ár / ${pair.newUnit}`:undefined,
      validFrom:payload.catalog.validFrom||isoToday(),
      validTo:payload.catalog.validTo||isoToday(),
      loyaltyOnly:true,
      conditionText:'Auchan Bizalomkártyával',
      image:placeholder('auchan',candidate.name),
      sourceUrl:payload.catalog.sourceUrl
    };
  });
}

async function scrapeAuchan(source: RetailSource): Promise<Offer[]> {
  const response=await fetchSourceProxy('auchan-weekly');
  const payload=await response.json() as AuchanWeeklyPayload;
  if(!payload?.catalog||!Array.isArray(payload.pageTexts)) return [];
  const offers=payload.pageTexts.flatMap((text,index)=>parseAuchanWeeklyPage(String(text||''),index,payload));
  return dedupe(offers).slice(0,180);
}

function dedupe(offers: Offer[]) {
  const map = new Map<string, Offer>();
  for (const offer of offers) map.set(offer.id, offer);
  return [...map.values()];
}



function parseAldiUnitPrice(text: string) {
  const m = text.match(/([\d .]+(?:,\d+)?)\s*Ft\s*\/(kg|l|db|darab|csomó|szál|tekercs)/i);
  if (!m) return undefined;
  const value = Number(m[1].replace(/\s/g,'').replace(',','.'));
  return Number.isFinite(value) ? { value, unit:m[2].toLowerCase() } : undefined;
}

function aldiPackPrice(name: string, unitPrice: {value:number;unit:string}) {
  if (/\/\s*kg\b/i.test(name) && unitPrice.unit==='kg') return Math.round(unitPrice.value);
  if (/\/\s*(?:db|darab)\b/i.test(name) && /^(?:db|darab)$/.test(unitPrice.unit)) return Math.round(unitPrice.value);
  if (/\/\s*(?:csomó|szál|tekercs)\b/i.test(name) && ['csomó','szál','tekercs'].includes(unitPrice.unit)) return Math.round(unitPrice.value);

  const quantities=[...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|db|darab)\b/gi)];
  if (quantities.length !== 1) return undefined;
  const qty=Number(quantities[0][1].replace(',','.'));
  const qUnit=quantities[0][2].toLowerCase();
  if (!Number.isFinite(qty)) return undefined;
  if (unitPrice.unit==='kg' && qUnit==='g') return Math.round(unitPrice.value*qty/1000);
  if (unitPrice.unit==='kg' && qUnit==='kg') return Math.round(unitPrice.value*qty);
  if (unitPrice.unit==='l' && qUnit==='ml') return Math.round(unitPrice.value*qty/1000);
  if (unitPrice.unit==='l' && qUnit==='l') return Math.round(unitPrice.value*qty);
  if (/^(?:db|darab)$/.test(unitPrice.unit) && /^(?:db|darab)$/.test(qUnit)) return Math.round(unitPrice.value*qty);
  return undefined;
}

function parseAldiDateRange(text: string) {
  const m=text.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})-tól\s+(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})-ig/i);
  if(!m) return undefined;
  return {
    start:`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,
    end:`${m[4]}-${m[5].padStart(2,'0')}-${m[6].padStart(2,'0')}`
  };
}

async function fetchAldiOffersHtml() {
  const response = await fetch(
    'https://wopluslqeihwlnolfypm.supabase.co/rest/v1/rpc/multi_akciok_aldi_offers_html',
    {
      method: 'POST',
      headers: {
        apikey: SOURCE_PROXY_KEY,
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    }
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error('ALDI akciós forrás-RPC hiba: ' + response.status + ' ' + detail);
  }

  const html = await response.json();
  if (typeof html !== 'string' || !/Cikkszám:/i.test(html)) {
    throw new Error('ALDI akciós forrás üres vagy érvénytelen.');
  }
  return html;
}

async function scrapeAldi(source: RetailSource): Promise<Offer[]> {
  const html = await fetchAldiOffersHtml();
  const data = lines(html);
  const offers: Offer[] = [];
  let current = { start: isoToday(), end: isoToday() };

  for (let i = 0; i < data.length; i++) {
    const range = parseAldiDateRange(data[i]);
    if (range) { current = range; continue; }
    if (!/Cikkszám:/i.test(data[i])) continue;

    const before = data.slice(Math.max(0, i - 8), i);
    const unitPrice = [data[i], ...before].map(parseAldiUnitPrice).find(Boolean);
    if (!unitPrice) continue;

    const name = [...before].reverse().find(x =>
      x.length >= 3 && x.length <= 150 &&
      /(\/kg|\/darab|\/csomag|\/doboz|\/palack|\/üveg|\/tálca|\/vödör|\/pohár|\/szál|\/csokor|\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b)/i.test(x) &&
      !/Cikkszám|Ft\//i.test(x)
    );
    if (!name) continue;

    const price = aldiPackPrice(name, unitPrice);
    if (!price || price < 20 || price > 1_500_000) continue;

    const sku = data[i].match(/Cikkszám:\s*(\d+)/i)?.[1];
    offers.push({
      id: sku ? 'aldi-' + sku : 'aldi-' + slug(name),
      name,
      category: categoryFor(name),
      store: 'aldi',
      price,
      unitLabel: unitFrom([name]),
      unitPrice: Math.round(unitPrice.value * 100) / 100,
      unitPriceLabel: '/' + (unitPrice.unit === 'darab' ? 'db' : unitPrice.unit),
      validFrom: current.start,
      validTo: current.end,
      image: imageNear(html, name, source.url, placeholder('aldi', name)),
      sourceUrl: source.url
    });
  }

  return dedupe(offers).slice(0, 180);
}
function parseMonthDayRange(text: string) {
  const m = text.match(/(\d{1,2})[.\/-](\d{1,2})\.?\s*-\s*(\d{1,2})[.\/-](\d{1,2})/);
  if (!m) return undefined;
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, Number(m[1])-1, Number(m[2]));
  let end = new Date(year, Number(m[3])-1, Number(m[4]));
  if (end.getTime() < start.getTime()) end = new Date(year+1, Number(m[3])-1, Number(m[4]));
  const iso = (d: Date) => d.toISOString().slice(0,10);
  return { start: iso(start), end: iso(end) };
}

function discoverLidlPlusUrl(html: string) {
  const m = html.match(/href=["']([^"']*\/c\/lidl-plus-ajanlataink\/[^"']+)["']/i);
  return m ? absoluteUrl(m[1], 'https://www.lidl.hu') : undefined;
}

function parseLidlPage(html: string, url: string) {
  const $=load(html);
  const offers:Offer[]=[];
  const seen=new Set<string>();

  $('[data-grid-data]').each((_: number, element: any)=>{
    const raw=$(element).attr('data-grid-data');
    if(!raw) return;
    try{
      const data=JSON.parse(raw) as {
        productId?:number|string;
        fullTitle?:string;
        title?:string;
        image?:string;
        canonicalUrl?:string;
        category?:string;
        storeStartDate?:number;
        storeEndDate?:number;
        brand?:{name?:string};
        lidlPlus?:Array<{
          lidlPlusText?:string;
          price?:{
            price?:number;
            oldPrice?:number;
            basePrice?:{text?:string};
            discount?:{deletedPrice?:number}
          }
        }>;
      };
      const plus=Array.isArray(data.lidlPlus)?data.lidlPlus[0]:undefined;
      const price=Math.round(Number(plus?.price?.price||0));
      if(!price||price<20||price>1_500_000) return;
      const name=String(data.fullTitle||data.title||'').trim();
      if(name.length<2||name.length>180) return;
      const productId=String(data.productId||slug(name));
      const id=`lidl-${productId}`;
      if(seen.has(id)) return;
      seen.add(id);

      const oldRaw=Number(plus?.price?.oldPrice??plus?.price?.discount?.deletedPrice??0);
      const oldPrice=Number.isFinite(oldRaw)&&oldRaw>price?Math.round(oldRaw):undefined;
      const baseText=String(plus?.price?.basePrice?.text||'');
      const unitPriceMatch=baseText.match(/1\s*(kg|l|db)\s*=\s*([\d\s.]+)\s*Ft/i);
      const unitPrice=unitPriceMatch?number(unitPriceMatch[2]):undefined;
      const pack=baseText.split(';')[0]?.trim();
      const unitLabel=pack&&/\d/.test(pack)?pack:unitFrom([name,baseText]);
      const canonical=data.canonicalUrl?absoluteUrl(data.canonicalUrl,'https://www.lidl.hu'):url;

      offers.push({
        id,
        name,
        category:categoryFor(name),
        store:'lidl',
        price,
        oldPrice,
        unitLabel,
        unitPrice,
        unitPriceLabel:unitPriceMatch?'/'+unitPriceMatch[1].toLowerCase():undefined,
        validFrom:budapestDateFromEpoch(data.storeStartDate)??isoToday(),
        validTo:budapestDateFromEpoch(data.storeEndDate)??isoToday(),
        loyaltyOnly:true,
        conditionText:String(plus?.lidlPlusText||'Lidl Plus'),
        image:data.image||placeholder('lidl',name),
        sourceUrl:canonical
      });
    }catch{
      // A hibás termékkártya ne állítsa le a többi ajánlat feldolgozását.
    }
  });

  return dedupe(offers).slice(0,180);
}

async function scrapeLidl(source: RetailSource): Promise<Offer[]> {
  const url='https://www.lidl.hu/c/lidl-plus-ajanlataink/a10050097';
  const html=await fetchHtml(url);
  return parseLidlPage(html,url);
}

function parseTescoDate(text: string) {
  const iso = parseIsoDate(text);
  if (iso) return iso;
  const m = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}

async function scrapeTesco(source: RetailSource): Promise<Offer[]> {
  const url = 'https://bevasarlas.tesco.hu/shop/hu-HU/buylists/weekly-offers/weekly-offers';
  const html = await fetchHtml(url);
  const data = lines(html);
  const offers: Offer[] = [];

  for (let i = 0; i < data.length; i++) {
    if (!/Offer valid until|Ajánlat.*érvényes/i.test(data[i])) continue;
    const before = data.slice(Math.max(0,i-10), i+1);
    const after = data.slice(i+1, i+8);
    const priceLine = after.find(x => /^\s*\d[\d .]*\s*Ft\s*$/i.test(x) || /^\s*\d[\d .]*\s*Ft\b/i.test(x));
    if (!priceLine) continue;
    const price = number(priceLine);
    if (!price || price > 1_500_000) continue;

    const oldMatch = data[i].match(/(?:was|korábban|volt)\s*(\d[\d .]*)\s*Ft/i);
    const oldPrice = oldMatch ? number(oldMatch[1]) : undefined;
    const name = [...before].reverse().find(x =>
      x.length >= 3 && x.length <= 150 &&
      !/Offer valid|Ajánlat|Write a review|Rest of category|Special Offer|Clubcard|Super price|kedvezmény|^-?\d+%/i.test(x) &&
      !/\d[\d .]*\s*Ft/i.test(x)
    );
    if (!name) continue;

    const unitLine = after.find(x => /Ft\/(?:kg|litre|l|each|db)/i.test(x));
    const unitPrice = unitLine ? number((unitLine.match(/([\d\s.]+)\s*Ft/i)||[])[1]||'') : undefined;
    const parsedTescoValidTo = parseTescoDate(data[i]);
    const validTo = parsedTescoValidTo ?? isoToday();
    const loyaltyOnly = /Clubcard/i.test(before.join(' ') + ' ' + data[i]);

    offers.push({
      id: `tesco-${slug(name)}`,
      name,
      category: categoryFor(name),
      store: 'tesco',
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
      unitLabel: unitFrom(before),
      unitPrice,
      unitPriceLabel: unitLine ? unitPriceLabelFrom(unitLine.replace('litre','l')) : undefined,
      validFrom: isoToday(),
      validTo,
      validityText: parsedTescoValidTo ? undefined : 'Ma ellenőrizve',
      loyaltyOnly,
      conditionText: loyaltyOnly ? 'Clubcard' : undefined,
      image: imageNear(html, name, url, placeholder('tesco', name)),
      sourceUrl: url
    });
  }
  return dedupe(offers).slice(0,120);
}





async function scrapeRossmann(source:RetailSource):Promise<Offer[]>{
  const html=await fetchHtml(source.url);
  const data=lines(html);
  const offers:Offer[]=[];

  for(let i=0;i<data.length;i++){
    const promo=data[i].match(/^(\d{1,2})%\s+KEDVEZMÉNY\s+(.+)$/i);
    if(!promo) continue;
    const name=promo[2].trim();
    if(name.length<3||name.length>190) continue;

    const after=data.slice(i+1,i+16);
    const oldIndex=after.findIndex(x=>/Ft.*helyett/i.test(x));
    if(oldIndex<0) continue;
    const oldMatch=after[oldIndex].match(/([\d\s.]+)\s*Ft/i);
    if(!oldMatch) continue;
    const oldPrice=number(oldMatch[1]);
    const currentLine=after.slice(oldIndex+1).find(x=>/^\s*[\d\s.]+\s*Ft\s*$/i.test(x));
    if(!currentLine) continue;
    const price=number(currentLine);
    if(!price||!oldPrice||price>=oldPrice) continue;

    const unitLine=after.slice(oldIndex+1).find(x=>/Ft\s*\/(?:l|kg|db|100\s*ml|100\s*g)/i.test(x));
    const unitMatch=unitLine?.match(/([\d\s.]+)\s*Ft\s*\/\s*(l|kg|db|100\s*ml|100\s*g)/i);
    const unitPrice=unitMatch?number(unitMatch[1]):undefined;

    offers.push({
      id:'rossmann-'+slug(name),
      name,
      category:categoryFor(name),
      store:'rossmann',
      price,
      oldPrice,
      unitLabel:unitFrom([name]),
      unitPrice,
      unitPriceLabel:unitLine?unitPriceLabelFrom(unitLine):undefined,
      validFrom:isoToday(),
      validTo:isoToday(),
      validityText:'Ma ellenőrizve',
      priceScope:'Online drogéria ár · bolti elérhetőség eltérhet',
      image:imageNear(html,name,source.url,placeholder('rossmann',name)),
      sourceUrl:source.url
    });
  }
  return dedupe(offers).slice(0,220);
}

function parsePraktikerPage(html:string,url:string):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];

  for(let i=0;i<data.length-2;i++){
    if(!/^\d{6}$/.test(data[i+1])) continue;
    const name=data[i].trim();
    if(name.length<3||name.length>190||/Kosárba|Szállítás|Készleten|Rendezés|termék$/i.test(name)) continue;

    const block=data.slice(i+2,Math.min(data.length,i+14));
    const basketIndex=block.findIndex(x=>/Kosárba/i.test(x));
    const priceArea=(basketIndex>=0?block.slice(0,basketIndex):block).filter(x=>/^[\d.]+\s*Ft\s*\/\s*(darab|m2|m²|csomag|tekercs|l|kg|pár|garnitúra)\b/i.test(x));
    if(!priceArea.length) continue;

    const parsed=priceArea.map(line=>{
      const m=line.match(/^([\d.]+)\s*Ft\s*\/\s*(darab|m2|m²|csomag|tekercs|l|kg|pár|garnitúra)\b/i);
      return m?{value:number(m[1]),unit:m[2].toLowerCase()}:null;
    }).filter((x):x is {value:number;unit:string}=>!!x&&x.value>0&&x.value<=1_500_000);
    if(!parsed.length) continue;

    const sellingUnits=['darab','csomag','tekercs','pár','garnitúra'];
    const primaryCandidates=parsed.filter(x=>sellingUnits.includes(x.unit));
    let primary=primaryCandidates[primaryCandidates.length-1] ?? parsed[parsed.length-1];
    let oldPrice: number|undefined;

    if(primaryCandidates.length>=2){
      const sameUnit=primaryCandidates.filter(x=>x.unit===primary.unit);
      if(sameUnit.length>=2){
        primary=sameUnit[sameUnit.length-1];
        const previous=sameUnit.slice(0,-1).map(x=>x.value).filter(v=>v>primary.value);
        oldPrice=previous.length?Math.max(...previous):undefined;
      }
    }

    const unitEntry=parsed.find(x=>x.unit!==primary.unit) ?? (primary.unit==='m2'||primary.unit==='m²'||primary.unit==='kg'||primary.unit==='l'?primary:undefined);
    const unitLabel=primary.unit==='darab'?'1 db':primary.unit==='m2'||primary.unit==='m²'?'1 m²':'1 '+primary.unit;
    const unitPriceLabel=unitEntry?'/'+(unitEntry.unit==='darab'?'db':unitEntry.unit):undefined;

    offers.push({
      id:'praktiker-'+slug(name),
      name,
      category:categoryFor(name),
      store:'praktiker',
      price:primary.value,
      oldPrice,
      unitLabel,
      unitPrice:unitEntry?.value,
      unitPriceLabel,
      validFrom:isoToday(),
      validTo:isoToday(),
      validityText:'Ma ellenőrizve',
      image:imageNear(html,name,url,placeholder('praktiker',name)),
      sourceUrl:url
    });
  }
  return offers;
}

async function scrapePraktiker(source:RetailSource):Promise<Offer[]>{
  const firstUrl=urlWithParams(source.url,{page:1,perPage:100});
  const firstHtml=await fetchHtml(firstUrl);
  const countMatch=lines(firstHtml).find(x=>/^\d+\s+termék$/i.test(x))?.match(/^(\d+)/);
  const totalCount=countMatch?Number(countMatch[1]):100;
  const pageCount=Math.max(1,Math.min(6,Math.ceil(totalCount/100)));
  const urls=[
    ...Array.from({length:pageCount},(_,i)=>urlWithParams(source.url,{page:i+1,perPage:100})),
    urlWithParams('https://www.praktiker.hu/kiarusitas/bfd',{page:1,perPage:100})
  ];
  const pages=await Promise.allSettled(urls.map(async url=>({
    url,
    html:url===firstUrl?firstHtml:await fetchHtml(url)
  })));
  const offers=pages.flatMap(p=>p.status==='fulfilled'?parsePraktikerPage(p.value.html,p.value.url):[]);
  return dedupe(offers).slice(0,650);
}

function obiUnitPriceToPack(name:string,value:number,unit:string){
  const normalized=unit.toLocaleLowerCase('hu').replace('liter','l').replace('darab','db').replace('kg','kg');
  if(normalized==='db') return Math.round(value);
  if(normalized==='m²'||normalized==='m2') return Math.round(value);
  const quantities=[...name.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|db|darab)\b/gi)];
  if(quantities.length!==1) return Math.round(value);
  const qty=Number(quantities[0][1].replace(',','.'));
  const qUnit=quantities[0][2].toLowerCase();
  if(!Number.isFinite(qty)) return Math.round(value);
  if(normalized==='kg'&&qUnit==='kg') return Math.round(value*qty);
  if(normalized==='kg'&&qUnit==='g') return Math.round(value*qty/1000);
  if(normalized==='l'&&qUnit==='l') return Math.round(value*qty);
  if(normalized==='l'&&qUnit==='ml') return Math.round(value*qty/1000);
  if(normalized==='db'&&/^(?:db|darab)$/.test(qUnit)) return Math.round(value*qty);
  return Math.round(value);
}

function parseObiPage(html:string,url:string):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];

  for(const line of data){
    if(!/Összehasonlítás/i.test(line)||!/Ft\s*\//i.test(line)) continue;
    const priceMatch=line.match(/([\d\s.]+)\s*Ft\s*\/\s*(Liter|Darab|KG|m²|m2|Eladási egység)/i);
    if(!priceMatch) continue;
    const unitPrice=number(priceMatch[1]);
    if(!unitPrice||unitPrice>1_500_000) continue;

    let name=line
      .replace(/^.*?Összehasonlítás\s*/i,'')
      .replace(/([\d\s.]+)\s*Ft\s*\/.*$/i,'')
      .replace(/\s+\d(?:[.,]\d)?\s+\d(?:[.,]\d)?\s*\([^)]*\).*$/,'')
      .replace(/\s+\([^)]*\)\s*$/,'')
      .trim();
    if(name.length<3||name.length>190) continue;

    const unit=priceMatch[2];
    const price=obiUnitPriceToPack(name,unitPrice,unit);
    offers.push({
      id:'obi-'+slug(name),
      name,
      category:categoryFor(name),
      store:'obi',
      price,
      unitLabel:/m²|m2/i.test(unit)?'1 m²':unitFrom([name]),
      unitPrice:Math.round(unitPrice),
      unitPriceLabel:'/'+(unit.toLowerCase()==='liter'?'l':unit.toLowerCase()==='darab'?'db':unit.toLowerCase()),
      validFrom:isoToday(),
      validTo:isoToday(),
      validityText:'Ma ellenőrizve',
      priceScope:'Online/áruházi ár eltérhet',
      image:imageNear(html,name,url,placeholder('obi',name)),
      sourceUrl:url
    });
  }
  return offers;
}

async function scrapeObi(source:RetailSource):Promise<Offer[]>{
  const firstUrl=urlWithParams(source.url,{page:1});
  const firstHtml=await fetchHtml(firstUrl);
  const pageLine=lines(firstHtml).find(x=>/Oldal\s+1\s*\/\s*\d+/i.test(x));
  const pageCount=Math.max(1,Math.min(10,Number(pageLine?.match(/\/\s*(\d+)/)?.[1]||1)));
  const urls=Array.from({length:pageCount},(_,i)=>urlWithParams(source.url,{page:i+1}));
  const pages=await Promise.allSettled(urls.map(async url=>({
    url,
    html:url===firstUrl?firstHtml:await fetchHtml(url)
  })));
  const offers=pages.flatMap(p=>p.status==='fulfilled'?parseObiPage(p.value.html,p.value.url):[]);
  return dedupe(offers).slice(0,750);
}

function dateFromMonthDay(month: number, day: number) {
  const now = new Date();
  let d = new Date(now.getFullYear(), month - 1, day);
  if (d.getTime() < now.getTime() - 45 * 24 * 3600 * 1000) d = new Date(now.getFullYear() + 1, month - 1, day);
  return d.toISOString().slice(0,10);
}

async function scrapeIkea(source: RetailSource): Promise<Offer[]> {
  const url = source.url;
  const html = await fetchHtml(url);
  const data = lines(html);
  const offers: Offer[] = [];

  for (let i = 0; i < data.length; i++) {
    const oldMatch = data[i].match(/([\d .]+)\s*Ft.*Előző ár/i);
    if (!oldMatch) continue;

    const oldPrice = number(oldMatch[1]);
    const after = data.slice(i + 1, i + 6);
    const currentLine = after.find(x => /([\d .]+)\s*Ft.*\bÁr\b/i.test(x));
    if (!currentLine) continue;
    const currentMatch = currentLine.match(/([\d .]+)\s*Ft/i);
    if (!currentMatch) continue;
    const price = number(currentMatch[1]);
    if (!price || !oldPrice || price >= oldPrice) continue;

    const before = data.slice(Math.max(0, i - 7), i);
    const name = [...before].reverse().find(x =>
      x.length >= 3 && x.length <= 170 &&
      !/Vásár|Összehasonlítás|kedvezmény|megtakarítás|Eredménylista|Rendezés|szűrés|tétel/i.test(x) &&
      !/\bFt\b/i.test(x)
    );
    if (!name) continue;

    const validLine = after.find(x => /Az ár .* után/i.test(x));
    const start = validLine ? parseIsoDate(validLine) ?? isoToday() : isoToday();

    offers.push({
      id: `ikea-${slug(name)}`,
      name,
      category: categoryFor(name),
      store: 'ikea',
      price,
      oldPrice,
      unitLabel: unitFrom([name]),
      validFrom: start,
      validTo: isoToday(),
      validityText: 'Készlet erejéig · ma ellenőrizve',
      image: imageNear(html, name, url, placeholder('ikea', name)),
      sourceUrl: url
    });
  }

  return dedupe(offers).slice(0,160);
}

function parseJyskPage(html:string,url:string):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];

  for(let i=0;i<data.length;i++){
    const current=data[i].match(/^([\d .]+)\s*Ft\s*\/(db|szett|pár|csomag|garnitúra|cs)?/i);
    if(!current) continue;
    const next=data[i+1]?.match(/^([\d .]+)\s*Ft\s*\/(db|szett|pár|csomag|garnitúra|cs)?/i);
    if(!next) continue;

    const price=number(current[1]);
    const oldPrice=number(next[1]);
    if(!price||!oldPrice||price>=oldPrice) continue;

    const before=data.slice(Math.max(0,i-5),i);
    const rawName=[...before].reverse().find(x=>
      x.length>=4&&x.length<=180 &&
      !/kedvezmény|ajánlat|készlet erejéig|További opciók|plus|basic|gold|^-?\d+%/i.test(x) &&
      !/\bFt\b/i.test(x)
    );
    if(!rawName) continue;
    const name=rawName.replace(/^(?:plus|basic|gold)\s+/i,'').trim();

    offers.push({
      id:'jysk-'+slug(name),
      name,
      category:categoryFor(name),
      store:'jysk',
      price,
      oldPrice,
      unitLabel:current[2]?'1 '+current[2]:'1 db',
      validFrom:isoToday(),
      validTo:isoToday(),
      validityText:'Ma ellenőrizve',
      image:imageNear(html,name,url,placeholder('jysk',name)),
      sourceUrl:url
    });
  }
  return offers;
}

function discoverJyskCampaignLinks(html:string,base:string){
  const found=new Set<string>();
  const re=/href=["']([^"']+)["']/gi;
  let match:RegExpExecArray|null;
  while((match=re.exec(html))){
    const href=match[1];
    if(!/(?:\/dcp-\d+|\/extra-[^"'?#]+|\/[^"'?#]*kedvezmeny[^"'?#]*)/i.test(href)) continue;
    const url=absoluteUrl(href,base);
    if(url&&url!==base) found.add(url);
    if(found.size>=4) break;
  }
  return [...found];
}

async function scrapeJysk(source: RetailSource): Promise<Offer[]> {
  const home=await fetchHtml(source.url);
  const links=discoverJyskCampaignLinks(home,source.url);
  const pages=await Promise.allSettled(links.map(async url=>({url,html:await fetchHtml(url)})));
  const offers=[
    ...parseJyskPage(home,source.url),
    ...pages.flatMap(p=>p.status==='fulfilled'?parseJyskPage(p.value.html,p.value.url):[])
  ];
  return dedupe(offers).slice(0,180);
}

async function scrapeDecathlon(source: RetailSource): Promise<Offer[]> {
  const proxy = await fetchSourceProxy('decathlon-sale');
  const html = await proxy.text();
  const $ = load(html);
  const offers: Offer[] = [];

  $('article.product-card').each((_: number, element: any) => {
    const card = $(element);
    const titleLink = card.find('.product-card-details__item__title a').first();
    const name = titleLink.text().replace(/\s+/g, ' ').trim();
    if (name.length < 4 || name.length > 220) return;

    const price = number(card.find('.vp-price-amount--sale').first().text());
    if (!price || price < 100 || price > 2_000_000) return;

    const oldPriceRaw = number(card.find('.vp-price-barred-amount').first().text());
    const sticker = card.find('.product-card__sticker').text().replace(/\s+/g, ' ').trim();
    const cardText = card.text().replace(/\s+/g, ' ').trim();
    const href = titleLink.attr('href');
    const productId = href?.match(/R-p-(\d+)/i)?.[1] ?? href?.match(/[?&]mc=(\d+)/i)?.[1];
    const sourceUrl = href ? absoluteUrl(href, 'https://www.decathlon.hu') : source.url;
    const rawImage = card.find('.product-card-image__img').first().attr('src');
    const image = rawImage ? absoluteUrl(rawImage, 'https://www.decathlon.hu') : undefined;

    const md = sticker.match(/(\d{1,2})[.](\d{1,2})-ig/i);
    const validTo = md ? dateFromMonthDay(Number(md[1]), Number(md[2])) : isoToday();
    const loyaltyOnly = /Hűségkártyás ajánlat/i.test(sticker + ' ' + cardText);
    const unitMatch = cardText.match(/([\d\s.]+(?:,\d+)?)\s*Ft\s*\/\s*(db|kg|l)\b/i);
    const unitPrice = unitMatch
      ? Number(unitMatch[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
      : undefined;

    offers.push({
      id: productId ? 'decathlon-' + productId : 'decathlon-' + slug(name),
      name,
      category: categoryFor(name),
      store: 'decathlon',
      price,
      oldPrice: oldPriceRaw > price ? oldPriceRaw : undefined,
      unitLabel: '1 db',
      unitPrice: Number.isFinite(unitPrice) ? Math.round((unitPrice as number) * 100) / 100 : undefined,
      unitPriceLabel: unitMatch ? '/' + unitMatch[2].toLowerCase() : undefined,
      validFrom: isoToday(),
      validTo,
      validityText: md ? undefined : 'Online leárazás · ma ellenőrizve',
      loyaltyOnly,
      conditionText: loyaltyOnly ? 'Hűségkártyás ajánlat' : undefined,
      priceScope: 'Decathlon online ár',
      image: image ?? placeholder('decathlon', name),
      sourceUrl
    });
  });

  return dedupe(offers).slice(0, 80);
}
function sparMoneyNumber(value:string){
  const n=Number(value.replace(/\s/g,'').replace(/\./g,'').replace(',','.'));
  return Number.isFinite(n)?n:undefined;
}

function sparPackPrice(rate:number,rateUnit:string,qty:number,qtyUnit:string){
  const ru=rateUnit.toLowerCase();
  const qu=qtyUnit.toLowerCase();
  if(ru==='kg'&&qu==='g') return Math.round(rate*qty/1000);
  if(ru==='kg'&&qu==='kg') return Math.round(rate*qty);
  if(ru==='l'&&qu==='ml') return Math.round(rate*qty/1000);
  if(ru==='l'&&qu==='l') return Math.round(rate*qty);
  if(ru==='db'&&qu==='db') return Math.round(rate*qty);
  return undefined;
}

async function scrapeSpar(source:RetailSource):Promise<Offer[]>{
  const proxy=await fetchSourceProxy('spar');
  const html=await proxy.text();
  const $=load(html);
  const pageText=$('body').text().replace(/\s+/g,' ');
  const range=parseMonthDayRange(pageText);
  const offers:Offer[]=[];

  $('.contentslider__slide').each((_: number, element: any)=>{
    const card=$(element);
    const name=card.find('.contentslider__slide-title').first().text().replace(/\s+/g,' ').trim();
    if(name.length<3||name.length>170) return;

    const detail=card.find('.contentslider__slide-text').text().replace(/\s+/g,' ').trim();
    const quantity=detail.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|db)\b/i);
    if(!quantity) return;
    const qty=Number(quantity[1].replace(',','.'));
    const qtyUnit=quantity[2].toLowerCase();
    if(!Number.isFinite(qty)||qty<=0) return;

    const rates:Array<{rate:number;unit:string}>=[];
    const rateRe=/\(([\d\s.]+(?:,\d+)?)\s*Ft\/1\s*(kg|l|db)\)/gi;
    let rm:RegExpExecArray|null;
    while((rm=rateRe.exec(detail))){
      const rate=sparMoneyNumber(rm[1]);
      if(rate) rates.push({rate,unit:rm[2].toLowerCase()});
    }
    if(!rates.length) return;

    const condition=detail.match(/(\d+)\s*db[-\s]*(tól|tol|esetén|eseten)/i);
    const regular=rates[0];
    const promo=condition&&rates.length>1?rates[rates.length-1]:undefined;
    const chosen=promo??regular;
    const price=sparPackPrice(chosen.rate,chosen.unit,qty,qtyUnit);
    if(!price||price<20||price>1_500_000) return;

    const regularPack=sparPackPrice(regular.rate,regular.unit,qty,qtyUnit);
    const minQuantity=condition?Number(condition[1]):undefined;
    const hasMulti=!!(promo&&minQuantity&&regularPack&&regularPack>price);
    const rawImage=card.find('img.contentslider-slide__image').first().attr('src');
    const image=rawImage?absoluteUrl(rawImage,source.url):undefined;

    offers.push({
      id:'spar-'+slug(name),
      name,
      category:categoryFor(name),
      store:'spar',
      price,
      oldPrice:hasMulti?regularPack:undefined,
      unitLabel:quantity[1].replace('.',',')+' '+qtyUnit,
      unitPrice:Math.round(chosen.rate),
      unitPriceLabel:'/'+chosen.unit,
      validFrom:range?.start??isoToday(),
      validTo:range?.end??isoToday(),
      validityText:range?undefined:'Ma ellenőrizve',
      conditionText:hasMulti?(condition![2].toLowerCase().startsWith('t')?minQuantity+' db-tól':minQuantity+' db esetén'):undefined,
      minQuantity:hasMulti?minQuantity:undefined,
      image:image??placeholder('spar',name),
      sourceUrl:source.url
    });
  });

  return dedupe(offers).slice(0,180);
}

const pharmacyMonths:Record<string,number>={
  januar:1,februar:2,marcius:3,aprilis:4,majus:5,junius:6,julius:7,augusztus:8,
  szeptember:9,oktober:10,november:11,december:12
};

function asciiHu(value:string){
  return value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function pharmacyDateRange(text:string){
  const normalized=asciiHu(text);
  const yearMatch=normalized.match(/\b(20\d{2})\b/);
  const now=new Date();
  const year=yearMatch?Number(yearMatch[1]):now.getFullYear();

  const full=normalized.match(/(?:20\d{2}[. ]+)?([a-z]+)\s+(\d{1,2})\s*[-–]\s*(?:(?:20\d{2})[. ]+)?(?:([a-z]+)\s+)?(\d{1,2})/i);
  if(!full) return undefined;
  const startMonth=pharmacyMonths[full[1]];
  const endMonth=pharmacyMonths[full[3]||full[1]];
  if(!startMonth||!endMonth) return undefined;
  const start=year+'-'+String(startMonth).padStart(2,'0')+'-'+String(Number(full[2])).padStart(2,'0');
  let endYear=year;
  if(endMonth<startMonth) endYear++;
  const end=endYear+'-'+String(endMonth).padStart(2,'0')+'-'+String(Number(full[4])).padStart(2,'0');
  return {start,end};
}

function parsePharmacyOfferLine(line:string,store:'gyongy'|'alma'|'kamilla-mezotur',url:string,defaultRange?:{start:string;end:string}):Offer|null{
  if(!/Akciós ár/i.test(line)||!/Korábbi ár/i.test(line)) return null;
  const priceMatch=line.match(/Akciós ár[:\s]*([\d\s.]+)\s*Ft/i);
  const oldMatch=line.match(/Korábbi ár[:\s]*([\d\s.]+)\s*Ft/i);
  if(!priceMatch||!oldMatch) return null;
  const price=number(priceMatch[1]);
  const oldPrice=number(oldMatch[1]);
  if(!price||!oldPrice||price>=oldPrice||price>500_000) return null;

  let name=line.split(/Akciós ár/i)[0].trim();
  name=name.replace(/^[-–%\s]+/,'').replace(/^(?:Kiemelt termék|Minden akciós termék)\s*/i,'').trim();
  if(name.length<3||name.length>220) return null;

  const unitMatch=line.match(/(?:Akciós\s+)?(?:Egységár|egységár)[:\s]*([\d\s.,]+)\s*Ft\s*\/?\s*(ml|g|db|kg|l)\b/i);
  const unitPrice=unitMatch?Number(unitMatch[1].replace(/\s/g,'').replace('.','').replace(',','.')):undefined;
  const range=pharmacyDateRange(line)??defaultRange;
  const isPrescription=/\b(?:vényköteles|vényre|RX)\b/i.test(line)&&!/\bVN\b/i.test(line);
  if(isPrescription) return null;

  return {
    id:store+'-'+slug(name),
    name,
    category:'Gyógyszertár',
    store,
    price,
    oldPrice,
    unitLabel:unitFrom([name]),
    unitPrice:Number.isFinite(unitPrice)?Math.round((unitPrice as number)*10)/10:undefined,
    unitPriceLabel:unitMatch?'/'+unitMatch[2].toLowerCase():undefined,
    validFrom:range?.start??isoToday(),
    validTo:range?.end??isoToday(),
    validityText:range?undefined:'Ma ellenőrizve',
    priceScope:store==='kamilla-mezotur'?'Kamilla Patika · Mezőtúr':store==='gyongy'?'Résztvevő Gyöngy Patikák · helyi ár eltérhet':'Újvárosi Gyógyszertár · Mezőtúr',
    conditionText:/\bVN\b/i.test(line)?'Vény nélkül kapható':undefined,
    image:imageNear(line,name,url,placeholder(store,name)),
    sourceUrl:url
  };
}

function parsePharmacyPage(html:string,store:'gyongy'|'alma'|'kamilla-mezotur',url:string):Offer[]{
  const data=lines(html);
  const offers:Offer[]=[];
  let currentRange:{start:string;end:string}|undefined;

  for(const line of data){
    const foundRange=pharmacyDateRange(line);
    if(foundRange&&/akció|október|szeptember|november|december/i.test(line)) currentRange=foundRange;
    const offer=parsePharmacyOfferLine(line,store,url,currentRange);
    if(offer) offers.push(offer);
  }

  return dedupe(offers);
}

async function scrapeGyongy(source:RetailSource):Promise<Offer[]>{
  const html=await fetchHtml(source.url);
  return parsePharmacyPage(html,'gyongy',source.url).slice(0,220);
}

async function scrapeAlma(source:RetailSource):Promise<Offer[]>{
  const html=await fetchHtml(source.url);
  return parsePharmacyPage(html,'alma',source.url).slice(0,220);
}

async function scrapeKamillaMezotur(source:RetailSource):Promise<Offer[]>{
  const html=await fetchHtml(source.url);
  return parsePharmacyPage(html,'kamilla-mezotur',source.url).slice(0,220);
}

function parseEuronicsValidity(text:string){
  const m=text.match(/Az ajánlat csak\s+(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})[.]?\s+és\s+(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})[.]?\s+között/i);
  if(!m) return undefined;
  return {
    start:m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'),
    end:m[4]+'-'+m[5].padStart(2,'0')+'-'+m[6].padStart(2,'0')
  };
}

async function scrapeEuronics(source:RetailSource):Promise<Offer[]>{
  const html=await fetchHtml(source.url);
  const data=lines(html);
  const joined=data.join(' ');
  const range=parseEuronicsValidity(joined);
  const offers:Offer[]=[];

  for(let i=0;i<data.length;i++){
    const line=data[i];
    if(/^\s*-\s*[\d\s.]+\s*Ft/i.test(line)) continue;

    const priceMatches=[...line.matchAll(/([\d][\d\s.]*)\s*Ft/gi)];
    let name='';
    let prices:number[]=[];

    if(priceMatches.length){
      prices=priceMatches.map(m=>number(m[1])).filter(n=>n>=100&&n<=2_000_000);
      const firstIndex=priceMatches[0]?.index ?? 0;
      const prefix=line.slice(0,firstIndex).replace(/^Termék adatlap\s*/i,'').trim();
      if(prefix.length>=4&&!/Image:|Online díjmentes|THM|kedvezmény|ajánlat/i.test(prefix)) name=prefix;
      if(!name){
        name=[...data.slice(Math.max(0,i-5),i)].reverse().find(x=>
          x.length>=4&&x.length<=190 &&
          !/Image:|Termék adatlap|THM|kedvezmény|ajánlat|szállítás|^-?[\d\s.]+\s*Ft/i.test(x)
        )||'';
      }
    } else {
      const next=data[i+1]||'';
      if(/^\s*-\s*/.test(next)) continue;
      const nextPrices=[...next.matchAll(/([\d][\d\s.]*)\s*Ft/gi)];
      if(nextPrices.length&&line.length>=4&&line.length<=190&&!/Image:|Termék adatlap|THM|kedvezmény|ajánlat/i.test(line)){
        name=line;
        prices=nextPrices.map(m=>number(m[1])).filter(n=>n>=100&&n<=2_000_000);
      }
    }

    if(!name||!prices.length) continue;
    const price=prices[0];
    const oldPrice=prices.find((p,index)=>index>0&&p>price);
    if(!price) continue;

    offers.push({
      id:'euronics-'+slug(name),
      name,
      category:categoryFor(name),
      store:'euronics',
      price,
      oldPrice,
      unitLabel:'1 db',
      validFrom:range?.start??isoToday(),
      validTo:range?.end??isoToday(),
      validityText:range?undefined:'Ma ellenőrizve',
      priceScope:'Online ajánlat · bolti ár eltérhet',
      image:imageNear(html,name,source.url,placeholder('euronics',name)),
      sourceUrl:source.url
    });
  }
  return dedupe(offers).slice(0,180);
}

export async function scrapeSpecialRetailer(source: RetailSource): Promise<Offer[] | null> {
  if (source.id === 'kamilla-mezotur') return scrapeKamillaMezotur(source);
  if (source.id === 'gyongy') return scrapeGyongy(source);
  if (source.id === 'alma') return scrapeAlma(source);
  if (source.id === 'spar') return scrapeSpar(source);
  if (source.id === 'aldi') return scrapeAldi(source);
  if (source.id === 'lidl') return scrapeLidl(source);
  if (source.id === 'penny') return scrapePenny(source);
  if (source.id === 'tesco') return scrapeTesco(source);
  if (source.id === 'euronics') return scrapeEuronics(source);
  if (source.id === 'rossmann') return scrapeRossmann(source);
  if (source.id === 'praktiker') return scrapePraktiker(source);
  if (source.id === 'obi') return scrapeObi(source);
  if (source.id === 'ikea') return scrapeIkea(source);
  if (source.id === 'decathlon') return scrapeDecathlon(source);
  if (source.id === 'deichmann') return scrapeDeichmann(source);
  if (source.id === 'jysk') return scrapeJysk(source);
  if (source.id === 'auchan') return scrapeAuchan(source);
  return null;
}
