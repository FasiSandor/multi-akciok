const API_CACHE='multi-akciok-offers-v1';

self.addEventListener('install',()=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('multi-akciok-offers-')&&key!==API_CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname!=='/api/offers') return;

  event.respondWith((async()=>{
    const cache=await caches.open(API_CACHE);
    try{
      const response=await fetch(event.request);
      if(response.ok) await cache.put(event.request,response.clone());
      return response;
    }catch{
      const cached=await cache.match(event.request);
      if(cached) return cached;
      return new Response(JSON.stringify({offers:[],sourceStates:[],campaigns:[],offline:true}),{
        status:503,
        headers:{'Content-Type':'application/json'}
      });
    }
  })());
});

self.addEventListener('push',event=>{
  event.waitUntil(
    self.registration.showNotification('MULTI AKCIÓK',{
      body:'Új vagy olcsóbb figyelt ajánlat érkezett.',
      icon:'/icon.svg',
      badge:'/icon.svg',
      tag:'multi-akciok-watch',
      renotify:true,
      data:{url:'/?watch=1'}
    })
  );
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const allClients=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of allClients){
      if('focus' in client){
        await client.navigate('/?watch=1');
        return client.focus();
      }
    }
    return clients.openWindow('/?watch=1');
  })());
});
