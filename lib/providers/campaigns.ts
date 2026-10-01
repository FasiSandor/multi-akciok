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


function numericRange(text:string){
  const m=text.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\.?\s*-\s*(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if(!m) return undefined;
  return {
    start:m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'),
    end:m[4]+'-'+m[5].padStart(2,'0')+'-'+m[6].padStart(2,'0')
  };
}

async function dmCampaigns():Promise<Campaign[]>{
  const url='https://www.dm.hu/';
  const html=await fetchHtml(url);
  const data=strip(html);
  const out:Campaign[]=[];
  const line=data.find(x=>/Bónusz hetek a dm-ben/i.test(x));
  if(line){
    const a=ascii(line);
    const m=a.match(/(20\d{2})[.\s]+([a-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})/i);
    let start:string|undefined,end:string|undefined;
    if(m){
      start=huDate(m[1],m[2],m[3]);
      end=huDate(m[1],m[2],m[4]);
    }
    out.push({
      id:'dm-bonus-weeks',
      store:'dm',
      title:'Bónusz hetek a dm-ben',
      subtitle:'Aktuális dm kampány és active beauty ajánlatok',
      validFrom:start,
      validTo:end,
      loyaltyOnly:true,
      sourceUrl:url
    });
  }
  return out;
}

async function mediaMarktCampaigns():Promise<Campaign[]>{
  const url='https://www.mediamarkt.hu/hu/campaign/promocioink';
  const html=await fetchHtml(url);
  const data=strip(html);
  const out:Campaign[]=[];
  for(let i=0;i<data.length;i++){
    if(!/^Érvényes:/i.test(data[i])) continue;
    const range=numericRange(data[i]);
    const title=data.slice(i+1,i+5).find(x=>x.length>5&&!/Megnézem|Lejár|nap/i.test(x));
    if(!title) continue;
    out.push({
      id:'mediamarkt-'+ascii(title).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60),
      store:'mediamarkt',
      title,
      subtitle:'MediaMarkt aktuális promóció',
      validFrom:range?.start,
      validTo:range?.end,
      sourceUrl:url
    });
    if(out.length>=6) break;
  }
  return dedupe(out);
}


async function ikeaCampaigns():Promise<Campaign[]>{
  const url='https://www.ikea.com/hu/hu/offers/';
  const html=await fetchHtml(url);
  const data=strip(html);
  const joined=data.join(' ');
  if(!/(?:2\s*\+\s*1|3\s*\+\s*1)/i.test(joined)) return [];
  const range=parseRange(joined);
  return [{
    id:'ikea-family-combine-save',
    store:'ikea',
    title:'IKEA Family: kombinálj és spórolj',
    subtitle:'2+1 és 3+1 ajánlatok kijelölt termékekre',
    discountText:'2+1 / 3+1',
    loyaltyOnly:true,
    validFrom:range?.start,
    validTo:range?.end,
    sourceUrl:url
  }];
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
  const results=await Promise.allSettled([obiCampaigns(),praktikerCampaigns(),dmCampaigns(),mediaMarktCampaigns(),ikeaCampaigns()]);
  return results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
}
