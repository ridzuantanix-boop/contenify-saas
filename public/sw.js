const CACHE='affimatik-admin-shell-v1';
const SAFE_ASSETS=['/admin-pwa-icon-192.png','/admin-pwa-icon-512.png','/manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SAFE_ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('affimatik-admin-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Authentication, customer, payment and media data must always come from the
  // live server. No sensitive HTML or API response is retained offline.
  if(request.mode==='navigate'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/admin')||url.pathname.startsWith('/auth')||url.pathname.includes('/stream'))return;
  const safeStatic=url.pathname.startsWith('/_next/static/')||SAFE_ASSETS.includes(url.pathname);
  if(!safeStatic)return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  })));
});
