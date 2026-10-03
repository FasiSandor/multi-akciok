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
