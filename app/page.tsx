'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import {
  Bell, Search, ListChecks, CreditCard, UserRound, Home, Heart, ChevronRight, ArrowLeft,
  BarChart3, Plus, Camera, X, Sparkles, MapPin, ScanLine, Trash2, CheckCircle2, RefreshCw,
  Tag, ShoppingCart, SlidersHorizontal, WalletCards, ExternalLink, ImagePlus
} from 'lucide-react';
import type { CustomRetailer, LoyaltyCard, Offer, StoreId } from '@/lib/types';
import { fallbackOffers } from '@/lib/fallback-offers';
import { knownStoreOrder, stores } from '@/lib/stores';
import { CodeDisplay } from '@/components/CodeDisplay';
import { recordOfferHistory, readOfferHistoryStats, type HistoryStats } from '@/lib/client-history';
import { evaluateWatchTerms, type WatchHit } from '@/lib/client-watch';

type Tab = 'home' | 'search' | 'list' | 'cards' | 'profile';
type SourceState = { id:string; name:string; url:string; ok:boolean; checkedAt:string; count:number; note?:string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string; format: string }>>;
};

declare global {
  interface Window { BarcodeDetector?: BarcodeDetectorCtor }
}

const storeOrder: StoreId[] = knownStoreOrder;

function money(value: number) {
  return new Intl.NumberFormat('hu-HU').format(value) + ' Ft';
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

export default function Page() {
  const [tab, setTab] = useState<Tab>('home');
  const [offers, setOffers] = useState<Offer[]>(process.env.NODE_ENV === 'development' ? fallbackOffers : []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Offer | null>(null);
  const [listIds, setListIds] = useState<string[]>([]);
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

  useEffect(() => {
    const savedCards = localStorage.getItem('multi-akciok-cards');
    const savedList = localStorage.getItem('multi-akciok-list');
    const savedRetailers = localStorage.getItem('multi-akciok-custom-retailers');
    const savedWatchTerms = localStorage.getItem('multi-akciok-watch-terms');
    setCards(savedCards ? JSON.parse(savedCards) : []);
    if (savedList) setListIds(JSON.parse(savedList));
    if (savedRetailers) setCustomRetailers(JSON.parse(savedRetailers));
    const initialWatchTerms = savedWatchTerms ? JSON.parse(savedWatchTerms) : [];
    setWatchTerms(initialWatchTerms);
    refreshOffers(initialWatchTerms);
  }, []);

  useEffect(() => {
    if (cards.length) localStorage.setItem('multi-akciok-cards', JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    localStorage.setItem('multi-akciok-list', JSON.stringify(listIds));
  }, [listIds]);

  useEffect(() => {
    localStorage.setItem('multi-akciok-custom-retailers', JSON.stringify(customRetailers));
  }, [customRetailers]);

  useEffect(() => {
    localStorage.setItem('multi-akciok-watch-terms', JSON.stringify(watchTerms));
    setWatchHits(evaluateWatchTerms(offers, watchTerms));
  }, [watchTerms, offers]);

  async function refreshOffers(termsOverride?: string[]) {
    setRefreshing(true);
    try {
      const res = await fetch('/api/offers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.offers)) { setOffers(data.offers); recordOfferHistory(data.offers); setWatchHits(evaluateWatchTerms(data.offers, termsOverride ?? watchTerms)); }
        if (Array.isArray(data.sourceStates)) setSourceStates(data.sourceStates);
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

  return (
    <main className="app-shell">
      <section className="phone-app">
        {selected ? (
          <OfferDetail offer={selected} allOffers={offers} onBack={() => setSelected(null)} />
        ) : tab === 'home' ? (
          <HomeView offers={filtered} query={query} setQuery={setQuery} onSelect={setSelected} setTab={setTab} refresh={() => refreshOffers()} refreshing={refreshing} lastRefresh={lastRefresh} customRetailers={customRetailers} watchHits={watchHits} onAddRetailer={() => setRetailerModal(true)} />
        ) : tab === 'search' ? (
          <SearchView offers={filtered} query={query} setQuery={setQuery} onSelect={setSelected} />
        ) : tab === 'list' ? (
          <ListView offers={offers} listIds={listIds} setListIds={setListIds} />
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
      <button className="location"><MapPin size={15} fill="currentColor" /> Magyarország <ChevronRight size={14} /></button>
    </>
  );
}

function HomeView({ offers, query, setQuery, onSelect, setTab, refresh, refreshing, lastRefresh, customRetailers, watchHits, onAddRetailer }: {
  offers: Offer[]; query: string; setQuery: (s: string) => void; onSelect: (o: Offer) => void; setTab: (t: Tab) => void;
  refresh: () => void; refreshing: boolean; lastRefresh: string; customRetailers: CustomRetailer[]; watchHits: WatchHit[]; onAddRetailer: () => void;
}) {
  const top = offers.slice(0, 3);
  const categories = [
    ['🥩', 'Élelmiszer'], ['🛋️', 'Lakberendezés'], ['🏃', 'Sport'], ['🛠️', 'Barkács'],
    ['👟', 'Cipő'], ['🌿', 'Kert'], ['🧴', 'Háztartás'], ['🏷️', 'Minden akció']
  ];
  return (
    <div className="screen home-screen">
      <BrandHeader />
      <div className="searchbox"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Keress terméket, márkát vagy üzletet..." /></div>
      {watchHits.length>0&&<div className="watch-banner"><div className="watch-banner-head"><Bell size={16}/><strong>Figyelt ajánlatok</strong><span>{watchHits.length}</span></div>{watchHits.slice(0,2).map(hit=><button key={hit.term} onClick={()=>onSelect(hit.offer)}><div><b>{hit.term}</b><small>{hit.status==='lower'?'Olcsóbb lett':hit.status==='new'?'Új találat':'Aktuális találat'} · {stores[hit.offer.store].name}</small></div><strong>{money(hit.offer.price)}</strong><ChevronRight size={16}/></button>)}</div>}
      <div className="stores-row">
        {storeOrder.map(s => <div className="store-chip" key={s}><StoreBadge store={s} /><span>{stores[s].name}</span></div>)}
        {customRetailers.map(r => <button className="store-chip custom-store-chip" key={r.id} onClick={() => r.url && window.open(r.url, '_blank', 'noopener,noreferrer')}><span className="custom-store-badge" style={{background:r.color}}>{r.name.slice(0,6).toUpperCase()}</span><span>{r.name}</span></button>)}
        <button className="store-chip add-store-chip" onClick={onAddRetailer}><span className="custom-store-badge add"><Plus size={18}/></span><span>Üzlet</span></button>
      </div>
      <div className="section-title"><h2>Mai legjobb akciók</h2><button onClick={() => setTab('search')}>Összes <ChevronRight size={16}/></button></div>
      <div className="offer-grid">
        {top.map(o => <OfferCard key={o.id} offer={o} onClick={() => onSelect(o)} />)}
      </div>
      <div className="fresh-banner">
        <div><span>FRISS</span><strong>Élelmiszer, otthon, sport és barkács akciók egy helyen</strong><button onClick={() => setTab('search')}>Megnézem <ChevronRight size={15}/></button></div>
        <div className="banner-food">🛒🏠🏃</div>
      </div>
      <div className="section-title"><h2>Kategóriák</h2><button onClick={() => setTab('search')}>Összes <ChevronRight size={16}/></button></div>
      <div className="category-row">{categories.map(([e, n]) => <button key={n} onClick={() => { setQuery(n === 'Minden akció' ? '' : n); setTab('search'); }}><span>{e}</span><small>{n}</small></button>)}</div>
      <div className="daily-status">
        <div><RefreshCw size={16} className={refreshing ? 'spin' : ''}/><span>{lastRefresh ? `Frissítve: ${new Date(lastRefresh).toLocaleString('hu-HU', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}` : 'Napi automatikus frissítés'}</span></div>
        <button onClick={refresh} disabled={refreshing}>Frissítés</button>
      </div>
    </div>
  );
}

function OfferCard({ offer, onClick }: { offer: Offer; onClick: () => void }) {
  const d = discount(offer);
  return (
    <button className="offer-card" onClick={onClick}>
      {d > 0 && <span className="discount">-{d}%</span>}
      <div className="offer-img"><Image src={offer.image} alt={offer.name} fill sizes="30vw" /></div>
      <strong>{offer.name}</strong><small>{offer.unitLabel}</small>
      <b>{money(offer.price)}</b>{offer.oldPrice && <del>{money(offer.oldPrice)}</del>}
      <span className="unit-price">{offer.unitPrice ? `${money(offer.unitPrice)}/kg` : ' '}</span>
      <div className="offer-foot"><StoreBadge store={offer.store} compact/><span>{new Date(offer.validTo).toLocaleDateString('hu-HU',{month:'short',day:'numeric'})}-ig</span><Heart size={17}/></div>
    </button>
  );
}

function SearchView({ offers, query, setQuery, onSelect }: { offers: Offer[]; query: string; setQuery: (s: string) => void; onSelect: (o: Offer) => void }) {
  return (
    <div className="screen search-screen">
      <h1>Akciókereső</h1>
      <div className="searchbox large"><Search size={20}/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Mit keresel?"/><SlidersHorizontal size={19}/></div>
      <div className="filter-chips"><button className="active">Összes</button>{storeOrder.map(s=><button key={s}>{stores[s].name}</button>)}</div>
      <p className="result-count">{offers.length} aktuális ajánlat</p>
      <div className="results-list">
        {offers.map(o => <button className="result-card" key={o.id} onClick={()=>onSelect(o)}>
          <div className="result-image"><Image src={o.image} alt={o.name} fill sizes="88px"/></div>
          <div className="result-main"><div className="result-top"><StoreBadge store={o.store} compact/>{discount(o)>0&&<span className="discount inline">-{discount(o)}%</span>}</div><strong>{o.name}</strong><small>{o.unitLabel} · {o.category}</small></div>
          <div className="result-price"><b>{money(o.price)}</b>{o.oldPrice&&<del>{money(o.oldPrice)}</del>}<ChevronRight size={18}/></div>
        </button>)}
      </div>
    </div>
  );
}

function OfferDetail({ offer, allOffers, onBack }: { offer: Offer; allOffers: Offer[]; onBack: () => void }) {
  const [history, setHistory] = useState<HistoryStats | null>(null);
  useEffect(() => setHistory(readOfferHistoryStats(offer)), [offer]);
  const comparable = allOffers.filter(o => o.category === offer.category || o.name.toLowerCase().includes(offer.name.split(' ')[0].toLowerCase())).slice(0,5);
  return (
    <div className="screen detail-screen">
      <div className="detail-nav"><button className="icon-btn" onClick={onBack}><ArrowLeft/></button><div><button className="icon-btn"><Heart/></button><button className="icon-btn"><ExternalLink/></button></div></div>
      <div className="hero-product"><Image src={offer.image} alt={offer.name} fill sizes="80vw" /></div>
      <h1>{offer.name}</h1><p>{offer.unitLabel}</p>
      <div className="segmented"><button className="active">Árak és üzletek</button><button>Árhistorika</button></div>
      <div className="compare-list">
        {[offer, ...comparable.filter(x=>x.id!==offer.id)].slice(0,5).map((o,i)=><div className="compare-row" key={o.id}>
          <StoreBadge store={o.store}/><div><strong>{stores[o.store].name}</strong>{o.loyaltyOnly&&<small>Kártyás ár</small>}</div><div className="compare-price"><b>{money(o.price)}</b>{o.oldPrice&&<del>{money(o.oldPrice)}</del>}{discount(o)>0&&<span className="discount inline">-{discount(o)}%</span>}</div><Heart size={18}/>
        </div>)}
      </div>
      <div className="deal-score"><BarChart3 size={31}/><div><strong>{history && history.samples > 1 ? 'Saját árhistorika' : 'Árhistorika épül'}</strong><span>Most: <b>{money(offer.price)}</b>{history && history.samples > 1 ? <><br/>Átlag: <b>{money(history.average)}</b> · minimum: <b>{money(history.minimum)}</b></> : <><br/>Az app csak valóban összegyűjtött korábbi árakból számol.</>}</span></div>{history && history.samples > 1 ? <div className="history-pending">{history.samples} nap<small>{offer.price < history.average ? 'átlag alatt' : 'mért adat'}</small></div> : <div className="history-pending">1. nap<small>adatgyűjtés</small></div>}</div>
    </div>
  );
}

function ListView({ offers, listIds, setListIds }: { offers: Offer[]; listIds: string[]; setListIds: (v: string[])=>void }) {
  const [oneStore,setOneStore]=useState(false);
  const [addOpen,setAddOpen]=useState(false);
  const [addQuery,setAddQuery]=useState('');

  const selected = listIds.map(id=>offers.find(o=>o.id===id)).filter(Boolean) as Offer[];

  function norm(value:string){
    return value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function tokens(value:string){
    return norm(value).split(' ').filter(x=>x.length>=4 && !['friss','akcios','termek','felnott','gyerek','ferfi'].includes(x));
  }
  function similarity(a:Offer,b:Offer){
    if(a.category!==b.category) return 0;
    const ta=tokens(a.name),tb=tokens(b.name);
    if(!ta.length||!tb.length) return 0;
    const overlap=ta.filter(x=>tb.some(y=>y===x||y.includes(x)||x.includes(y))).length;
    return overlap/Math.max(ta.length,tb.length);
  }
  function alternatives(item:Offer,store?:StoreId){
    return offers
      .filter(o=>(!store||o.store===store) && (o.id===item.id || similarity(item,o)>=0.5))
      .sort((a,b)=>a.price-b.price);
  }

  const originalTotal=selected.reduce((a,b)=>a+b.price,0);
  const mixedPicks=selected.map(item=>alternatives(item)[0]??item);
  const mixedTotal=mixedPicks.reduce((a,b)=>a+b.price,0);

  const oneStoreOptions=storeOrder.map(store=>{
    const picks=selected.map(item=>alternatives(item,store)[0]).filter(Boolean) as Offer[];
    return {store,picks,total:picks.reduce((a,b)=>a+b.price,0),complete:picks.length===selected.length};
  }).filter(x=>x.complete).sort((a,b)=>a.total-b.total);
  const bestOneStore=oneStoreOptions[0];

  const plan=oneStore?(bestOneStore?.picks??[]):mixedPicks;
  const planTotal=oneStore?(bestOneStore?.total??0):mixedTotal;
  const saving=Math.max(0,originalTotal-planTotal);
  const planTotals=storeOrder.map(store=>({
    store,
    total:plan.filter(o=>o.store===store).reduce((a,b)=>a+b.price,0),
    count:plan.filter(o=>o.store===store).length
  })).filter(x=>x.count>0);

  const q=norm(addQuery);
  const addResults=offers.filter(o=>!listIds.includes(o.id) && (!q||norm(o.name+' '+o.category+' '+stores[o.store].name).includes(q))).slice(0,8);

  return (
    <div className="screen list-screen">
      <div className="title-with-plus"><div><ListChecks/><h1>Bevásárlólista</h1></div><button className="round-plus" onClick={()=>setAddOpen(v=>!v)}><Plus/></button></div>
      <button className="toggle-row button-toggle" onClick={()=>setOneStore(v=>!v)}><span className={'toggle '+(oneStore?'on':'')}><i/></span> Csak egy üzletbe megyek <span className="info-dot">i</span></button>

      {addOpen&&<div className="list-add-panel">
        <div className="searchbox"><Search size={18}/><input autoFocus value={addQuery} onChange={e=>setAddQuery(e.target.value)} placeholder="Mit szeretnél venni?"/></div>
        <div className="list-add-results">{addResults.map(o=><button key={o.id} onClick={()=>{setListIds([...listIds,o.id]);setAddQuery('')}}><div className="mini-food"><Image src={o.image} alt="" fill sizes="44px"/></div><div><b>{o.name}</b><small>{stores[o.store].name} · {o.unitLabel}</small></div><strong>{money(o.price)}</strong><Plus size={16}/></button>)}</div>
      </div>}

      <div className="list-layout">
        <div className="shopping-items">
          {selected.length===0&&<div className="list-empty"><ShoppingCart size={28}/><b>A listád még üres</b><small>Adj hozzá aktuális ajánlatot a + gombbal.</small></div>}
          {selected.map(o=>{const best=alternatives(o)[0]; const cheaper=best&&best.price<o.price?best:null; return <div className="shopping-item selected-item" key={o.id}>
            <button className="remove-list-item" onClick={()=>setListIds(listIds.filter(x=>x!==o.id))}><X size={14}/></button><div className="mini-food"><Image src={o.image} alt="" fill sizes="44px"/></div><div><strong>{o.name}</strong><small>{o.unitLabel}{cheaper?' · máshol '+money(cheaper.price):''}</small></div><div className="item-price"><b>{money(o.price)}</b><StoreBadge store={o.store} compact/></div><span className="drag">≡</span>
          </div>})}
          <button className="add-product" onClick={()=>setAddOpen(v=>!v)}><Plus size={18}/> Termék hozzáadása</button>
        </div>

        <div className="optimizer-card">
          <span className="trophy">{oneStore?'🏪':'✨'}</span>
          <small>{oneStore?'Legjobb egyboltos kosár':'Legolcsóbb kombináció'}</small>
          <strong>{selected.length&&plan.length?money(planTotal):'—'}</strong>
          <p>{selected.length?selected.length+' tétel · aktuális ajánlatok alapján':'Adj hozzá termékeket'}</p>
          {saving>0&&<div className="optimizer-saving">−{money(saving)}</div>}
          <hr/>
          {oneStore&&!bestOneStore&&selected.length>0?<p className="optimizer-warning">A jelenlegi akciós adatok alapján nincs olyan üzlet, ahol minden kiválasztott tételhez találtunk megfelelő ajánlatot.</p>:<>
            <b>{oneStore?'Egy üzlet':'Boltonként'}</b>
            {planTotals.map(x=><div className="store-total" key={x.store}><StoreBadge store={x.store} compact/><span>{x.count} db · {money(x.total)}</span></div>)}
          </>}
        </div>
      </div>

      <button className="primary wide" disabled={!selected.length||!plan.length}><Sparkles size={18}/> {oneStore?'Legjobb egy üzlet':'Lista optimalizálva'}</button>
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
          const s=stores[card.store];
          return <button className="wallet-card" key={card.id} onClick={()=>onOpen(card)} style={{background:s.color,color:s.text}}>
            <div className="wallet-brand"><StoreBadge store={card.store}/><div><strong>{card.label}</strong><small>{card.code.replace(/(.{4})/g,'$1 ').trim()}</small></div></div>
            <div className="wallet-code"><CodeDisplay value={card.code} format={card.format}/></div>
          </button>
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
  const fileRef=useRef<HTMLInputElement>(null);
  const videoRef=useRef<HTMLVideoElement>(null);
  const [camera,setCamera]=useState(false);
  const streamRef=useRef<MediaStream|null>(null);

  useEffect(()=>()=>{streamRef.current?.getTracks().forEach(t=>t.stop())},[]);

  function chooseStore(value: StoreId) { setStore(value); setLabel(value==='custom'?'Saját hűségkártya':stores[value].name + (value==='tesco'?' Clubcard':value==='lidl'?' Plus':' kártya')); }

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
      const result = reader.decode(videoRef.current);
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
    <label>Üzlet<select value={store} onChange={e=>chooseStore(e.target.value as StoreId)}>{[...storeOrder,'custom' as StoreId].map(s=><option key={s} value={s}>{stores[s].name}</option>)}</select></label>
    <label>Kártya neve<input value={label} onChange={e=>setLabel(e.target.value)}/></label>
    <div className="scan-actions"><button onClick={startCamera}><Camera/> Kamera</button><button onClick={()=>fileRef.current?.click()}><ImagePlus/> Kép/screenshot</button><input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>e.target.files?.[0]&&detectFromFile(e.target.files[0])}/></div>
    {camera&&<div className="camera-box"><video ref={videoRef} playsInline muted/><div className="scan-frame"/><button className="primary" onClick={scanFrame}>Kód beolvasása</button></div>}
    <label>Kód<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Beolvashatod vagy beírhatod"/></label>
    <div className="segmented small"><button className={format==='qr'?'active':''} onClick={()=>setFormat('qr')}>QR</button><button className={format==='barcode'?'active':''} onClick={()=>setFormat('barcode')}>Vonalkód</button></div>
    {message&&<p className="scan-message">{message}</p>}
    <button className="primary wide" disabled={!code.trim()} onClick={()=>onSave({id:crypto.randomUUID(),store,label,code:code.trim(),format})}><CheckCircle2/> Kártya mentése</button>
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
  const s=stores[card.store];
  useEffect(()=>{const old=document.body.style.background;document.body.style.background='#fff';return()=>{document.body.style.background=old}},[]);
  return <div className="full-card-screen"><div className="full-card-top"><button className="icon-btn" onClick={onClose}><X/></button><span>Pénztári nézet</span></div><div className="full-card-brand" style={{background:s.color,color:s.text}}><StoreBadge store={card.store}/><h1>{card.label}</h1><p>{card.code}</p></div><div className="full-code"><CodeDisplay value={card.code} format={card.format} large/></div><p className="brightness-note">☀️ A képernyőt tartsd a leolvasó elé.</p></div>
}

function ProfileView({customRetailers,sourceStates,lastRefresh,watchTerms,setWatchTerms,watchHits,onAddRetailer,onRemoveRetailer}:{customRetailers:CustomRetailer[];sourceStates:SourceState[];lastRefresh:string;watchTerms:string[];setWatchTerms:Dispatch<SetStateAction<string[]>>;watchHits:WatchHit[];onAddRetailer:()=>void;onRemoveRetailer:(id:string)=>void}){const [watchInput,setWatchInput]=useState('');function addWatch(){const value=watchInput.trim();if(!value)return;setWatchTerms(prev=>prev.some(x=>x.toLocaleLowerCase('hu')===value.toLocaleLowerCase('hu'))?prev:[...prev,value]);setWatchInput('');}return <div className="screen profile-screen"><BrandHeader/><div className="profile-hero"><div className="avatar"><UserRound/></div><h1>MULTI AKCIÓK</h1><p>Saját bevásárlási asszisztens</p></div><div className="settings-list"><button><Heart/> Figyelőlista <ChevronRight/></button><button><Bell/> Értesítések <ChevronRight/></button><button><Tag/> Árhistorika <ChevronRight/></button><button onClick={onAddRetailer}><Plus/> Üzlet / forrás hozzáadása <ChevronRight/></button></div><div className="watch-panel"><div className="section-title"><h2>Figyelőlista</h2><small>{watchTerms.length} figyelés</small></div><div className="watch-input"><input value={watchInput} onChange={e=>setWatchInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addWatch()}} placeholder="pl. vaj, lazac, futócipő"/><button onClick={addWatch}><Plus size={17}/></button></div>{watchTerms.length===0?<p className="watch-empty">Adj hozzá terméket vagy márkát, és frissítéskor megkeressük a legjobb aktuális ajánlatot.</p>:<div className="watch-chips">{watchTerms.map(term=>{const hit=watchHits.find(x=>x.term===term);return <div className="watch-chip" key={term}><div><b>{term}</b><small>{hit?stores[hit.offer.store].name+' · '+money(hit.offer.price):'Nincs aktuális találat'}</small></div><button onClick={()=>setWatchTerms(prev=>prev.filter(x=>x!==term))}><X size={14}/></button></div>})}</div>}</div><div className="source-panel"><div className="section-title"><h2>Mai adatforrások</h2><small>{lastRefresh?new Date(lastRefresh).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}):''}</small></div>{sourceStates.map(s=><div className="source-row" key={s.id}><span className={s.ok&&s.count>0?'source-dot ok':s.ok?'source-dot warn':'source-dot bad'}/><div><b>{s.name}</b><small>{s.count>0?`${s.count} ajánlat`:s.note||'Nincs adat'}</small></div><a href={s.url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a></div>)}</div>{customRetailers.length>0&&<div className="custom-retailers-panel"><div className="section-title"><h2>Saját üzletek</h2></div>{customRetailers.map(r=><div className="custom-retailer-row" key={r.id}><span style={{background:r.color}}>{r.name.slice(0,2).toUpperCase()}</span><div><b>{r.name}</b><small>{r.url||'Saját üzlet'}</small></div><button onClick={()=>onRemoveRetailer(r.id)} aria-label="Törlés"><Trash2 size={17}/></button></div>)}</div>}</div>}

function BottomNav({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}){
  const items:[Tab,ReactNode,string][]=[['home',<Home key="h"/>,'Kezdőlap'],['search',<Search key="s"/>,'Keresés'],['list',<ListChecks key="l"/>,'Lista'],['cards',<CreditCard key="c"/>,'Kártyák'],['profile',<UserRound key="p"/>,'Profil']];
  return <nav className="bottom-nav">{items.map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>)}</nav>
}
