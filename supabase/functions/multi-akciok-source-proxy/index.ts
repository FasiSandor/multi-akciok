import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const browserHeaders = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36",
  "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.7",
  "Accept": "text/html,application/xhtml+xml,application/json"
};

async function fetchText(url: string, headers: Record<string,string> = browserHeaders) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(25_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { text, finalUrl: res.url };
}

async function spar() {
  const { text } = await fetchText("https://www.spar.hu/akcioterv");
  return new Response(text, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
}

async function decathlonSale() {
  const officialUrl = "https://www.decathlon.hu/deals/decathlon-ajanlatai?from=0&size=40";
  const { text } = await fetchText("https://r.jina.ai/" + officialUrl, {
    "User-Agent": "MULTI-AKCIOK/1.0",
    "Accept": "text/html",
    "X-Return-Format": "html"
  });
  if (!text.includes("product-card") || !text.includes("Jelenlegi ár")) {
    throw new Error("Decathlon renderelt terméklista érvénytelen");
  }
  return new Response(text, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
}

function extractJsonObject(html: string, marker: string) {
  const markerPos = html.indexOf(marker);
  if (markerPos < 0) throw new Error("marker not found");
  const start = html.indexOf("{", markerPos);
  if (start < 0) throw new Error("JSON start not found");
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error("JSON end not found");
}

async function auchanWeekly() {
  const { text: listText } = await fetchText("https://auchan.hu/api/v2/catalog/list");
  const catalogs = JSON.parse(listText);
  if (!Array.isArray(catalogs)) throw new Error("Invalid Auchan catalog list");
  const now = Date.now();
  const active = catalogs
    .filter((x:any)=>x&&/Heti Hipermarket ajánlataink/i.test(String(x.title||"")))
    .filter((x:any)=>{
      const from=Date.parse(String(x.availabilityFromDate||x.viewFromDate||""));
      const to=Date.parse(String(x.availabilityToDate||x.viewToDate||""));
      return Number.isFinite(from)&&Number.isFinite(to)&&from<=now&&now<=to;
    })
    .sort((a:any,b:any)=>Date.parse(String(b.availabilityFromDate||""))-Date.parse(String(a.availabilityFromDate||"")))[0];

  if (!active?.flipbookUrl) throw new Error("No active Auchan weekly catalog");
  const flipbook=new URL(String(active.flipbookUrl));
  if (flipbook.hostname!=="reklamujsag.auchan.hu") throw new Error("Unexpected Auchan flipbook host");

  const { text: html }=await fetchText(flipbook.toString());
  const settings=JSON.parse(extractJsonObject(html,"window.staticSettings"));
  const pageTexts=Array.isArray(settings?.pageTexts)?settings.pageTexts:[];
  if(!pageTexts.length) throw new Error("Auchan pageTexts empty");

  return Response.json({
    catalog:{
      id:active.id,
      title:active.title,
      validFrom:String(active.availabilityFromDate||active.viewFromDate||"").slice(0,10),
      validTo:String(active.availabilityToDate||active.viewToDate||"").slice(0,10),
      cover:active.cover,
      sourceUrl:flipbook.toString()
    },
    pageTexts
  },{headers:{"Cache-Control":"public, max-age=300"}});
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST required",{status:405});
  const body=await req.json().catch(()=>({}));
  const source=String(body?.source||"");
  try {
    if(source==="spar") return await spar();
    if(source==="decathlon-sale") return await decathlonSale();
    if(source==="auchan-weekly") return await auchanWeekly();
    return Response.json({ok:false,error:"unsupported source"},{status:400});
  } catch(error) {
    return Response.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:502});
  }
});