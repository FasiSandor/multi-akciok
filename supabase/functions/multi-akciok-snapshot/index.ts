import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OFFER_ENDPOINTS = [
  "https://multi-akciok.vercel.app/api/offers",
  "https://multi-akciok-fasi-sandor-s-projects.vercel.app/api/offers",
  "https://multi-akciok-git-main-fasi-sandor-s-projects.vercel.app/api/offers",
];

type Offer = { id:string; name:string; category:string; store:string; price:number; oldPrice?:number; unitLabel?:string; unitPrice?:number; validTo?:string; conditionText?:string; sourceUrl?:string; };
type PushTarget = { device_id:string; endpoint:string; watch_terms:string[]; last_hash:string|null; };
type PushConfig = { privateJwk: JsonWebKey; publicKey: string; };

async function rpc(name:string,body:Record<string,unknown>){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const text=await response.text();
  if(!response.ok) throw new Error(`${name} failed: ${response.status} ${text.slice(0,500)}`);
  if(!text) return null;
  try{return JSON.parse(text)}catch{return text}
}

async function loadOffers(){
  const errors:string[]=[];
  for(const url of OFFER_ENDPOINTS){
    try{
      const response=await fetch(url,{headers:{"User-Agent":"MULTI-AKCIOK-Supabase-Snapshot/1.0",Accept:"application/json"},signal:AbortSignal.timeout(25_000)});
      if(!response.ok){errors.push(`${url}: HTTP ${response.status}`);continue}
      const data=await response.json();
      if(!Array.isArray(data?.offers)){errors.push(`${url}: invalid payload`);continue}
      return {url,data};
    }catch(error){errors.push(`${url}: ${error instanceof Error?error.message:String(error)}`)}
  }
  throw new Error(errors.join(" | "));
}

function normalize(value:string){
  return value.toLocaleLowerCase("hu").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function base64Url(bytes:Uint8Array){
  let binary=""; for(const b of bytes) binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function base64UrlText(value:string){ return base64Url(new TextEncoder().encode(value)); }
async function sha256Text(value:string){ return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))); }

async function vapidJwt(endpoint:string,config:PushConfig){
  const header=base64UrlText(JSON.stringify({typ:"JWT",alg:"ES256"}));
  const payload=base64UrlText(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+43200,sub:"https://multi-akciok.vercel.app"}));
  const input=`${header}.${payload}`;
  const key=await crypto.subtle.importKey("jwk",config.privateJwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const signature=new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,new TextEncoder().encode(input)));
  return `${input}.${base64Url(signature)}`;
}

async function sendEmptyPush(endpoint:string,config:PushConfig){
  const token=await vapidJwt(endpoint,config);
  return fetch(endpoint,{method:"POST",headers:{TTL:"86400",Urgency:"normal",Authorization:`vapid t=${token}, k=${config.publicKey}`},signal:AbortSignal.timeout(15_000)});
}

function bestWatchState(offers:Offer[],terms:string[]){
  const parts:string[]=[]; let matchCount=0;
  for(const raw of terms.slice(0,30)){
    const term=normalize(raw); if(!term) continue;
    const words=term.split(" ").filter(Boolean);
    const matches=offers.filter(offer=>{
      const hay=normalize(`${offer.name} ${offer.category} ${offer.store}`);
      return words.every(word=>hay.includes(word));
    }).sort((a,b)=>Number(a.price)-Number(b.price));
    const best=matches[0];
    if(best){matchCount++;parts.push(`${term}|${best.id}|${Math.round(Number(best.price))}`)}
    else parts.push(`${term}|none`);
  }
  return {canonical:parts.sort().join("\n"),matchCount};
}

async function processPushes(offers:Offer[]){
  const targets=(await rpc("multi_akciok_push_targets",{})) as PushTarget[]|null;
  if(!Array.isArray(targets)||!targets.length) return {targets:0,sent:0,disabled:0};
  const config=(await rpc("multi_akciok_push_config",{})) as PushConfig;
  if(!config?.privateJwk||!config?.publicKey) return {targets:targets.length,sent:0,disabled:0};

  let sent=0,disabled=0;
  for(const target of targets){
    try{
      const state=bestWatchState(offers,Array.isArray(target.watch_terms)?target.watch_terms:[]);
      const hash=await sha256Text(state.canonical||"empty");
      if(hash===target.last_hash) continue;
      if(state.matchCount===0){
        await rpc("multi_akciok_mark_push",{p_device_id:target.device_id,p_hash:hash,p_disable:false});
        continue;
      }
      const response=await sendEmptyPush(target.endpoint,config);
      if(response.ok){
        sent++;
        await rpc("multi_akciok_mark_push",{p_device_id:target.device_id,p_hash:hash,p_disable:false});
      }else if(response.status===404||response.status===410){
        disabled++;
        await rpc("multi_akciok_mark_push",{p_device_id:target.device_id,p_hash:hash,p_disable:true});
      }
    }catch{}
  }
  return {targets:targets.length,sent,disabled};
}

Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("POST required",{status:405});
  let started=false;
  try{
    started=Boolean(await rpc("multi_akciok_try_begin_refresh",{p_min_minutes:45}));
    if(!started) return Response.json({ok:true,skipped:true,reason:"recent_refresh"});

    const {url,data}=await loadOffers();
    const today=new Date().toISOString().slice(0,10);
    const offers=(data.offers as Offer[]).filter(offer=>offer&&typeof offer.id==="string"&&typeof offer.store==="string"&&typeof offer.name==="string"&&typeof offer.category==="string"&&Number.isFinite(Number(offer.price))&&Number(offer.price)>0).slice(0,5000);

    const rows=offers.map(offer=>({
      observed_date:today,
      offer_key:String(offer.id).slice(0,220),
      store:String(offer.store).slice(0,80),
      name:String(offer.name).slice(0,320),
      category:String(offer.category).slice(0,140),
      price:Math.round(Number(offer.price)),
      old_price:Number.isFinite(Number(offer.oldPrice))?Math.round(Number(offer.oldPrice)):null,
      unit_label:String(offer.unitLabel||"1 db").slice(0,120),
      unit_price:Number.isFinite(Number(offer.unitPrice))?Number(offer.unitPrice):null,
      valid_to:/^\d{4}-\d{2}-\d{2}$/.test(String(offer.validTo||""))?offer.validTo:null,
      condition_text:offer.conditionText?String(offer.conditionText).slice(0,220):null,
      source_url:offer.sourceUrl?String(offer.sourceUrl).slice(0,1200):null
    }));

    const stored=Number(await rpc("multi_akciok_upsert_snapshots",{p_rows:rows}))||0;
    const push=await processPushes(offers);
    await rpc("multi_akciok_finish_refresh",{p_status:"success",p_count:stored,p_error:null});

    return Response.json({ok:true,skipped:false,source:url,offers_received:data.offers.length,stored,push,source_states:Array.isArray(data.sourceStates)?data.sourceStates:[]});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(started){try{await rpc("multi_akciok_finish_refresh",{p_status:"error",p_count:0,p_error:message})}catch{}}
    return Response.json({ok:false,error:message},{status:500});
  }
});