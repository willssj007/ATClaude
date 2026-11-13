// Communication avec le pont Java.
// - Android : la WebView expose window.AndroidBridge.send() et appelle window.__atReceive(json).
// - iPhone et iPad : window.webkit.messageHandlers.atclaude.postMessage(json), réponses par window.__atReceive.
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
// iPhone et iPad : l'application native (WKWebView) reçoit les messages par window.webkit.messageHandlers.
const iosHandlers = !android && window.webkit && window.webkit.messageHandlers;
const ios = !!(iosHandlers && iosHandlers.atclaude);
// Ordinateur : l'interface vient de « 127.0.0.1 » et les images de quatre adresses « imgN.localhost » (toujours
// la machine elle-même). Le navigateur limite les connexions par adresse (6) : des images lentes à télécharger ne
// retiennent ni les requêtes du moteur ni les images déjà en cache, qui passent par une autre file.
let imageHosts = !android && location.hostname === '127.0.0.1' && location.port
  ? [0, 1, 2, 3].map(i => `${location.protocol}//img${i}.localhost:${location.port}/`) : null;
if (imageHosts) {
  // Navigateur qui ne connaîtrait pas les sous-adresses de localhost : une seule adresse d'images.
  fetch(imageHosts[0] + 'cardimg', {mode: 'no-cors'}).catch(() => {
    imageHosts = [`${location.protocol}//localhost:${location.port}/`];
  });
}

function imageBase(key) {
  if (!imageHosts) {
    return '';
  }
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return imageHosts[Math.abs(h) % imageHosts.length];
}

function post(message) {
  const json = JSON.stringify(message);
  if (android) {
    window.AndroidBridge.send(json);
    return;
  }
  if (ios) {
    iosHandlers.atclaude.postMessage(json);
    return;
  }
  fetch('api/send', {method: 'POST', body: json, headers: {'Content-Type': 'application/json'}})
    .catch(() => emit('connection', {type: 'connection', connected: false}));
}

export const bridge = {
  android,
  ios,

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
    if (android || ios) {
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

  /** Android : installe l'APK d'une mise à jour téléchargée (« installing », « permission » ou « missing »). */
  installUpdate(path) {
    return android && window.AndroidBridge.installUpdate ? window.AndroidBridge.installUpdate(path) : 'missing';
  },

  /** Ouvre un lien dans le navigateur du système. */
  openUrl(url) {
    if (android && window.AndroidBridge.openUrl) {
      window.AndroidBridge.openUrl(url);
    } else if (ios) {
      iosHandlers.atclaudeUrl.postMessage(url);
    } else {
      window.open(url, '_blank');
    }
  },

  /**
   * Partage un fichier préparé par le pont ({path, name, text | base64}) : « Partager » d'Android, feuille de partage
   * d'iOS, ou téléchargement sur ordinateur.
   */
  shareFile(file, title = '', mime = 'application/json') {
    if (android && window.AndroidBridge.shareFile) {
      return window.AndroidBridge.shareFile(file.path, title) === 'shared';
    }
    if (ios && iosHandlers.atclaudeShare) {
      iosHandlers.atclaudeShare.postMessage(file.path);
      return true;
    }
    const blob = file.text !== undefined ? new Blob([file.text], {type: mime})
      : new Blob([Uint8Array.from(atob(file.base64 || ''), c => c.charCodeAt(0))], {type: mime});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
    return true;
  },

  /**
   * Orientation permise sur téléphone et tablette : 'landscape' (partout par défaut) ou 'any' (écrans des decks,
   * qu'on peut tenir en portrait). Sans effet sur ordinateur.
   */
  orientation(mode) {
    if (android && window.AndroidBridge.setOrientation) {
      window.AndroidBridge.setOrientation(mode);
    } else if (ios && iosHandlers.atclaudeOrientation) {
      iosHandlers.atclaudeOrientation.postMessage(mode);
    }
  },

  /**
   * Adresse de l'image d'une carte, servie par le pont : en français si Scryfall en a une, sinon en anglais.
   * La langue fait partie de l'adresse pour que le cache du navigateur ne mélange pas les deux.
   */
  imageUrl(key, lang = 'fr') {
    return key ? imageBase(key) + 'cardimg?key=' + encodeURIComponent(key) + '&lang=' + (lang === 'en' ? 'en' : 'fr') : '';
  },
};
