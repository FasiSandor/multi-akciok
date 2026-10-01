import { retailSources, scrapeRetailer } from './scrape';
import type { Offer } from '@/lib/types';

export type SourceState = { id: string; name: string; url: string; ok: boolean; checkedAt: string; count: number; note?: string };

export async function collectLiveOffers(): Promise<{offers:Offer[];sources:SourceState[]}> {
  const results=await Promise.all(retailSources.map(async source=>{
    try{
      const offers=await scrapeRetailer(source);
      return {offers,state:{...source,ok:true,checkedAt:new Date().toISOString(),count:offers.length}};
    }catch(error){
      return {offers:[] as Offer[],state:{...source,ok:false,checkedAt:new Date().toISOString(),count:0,note:error instanceof Error?error.message:'Ismeretlen hiba'}};
    }
  }));
  const dedup=new Map<string,Offer>();
  for(const r of results) for(const o of r.offers) dedup.set(o.id,o);
  return {offers:[...dedup.values()],sources:results.map(r=>r.state)};
}

export async function checkSources(){ return (await collectLiveOffers()).sources; }
