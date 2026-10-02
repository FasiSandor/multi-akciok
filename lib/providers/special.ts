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

function absoluteUrl(href: string, base: string) {
  try { return new URL(href, base).toString(); } catch { return undefined; }
}

function discoverAuchanLinks(html: string) {
  const found = new Set<string>();
  const re = /href=["']([^"']*\/shop\/list\/[^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const url = absoluteUrl(match[1], 'https://auchan.hu');
    if (url) found.add(url);
    if (found.size >= 3) break;
  }
  return [...found];
}

function parseAuchanPage(html: string, url: string) {
  const data = lines(html);
  const offers: Offer[] = [];
  for (let i = 0; i < data.length; i++) {
    if (!/^Termék:/i.test(data[i])) continue;
    const name = data[i].replace(/^Termék:\s*/i, '').trim();
    if (!name) continue;
    const after = data.slice(i + 1, i + 12);
    const priceLine = after.find(x => /^Ár\s+\d|\bÁr\s+\d/i.test(x));
    if (!priceLine) continue;
    const price = number(priceLine);
    if (!price || price > 1_500_000) continue;
    const oldLine = after.find(x => /Eredeti ár/i.test(x));
    const oldPrice = oldLine ? number(oldLine) : undefined;
    const unitLine = after.find(x => /Egységár/i.test(x));
    const unitMatch = unitLine?.match(/([\d\s.]+)\s*Ft\s*\/\s*(kg|l|lt|db|darab|m2|m²|liter)/i);
    const unitPrice = unitMatch ? number(unitMatch[1]) : undefined;

    offers.push({
      id: `auchan-${slug(name)}`,
      name,
      category: categoryFor(name),
      store: 'auchan',
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
      unitLabel: unitFrom(after),
      unitPrice,
      unitPriceLabel: unitLine ? unitPriceLabelFrom(unitLine) : undefined,
      validFrom: isoToday(),
      validTo: isoToday(),
      validityText: 'Ma ellenőrizve',
      image: imageNear(html, name, url, placeholder('auchan', name)),
      sourceUrl: url
    });
  }
  return offers;
}

async function scrapeAuchan(source: RetailSource): Promise<Offer[]> {
  const home = await fetchHtml(source.url);
  const links = discoverAuchanLinks(home);
  if (!links.length) return [];
  const pages = await Promise.all(links.map(async url => ({ url, html: await fetchHtml(url) })));
  return dedupe(pages.flatMap(x => parseAuchanPage(x.html, x.url))).slice(0, 120);
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

async function scrapeAldi(source: RetailSource): Promise<Offer[]> {
  const html=await fetchHtml(source.url);
  const data=lines(html);
  const offers:Offer[]=[];
  let current={start:isoToday(),end:isoFuture(7)};

  for(let i=0;i<data.length;i++){
    const range=parseAldiDateRange(data[i]);
    if(range){ current=range; continue; }
    if(!/Cikkszám:/i.test(data[i])) continue;
    const unitPrice=parseAldiUnitPrice(data[i]);
    if(!unitPrice) continue;

    const before=data.slice(Math.max(0,i-4),i);
    const name=[...before].reverse().find(x=>
      x.length>=3 && x.length<=150 &&
      /(\/kg|\/darab|\/csomag|\/doboz|\/palack|\/üveg|\/tálca|\/vödör|\/pohár|\/szál|\/csokor|\b\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b)/i.test(x) &&
      !/Cikkszám|Ft\//i.test(x)
    );
    if(!name) continue;
    const price=aldiPackPrice(name,unitPrice);
    if(!price || price<30 || price>1_500_000) continue;

    offers.push({
      id:`aldi-${slug(name)}`,
      name,
      category:categoryFor(name),
      store:'aldi',
      price,
      unitLabel:unitFrom([name]),
      unitPrice:Math.round(unitPrice.value),
      unitPriceLabel:'/'+(unitPrice.unit==='darab'?'db':unitPrice.unit),
      validFrom:current.start,
      validTo:current.end,
      image:imageNear(html,name,source.url,placeholder('aldi',name)),
      sourceUrl:source.url
    });
  }
  return dedupe(offers).slice(0,160);
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
  const data = lines(html);
  const offers: Offer[] = [];
  for (let i = 0; i < data.length; i++) {
    if (!/Lidl Plus-szal/i.test(data[i])) continue;
    const before = data.slice(Math.max(0,i-9), i);
    const after = data.slice(i+1, i+10);
    const oldLine = [...before].reverse().find(x => /\d[\d .]*\s*Ft/i.test(x));
    const priceLine = after.find(x => /\d[\d .]*\s*Ft/i.test(x));
    if (!priceLine) continue;
    const price = number(priceLine);
    const oldPrice = oldLine ? number(oldLine) : undefined;
    if (!price || price > 1_500_000) continue;

    const name = [...before].reverse().find(x =>
      x.length >= 2 && x.length <= 120 &&
      !/Ft|Rendered:|Ajánlat|Lidl Plus|Image:|kedvezmény|^-?\d+%/i.test(x) &&
      !/^[A-ZÁÉÍÓÖŐÚÜŰ0-9 &'’.-]{2,28}$/.test(x)
    ) ?? [...before].reverse().find(x => x.length >= 2 && x.length <= 120 && !/Ft|Rendered:|Ajánlat|Image:/i.test(x));
    if (!name) continue;

    const rangeLine = after.find(x => /Ajánlat érvényes:/i.test(x)) ?? before.find(x => /Ajánlat érvényes:/i.test(x));
    const range = rangeLine ? parseMonthDayRange(rangeLine) : undefined;
    const unitPriceLine = after.find(x => /1\s*(?:kg|l|db)\s*=\s*\d[\d .]*\s*Ft/i.test(x));
    const unitPrice = unitPriceLine ? number(unitPriceLine.split('=')[1] ?? '') : undefined;

    offers.push({
      id: `lidl-${slug(name)}`,
      name,
      category: categoryFor(name),
      store: 'lidl',
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
      unitLabel: unitFrom(after),
      unitPrice,
      unitPriceLabel: unitPriceLine ? unitPriceLabelFrom(unitPriceLine) : undefined,
      validFrom: range?.start ?? isoToday(),
      validTo: range?.end ?? isoToday(),
      validityText: range ? undefined : 'Ma ellenőrizve',
      loyaltyOnly: true,
      conditionText: 'Lidl Plus',
      image: imageNear(html, name, url, placeholder('lidl', name)),
      sourceUrl: url
    });
  }
  return dedupe(offers).slice(0,120);
}

async function scrapeLidl(source: RetailSource): Promise<Offer[]> {
  const home = await fetchHtml(source.url);
  const url = discoverLidlPlusUrl(home) ?? 'https://www.lidl.hu/c/lidl-plus-ajanlataink/a10050097';
  const html = url === source.url ? home : await fetchHtml(url);
  return parseLidlPage(html, url);
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
  const urls=[source.url,'https://www.praktiker.hu/kiarusitas/bfd'];
  const pages=await Promise.allSettled(urls.map(async url=>({url,html:await fetchHtml(url)})));
  const offers=pages.flatMap(p=>p.status==='fulfilled'?parsePraktikerPage(p.value.html,p.value.url):[]);
  return dedupe(offers).slice(0,220);
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

async function scrapeObi(source:RetailSource):Promise<Offer[]>{
  const html=await fetchHtml(source.url);
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
      image:imageNear(html,name,source.url,placeholder('obi',name)),
      sourceUrl:source.url
    });
  }
  return dedupe(offers).slice(0,180);
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
  const html = await fetchHtml(source.url);
  const data = lines(html);
  const offers: Offer[] = [];

  for (let i = 0; i < data.length; i++) {
    const line = data[i];
    const priceMatch = line.match(/Jelenlegi ár\s*([\d\s.]+)\s*Ft\s*Korábbi ár\s*([\d\s.]+)\s*Ft/i);
    if (!priceMatch) continue;

    const price = number(priceMatch[1]);
    const oldPrice = number(priceMatch[2]);
    if (!price || !oldPrice || price >= oldPrice) continue;

    const before = data.slice(Math.max(0, i - 10), i);
    const name = [...before].reverse().find(x =>
      x.length >= 4 && x.length <= 180 &&
      !/^\(?\d+[.,]?\d*\)?$/i.test(x) &&
      !/szavazat|színben|Leárazás|Kiszállítás|Online leárazás|kedvezmény|Szűrők|termék$/i.test(x)
    );
    if (!name) continue;

    const validity = [...before].reverse().find(x => /Online leárazás\s+\d{1,2}[.]\d{1,2}-ig/i.test(x));
    const md = validity?.match(/(\d{1,2})[.](\d{1,2})-ig/i);
    const validTo = md ? dateFromMonthDay(Number(md[1]), Number(md[2])) : isoToday();
    const loyaltyOnly = /Hűségkártyás ajánlat/i.test(before.join(' '));

    offers.push({
      id: `decathlon-${slug(name)}`,
      name,
      category: categoryFor(name),
      store: 'decathlon',
      price,
      oldPrice,
      unitLabel: unitFrom([name]),
      validFrom: isoToday(),
      validTo,
      validityText: md ? undefined : 'Ma ellenőrizve',
      loyaltyOnly,
      conditionText: loyaltyOnly ? 'Hűségkártyás ajánlat' : undefined,
      image: imageNear(html, name, source.url, placeholder('decathlon', name)),
      sourceUrl: source.url
    });
  }

  return dedupe(offers).slice(0,180);
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
  const html=await fetchHtml(source.url);
  const data=lines(html);
  const header=data.find(x=>/Aktuális ajánlataink/i.test(x));
  const range=header?parseMonthDayRange(header):undefined;
  const offers:Offer[]=[];

  for(let i=0;i<data.length;i++){
    const name=data[i].trim();
    if(name.length<3||name.length>170) continue;
    if(/Aktuális ajánlataink|Lapozd át|Sárga árcímkés|SPAR márkás|MySPAR|kupon|kedvezmény|Keresd őket|Ajánlatunk|Image/i.test(name)) continue;
    if(/^\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|db)(?:\/doboz)?$/i.test(name)) continue;

    const after=data.slice(i+1,i+14);
    const quantityText=[name,...after.slice(0,6)].join(' ');
    const q=quantityText.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i) ||
      quantityText.match(/(\d+)\s*db(?:\/doboz)?\b/i);
    if(!q) continue;

    const qty=Number(q[1].replace(',','.'));
    const qtyUnit=q[2].toLowerCase();
    if(!Number.isFinite(qty)||qty<=0) continue;

    const rateRows=after.map((line,index)=>{
      const m=line.match(/\(([\d\s.]+(?:,\d+)?)\s*Ft\/1\s*(kg|l|db)\)/i);
      if(!m) return null;
      const rate=sparMoneyNumber(m[1]);
      return rate?{index,rate,unit:m[2].toLowerCase(),line}:null;
    }).filter((x):x is {index:number;rate:number;unit:string;line:string}=>!!x);

    if(!rateRows.length) continue;

    const conditionRow=after.map((line,index)=>{
      const m=line.match(/(\d+)\s*db[-\s]*(tól|tol|esetén|eseten)/i);
      return m?{index,minQuantity:Number(m[1]),kind:m[2].toLowerCase(),line}:null;
    }).find((x):x is {index:number;minQuantity:number;kind:string;line:string}=>!!x);

    let regularRate=rateRows[0];
    let promoRate:typeof regularRate|undefined;
    if(conditionRow){
      const before=rateRows.filter(r=>r.index<conditionRow.index);
      const afterCondition=rateRows.filter(r=>r.index>conditionRow.index);
      if(before.length) regularRate=before[0];
      if(afterCondition.length) promoRate=afterCondition[0];
    }

    const chosenRate=promoRate??regularRate;
    const price=sparPackPrice(chosenRate.rate,chosenRate.unit,qty,qtyUnit);
    if(!price||price<20||price>1_500_000) continue;

    const regularPack=sparPackPrice(regularRate.rate,regularRate.unit,qty,qtyUnit);
    const hasMulti=!!(conditionRow&&promoRate&&regularPack&&regularPack>price);
    const conditionText=hasMulti
      ? conditionRow.kind.startsWith('t')||conditionRow.kind==='tol'
        ? conditionRow.minQuantity+' db-tól'
        : conditionRow.minQuantity+' db esetén'
      : undefined;

    offers.push({
      id:'spar-'+slug(name),
      name,
      category:categoryFor(name),
      store:'spar',
      price,
      oldPrice:hasMulti?regularPack:undefined,
      unitLabel:q[1].replace('.',',')+' '+qtyUnit,
      unitPrice:Math.round(chosenRate.rate),
      unitPriceLabel:'/'+chosenRate.unit,
      validFrom:range?.start??isoToday(),
      validTo:range?.end??isoToday(),
      validityText:range?undefined:'Ma ellenőrizve',
      conditionText,
      minQuantity:hasMulti?conditionRow.minQuantity:undefined,
      image:imageNear(html,name,source.url,placeholder('spar',name)),
      sourceUrl:source.url
    });
  }
  return dedupe(offers).slice(0,180);
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
