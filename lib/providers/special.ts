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
  if (/mosó|öblítő|tisztító|papír|mécses|kapszula/.test(s)) return 'Háztartás';
  return 'Egyéb';
}

function unitFrom(values: string[]) {
  const joined = values.join(' ');
  const m = joined.match(/\b(\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|lt|db|darab|csomag|pár))\b/i);
  return m ? m[1].replace(/\blt\b/i, 'l') : '1 db';
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

async function scrapePenny(source: RetailSource): Promise<Offer[]> {
  const range = pennyRange();
  const url = `https://www.penny.hu/category/ajanlatok-${range.key}-koezoett-penny-kartyaval-olcsobb-termekek?pageSize=100`;
  const html = await fetchHtml(url);
  const data = lines(html);
  const offers: Offer[] = [];

  for (let i = 0; i < data.length; i++) {
    if (!/PENNY Kártya nélkül/i.test(data[i])) continue;

    const before = data.slice(Math.max(0, i - 12), i);
    const name = [...before].reverse().find(x =>
      x.length >= 3 && x.length <= 120 &&
      !/^\d/.test(x) &&
      !/termék|ajánlat|között|tól|ig|kárty|kg|ml|lt|db|sort|filter/i.test(x)
    );
    if (!name) continue;

    const after = data.slice(i + 1, i + 12);
    const regularLine = after.find(x => /\d[\d .]*\s*Ft\b/i.test(x));
    const cardIndex = after.findIndex(x => /PENNY Kártyával/i.test(x));
    if (!regularLine || cardIndex < 0) continue;
    const cardLine = after.slice(cardIndex + 1).find(x => /\d[\d .]*\s*Ft\b/i.test(x));
    if (!cardLine) continue;

    const regular = number(regularLine);
    const price = number(cardLine);
    if (!price || !regular || price > regular || price > 1_500_000) continue;

    const unitPriceLine = after.slice(cardIndex + 1).find(x => /1\s*(?:KG|LT|L|DB)\s+\d[\d .]*\s*Ft/i.test(x));
    const unitPrice = unitPriceLine ? number(unitPriceLine.replace(/^.*?1\s*(?:KG|LT|L|DB)/i, '')) : undefined;
    const context = [...before, ...after];
    const dates = context.map(parseIsoDate).filter((x): x is string => !!x);
    const validFrom = dates[0] ?? range.start;
    const validTo = dates[1] ?? range.end;

    offers.push({
      id: `penny-${slug(name)}-${price}`,
      name,
      category: categoryFor(name),
      store: 'penny',
      price,
      oldPrice: regular > price ? regular : undefined,
      unitLabel: unitFrom(before),
      unitPrice,
      validFrom,
      validTo,
      loyaltyOnly: true,
      image: imageNear(html, name, url, placeholder('penny', name)),
      sourceUrl: url
    });
  }
  return dedupe(offers);
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
      id: `deichmann-${slug(name)}-${price}`,
      name,
      category: 'Divat · Cipő',
      store: 'deichmann',
      price,
      oldPrice,
      unitLabel: '1 pár',
      validFrom: isoToday(),
      validTo: isoFuture(14),
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
    const unitPrice = unitLine ? number(unitLine) : undefined;

    offers.push({
      id: `auchan-${slug(name)}-${price}`,
      name,
      category: categoryFor(name),
      store: 'auchan',
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
      unitLabel: unitFrom(after),
      unitPrice,
      validFrom: isoToday(),
      validTo: isoFuture(7),
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
      id: `lidl-${slug(name)}-${price}`,
      name,
      category: categoryFor(name),
      store: 'lidl',
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
      unitLabel: unitFrom(after),
      unitPrice,
      validFrom: range?.start ?? isoToday(),
      validTo: range?.end ?? isoFuture(7),
      loyaltyOnly: true,
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
    const unitPrice = unitLine ? number(unitLine) : undefined;
    const validTo = parseTescoDate(data[i]) ?? isoFuture(7);
    const loyaltyOnly = /Clubcard/i.test(before.join(' ') + ' ' + data[i]);

    offers.push({
      id: `tesco-${slug(name)}-${price}`,
      name,
      category: categoryFor(name),
      store: 'tesco',
      price,
      oldPrice: oldPrice && oldPrice > price ? oldPrice : undefined,
      unitLabel: unitFrom(before),
      unitPrice,
      validFrom: isoToday(),
      validTo,
      loyaltyOnly,
      image: imageNear(html, name, url, placeholder('tesco', name)),
      sourceUrl: url
    });
  }
  return dedupe(offers).slice(0,120);
}

export async function scrapeSpecialRetailer(source: RetailSource): Promise<Offer[] | null> {
  if (source.id === 'lidl') return scrapeLidl(source);
  if (source.id === 'penny') return scrapePenny(source);
  if (source.id === 'tesco') return scrapeTesco(source);
  if (source.id === 'deichmann') return scrapeDeichmann(source);
  if (source.id === 'auchan') return scrapeAuchan(source);
  return null;
}
