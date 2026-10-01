import type { Campaign } from '@/lib/types';

function strip(html:string){
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/h\d|\/section|\/article)[^>]*>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/[ \t]+/g,' ')
    .split(/\n+/)
    .map(x=>x.trim())
    .filter(Boolean);
}

async function fetchHtml(url:string){
  const res=await fetch(url,{
    headers:{'user-agent':'Mozilla/5.0 (compatible; MultiAkciok/1.0)','accept-language':'hu-HU,hu;q=0.9'},
    next:{revalidate:3600},
    signal:AbortSignal.timeout(12000)
  });
  if(!res.ok) throw new Error('HTTP '+res.status);
  return res.text();
}

const months:Record<string,number>={
  januar:1,januarban:1,februar:2,februarban:2,marcius:3,marciusban:3,aprilis:4,aprilisban:4,
  majus:5,majusban:5,junius:6,juniusban:6,julius:7,juliusban:7,augusztus:8,augusztusban:8,
  szeptember:9,szeptemberben:9,oktober:10,oktoberben:10,november:11,novemberben:11,december:12,decemberben:12
};

function ascii(value:string){
  return value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function huDate(year:string,month:string,day:string){
  const m=months[ascii(month)];
  if(!m) return undefined;
  return year+'-'+String(m).padStart(2,'0')+'-'+String(Number(day)).padStart(2,'0');
}

function parseRange(text:string){
  const a=ascii(text);
  const full=a.match(/(20\d{2})[.\s]+([a-z]+)\s+(\d{1,2})[^0-9]+(?:es|és|tol|től|-)\s*(?:(20\d{2})[.\s]+)?([a-z]+)\s+(\d{1,2})/i);
  if(full){
    const start=huDate(full[1],full[2],full[3]);
    const end=huDate(full[4]||full[1],full[5],full[6]);
    if(start&&end) return {start,end};
  }
  const tol=a.match(/(20\d{2})[.\s]+([a-z]+)\s+(\d{1,2})[^0-9]+(?:napjatol|tol|től)[^0-9]+(?:(20\d{2})[.\s]+)?([a-z]+)\s+(\d{1,2})/i);
  if(tol){
    const start=huDate(tol[1],tol[2],tol[3]);
    const end=huDate(tol[4]||tol[1],tol[5],tol[6]);
    if(start&&end) return {start,end};
  }
  return undefined;
}

function dedupe(items:Campaign[]){
  const m=new Map<string,Campaign>();
  for(const x of items)m.set(x.id,x);
  return [...m.values()];
}

async function obiCampaigns():Promise<Campaign[]>{
  const url='https://www.obi.hu/ajanlatok';
  const html=await fetchHtml(url);
  const data=strip(html);
  const out:Campaign[]=[];

  for(let i=0;i<data.length;i++){
    const line=data[i];
    if(/kiadványunk/i.test(line)){
      const rangeLine=data.slice(i,i+5).find(x=>/Érvényes/i.test(x));
      const range=rangeLine?parseRange(rangeLine):undefined;
      out.push({
        id:'obi-current-catalogue',
        store:'obi',
        title:line.replace(/^#+\s*/,''),
        subtitle:'Aktuális OBI kiadvány',
        validFrom:range?.start,
        validTo:range?.end,
        sourceUrl:url
      });
    }
    const code=line.match(/KUPONKÓD:\s*([A-Z0-9_-]+)/i);
    if(code){
      const title=[...data.slice(Math.max(0,i-5),i)].reverse().find(x=>x.length>4&&!/részletek|feltételek|érvényes|kedvezmény/i.test(x))||'OBI kupon';
      const rangeLine=data.slice(i,i+10).find(x=>/érvényess|között/i.test(x));
      const range=rangeLine?parseRange(rangeLine):undefined;
      out.push({
        id:'obi-coupon-'+code[1].toLowerCase(),
        store:'obi',
        title,
        discountText:'Kuponos ajánlat',
        code:code[1],
        validFrom:range?.start,
        validTo:range?.end,
        sourceUrl:url
      });
    }
  }
  return dedupe(out);
}

async function praktikerCampaigns():Promise<Campaign[]>{
  const url='https://www.praktiker.hu/praktiker-plusz-ar/sp';
  const html=await fetchHtml(url);
  const data=strip(html);
  const joined=data.join(' ');
  const out:Campaign[]=[];

  if(/15% kedvezm/i.test(joined)&&/tapéta/i.test(joined)){
    const range=parseRange(joined);
    out.push({
      id:'praktiker-plus-wallpaper-15',
      store:'praktiker',
      title:'Praktiker Plusz: 15% kedvezmény tapétákra',
      subtitle:'Teljes árú tapétákra Praktiker Plusz kártyával',
      discountText:'-15%',
      loyaltyOnly:true,
      validFrom:range?.start,
      validTo:range?.end,
      sourceUrl:url
    });
  }
  return out;
}

export async function collectCampaigns():Promise<Campaign[]>{
  const results=await Promise.allSettled([obiCampaigns(),praktikerCampaigns()]);
  return results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
}
