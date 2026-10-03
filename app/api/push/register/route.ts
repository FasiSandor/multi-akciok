import { NextResponse } from 'next/server';

const SUPABASE_URL='https://wopluslqeihwlnolfypm.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_f4FFiku_vqYePp8h1bXzcg_7iqRYlti';

function validUuid(value:string){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validPushEndpoint(value:string){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:') return false;
    const host=url.hostname.toLowerCase();
    return host==='fcm.googleapis.com' ||
      host==='push.apple.com' || host.endsWith('.push.apple.com') ||
      host==='push.services.mozilla.com' || host.endsWith('.push.services.mozilla.com');
  }catch{
    return false;
  }
}

export async function POST(request:Request){
  try{
    const body=await request.json();
    const deviceId=String(body?.deviceId||'');
    const endpoint=String(body?.endpoint||'');
    const watchTerms=Array.isArray(body?.watchTerms)
      ? body.watchTerms.map((x:unknown)=>String(x).trim()).filter(Boolean).slice(0,30)
      : [];

    if(!validUuid(deviceId)||!validPushEndpoint(endpoint)||endpoint.length>3000){
      return NextResponse.json({ok:false,error:'Érvénytelen push-adat.'},{status:400});
    }

    const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/multi_akciok_register_push',{
      method:'POST',
      headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_device_id:deviceId,p_endpoint:endpoint,p_watch_terms:watchTerms}),
      cache:'no-store'
    });

    if(!response.ok){
      return NextResponse.json({ok:false,error:'A push regisztráció nem menthető.'},{status:502});
    }
    return NextResponse.json({ok:true});
  }catch{
    return NextResponse.json({ok:false,error:'Hibás kérés.'},{status:400});
  }
}
