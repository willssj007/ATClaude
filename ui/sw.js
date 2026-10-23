// Service worker de la version iPhone (PWA) : l'interface reste disponible d'un lancement à l'autre, et les
// images des cartes (« cardimg?key=... ») sont demandées au moteur Forge qui tourne dans la page (pwa.js).
// La version est remplacée à chaque publication : un nouveau service worker remplace alors l'ancien.
const VERSION = 'dev';
const SHELL = 'arcane-shell-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    try {
      const list = await (await fetch('precache.json', {cache: 'no-cache'})).json();
      await cache.addAll(list);
    } catch (e) {
      // liste absente (version de développement) : les fichiers seront gardés au fil des visites
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('arcane-shell-') && name !== SHELL) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin || event.request.method !== 'GET') {
    return; // CheerpJ (son propre serveur), Scryfall, GitHub : le navigateur s'en charge
  }
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (path === 'cardimg') {
    event.respondWith(cardImage(event, url));
    return;
  }
  // Moteur et ressources de Forge : lus par CheerpJ (souvent par morceaux) ; manifeste : toujours le plus récent.
  if (path.startsWith('engine') || path.startsWith('forge') || path === 'engine.json' || path === 'precache.json') {
    return;
  }
  event.respondWith(shell(event.request));
});

/** Interface : depuis le cache de la version, sinon le réseau (et on la garde). */
async function shell(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request, {ignoreSearch: true});
  if (hit) {
    return hit;
  }
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    cache.put(request, response.clone());
  }
  return response;
}

/** Image d'une carte : la page la demande au moteur, qui la télécharge une fois et la garde. */
async function cardImage(event, url) {
  const client = (event.clientId && await self.clients.get(event.clientId))
    || (await self.clients.matchAll({type: 'window'}))[0];
  if (!client) {
    return new Response('', {status: 503});
  }
  const reply = await new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve({status: 504}), 130000);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data || {status: 500});
    };
    client.postMessage({type: 'cardimg', key: url.searchParams.get('key'), lang: url.searchParams.get('lang'),
      exact: url.searchParams.get('exact') === '1'}, [channel.port2]);
  });
  if (reply.status !== 200 || !reply.blob) {
    return new Response('', {status: reply.status || 404});
  }
  return new Response(reply.blob, {headers: {
    'Content-Type': reply.type || 'image/jpeg',
    'Content-Language': reply.lang || 'en',
    'Cache-Control': reply.cacheable ? 'max-age=604800' : 'no-store',
  }});
}
