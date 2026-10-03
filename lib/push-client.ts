const VAPID_PUBLIC_KEY='BN8Kq7yzxzwrEmsaXJWFHdiD8Aq8FljCdHEfd0fztm7wl7VdOLvSuRODg-vyp2dujXyMz7UZEP8Cvk3WRRdfvcY';
const DEVICE_KEY='multi-akciok-push-device-v1';

export type PushState='unsupported'|'off'|'denied'|'on';

function applicationServerKey(value:string):ArrayBuffer{
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  const bytes=Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
}

function deviceId(){
  let id=localStorage.getItem(DEVICE_KEY);
  if(!id){
    id=crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY,id);
  }
  return id;
}

function supported(){
  return typeof window!=='undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
}

async function registerWorker(){
  return navigator.serviceWorker.register('/sw.js',{scope:'/'});
}

async function sendRegistration(endpoint:string,watchTerms:string[]){
  const response=await fetch('/api/push/register',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({deviceId:deviceId(),endpoint,watchTerms})
  });
  if(!response.ok) throw new Error('A push regisztráció sikertelen.');
}

export async function getPushState():Promise<PushState>{
  if(!supported()) return 'unsupported';
  if(Notification.permission==='denied') return 'denied';
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=registration?await registration.pushManager.getSubscription():null;
  return subscription?'on':'off';
}

export async function enablePush(watchTerms:string[]){
  if(!supported()) throw new Error('Ezen az eszközön a webes push nem támogatott.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw new Error(permission==='denied'?'Az értesítéseket letiltottad.':'Az értesítési engedély nem lett megadva.');

  const registration=await registerWorker();
  let subscription=await registration.pushManager.getSubscription();
  if(!subscription){
    subscription=await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:applicationServerKey(VAPID_PUBLIC_KEY)
    });
  }
  await sendRegistration(subscription.endpoint,watchTerms);
  return 'on' as const;
}

export async function disablePush(){
  if(!supported()) return 'unsupported' as const;
  const registration=await navigator.serviceWorker.getRegistration('/');
  const subscription=registration?await registration.pushManager.getSubscription():null;

  await fetch('/api/push/unregister',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({deviceId:deviceId()})
  }).catch(()=>undefined);

  if(subscription) await subscription.unsubscribe();
  return 'off' as const;
}

export async function syncExistingPushTerms(watchTerms:string[]){
  if(!supported()||Notification.permission!=='granted') return;
  const registration=await navigator.serviceWorker.getRegistration('/');
  if(!registration) return;
  const subscription=await registration.pushManager.getSubscription();
  if(!subscription) return;
  await sendRegistration(subscription.endpoint,watchTerms);
}
