// Petits outils partagés par tous les écrans.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

/** Crée un élément depuis du HTML. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const MANA_LETTERS = new Set(['W', 'U', 'B', 'R', 'G', 'C', 'S', 'X', 'Y', 'Z', 'T', 'Q', 'E']);
const COLOR_VAR = {W: '--mana-W', U: '--mana-U', B: '--mana-B', R: '--mana-R', G: '--mana-G', C: '--mana-C'};

/** Un symbole de mana : « W », « 3 », « W/U », « G/P », « T »... */
export function symbol(sym) {
  const s = String(sym).toUpperCase();
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    const v1 = COLOR_VAR[a] ? `var(${COLOR_VAR[a]})` : 'var(--mana-C)';
    const v2 = b === 'P' ? '#c9c2d6' : (COLOR_VAR[b] ? `var(${COLOR_VAR[b]})` : 'var(--mana-C)');
    const label = b === 'P' ? a + 'ᵠ' : (/^\d$/.test(a) ? a : '');
    return `<span class="ms ms-hybrid" style="--h1:${v1};--h2:${v2}" title="${esc(s)}">${esc(label)}</span>`;
  }
  if (s === 'T') {
    return '<span class="ms ms-T" title="Engager">↷</span>';
  }
  if (s === 'Q') {
    return '<span class="ms ms-T" title="Dégager">↶</span>';
  }
  const cls = MANA_LETTERS.has(s) && 'WUBRG'.includes(s) ? `ms ms-${s}` : 'ms';
  return `<span class="${cls}">${esc('WUBRG'.includes(s) ? '' : s)}</span>`;
}

/** Coût de mana en symboles. Accepte « {2}{W}{W} » comme « 2 W W ». */
export function manaHtml(cost) {
  if (!cost) {
    return '';
  }
  const tokens = cost.includes('{') ? [...cost.matchAll(/\{([^}]+)\}/g)].map(m => m[1]) : cost.trim().split(/\s+/);
  return `<span class="mana">${tokens.filter(Boolean).map(symbol).join('')}</span>`;
}

/** Texte de règles avec ses symboles de mana. */
export function rulesHtml(text) {
  // Certains scripts de Forge gardent « \n » en toutes lettres pour les retours à la ligne.
  return esc(String(text || '').replace(/\\n/g, '\n')).replace(/\{([^}]+)\}/g, (_, s) => symbol(s));
}

/** Couleur principale d'une carte pour le cadre de secours. */
export function frameClass(card) {
  if (card.land) {
    return 'c-L';
  }
  const colors = card.colors || '';
  if (colors.length > 1) {
    return 'c-M';
  }
  return colors ? 'c-' + colors : '';
}

let toastTimer = 0;

export function toast(message, {title = '', error = false, duration = 3800} = {}) {
  const box = document.getElementById('toasts');
  const t = el(`<div class="toast${error ? ' error' : ''}">${title ? `<b>${esc(title)}</b>` : ''}${esc(message)}</div>`);
  box.appendChild(t);
  while (box.children.length > 4) {
    box.firstElementChild.remove();
  }
  setTimeout(() => t.remove(), duration);
  clearTimeout(toastTimer);
}

export function debounce(fn, ms) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Préférences locales de l'interface (le stockage peut être indisponible : on garde alors les valeurs par défaut). */
const DEFAULTS = {
  images: true,
  /** Deck builder : le deck en liste ('list') ou en images ('images'). */
  deckView: 'list',
  imageLang: 'fr',
  musicOn: true,
  musicVolume: 0.35,
  sfxOn: true,
  sfxVolume: 0.7,
  animations: true,
  holdPriority: false,
  autoPass: true,
  discordPresence: true,
  showEnglish: false,
  lastSetup: null,
  menuTheme: 'arcane',
  boardTheme: 'classic',
  cardBack: 'magic',
  themesKnown: null,
  statsWithCheats: true,
  // « sandbox » (tout est permis) ou « planeswalker » (carrière : collection, duels, boosters).
  mode: 'sandbox',
  boosterSet: '',
  careerDeck: null,
};

export const prefs = {
  get(key) {
    try {
      const raw = localStorage.getItem('at.' + key);
      return raw === null ? DEFAULTS[key] : JSON.parse(raw);
    } catch (e) {
      return DEFAULTS[key];
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('at.' + key, JSON.stringify(value));
      if (SYNCED.includes(key)) {
        localStorage.setItem('at.prefsAt', String(Date.now()));
      }
    } catch (e) {
      // stockage indisponible : la préférence ne durera que cette session
    }
  },
  /** Réglages partagés entre appareils par la synchronisation du compte (pas la disposition de l'écran). */
  synced() {
    const values = {};
    for (const k of SYNCED) {
      values[k] = this.get(k);
    }
    let at = 0;
    try {
      at = Number(localStorage.getItem('at.prefsAt')) || 0;
    } catch (e) {
      at = 0;
    }
    return {values, at};
  },
  applySynced(values, at) {
    try {
      for (const k of SYNCED) {
        if (values && k in values) {
          localStorage.setItem('at.' + k, JSON.stringify(values[k]));
        }
      }
      localStorage.setItem('at.prefsAt', String(at || Date.now()));
    } catch (e) {
      // stockage indisponible
    }
  },
};

const SYNCED = ['images', 'imageLang', 'musicOn', 'musicVolume', 'sfxOn', 'sfxVolume', 'animations', 'holdPriority', 'autoPass', 'showEnglish', 'lastSetup', 'menuTheme', 'boardTheme', 'cardBack'];

export const AVATAR_COLORS = ['#7c6cf2', '#e2563a', '#3c9a5a', '#3d8fd8', '#c9973d', '#b04fb8'];

// Photo de profil du joueur de cet appareil (data URL), tenue à jour par l'écran du compte.
let ownPhoto = '';
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function setOwnPhoto(photo) {
  ownPhoto = photo && PHOTO_RE.test(photo) ? photo : '';
}

export function ownPhotoUrl() {
  return ownPhoto;
}

/** Pastille d'un joueur : sa photo si elle est donnée, sinon son initiale sur une couleur. */
export function avatarHtml(name, index, size = 44, photo = '') {
  if (photo && PHOTO_RE.test(photo)) {
    return `<div class="avatar photo" style="width:${size}px;height:${size}px;background-image:url('${photo}')" title="${esc(name || '')}"></div>`;
  }
  const letter = esc((name || '?').trim().charAt(0).toUpperCase());
  const color = AVATAR_COLORS[Math.abs(index) % AVATAR_COLORS.length];
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px;background:radial-gradient(circle at 30% 30%, ${color}, #141829)">${letter}</div>`;
}

export const PHASES = [
  ['UNTAP', 'Dégagement', 'Dég.'],
  ['UPKEEP', 'Entretien', 'Ent.'],
  ['DRAW', 'Pioche', 'Pio.'],
  ['MAIN1', 'Phase principale 1', 'P1'],
  ['COMBAT_BEGIN', 'Début du combat', 'Déb.'],
  ['COMBAT_DECLARE_ATTACKERS', 'Attaquants', 'Att.'],
  ['COMBAT_DECLARE_BLOCKERS', 'Bloqueurs', 'Blo.'],
  ['COMBAT_FIRST_STRIKE_DAMAGE', 'Initiative', 'Init.'],
  ['COMBAT_DAMAGE', 'Blessures', 'Bles.'],
  ['COMBAT_END', 'Fin du combat', 'Fin'],
  ['MAIN2', 'Phase principale 2', 'P2'],
  ['END_OF_TURN', 'Fin de tour', 'FdT'],
  ['CLEANUP', 'Nettoyage', 'Net.'],
];

// Forge ne traduit pas toutes ses invites (surtout le ciblage) : on traduit les tournures courantes.
const NOUNS = [
  [/\bany target\b/gi, 'n\'importe quelle cible'], [/\bcreatures?\b/gi, 'créature'], [/\bplayers?\b/gi, 'joueur'],
  [/\bopponents?\b/gi, 'adversaire'], [/\bpermanents?\b/gi, 'permanent'], [/\bartifacts?\b/gi, 'artefact'],
  [/\benchantments?\b/gi, 'enchantement'], [/\blands?\b/gi, 'terrain'], [/\bspells?\b/gi, 'sort'],
  [/\bcards?\b/gi, 'carte'], [/\bnonland\b/gi, 'non-terrain'], [/\bnontoken\b/gi, 'non-jeton'], [/\byou control\b/gi, 'que vous contrôlez'],
  [/\byou don't control\b/gi, 'que vous ne contrôlez pas'], [/\ban opponent controls\b/gi, 'qu\'un adversaire contrôle'], [/\bor\b/g, 'ou'],
];
const PROMPTS = [
  [/^Select any target\.?$/i, 'Choisissez n\'importe quelle cible'],
  [/^Select targets? for (.+)$/i, 'Choisissez les cibles de $1'],
  [/^Select (?:a |an )?target (.+)$/i, (m, what) => 'Choisissez la cible : ' + NOUNS.reduce((s, [r, t]) => s.replace(r, t), what)],
  [/^Select up to (\d+) target (.+)$/i, (m, n, what) => `Choisissez jusqu'à ${n} cible(s) : ` + NOUNS.reduce((s, [r, t]) => s.replace(r, t), what)],
  [/^Waiting for (.*?)\.*$/i, 'En attente de $1…'],
  [/^Pay Mana Cost:?/i, 'Payez le coût de mana :'],
  [/^Choose a card to discard/i, 'Choisissez une carte à défausser'],
  [/^Declare attackers/i, 'Déclarez les attaquants'],
  [/^Declare blockers/i, 'Déclarez les bloqueurs'],
];

export function translatePrompt(text) {
  return String(text || '').split('\n').map(line => {
    for (const [re, to] of PROMPTS) {
      if (re.test(line)) {
        return line.replace(re, to);
      }
    }
    return line;
  }).join('\n');
}

// ------------------------------------------------------------------ encoche de la caméra (Android)

let cutout = {left: 0, top: 0, right: 0, bottom: 0, rects: []};

/** Rectangles occupés par l'encoche, en pixels CSS (vide sans encoche ou hors Android). */
export function cutoutRects() {
  return cutout.rects || [];
}

function applyCutout(c) {
  cutout = Object.assign({left: 0, top: 0, right: 0, bottom: 0, rects: []}, c || {});
  const style = document.documentElement.style;
  for (const side of ['left', 'top', 'right', 'bottom']) {
    style.setProperty('--cut-' + side, (Number(cutout[side]) || 0) + 'px');
  }
  window.dispatchEvent(new Event('cutout'));
}

window.__atCutout = applyCutout;
try {
  if (window.AndroidBridge && window.AndroidBridge.cutout) {
    applyCutout(JSON.parse(window.AndroidBridge.cutout()));
  }
} catch (e) {
  // pas d'information d'encoche : la page garde ses marges normales
}
