// Version iPhone (PWA) : Forge tourne dans la page, sur la machine Java de CheerpJ (Java en WebAssembly).
//
// Ce script (classique, chargé avant app.js) démarre CheerpJ, lance atclaude.web.WebMain et lui fournit ses
// méthodes natives : messages vers l'interface, requêtes HTTP par fetch (Java ne peut joindre que son propre
// site). bridge.js parle au moteur par window.AT_WEB. Le service worker (sw.js) demande ici les images des
// cartes, que le moteur télécharge et range dans le stockage du navigateur.
(function () {
  'use strict';

  const pending = [];      // messages de l'interface en attente du moteur
  const early = [];        // messages du moteur arrivés avant que l'interface écoute
  let app = null;          // objet Java WebMain
  let deliver = null;      // réception des messages par bridge.js
  let chain = Promise.resolve();
  const readyWaiters = [];

  function emit(obj) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (deliver) {
      deliver(json);
    } else {
      early.push(json);
    }
  }

  function toJava(json) {
    // Dans l'ordre d'envoi : chaque appel vers Java est asynchrone.
    chain = chain.then(() => app.receive(json)).catch((e) => console.error('Message refusé par le moteur', e));
  }

  window.AT_WEB = {
    send(json) {
      if (app) {
        toJava(json);
      } else {
        pending.push(json);
      }
    },
    connect(fn) {
      deliver = fn;
      early.splice(0).forEach(fn);
    },
  };

  function engineReady(timeoutMs) {
    if (app) {
      return Promise.resolve(app);
    }
    return new Promise((resolve) => {
      readyWaiters.push(resolve);
      setTimeout(() => resolve(null), timeoutMs);
    });
  }

  // ------------------------------------------------------------------ requêtes HTTP du moteur

  const bodies = new Map();
  let seq = 0;

  async function fetchStart(method, url, headers, body, timeoutMs) {
    const id = ++seq;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs || 60000);
    try {
      const init = {method, headers: JSON.parse(headers || '{}'), signal: ctl.signal, credentials: 'omit'};
      if (body && body.length) {
        init.body = new Uint8Array(body.buffer, body.byteOffset, body.length).slice();
      }
      const r = await fetch(url, init);
      const data = new Int8Array(await r.arrayBuffer());
      bodies.set(id, data);
      const h = {};
      for (const k of ['content-type', 'retry-after', 'location']) {
        const v = r.headers.get(k);
        if (v !== null) {
          h[k] = v;
        }
      }
      return JSON.stringify({id, status: r.status, headers: h});
    } catch (e) {
      return JSON.stringify({id: 0, status: 0, error: (e && e.name === 'AbortError') ? 'délai dépassé' : String(e && e.message || e)});
    } finally {
      clearTimeout(timer);
    }
  }

  const natives = {
    async Java_atclaude_web_WebMain_nativeReady(lib, self) {
      app = self;
      pending.splice(0).forEach(toJava);
      readyWaiters.splice(0).forEach(fn => fn(app));
      return new Promise(() => {}); // ne rend jamais la main : la page peut appeler le moteur à tout moment
    },
    async Java_atclaude_web_WebMain_deliver(lib, json) {
      emit(json);
    },
    async Java_atclaude_web_WebMain_fetchStart(lib, method, url, headers, body, timeoutMs) {
      return fetchStart(method, url, headers, body, timeoutMs);
    },
    async Java_atclaude_web_WebMain_fetchBody(lib, id) {
      const data = bodies.get(id) || new Int8Array(0);
      bodies.delete(id);
      return data;
    },
  };

  // ------------------------------------------------------------------ images (demandées par le service worker)

  async function cardImage(data, port) {
    try {
      const engine = await engineReady(120000);
      if (!engine) {
        port.postMessage({status: 503});
        return;
      }
      const info = await engine.imageInfo(data.key, data.lang || 'fr', !!data.exact);
      if (!info) {
        port.postMessage({status: 404});
        return;
      }
      const meta = JSON.parse(info);
      const blob = await cjFileBlob(meta.path);
      port.postMessage({status: 200, blob, type: meta.type, lang: meta.lang, cacheable: meta.cacheable});
    } catch (e) {
      port.postMessage({status: 500});
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'cardimg' && e.ports && e.ports[0]) {
        cardImage(e.data, e.ports[0]);
      }
    });
  }

  // ------------------------------------------------------------------ démarrage

  async function start() {
    emit({type: 'loading', text: 'Chargement de Java dans le navigateur…', percent: -1});
    if (typeof cheerpjInit !== 'function') {
      throw new Error('CheerpJ est injoignable (il faut Internet pour lancer l\'application).');
    }
    const manifest = await (await fetch('engine.json', {cache: 'no-cache'})).json();
    // Le stockage du navigateur ne doit pas être vidé sans prévenir (decks, carrière, cartes installées).
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
    await cheerpjInit({version: 17, status: 'none', natives});
    emit({type: 'loading', text: 'Démarrage du moteur Forge…', percent: -1});
    // /app/ est la racine du serveur : le site peut être dans un sous-dossier (GitHub Pages : /ATClaude/).
    const site = '/app' + new URL('.', location.href).pathname;
    const classPath = manifest.jars.map(j => site + manifest.engine + '/' + j).join(':');
    cheerpjRunMain('atclaude.web.WebMain', classPath, site, manifest.version, manifest.res, manifest.resHash, String(manifest.resSize))
      .then((code) => emit({type: 'fatal', message: `Le moteur s'est arrêté (code ${code}). Relance l'application.`}));
  }

  start().catch((e) => emit({type: 'fatal', message: 'Le moteur n\'a pas pu démarrer : ' + (e && e.message || e)}));
})();
