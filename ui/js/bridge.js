// Communication avec le pont Java.
// - Android : la WebView expose window.AndroidBridge.send() et appelle window.__atReceive(json).
// - Ordinateur : flux Server-Sent Events sur /api/events et POST sur /api/send.

const listeners = new Map();
const pending = new Map();
let nextRid = 1;
let connected = false;

function emit(type, message) {
  for (const fn of listeners.get(type) || []) {
    try {
      fn(message);
    } catch (e) {
      console.error(e);
    }
  }
  for (const fn of listeners.get('*') || []) {
    fn(message);
  }
}

function receive(json) {
  let message;
  try {
    message = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (e) {
    console.error('Message illisible', json);
    return;
  }
  if (message.type === 'response') {
    const waiter = pending.get(message.rid);
    if (waiter) {
      pending.delete(message.rid);
      if (message.error) {
        waiter.reject(new Error(message.error));
      } else {
        waiter.resolve(message.data);
      }
    }
    return;
  }
  emit(message.type, message);
}

const android = typeof window.AndroidBridge !== 'undefined';
// Ordinateur : les images viennent de « localhost » et l'interface de « 127.0.0.1 ». Le navigateur limite les
// connexions par adresse (6) ; des images lentes à télécharger ne retiennent ainsi jamais les requêtes du moteur.
const IMAGE_BASE = !android && location.hostname === '127.0.0.1' && location.port ? `${location.protocol}//localhost:${location.port}/` : '';

function post(message) {
  const json = JSON.stringify(message);
  if (android) {
    window.AndroidBridge.send(json);
    return;
  }
  fetch('api/send', {method: 'POST', body: json, headers: {'Content-Type': 'application/json'}})
    .catch(() => emit('connection', {type: 'connection', connected: false}));
}

export const bridge = {
  android,

  /** Écoute un type de message ('state', 'dialog', 'notice'...), ou '*' pour tous. */
  on(type, fn) {
    if (!listeners.has(type)) {
      listeners.set(type, []);
    }
    listeners.get(type).push(fn);
    return () => listeners.set(type, listeners.get(type).filter(f => f !== fn));
  },

  /** Envoie un message sans attendre de réponse. */
  send(type, payload = {}) {
    post({type, ...payload});
  },

  /** Envoie une requête et attend sa réponse. */
  request(type, payload = {}) {
    const rid = nextRid++;
    return new Promise((resolve, reject) => {
      pending.set(rid, {resolve, reject});
      post({type, rid, ...payload});
    });
  },

  answer(id, value) {
    post({type: 'answer', id, value});
  },

  connect() {
    if (android) {
      window.__atReceive = receive;
      window.__atReceiveMany = (list) => list.forEach(receive);
      connected = true;
      emit('connection', {type: 'connection', connected: true});
      return;
    }
    const source = new EventSource('api/events');
    source.onopen = () => {
      connected = true;
      emit('connection', {type: 'connection', connected: true});
    };
    source.onmessage = (e) => receive(e.data);
    source.onerror = () => {
      if (connected) {
        connected = false;
        emit('connection', {type: 'connection', connected: false});
      }
    };
  },

  /** Ouvre un lien dans le navigateur du système. */
  openUrl(url) {
    if (android && window.AndroidBridge.openUrl) {
      window.AndroidBridge.openUrl(url);
    } else {
      window.open(url, '_blank');
    }
  },

  /**
   * Adresse de l'image d'une carte, servie par le pont : en français si Scryfall en a une, sinon en anglais.
   * La langue fait partie de l'adresse pour que le cache du navigateur ne mélange pas les deux.
   */
  imageUrl(key, lang = 'fr') {
    return key ? IMAGE_BASE + 'cardimg?key=' + encodeURIComponent(key) + '&lang=' + (lang === 'en' ? 'en' : 'fr') : '';
  },
};
