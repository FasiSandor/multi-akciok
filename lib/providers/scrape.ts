import type { Offer, StoreId } from '@/lib/types';

export type RetailSource = { id: Exclude<StoreId,'custom'>; name: string; url: string };

export const retailSources: RetailSource[] = [
  { id: 'aldi', name: 'ALDI', url: 'https://www.aldi.hu/termekek' },
  { id: 'lidl', name: 'Lidl', url: 'https://www.lidl.hu/' },
  { id: 'penny', name: 'PENNY', url: 'https://www.penny.hu/ajanlatok' },
  { id: 'tesco', name: 'Tesco', url: 'https://bevasarlas.tesco.hu/shop/hu-HU/buylists/weekly-offers/weekly-offers/top-offer' },
  { id: 'spar', name: 'SPAR', url: 'https://www.spar.hu/akcioterv' },
  { id: 'auchan', name: 'Auchan', url: 'https://auchan.hu/shop' },
  { id: 'ikea', name: 'IKEA', url: 'https://www.ikea.com/hu/hu/cat/last-chance/' },
  { id: 'decathlon', name: 'Decathlon', url: 'https://www.decathlon.hu/deals/decathlon-ajanlatai' },
  { id: 'obi', name: 'OBI', url: 'https://www.obi.hu/campaign/asdp_top_aras_termekek' },
  { id: 'praktiker', name: 'Praktiker', url: 'https://www.praktiker.hu/utosar/cc/3539' },
  { id: 'deichmann', name: 'Deichmann', url: 'https://www.deichmann.com/hu-hu/c/akcio-akcios-cipok-481' },
  { id: 'jysk', name: 'JYSK', url: 'https://jysk.hu/kampany' },
  { id: 'rossmann', name: 'Rossmann', url: 'https://shop.rossmann.hu/altalanos-akciok' },
  { id: 'euronics', name: 'Euronics', url: 'https://euronics.hu/het-ajanlatai' },
  { id: 'gyongy', name: 'Gyöngy Patikák', url: 'https://gyongypatikak.hu/akcios-termekek' },
  { id: 'alma', name: 'Alma · Újvárosi Patika', url: 'https://almapatika.hu/patika/ujvarosi-gyogyszertar-mezotur' },
  { id: 'kamilla-mezotur', name: 'Kamilla Patika · Mezőtúr', url: 'https://gyongypatikak.hu/patika/kamilla-patika-mezotur' }
];

function clean(value: string) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function num(value: string) {
  return Number(value.replace(/[^\d]/g, ''));
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function future(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function categoryFor(name: string) {
  const s = name.toLowerCase();
  if (/csirke|sertés|marha|hús|sonka|szalámi|kolbász|hal|lazac/.test(s)) return 'Élelmiszer · Hús';
  if (/tej|sajt|vaj|joghurt|tejföl|tojás|túró/.test(s)) return 'Élelmiszer · Tejtermék';
  if (/alma|banán|paradicsom|paprika|uborka|szőlő|áfonya|avokádó|zöldség|gyümölcs|tök/.test(s)) return 'Élelmiszer · Zöldség-gyümölcs';
  if (/kenyér|zsemle|kifli|pogácsa|péks/.test(s)) return 'Élelmiszer · Pékáru';
  if (/víz|üdítő|kávé|tea|ital|sör|bor/.test(s)) return 'Élelmiszer · Ital';
  if (/cipő|sneaker|csizma|szandál|papucs|bakancs/.test(s)) return 'Divat · Cipő';
  if (/kerékpár|futó|fitness|fitnesz|sport|sátor|horgász|labda|roller|túra/.test(s)) return 'Sport';
  if (/fúr|csavar|szerszám|fűnyíró|festék|laminált|csempe|burkolat|tömlő|medence/.test(s)) return 'Barkács';
  if (/ágy|matrac|szék|asztal|szekrény|polc|lámpa|paplan|párna|szőnyeg|függöny/.test(s)) return 'Otthon · Lakberendezés';
  if (/kert|kerti|kaspó|virágláda/.test(s)) return 'Otthon · Kert';
  if (/mosó|öblítő|tisztító|papír|mécses/.test(s)) return 'Háztartás';
  return 'Egyéb';
}

function unitLabelFrom(text: string) {
  const m = text.match(/\b(\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|db|darab|csomag|pár))\b/i);
  return m ? clean(m[1]) : '1 db';
}

function asAbsoluteUrl(raw: unknown, base: string) {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

function priceFrom(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const n = Number(normalized.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

function imageFromProduct(product: Record<string, unknown>, base: string) {
  const raw = product.image;
  if (Array.isArray(raw)) return asAbsoluteUrl(raw[0], base);
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return asAbsoluteUrl(obj.url ?? obj.contentUrl, base);
  }
  return asAbsoluteUrl(raw, base);
}

function validPrice(n: number | undefined) {
  return !!n && n >= 30 && n <= 1_500_000;
}

function productToOffer(product: Record<string, unknown>, source: RetailSource): Offer | null {
  const type = product['@type'];
  const isProduct = type === 'Product' || (Array.isArray(type) && type.includes('Product'));
  if (!isProduct) return null;

  const name = clean(String(product.name ?? ''));
  if (name.length < 2 || name.length > 180) return null;

  const offerRaw = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  const offer = offerRaw && typeof offerRaw === 'object' ? offerRaw as Record<string, unknown> : {};
  const price = priceFrom(offer.price ?? offer.lowPrice ?? product.price);
  if (!validPrice(price)) return null;

  const oldPrice = priceFrom(
    offer.highPrice ??
    offer.priceBeforeDiscount ??
    offer.listPrice ??
    product.highPrice
  );

  const image =
    imageFromProduct(product, source.url) ??
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=640&q=80';

  const validToRaw = offer.priceValidUntil;
  const hasExactValidity = typeof validToRaw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(validToRaw);
  const validTo = hasExactValidity ? String(validToRaw).slice(0, 10) : today();

  return {
    id: `${source.id}-${slug(name)}`,
    name,
    category: categoryFor(name),
    store: source.id,
    price: price!,
    oldPrice: validPrice(oldPrice) && oldPrice! > price! ? oldPrice : undefined,
    unitLabel: unitLabelFrom(name),
    validFrom: today(),
    validTo,
    validityText: hasExactValidity ? undefined : 'Ma ellenőrizve',
    image,
    sourceUrl: source.url
  };
}

function walkJson(value: unknown, source: RetailSource, out: Offer[], seen: Set<string>) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, source, out, seen);
    return;
  }
  if (typeof value !== 'object') return;

  const obj = value as Record<string, unknown>;
  const parsed = productToOffer(obj, source);
  if (parsed && !seen.has(parsed.id)) {
    seen.add(parsed.id);
    out.push(parsed);
  }

  for (const child of Object.values(obj)) {
    if (child && typeof child === 'object') walkJson(child, source, out, seen);
  }
}

function parseJsonLd(html: string, source: RetailSource, seen: Set<string>) {
  const offers: Offer[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      walkJson(JSON.parse(raw), source, offers, seen);
    } catch {
      // Some sites emit malformed JSON-LD. Ignore that block and continue.
    }
  }
  return offers;
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);
}

function parseTextFallback(html: string, source: RetailSource, seen: Set<string>) {
  const lines = stripHtml(html);
  const offers: Offer[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(/(?:^|\s)(\d{2,3}(?:[ .]\d{3})*|\d{2,7})\s*Ft\b/i);
    if (!priceMatch) continue;

    const price = num(priceMatch[1]);
    if (!validPrice(price)) continue;

    const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 3));
    const name = context
      .filter(x => !/\bFt\b/i.test(x))
      .filter(x => x.length >= 3 && x.length <= 120)
      .find(x => !/akció|ajánlat|kedvezmény|kosár|bejelentkezés|cookie|szállítás/i.test(x));

    if (!name) continue;

    const id = `${source.id}-${slug(name)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const oldMatch = context.join(' ').match(/(?:régi|eredeti|korábbi|előző)\s*(?:ár)?\D{0,12}(\d{2,3}(?:[ .]\d{3})*|\d{2,7})\s*Ft/i);
    const oldPrice = oldMatch ? num(oldMatch[1]) : undefined;

    offers.push({
      id,
      name,
      category: categoryFor(name),
      store: source.id,
      price,
      oldPrice: validPrice(oldPrice) && oldPrice! > price ? oldPrice : undefined,
      unitLabel: unitLabelFrom(context.join(' ')),
      validFrom: today(),
      validTo: today(),
      validityText: 'Ma ellenőrizve',
      image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=640&q=80',
      sourceUrl: source.url
    });

    if (offers.length >= 80) break;
  }

  return offers;
}

export async function scrapeRetailer(source: RetailSource): Promise<Offer[]> {
  const response = await fetch(source.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; MultiAkciok/1.0)',
      'accept-language': 'hu-HU,hu;q=0.9,en;q=0.7'
    },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(12_000)
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const seen = new Set<string>();
  const structured = parseJsonLd(html, source, seen);
  if (structured.length) return structured.slice(0, 80);
  return parseTextFallback(html, source, seen).slice(0, 80);
}
