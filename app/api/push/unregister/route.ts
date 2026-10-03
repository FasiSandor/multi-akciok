import { NextResponse } from 'next/server';

const SUPABASE_URL='https://wopluslqeihwlnolfypm.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_f4FFiku_vqYePp8h1bXzcg_7iqRYlti';

export async function POST(request:Request){
  try{
    const body=await request.json();
    const deviceId=String(body?.deviceId||'');
    if(!/^[0-9a-f-]{36}$/i.test(deviceId)) return NextResponse.json({ok:false},{status:400});

    await fetch(SUPABASE_URL+'/rest/v1/rpc/multi_akciok_disable_push',{
      method:'POST',
      headers:{apikey:PUBLISHABLE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({p_device_id:deviceId}),
      cache:'no-store'
    });
    return NextResponse.json({ok:true});
  }catch{
    return NextResponse.json({ok:false},{status:400});
  }
}
