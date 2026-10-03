'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import {
  Bell, Search, ListChecks, CreditCard, UserRound, Home, Heart, ChevronRight, ArrowLeft,
  BarChart3, Plus, Camera, X, Sparkles, MapPin, ScanLine, Trash2, CheckCircle2, RefreshCw,
  Tag, ShoppingCart, SlidersHorizontal, WalletCards, ExternalLink, ImagePlus
} from 'lucide-react';
import type { Campaign, CustomRetailer, LoyaltyCard, Offer, StoreId } from '@/lib/types';
import { fallbackOffers } from '@/lib/fallback-offers';
import { knownStoreOrder, offerStoreOrder, stores } from '@/lib/stores';
import { CodeDisplay } from '@/components/CodeDisplay';
import { recordOfferHistory, readOfferHistoryStats, type HistoryStats, type PricePoint } from '@/lib/client-history';
import { evaluateWatchTerms, type WatchHit } from '@/lib/client-watch';
import { assessDeal } from '@/lib/deal-quality';
import { equivalentCandidates } from '@/lib/optimizer';

type Tab = 'home' | 'search' | 'list' | 'cards' | 'profile';
type SourceState = { id:string; name:string; url:string; ok:boolean; checkedAt:string; count:number; note?:string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format: string }>>;
};

declare global {
  interface Window { BarcodeDetector?: BarcodeDetectorCtor }
}

const storeOrder: StoreId[] = offerStoreOrder;
const cardStoreOrder: StoreId[] = knownStoreOrder;

function money(value: number) {
  return new Intl.NumberFormat('hu-HU').format(value) + ' Ft';
}

function readLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function readLocalRecord<T>(key: string): Record<string,T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string,T> : {};
  } catch {
    return {};
  }
}

function sameWatchTerm(a: string, b: string) {
  return a.trim().toLocaleLowerCase('hu') === b.trim().toLocaleLowerCase('hu');
}

function StoreBadge({ store, compact = false }: { store: StoreId; compact?: boolean }) {
  const s = stores[store];
  return (
    <span className={`store-badge ${compact ? 'compact' : ''}`} style={{ background: s.color, color: s.text }}>
      {s.short}
    </span>
  );
}

function discount(offer: Offer) {
  if (!offer.oldPrice || offer.oldPrice <= offer.price) return 0;
  return Math.round((1 - offer.price / offer.oldPrice) * 100);
}

function textForBackground(hex: string) {
  const clean = hex.replace('#','');
  if (clean.length !== 6) return '#ffffff';
  const r=parseInt(clean.slice(0,2),16),g=parseInt(clean.slice(2,4),16),b=parseInt(clean.slice(4,6),16);
  return (r*299+g*587+b*114)/1000 > 150 ? '#0b2545' : '#ffffff';
}

function cardVisual(card: LoyaltyCard) {
  if (card.store === 'custom') {
    const color=card.customColor || '#334155';
    const name=card.customStoreName || 'Saját kártya';
    return {name,short:name.slice(0,8).toUpperCase(),color,text:textForBackground(color)};
  }
  return stores[card.store];
}

function CardBadge({card}:{card:LoyaltyCard}) {
  const v=cardVisual(card);
  return <span className="store-badge" style={{background:v.color,color:v.text}}>{v.short}</span>;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>('home');
  const [offers, setOffers] = useState<Offer[]>(process.env.NODE_ENV === 'development' ? fallbackOffers : []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Offer | null>(null);
  const [listIds, setListIds] = useState<string[]>([]);
  const [listQuantities, setListQuantities] = useState<Record<string,number>>({});
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [cardModal, setCardModal] = useState(false);
  const [activeCard, setActiveCard] = useState<LoyaltyCard | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const [sourceStates, setSourceStates] = useState<SourceState[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [customRetailers, setCustomRetailers] = useState<CustomRetailer[]>([]);
  const [retailerModal, setRetailerModal] = useState(false);
  const [watchTerms, setWatchTerms] = useState<string[]>([]);
  const [watchHits, setWatchHits] = useState<WatchHit[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const initialCards = readLocalArray<LoyaltyCard>('multi-akciok-cards');
    const initialList = readLocalArray<string>('multi-akciok-list');
    const initialRetailers = readLocalArray<CustomRetailer>('multi-akciok-custom-retailers');
    const initialQuantities = readLocalRecord<number>('multi-akciok-list-qty');
    const initialWatchTerms = readLocalArray<string>('multi-akciok-watch-terms');
    setCards(initialCards);
    setListIds(initialList);
    setListQuantities(initialQuantities);
    setCustomRetailers(initialRetailers);
    setWatchTerms(initialWatchTerms);
    setStorageReady(true);
    refreshOffers(initialWatchTerms);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem('multi-akciok-cards', JSON.stringify(cards));
  }, [cards, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem('multi-akciok-list', JSON.stringify(listIds));
  }, [listIds, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem('multi-akciok-list-qty', JSON.stringify(listQuantities));
  }, [listQuantities, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem('multi-akciok-custom-retailers', JSON.stringify(customRetailers));
  }, [customRetailers, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem('multi-akciok-watch-terms', JSON.stringify(watchTerms));
    setWatchHits(evaluateWatchTerms(offers, watchTerms));
  }, [watchTerms, offers, storageReady]);

  async function refreshOffers(termsOverride?: string[]) {
    setRefreshing(true);
    try {
      const res = await fetch('/api/offers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.offers)) {
          const liveOffers = data.offers as Offer[];
          setOffers(liveOffers);
          setListIds(prev => prev.map(id => liveOffers.find(o => o.id === id || id.startsWith(o.id + '-'))?.id ?? id));
          setListQuantities(prev => {
            const next: Record<string,number> = {};
            for (const [id,qty] of Object.entries(prev)) {
              const stableId = liveOffers.find(o => o.id === id || id.startsWith(o.id + '-'))?.id ?? id;
              next[stableId] = Math.max(1, Number(qty) || 1);
            }
            return next;
          });
          recordOfferHistory(liveOffers);
          setWatchHits(evaluateWatchTerms(liveOffers, termsOverride ?? watchTerms));
        }
        if (Array.isArray(data.sourceStates)) setSourceStates(data.sourceStates);
        if (Array.isArray(data.campaigns)) setCampaigns(data.campaigns);
        setLastRefresh(data.refreshedAt || new Date().toISOString());
      }
    } catch {
      setLastRefresh(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('hu');
    if (!q) return offers;
    return offers.filter(o => `${o.name} ${o.category} ${stores[o.store].name}`.toLocaleLowerCase('hu').includes(q));
  }, [offers, query]);

  function addWatchTerm(term: string) {
    const value = term.trim();
    if (!value) return;
    setWatchTerms(prev => prev.some(x => sameWatchTerm(x, value)) ? prev : [...prev, value]);
  }

  return (
    <main className="app-shell">
      <section className="phone-app">
        {selected ? (
          <OfferDetail offer={selected} allOffers={offers} watched={watchTerms.some(x=>sameWatchTerm(x,selected.name))} onWatch={()=>addWatchTerm(selected.name)} onBack={() => setSelected(null)} />
        ) : tab === 'home' ? (
          <HomeView offers={filtered} campaigns={campaigns} query={query} setQuery={setQuery} onSelect={setSelected} onWatch={addWatchTerm} watchedTerms={watchTerms} setTab={setTab} refresh={() => refreshOffers()} refreshing={refreshing} lastRefresh={lastRefresh} customRetailers={customRetailers} watchHits={watchHits} onAddRetailer={() => setRetailerModal(true)} />
        ) : tab === 'search' ? (
          <SearchView offers={offers} query={query} setQuery={setQuery} onSelect={setSelected} />
        ) : tab === 'list' ? (
          <ListView offers={offers} listIds={listIds} setListIds={setListIds} quantities={listQuantities} setQuantities={setListQuantities} cards={cards} />
        ) : tab === 'cards' ? (
          <CardsView cards={cards} setCards={setCards} onAdd={() => setCardModal(true)} onOpen={setActiveCard} />
        ) : (
          <ProfileView customRetailers={customRetailers} sourceStates={sourceStates} lastRefresh={lastRefresh} watchTerms={watchTerms} setWatchTerms={setWatchTerms} watchHits={watchHits} onAddRetailer={() => setRetailerModal(true)} onRemoveRetailer={(id) => setCustomRetailers(prev => prev.filter(x => x.id !== id))} />
        )}
        {!selected && <BottomNav tab={tab} setTab={setTab} />}
      </section>

      {retailerModal && <AddRetailerModal onClose={() => setRetailerModal(false)} onSave={(retailer) => { setCustomRetailers(prev => [retailer, ...prev]); setRetailerModal(false); }} />}
      {cardModal && <AddCardModal onClose={() => setCardModal(false)} onSave={(card) => { setCards(prev => [card, ...prev]); setCardModal(false); }} />}
      {activeCard && <FullCard card={activeCard} onClose={() => setActiveCard(null)} />}
    </main>
  );
}

function BrandHeader({ onBell }: { onBell?: () => void }) {
  return (
    <>
      <header className="topbar">
        <div className="brandmark"><span className="basket">🛒</span><strong>MULTI <em>AKCIÓK</em></strong></div>
        <button className="icon-btn" onClick={onBell} aria-label="Értesítések"><Bell size={22} /></button>
      </header>
      <div className="location"><MapPin size={15} fill="currentColor" /> Magyarország</div>
    </>
  );
}

function HomeView({ offers, campaigns, query, setQuery, onSelect, onWatch, watchedTerms, setTab, refresh, refreshing, lastRefresh, customRetailers, watchHits, onAddRetailer }: {
  offers: Offer[]; campaigns: Campaign[]; query: string; setQuery: (s: string) => void; onSelect: (o: Offer) => void; onWatch: (name:string)=>void; watchedTerms:string[]; setTab: (t: Tab) => void;
  refresh: () => void; refreshing: boolean; lastRefresh: string; customRetailers: CustomRetailer[]; watchHits: WatchHit[]; onAddRetailer: () => void;
}) {
  const top = [...offers].sort((a,b)=>discount(b)-discount(a) || a.price-b.price).slice(0, 3);
  const categories = [
    ['🥩', 'Élelmiszer'], ['🛋️', 'Lakberendezés'], ['🏃', 'Sport'], ['🛠️', 'Barkács'],
    ['👟', 'Cipő'], ['🌿', 'Kert'], ['🧴', 'Háztartás'], ['💄', 'Drogéria'], ['💊', 'Gyógyszertár'], ['📺', 'Műszaki'], ['🏷️', 'Minden akció']
  ];
  return (
    <div className="screen home-screen">
      <BrandHeader onBell={()=>setTab('profile')} />
      <div className="searchbox"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Keress terméket, márkát vagy üzletet..." /></div>
      {watchHits.length>0&&<div className="watch-banner"><div className="watch-banner-head"><Bell size={16}/><strong>Figyelt ajánlatok</strong><span>{watchHits.length}</span></div>{watchHits.slice(0,2).map(hit=><button key={hit.term} onClick={()=>onSelect(hit.offer)}><div><b>{hit.term}</b><small>{hit.status==='lower'?'Olcsóbb lett':hit.status==='new'?'Új találat':'Aktuális találat'} · {stores[hit.offer.store].name}</small></div><strong>{money(hit.offer.price)}</strong><ChevronRight size={16}/></button>)}</div>}
      <div className="stores-row">
        {storeOrder.map(s => <button className="store-chip known-store-chip" key={s} onClick={()=>{setQuery(stores[s].name);setTab('search')}}><StoreBadge store={s} /><span>{stores[s].name}</span></button>)}
        {customRetailers.map(r => <button className="store-chip custom-store-chip" key={r.id} onClick={() => r.url && window.open(r.url, '_blank', 'noopener,noreferrer')}><span className="custom-store-badge" style={{background:r.color}}>{r.name.slice(0,6).toUpperCase()}</span><span>{r.name}</span></button>)}
        <button className="store-chip add-store-chip" onClick={onAddRetailer}><span className="custom-store-badge add"><Plus size={18}/></span><span>Üzlet</span></button>
      </div>
      <div className="section-title"><h2>Mai legjobb akciók</h2><button onClick={() => setTab('search')}>Összes <ChevronRight size={16}/></button></div>
      <div className="offer-grid">
        {top.map(o => <OfferCard key={o.id} offer={o} watched={watchedTerms.some(x=>sameWatchTerm(x,o.name))} onWatch={()=>onWatch(o.name)} onClick={() => onSelect(o)} />)}
      </div>
      <div className="fresh-banner">
        <div><span>FRISS</span><strong>Élelmiszer, otthon, sport és barkács akciók egy helyen</strong><button onClick={() => setTab('search')}>Megnézem <ChevronRight size={15}/></button></div>
        <div className="banner-food">🛒🏠🏃</div>
      </div>
      {campaigns.length>0&&<>
        <div className="section-title"><h2>Kuponok és kampányok</h2></div>
        <div className="campaign-row">{campaigns.slice(0,4).map(campaign=><a className="campaign-card" key={campaign.id} href={campaign.sourceUrl} target="_blank" rel="noreferrer">
          <div className="campaign-top"><StoreBadge store={campaign.store} compact/>{campaign.discountText&&<span>{campaign.discountText}</span>}</div>
          <strong>{campaign.title}</strong>
          {campaign.subtitle&&<small>{campaign.subtitle}</small>}
          <div className="campaign-foot">{campaign.code&&<b>Kód: {campaign.code}</b>}{campaign.validTo&&<span>{new Date(campaign.validTo).toLocaleDateString('hu-HU',{month:'short',day:'numeric'})}-ig</span>}</div>
        </a>)}</div>
      </>}
      <div className="section-title"><h2>Kategóriák</h2><button onClick={() => setTab('search')}>Összes <ChevronRight size={16}/></button></div>
      <div className="category-row">{categories.map(([e, n]) => <button key={n} onClick={() => { setQuery(n === 'Minden akció' ? '' : n); setTab('search'); }}><span>{e}</span><small>{n}</small></button>)}</div>
      <div className="daily-status">
        <div><RefreshCw size={16} className={refreshing ? 'spin' : ''}/><span>{lastRefresh ? `Frissítve: ${new Date(lastRefresh).toLocaleString('hu-HU', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}` : 'Napi automatikus frissítés'}</span></div>
        <button onClick={refresh} disabled={refreshing}>Frissítés</button>
      </div>
    </div>
  );
}

function OfferCard({ offer, onClick, onWatch, watched }: { offer: Offer; onClick: () => void; onWatch:()=>void; watched:boolean }) {
  const d = discount(offer);
  return (
    <button className="offer-card" onClick={onClick}>
      {d > 0 && <span className="discount">-{d}%</span>}
      <div className="offer-img"><Image src={offer.image} alt={offer.name} fill sizes="30vw" /></div>
      <strong>{offer.name}</strong><small>{offer.unitLabel}</small>
      <b>{money(offer.price)}</b>{offer.oldPrice && <del>{money(offer.oldPrice)}</del>}
      <span className="unit-price">{offer.unitPrice ? `${money(offer.unitPrice)}${offer.unitPriceLabel||''}` : ' '}</span>
      <div className="offer-foot"><StoreBadge store={offer.store} compact/><span>{offer.validityText||`${new Date(offer.validTo).toLocaleDateString('hu-HU',{month:'short',day:'numeric'})}-ig`}</span><span className={'offer-heart '+(watched?'active':'')} role="button" tabIndex={0} aria-label={watched?'Figyelve':'Figyelés'} onClick={e=>{e.stopPropagation();onWatch()}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onWatch()}}}><Heart size={17} fill={watched?'currentColor':'none'}/></span></div>
    </button>
  );
}

function SearchView({ offers, query, setQuery, onSelect }: { offers: Offer[]; query: string; setQuery: (s: string) => void; onSelect: (o: Offer) => void }) {
  const [storeFilter,setStoreFilter]=useState<StoreId | null>(null);
  const queryStore=storeOrder.find(s=>stores[s].name.toLocaleLowerCase('hu')===query.trim().toLocaleLowerCase('hu'))??null;
  const effectiveStore=storeFilter??queryStore;
  const textQuery=queryStore?'':query.trim().toLocaleLowerCase('hu');
  const visible=offers.filter(o=>{
    if(effectiveStore&&o.store!==effectiveStore) return false;
    if(!textQuery) return true;
    return (o.name+' '+o.category+' '+stores[o.store].name).toLocaleLowerCase('hu').includes(textQuery);
  });
  function chooseStore(store:StoreId|null){
    setStoreFilter(store);
    if(queryStore) setQuery('');
  }
  return (
    <div className="screen search-screen">
      <h1>Akciókereső</h1>
      <div className="searchbox large"><Search size={20}/><input autoFocus value={query} onChange={e => {setQuery(e.target.value);setStoreFilter(null)}} placeholder="Mit keresel?"/><SlidersHorizontal size={19}/></div>
      <div className="filter-chips"><button className={!effectiveStore?'active':''} onClick={()=>chooseStore(null)}>Összes</button>{storeOrder.map(s=><button className={effectiveStore===s?'active':''} onClick={()=>chooseStore(s)} key={s}>{stores[s].name}</button>)}</div>
      <p className="result-count">{visible.length} aktuális ajánlat</p>
      <div className="results-list">
        {visible.map(o => <button className="result-card" key={o.id} onClick={()=>onSelect(o)}>
          <div className="result-image"><Image src={o.image} alt={o.name} fill sizes="88px"/></div>
          <div className="result-main"><div className="result-top"><StoreBadge store={o.store} compact/>{discount(o)>0&&<span className="discount inline">-{discount(o)}%</span>}</div><strong>{o.name}</strong><small>{o.unitLabel} · {o.category}{o.unitPrice?` · ${money(o.unitPrice)}${o.unitPriceLabel||''}`:''}</small>{o.conditionText&&<em className="condition-note">{o.conditionText}</em>}{o.priceScope&&<em className="price-scope">{o.priceScope}</em>}</div>
          <div className="result-price"><b>{money(o.price)}</b>{o.oldPrice&&<del>{money(o.oldPrice)}</del>}<ChevronRight size={18}/></div>
        </button>)}
      </div>
    </div>
  );
}

function HistoryChart({points}:{points:PricePoint[]}) {
  if(points.length<2) return <div className="history-chart-empty">Még nincs elég pont a grafikonhoz.</div>;
  const width=320,height=120,pad=12;
  const values=points.map(p=>p.price);
  const min=Math.min(...values),max=Math.max(...values);
  const span=Math.max(1,max-min);
  const coords=points.map((p,i)=>{
    const x=pad+(i/(points.length-1))*(width-pad*2);
    const y=height-pad-((p.price-min)/span)*(height-pad*2);
    return {x,y,p};
  });
  const path=coords.map((c,i)=>(i?'L':'M')+c.x.toFixed(1)+' '+c.y.toFixed(1)).join(' ');
  return <div className="history-chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Árhistorika grafikon">
      <path className="history-grid-line" d={`M${pad} ${height/2} H${width-pad}`}/>
      <path className="history-line" d={path}/>
      {coords.map((c,i)=><circle key={i} className="history-dot" cx={c.x} cy={c.y} r="3"/>)}
    </svg>
    <div className="history-axis"><span>{new Date(points[0].date).toLocaleDateString('hu-HU',{month:'short',day:'numeric'})}</span><span>{new Date(points[points.length-1].date).toLocaleDateString('hu-HU',{month:'short',day:'numeric'})}</span></div>
  </div>;
}

function OfferDetail({ offer, allOffers, onBack, onWatch, watched }: { offer: Offer; allOffers: Offer[]; onBack: () => void; onWatch:()=>void; watched:boolean }) {
  const [history, setHistory] = useState<HistoryStats | null>(null);
  const [detailTab,setDetailTab]=useState<'prices'|'history'>('prices');

  useEffect(() => {
    let active = true;
    const local = readOfferHistoryStats(offer);
    setHistory(local);

    fetch('/api/history?offerKey=' + encodeURIComponent(offer.id) + '&days=90', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!active || !data?.history) return;
        const server = data.history as HistoryStats;
        if (!local || server.samples >= local.samples) setHistory(server);
      })
      .catch(() => { /* local history remains available */ });

    return () => { active = false; };
  }, [offer]);

  const comparable = allOffers
    .filter(o => o.id!==offer.id)
    .map(o=>({offer:o,confidence:equivalentCandidates(offer,[o],1)[0]?.confidence??0}))
    .filter(x=>x.confidence>=0.64)
    .sort((a,b)=>b.confidence-a.confidence||a.offer.price-b.offer.price)
    .slice(0,4)
    .map(x=>x.offer);

  const deal=assessDeal(history,offer.price);

  return (
    <div className="screen detail-screen">
      <div className="detail-nav"><button className="icon-btn" onClick={onBack}><ArrowLeft/></button><div><button className="icon-btn" onClick={onWatch} aria-label={watched?'Figyelve':'Figyelés'}><Heart fill={watched?'currentColor':'none'}/></button>{offer.sourceUrl&&<a className="icon-btn" href={offer.sourceUrl} target="_blank" rel="noreferrer" aria-label="Forrás megnyitása"><ExternalLink/></a>}</div></div>
      <div className="hero-product"><Image src={offer.image} alt={offer.name} fill sizes="80vw" /></div>
      <h1>{offer.name}</h1><p>{offer.unitLabel}</p>{offer.conditionText&&<div className="condition-note detail-condition">{offer.conditionText}</div>}{offer.priceScope&&<div className="price-scope detail-scope">{offer.priceScope}</div>}
      <div className="segmented"><button className={detailTab==='prices'?'active':''} onClick={()=>setDetailTab('prices')}>Árak és üzletek</button><button className={detailTab==='history'?'active':''} onClick={()=>setDetailTab('history')}>Árhistorika</button></div>

      {detailTab==='prices'?<>
        <div className="compare-list">
          {[offer, ...comparable].slice(0,5).map(o=><div className="compare-row" key={o.id}>
            <StoreBadge store={o.store}/><div><strong>{stores[o.store].name}</strong>{o.loyaltyOnly&&<small>{o.conditionText||'Kártyás ár'}</small>}</div><div className="compare-price"><b>{money(o.price)}</b>{o.oldPrice&&<del>{money(o.oldPrice)}</del>}{discount(o)>0&&<span className="discount inline">-{discount(o)}%</span>}</div><Heart size={18}/>
          </div>)}
        </div>
      </>:<>
        <HistoryChart points={history?.points??[]}/>
        <div className="history-stat-grid">
          <div><small>Mért napok</small><b>{history?.samples??0}</b></div>
          <div><small>Minimum</small><b>{history?money(history.minimum):'—'}</b></div>
          <div><small>Átlag</small><b>{history?money(history.average):'—'}</b></div>
          <div><small>Maximum</small><b>{history?money(history.maximum):'—'}</b></div>
        </div>
      </>}

      <div className={'deal-score deal-'+deal.state}><BarChart3 size={31}/><div><strong>{deal.title}</strong><span>{deal.detail}{history&&history.samples>=3?<><br/>Mért tartomány: <b>{money(history.minimum)} – {money(history.maximum)}</b></>:null}</span></div>{deal.score?<div className="score">{deal.score}<small>/100</small></div>:<div className="history-pending">{history?.samples??1}. nap<small>adatgyűjtés</small></div>}</div>
    </div>
  );
}


function ListView({ offers, listIds, setListIds, quantities, setQuantities, cards }: {
  offers: Offer[];
  listIds: string[];
  setListIds: (v: string[])=>void;
  quantities: Record<string,number>;
  setQuantities: Dispatch<SetStateAction<Record<string,number>>>;
  cards: LoyaltyCard[];
}) {
  const [oneStore,setOneStore]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [addQuery,setAddQuery]=useState('');

  function norm(value:string){
    return value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }

  const loyaltyStores=new Set(cards.map(card=>card.store));
  function automaticPromoUsable(offer:Offer){
    if(/digitális kupon/i.test(offer.conditionText||'')) return false;
    if(offer.loyaltyOnly&&!loyaltyStores.has(offer.store)) return false;
    return true;
  }
  function unitPackPrice(offer:Offer,packs:number){
    if(!automaticPromoUsable(offer)&&offer.oldPrice) return offer.oldPrice;
    if(offer.minQuantity&&packs<offer.minQuantity&&offer.oldPrice) return offer.oldPrice;
    return offer.price;
  }
  function quantityFor(id:string){
    return Math.max(1,Math.min(99,Math.round(quantities[id]||1)));
  }
  function changeQty(id:string,delta:number){
    setQuantities(prev=>({...prev,[id]:Math.max(1,Math.min(99,Math.round((prev[id]||1)+delta)))}));
  }
  function removeItem(id:string){
    setListIds(listIds.filter(x=>x!==id));
    setQuantities(prev=>{const next={...prev};delete next[id];return next});
  }
  function addItem(id:string){
    setListIds(listIds.includes(id)?listIds:[...listIds,id]);
    setQuantities(prev=>({...prev,[id]:prev[id]||1}));
    setAddQuery('');
  }

  const entries=listIds.map(id=>{
    const offer=offers.find(o=>o.id===id || id.startsWith(o.id+'-'));
    if(!offer) return null;
    return {offer,qty:quantityFor(offer.id)};
  }).filter(Boolean) as Array<{offer:Offer;qty:number}>;

  function rankedCandidates(item:Offer,qty:number,store?:StoreId){
    return equivalentCandidates(item,offers,qty,store)
      .filter(candidate=>automaticPromoUsable(candidate.offer)||!!candidate.offer.oldPrice||candidate.offer.id===item.id)
      .map(candidate=>({
        ...candidate,
        cost:unitPackPrice(candidate.offer,candidate.requiredPacks)*candidate.requiredPacks
      }))
      .sort((a,b)=>a.cost-b.cost||b.confidence-a.confidence);
  }

  const originalTotal=entries.reduce((sum,x)=>sum+unitPackPrice(x.offer,x.qty)*x.qty,0);
  const mixedPicks=entries.map(entry=>{
    const candidate=rankedCandidates(entry.offer,entry.qty)[0];
    return candidate?{source:entry.offer,offer:candidate.offer,sourceQty:entry.qty,packs:candidate.requiredPacks,cost:candidate.cost,confidence:candidate.confidence}:null;
  }).filter(Boolean) as Array<{source:Offer;offer:Offer;sourceQty:number;packs:number;cost:number;confidence:number}>;
  const mixedTotal=mixedPicks.reduce((sum,x)=>sum+x.cost,0);

  const oneStoreOptions=storeOrder.map(store=>{
    const picks=entries.map(entry=>{
      const candidate=rankedCandidates(entry.offer,entry.qty,store)[0];
      return candidate?{source:entry.offer,offer:candidate.offer,sourceQty:entry.qty,packs:candidate.requiredPacks,cost:candidate.cost,confidence:candidate.confidence}:null;
    }).filter(Boolean) as Array<{source:Offer;offer:Offer;sourceQty:number;packs:number;cost:number;confidence:number}>;
    return {store,picks,total:picks.reduce((sum,x)=>sum+x.cost,0),complete:picks.length===entries.length};
  }).filter(x=>x.complete).sort((a,b)=>a.total-b.total);
  const bestOneStore=oneStoreOptions[0];

  const plan=oneStore?(bestOneStore?.picks??[]):mixedPicks;
  const planTotal=oneStore?(bestOneStore?.total??0):mixedTotal;
  const saving=Math.max(0,originalTotal-planTotal);
  const substitutions=plan.filter(x=>x.source.id!==x.offer.id).length;

  const planTotals=storeOrder.map(store=>({
    store,
    total:plan.filter(x=>x.offer.store===store).reduce((sum,x)=>sum+x.cost,0),
    count:plan.filter(x=>x.offer.store===store).reduce((sum,x)=>sum+x.packs,0)
  })).filter(x=>x.count>0);

  const q=norm(addQuery);
  const addResults=offers.filter(o=>!listIds.includes(o.id) && (!q||norm(o.name+' '+o.category+' '+stores[o.store].name).includes(q))).slice(0,8);

  return (
    <div className="screen list-screen">
      <div className="title-with-plus"><div><ListChecks/><h1>Bevásárlólista</h1></div><button className="round-plus" onClick={()=>setAddOpen(v=>!v)}><Plus/></button></div>
      <button className="toggle-row button-toggle" onClick={()=>setOneStore(v=>!v)}><span className={'toggle '+(oneStore?'on':'')}><i/></span> Csak egy üzletbe megyek <span className="info-dot">i</span></button>

      {addOpen&&<div className="list-add-panel">
        <div className="searchbox"><Search size={18}/><input autoFocus value={addQuery} onChange={e=>setAddQuery(e.target.value)} placeholder="Mit szeretnél venni?"/></div>
        <div className="list-add-results">{addResults.map(o=><button key={o.id} onClick={()=>addItem(o.id)}><div className="mini-food"><Image src={o.image} alt="" fill sizes="44px"/></div><div><b>{o.name}</b><small>{stores[o.store].name} · {o.unitLabel}</small></div><strong>{money(o.price)}</strong><Plus size={16}/></button>)}</div>
      </div>}

      <div className="list-layout">
        <div className="shopping-items">
          {entries.length===0&&<div className="list-empty"><ShoppingCart size={28}/><b>A listád még üres</b><small>Adj hozzá aktuális ajánlatot a + gombbal.</small></div>}
          {entries.map(({offer:o,qty})=>{
            const current=unitPackPrice(o,qty)*qty;
            const best=rankedCandidates(o,qty)[0];
            const cheaper=best&&best.cost<current&&best.offer.id!==o.id?best:null;
            return <div className="shopping-item selected-item" key={o.id}>
              <button className="remove-list-item" onClick={()=>removeItem(o.id)}><X size={14}/></button>
              <div className="mini-food"><Image src={o.image} alt="" fill sizes="44px"/></div>
              <div><strong>{o.name}</strong><small>{o.unitLabel}{cheaper?' · jobb kosártalálat: '+stores[cheaper.offer.store].name:''}</small>{o.loyaltyOnly&&!automaticPromoUsable(o)&&<em className="basket-condition">{/digitális kupon/i.test(o.conditionText||'')?'Kupon nincs automatikusan beleszámolva':'Kártya nélkül normál árral számolva'}</em>}<div className="qty-control"><button onClick={()=>changeQty(o.id,-1)} aria-label="Mennyiség csökkentése">−</button><span>{qty}</span><button onClick={()=>changeQty(o.id,1)} aria-label="Mennyiség növelése">+</button></div></div>
              <div className="item-price"><b>{money(current)}</b><small>{o.minQuantity&&qty<o.minQuantity&&o.oldPrice?'Akció '+o.minQuantity+' db-tól':qty>1?qty+' × '+money(unitPackPrice(o,qty)):''}</small><StoreBadge store={o.store} compact/></div><span className="drag">≡</span>
            </div>;
          })}
          <button className="add-product" onClick={()=>setAddOpen(v=>!v)}><Plus size={18}/> Termék hozzáadása</button>
        </div>

        <div className="optimizer-card">
          <span className="trophy">{oneStore?'🏪':'✨'}</span>
          <small>{oneStore?'Legjobb egyboltos kosár':'Legolcsóbb megbízható kombináció'}</small>
          <strong>{entries.length&&plan.length?money(planTotal):'—'}</strong>
          <p>{entries.length?entries.length+' féle termék · '+entries.reduce((sum,x)=>sum+x.qty,0)+' kiválasztott csomag':'Adj hozzá termékeket'}</p>
          {saving>0&&<div className="optimizer-saving">−{money(saving)}</div>}
          {substitutions>0&&<div className="optimizer-substitution">{substitutions} tételnél összevethető másik kiszerelést/terméket választ</div>}
          <p className="optimizer-card-note"><CreditCard size={12}/> Csak erős név-, kategória- és kiszerelés-egyezésnél helyettesítünk. Különböző kiszerelésnél a szükséges csomagszámot is átszámoljuk.</p>
          <hr/>
          {oneStore&&!bestOneStore&&entries.length>0?<p className="optimizer-warning">A jelenlegi adatok alapján nincs olyan egyetlen üzlet, ahol minden tételhez elég biztosan összevethető ajánlatot találtunk.</p>:<>
            <b>{oneStore?'Egy üzlet':'Boltonként'}</b>
            {planTotals.map(x=><div className="store-total" key={x.store}><StoreBadge store={x.store} compact/><span>{x.count} csomag · {money(x.total)}</span></div>)}
          </>}
        </div>
      </div>

      <button className="primary wide" disabled={!entries.length||!plan.length}><Sparkles size={18}/> {oneStore?'Legjobb egy üzlet':'Lista optimalizálva'}</button>
    </div>
  );
}


function CardsView({ cards, setCards, onAdd, onOpen }: { cards: LoyaltyCard[]; setCards: Dispatch<SetStateAction<LoyaltyCard[]>>; onAdd:()=>void; onOpen:(c:LoyaltyCard)=>void }) {
  return (
    <div className="screen cards-screen">
      <div className="title-with-plus"><div><WalletCards/><h1>Digitális kártyák</h1></div><button className="round-plus" onClick={onAdd}><Plus/></button></div>
      <p className="muted">Minden hűségkártyád egy helyen. Érintsd meg a pénztári megjelenítéshez.</p>
      <div className="wallet-stack">
        {cards.map(card=>{
          const v=cardVisual(card);
          return <div className="wallet-card" key={card.id} style={{background:v.color,color:v.text}}>
            <button className="wallet-card-open" onClick={()=>onOpen(card)} style={{color:v.text}}>
              <div className="wallet-brand"><CardBadge card={card}/><div><strong>{card.label}</strong><small>{card.code.replace(/(.{4})/g,'$1 ').trim()}</small></div></div>
              <div className="wallet-code"><CodeDisplay value={card.code} format={card.format}/></div>
            </button>
            <button className="wallet-delete" style={{color:v.text}} aria-label="Kártya törlése" onClick={()=>{if(window.confirm('Törlöd ezt a kártyát?'))setCards(prev=>prev.filter(x=>x.id!==card.id))}}><Trash2 size={16}/></button>
          </div>
        })}
      </div>
      {!cards.length && <div className="empty"><CreditCard size={42}/><h3>Még nincs kártyád</h3><button className="primary" onClick={onAdd}><Plus size={18}/> Kártya hozzáadása</button></div>}
      <div className="wallet-tip"><Sparkles/><div><b>Tipp</b><p>A kártyákhoz kapcsolódó kártyás árakat az akcióknál külön jelöljük.</p></div></div>
    </div>
  );
}

function AddCardModal({ onClose, onSave }: { onClose:()=>void; onSave:(c:LoyaltyCard)=>void }) {
  const [store,setStore]=useState<StoreId>('lidl');
  const [label,setLabel]=useState('Lidl Plus');
  const [code,setCode]=useState('');
  const [format,setFormat]=useState<'qr'|'barcode'>('qr');
  const [message,setMessage]=useState('');
  const [customStoreName,setCustomStoreName]=useState('');
  const [customColor,setCustomColor]=useState('#334155');
  const fileRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const [camera,setCamera]=useState(false);
  const streamRef=useRef<MediaStream|null>(null);

  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop())},[]);

  function chooseStore(value: StoreId) { const loyaltyLabel=value==='tesco'?'Tesco Clubcard':value==='lidl'?'Lidl Plus':value==='gyongy'?'Gyöngy Prémium':value==='alma'?'Alma+':value==='kamilla-mezotur'?'Gyöngy Prémium · Kamilla':stores[value].name+' kártya'; setStore(value); setLabel(value==='custom'?'Saját hűségkártya':loyaltyLabel); if(value!=='custom') setCustomStoreName(''); }

  async function detectFromFile(file: File) {
    setMessage('Kód keresése…');
    try {
      const Detector=window.BarcodeDetector;
      if (Detector) {
        try {
          const bitmap=await createImageBitmap(file);
          const detector=new Detector({formats:['qr_code','code_128','ean_13','ean_8','upc_a','data_matrix']});
          const found=await detector.detect(bitmap);
          bitmap.close();
          if (found.length) {
            setCode(found[0].rawValue);
            setFormat(found[0].format==='qr_code'?'qr':'barcode');
            setMessage('Kód sikeresen beolvasva.');
            return;
          }
        } catch {
          // ZXing fallback follows below.
        }
      }

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const url = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(url);
        setCode(result.getText());
        setFormat(String(result.getBarcodeFormat()).toUpperCase().includes('QR')?'qr':'barcode');
        setMessage('Kód sikeresen beolvasva.');
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setMessage('Nem találtam olvasható QR- vagy vonalkódot a képen.');
    }
  }

  async function startCamera() {
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
      streamRef.current=stream; setCamera(true); setTimeout(()=>{if(videoRef.current){videoRef.current.srcObject=stream; videoRef.current.play();}},50);
    } catch { setMessage('A kamera nem érhető el. Képből vagy kézi beírással is hozzáadhatod.'); }
  }

  async function scanFrame() {
    try {
      if (!videoRef.current) return;
      const Detector=window.BarcodeDetector;
      if (Detector) {
        try {
          const detector=new Detector({formats:['qr_code','code_128','ean_13','ean_8','upc_a','data_matrix']});
          const found=await detector.detect(videoRef.current);
          if(found.length){
            setCode(found[0].rawValue);
            setFormat(found[0].format==='qr_code'?'qr':'barcode');
            setMessage('Kód beolvasva.');
            streamRef.current?.getTracks().forEach(t=>t.stop());
            setCamera(false);
            return;
          }
        } catch {
          // ZXing fallback follows below.
        }
      }

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeOnceFromVideoElement(videoRef.current);
      setCode(result.getText());
      setFormat(String(result.getBarcodeFormat()).toUpperCase().includes('QR')?'qr':'barcode');
      setMessage('Kód beolvasva.');
      streamRef.current?.getTracks().forEach(t=>t.stop());
      setCamera(false);
    } catch {
      setMessage('Még nem látok olvasható kódot. Tartsd stabilan a kamera elé.');
    }
  }

  return <div className="modal-backdrop"><div className="modal-card">
    <div className="modal-head"><div><ScanLine/><h2>Kártya hozzáadása</h2></div><button className="icon-btn" onClick={onClose}><X/></button></div>
    <label>Üzlet<select value={store} onChange={e=>chooseStore(e.target.value as StoreId)}>{[...cardStoreOrder,'custom' as StoreId].map(s=><option key={s} value={s}>{stores[s].name}</option>)}</select></label>
    {store==='custom'&&<><label>Üzlet neve<input value={customStoreName} onChange={e=>setCustomStoreName(e.target.value)} placeholder="pl. Rossmann, Müller, DM"/></label><label>Kártya színe<div className="color-input-row"><input type="color" value={customColor} onChange={e=>setCustomColor(e.target.value)}/><span className="color-preview" style={{background:customColor,color:textForBackground(customColor)}}>{(customStoreName||'SAJÁT').slice(0,8).toUpperCase()}</span></div></label></>}
    <label>Kártya neve<input value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <div className="scan-actions"><button onClick={startCamera}><Camera/> Kamera</button><button onClick={()=>fileRef.current?.click()}><ImagePlus/> Kép/screenshot</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&detectFromFile(e.target.files[0])}/></div>
    {camera&&<div className="camera-box"><video ref={videoRef} playsInline muted/><div className="scan-frame"/><button className="primary" onClick={scanFrame}>Kód beolvasása</button></div>}
    <label>Kód<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Beolvashatod vagy beírhatod"/></label>
    <div className="segmented small"><button className={format==='qr'?'active':''} onClick={()=>setFormat('qr')}>QR</button><button className={format==='barcode'?'active':''} onClick={()=>setFormat('barcode')}>Vonalkód</button></div>
    {message&&<p className="scan-message">{message}</p>}
    <button className="primary wide" disabled={!code.trim()||(store==='custom'&&!customStoreName.trim())} onClick={()=>onSave({id:crypto.randomUUID(),store,label,code:code.trim(),format,customStoreName:store==='custom'?customStoreName.trim():undefined,customColor:store==='custom'?customColor:undefined})}><CheckCircle2/> Kártya mentése</button>
  </div></div>
}

function AddRetailerModal({onClose,onSave}:{onClose:()=>void;onSave:(r:CustomRetailer)=>void}){
  const [name,setName]=useState('');
  const [url,setUrl]=useState('');
  const [color,setColor]=useState('#0b2545');
  const [note,setNote]=useState('');
  function save(){
    if(!name.trim()) return;
    const normalized=url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim();
    onSave({id:crypto.randomUUID(),name:name.trim(),url:normalized||undefined,color,note:note.trim()||undefined});
  }
  return <div className="modal-backdrop"><div className="modal-card">
    <div className="modal-head"><div><Plus/><h2>Üzlet hozzáadása</h2></div><button className="icon-btn" onClick={onClose}><X/></button></div>
    <p className="muted">Saját üzletet vagy új akcióforrást is felvehetsz. Az URL megmarad a gyors eléréshez.</p>
    <label>Üzlet neve<input value={name} onChange={e=>setName(e.target.value)} placeholder="pl. Rossmann"/></label>
    <label>Akciós oldal / webcím<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." inputMode="url"/></label>
    <label>Szín<div className="color-input-row"><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><span className="color-preview" style={{background:color}}>{name.trim().slice(0,8).toUpperCase()||'ÜZLET'}</span></div></label>
    <label>Megjegyzés<input value={note} onChange={e=>setNote(e.target.value)} placeholder="pl. kártyás árak, online akciók"/></label>
    <button className="primary wide" disabled={!name.trim()} onClick={save}><CheckCircle2/> Üzlet mentése</button>
  </div></div>
}

function FullCard({ card, onClose }: { card:LoyaltyCard; onClose:()=>void }) {
  const v=cardVisual(card);
  useEffect(()=>{const old=document.body.style.background;document.body.style.background='#fff';return()=>{document.body.style.background=old}},[]);
  return <div className="full-card-screen"><div className="full-card-top"><button className="icon-btn" onClick={onClose}><X/></button><span>Pénztári nézet</span></div><div className="full-card-brand" style={{background:v.color,color:v.text}}><CardBadge card={card}/><h1>{card.label}</h1>{card.store==='custom'&&<small>{v.name}</small>}<p>{card.code}</p></div><div className="full-code"><CodeDisplay value={card.code} format={card.format} large/></div><p className="brightness-note">☀️ A képernyőt tartsd a leolvasó elé.</p></div>
}

function ProfileView({customRetailers,sourceStates,lastRefresh,watchTerms,setWatchTerms,watchHits,onAddRetailer,onRemoveRetailer}:{customRetailers:CustomRetailer[];sourceStates:SourceState[];lastRefresh:string;watchTerms:string[];setWatchTerms:Dispatch<SetStateAction<string[]>>;watchHits:WatchHit[];onAddRetailer:()=>void;onRemoveRetailer:(id:string)=>void}){
  const [watchInput,setWatchInput]=useState('');
  function addWatch(){
    const value=watchInput.trim();
    if(!value)return;
    setWatchTerms(prev=>prev.some(x=>sameWatchTerm(x,value))?prev:[...prev,value]);
    setWatchInput('');
  }
  const scrollTo=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'});
  return <div className="screen profile-screen">
    <BrandHeader onBell={()=>scrollTo('watch-panel')}/>
    <div className="profile-hero"><div className="avatar"><UserRound/></div><h1>MULTI AKCIÓK</h1><p>Saját bevásárlási asszisztens</p></div>
    <div className="settings-list">
      <button onClick={()=>scrollTo('watch-panel')}><Heart/> Figyelőlista <ChevronRight/></button>
      <button onClick={()=>scrollTo('source-panel')}><RefreshCw/> Adatforrások <ChevronRight/></button>
      <button onClick={onAddRetailer}><Plus/> Üzlet / forrás hozzáadása <ChevronRight/></button>
    </div>

    <div className="watch-panel" id="watch-panel">
      <div className="section-title"><h2>Figyelőlista</h2><small>{watchTerms.length} figyelés</small></div>
      <div className="watch-input"><input value={watchInput} onChange={e=>setWatchInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addWatch()}} placeholder="pl. vaj, lazac, futócipő"/><button onClick={addWatch}><Plus size={17}/></button></div>
      {watchTerms.length===0?<p className="watch-empty">Adj hozzá terméket vagy márkát, és frissítéskor megkeressük a legjobb aktuális ajánlatot.</p>:<div className="watch-chips">{watchTerms.map(term=>{const hit=watchHits.find(x=>x.term===term);return <div className="watch-chip" key={term}><div><b>{term}</b><small>{hit?stores[hit.offer.store].name+' · '+money(hit.offer.price):'Nincs aktuális találat'}</small></div><button onClick={()=>setWatchTerms(prev=>prev.filter(x=>x!==term))}><X size={14}/></button></div>})}</div>}
      <p className="feature-note"><Bell size={13}/> Az appon belüli figyelés működik. Háttér push értesítést csak a külön szerveres értesítési réteg bekötése után jelölünk aktívnak.</p>
    </div>

    <div className="source-panel" id="source-panel">
      <div className="section-title"><h2>Mai adatforrások</h2><small>{lastRefresh?new Date(lastRefresh).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}):''}</small></div>
      {sourceStates.map(s=><div className="source-row" key={s.id}><span className={s.ok&&s.count>0?'source-dot ok':s.ok?'source-dot warn':'source-dot bad'}/><div><b>{s.name}</b><small>{s.count>0?s.count+' ajánlat':s.note||'Nincs adat'}</small></div><a href={s.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a></div>)}
    </div>

    {customRetailers.length>0&&<div className="custom-retailers-panel"><div className="section-title"><h2>Saját üzletek</h2></div>{customRetailers.map(r=><div className="custom-retailer-row" key={r.id}><span style={{background:r.color}}>{r.name.slice(0,2).toUpperCase()}</span><div><b>{r.name}</b><small>{r.url||'Saját üzlet'}</small></div><button onClick={()=>onRemoveRetailer(r.id)} aria-label="Törlés"><Trash2 size={17}/></button></div>)}</div>}
  </div>
}

function BottomNav({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}){
  const items:[Tab,ReactNode,string][]=[['home',<Home key="h"/>,'Kezdőlap'],['search',<Search key="s"/>,'Keresés'],['list',<ListChecks key="l"/>,'Lista'],['cards',<CreditCard key="c"/>,'Kártyák'],['profile',<UserRound key="p"/>,'Profil']];
  return <nav className="bottom-nav">{items.map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>)}</nav>
}
