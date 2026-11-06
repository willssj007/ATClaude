// Cadres des cartes perso (Atelier) : dessinés pour l'application, dans l'esprit des grandes époques des cartes
// (moderne, classique, ancien, futur, vitrine, Nyx, art étendu, sans bord, illustration pleine, jeton), chacun aux
// couleurs de la carte. Ce ne sont pas les cadres officiels (images de Wizards of the Coast) : tout est en CSS.

import {esc, manaHtml, rulesHtml} from './util.js';
import {icon} from './icons.js';

export const FRAMES = [
  ['modern', 'Moderne'], ['classic', 'Classique'], ['retro', 'Ancien'], ['future', 'Futur'], ['showcase', 'Vitrine'],
  ['nyx', 'Nyx'], ['extended', 'Art étendu'], ['borderless', 'Sans bord'], ['fullart', 'Illustration pleine'], ['token', 'Jeton'],
];
/** Cadre importé : une image PNG de la carte entière, la fenêtre de l'illustration transparente. */
export const IMPORTED = 'imported';
export const FRAME_TEXT = [['dark', 'Texte sombre'], ['light', 'Texte clair']];
/** Effets visuels (calque animé posé sur toute la carte), comme les cartes premium. */
export const FX = [
  ['none', 'Aucun'], ['foil', 'Brillant'], ['etched', 'Gravé'], ['galaxy', 'Galaxie'], ['gilded', 'Doré'], ['pearl', 'Nacré'], ['glitter', 'Paillettes'],
];

export const FRAME_COLORS = [
  ['auto', 'Auto'], ['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert'], ['M', 'Or'],
  ['A', 'Artefact'], ['C', 'Incolore'], ['L', 'Terrain'],
];

// Teinte de chaque partie du cadre : f le cadre, b les bandeaux (nom, type), x la boîte de texte, e les filets,
// ink le texte posé directement sur le cadre (cadre ancien).
const PALETTE = {
  W: {f: '#ddd4ba', b: '#f1ead4', x: '#f5f1e4', e: '#8b8064', ink: '#1d1a14'},
  U: {f: '#2f6eaa', b: '#c6dbec', x: '#dfe9f2', e: '#1c4873', ink: '#ffffff'},
  B: {f: '#3f393a', b: '#cdc6c3', x: '#dbd5d2', e: '#211c1d', ink: '#ffffff'},
  R: {f: '#c4472d', b: '#f0c9b7', x: '#f3ddd2', e: '#7a2315', ink: '#ffffff'},
  G: {f: '#2f7a48', b: '#cbdfc2', x: '#dce8d4', e: '#1c4f2f', ink: '#ffffff'},
  M: {f: '#c9a24c', b: '#f1dfab', x: '#f3e9cb', e: '#7b5d1e', ink: '#ffffff'},
  A: {f: '#9da2a8', b: '#e0e3e6', x: '#e9eaec', e: '#52575d', ink: '#ffffff'},
  C: {f: '#cdc8bf', b: '#edeae4', x: '#f2f0eb', e: '#78746c', ink: '#1d1a14'},
  L: {f: '#a88b66', b: '#e3d4bd', x: '#ece2d2', e: '#5c4831', ink: '#ffffff'},
};

/** Couleurs du cadre : celle choisie, sinon d'après la carte (deux couleurs : cadre partagé ; trois et plus : or). */
export function frameColors(card) {
  const pick = card.frameColor;
  if (pick && pick !== 'auto' && PALETTE[pick]) {
    return [pick];
  }
  if (card.land) {
    return ['L'];
  }
  const colors = [...String(card.colors || '')].filter(c => 'WUBRG'.includes(c));
  if (!colors.length) {
    return [/Artefact|Artifact/.test(card.typeLine || '') ? 'A' : 'C'];
  }
  return colors.length === 2 ? colors : colors.length === 1 ? colors : ['M'];
}

function typeIcon(typeLine) {
  const t = typeLine || '';
  if (/Planeswalker/.test(t)) return icon('crown');
  if (/Créature|Creature/.test(t)) return icon('swords');
  if (/Éphémère|Instant/.test(t)) return icon('bolt');
  if (/Rituel|Sorcery/.test(t)) return icon('torch');
  if (/Terrain|Land/.test(t)) return icon('mountain');
  if (/Artefact|Artifact/.test(t)) return icon('gear');
  if (/Enchantement|Enchantment/.test(t)) return icon('spark');
  return icon('spark');
}

// Place de chaque cadre, en centièmes de la largeur de la carte : largeur utile du nom (t), du type (y), et de la boîte
// de texte (largeur w, hauteur h, sans les marges). Le texte rétrécit jusqu'à tenir, comme sur les vraies cartes.
const SPACE = {
  modern: {t: 82.4, y: 74.4, w: 78, h: 35.3}, nyx: {t: 82.4, y: 74.4, w: 78, h: 35.3}, extended: {t: 82.4, y: 74.4, w: 78, h: 35.3},
  showcase: {t: 82.4, y: 74.4, w: 78, h: 35.3}, fullart: {t: 82.4, y: 74.4, w: 78, h: 35.3},
  classic: {t: 80, y: 72, w: 74.8, h: 31.4}, retro: {t: 82.8, y: 80, w: 72, h: 37},
  future: {t: 84.4, y: 62, w: 83.6, h: 35}, borderless: {t: 84.8, y: 76.8, w: 84, h: 34.8}, token: {t: 57.6, y: 74.4, w: 78, h: 16.6},
  imported: {t: 82.4, y: 74.4, w: 78, h: 35.3},
};
const FONT = '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Noto Serif", serif';
let measureCtx = null;
const widths = new Map();

/** Largeur d'un texte en unités de police (1 = la taille de la police). */
function textWidth(text, bold) {
  const key = (bold ? 'b' : 'r') + text;
  let w = widths.get(key);
  if (w === undefined) {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    measureCtx.font = `${bold ? 700 : 400} 100px ${FONT}`;
    w = measureCtx.measureText(text).width / 100;
    if (widths.size > 5000) {
      widths.clear();
    }
    widths.set(key, w);
  }
  return w;
}

/** Nombre de lignes du texte de règles à cette taille de police (en unités), pour cette largeur. */
function lineCount(paras, size, width) {
  const space = textWidth(' ', false) * size;
  let lines = 0;
  for (const p of paras) {
    let line = 0;
    lines++;
    for (const word of p.split(/\s+/).filter(Boolean)) {
      // Un symbole de mana ({T}, {2}) prend à peu près la place d'un cadratin.
      const w = (/^\{[^}]+\}/.test(word) ? 0.95 * (word.match(/\{/g) || []).length + textWidth(word.replace(/\{[^}]+\}/g, ''), false) : textWidth(word, false)) * size;
      if (line && line + space + w > width) {
        lines++;
        line = w;
      } else {
        line += (line ? space : 0) + w;
      }
    }
  }
  return lines;
}

function rulesScale(text, box) {
  const paras = String(text || '').replace(/\\n/g, '\n').split('\n').filter(p => p.trim());
  if (!paras.length) {
    return 1;
  }
  for (let s = 1; s > 0.45; s -= 0.03) {
    const size = 6 * s;
    if (lineCount(paras, size, box.w) * size * 1.16 <= box.h) {
      return Math.round(s * 100) / 100;
    }
  }
  return 0.45;
}

function clampScale(v) {
  return Math.round(Math.max(0.45, Math.min(1, v)) * 100) / 100;
}

// Tailles mesurées (nom, type, texte) par carte et par cadre : les polices de l'appareil ne sont pas celles de
// l'estimation, et le texte ne doit jamais être coupé. Tout est relatif à la largeur : une mesure vaut pour toutes les tailles.
const FITTED = new Map();

function fitKey(style, name, type, text, cost) {
  return [style, name, type, cost || '', text].join('\u0001');
}

/** Réduit le nom, le type et le texte d'un cadre affiché jusqu'à ce qu'ils tiennent, et retient le résultat. */
export function fitFrame(frame) {
  const key = frame.dataset.fit;
  if (!key || !frame.isConnected || frame.offsetWidth < 20) {
    return false;
  }
  const shrink = (selector, prop, overflows) => {
    const el = frame.querySelector(selector);
    let v = parseFloat(frame.style.getPropertyValue(prop)) || 1;
    for (let i = 0; el && i < 30 && v > 0.3 && overflows(el); i++) {
      v = Math.round((v - 0.04) * 100) / 100;
      frame.style.setProperty(prop, String(v));
    }
    return v;
  };
  const wide = (el) => el.scrollWidth > el.clientWidth + 0.5;
  const tall = (el) => el.scrollHeight > el.clientHeight + 0.5;
  const sn = shrink('.cf-name', '--sn', wide);
  const st = shrink('.cf-tl', '--st', wide);
  const sr = shrink('.cf-rules', '--sr', tall);
  delete frame.dataset.fit;
  // Une petite carte peut garder un texte plus grand que demandé (taille minimale du système) : on ne retient que
  // les mesures faites sur une carte assez grande.
  if (frame.offsetWidth >= 150) {
    if (FITTED.size > 500) {
      FITTED.clear();
    }
    FITTED.set(key, {sn, st, sr});
  }
  return true;
}

/** Capacité de loyauté (« [+1] : … », « −2: … ») : sa valeur et son texte, ou null. */
const LOYALTY_LINE = /^\s*\[?\s*([+−-]?\s*(?:\d+|X))\s*\]?\s*:\s*(.+)$/;

/**
 * Texte d'un planeswalker : chaque capacité de loyauté sur sa ligne, sa valeur dans un insigne (pointe en haut
 * pour +, en bas pour −, plat pour 0) ; les autres lignes en entier.
 */
function planeswalkerRules(text) {
  // Le texte d'une carte qui n'est pas en partie sépare ses lignes par « \n » écrit en toutes lettres.
  return text.replace(/\\n/g, '\n').split('\n').filter(l => l.trim()).map((line) => {
    const m = line.match(LOYALTY_LINE);
    if (!m) {
      return `<div class="cf-pwt">${rulesHtml(line)}</div>`;
    }
    const v = m[1].replace(/\s/g, '').replace('-', '−');
    const kind = v.startsWith('+') ? 'up' : v.startsWith('−') ? 'down' : 'zero';
    return `<div class="cf-pwl cf-pw-${kind}"><span class="cf-lb"><b>${esc(v)}</b></span><span class="cf-lt">${rulesHtml(m[2])}</span></div>`;
  }).join('');
}

const RARITY_LETTER = {C: 'C', U: 'U', R: 'R', M: 'M', S: 'S'};

/**
 * Une adresse complète : dans une variable CSS (« --logo: url(…) »), une adresse relative (« cardimg?key=… » sur
 * téléphone) serait lue depuis le dossier de la feuille de style, et l'image introuvable.
 */
export function absoluteUrl(u) {
  try {
    return new URL(u, document.baseURI).href;
  } catch (e) {
    return u;
  }
}

/**
 * Symbole d'extension (à droite du type) : le logo de l'extension perso, teint selon la rareté si elle le demande
 * (comme les vrais symboles), sinon l'enclume de l'Atelier, de la couleur de la rareté.
 */
function setSymbol(card, logoUrl) {
  const r = RARITY_LETTER[card.crarity] ? ` cf-r${card.crarity}` : '';
  const set = card.cset;
  if (set && logoUrl) {
    const url = `url(&quot;${esc(absoluteUrl(logoUrl))}&quot;)`;
    // Teint : la silhouette (masque) colorée, l'ombre autour sur l'enveloppe (le masque l'effacerait).
    return set.tint ? `<span class="cf-set cf-slogo cf-tint${r || ' cf-rC'}" style="--logo:${url}" title="${esc(set.name)}"><i></i></span>`
      : `<span class="cf-set cf-slogo${r}" style="background-image:${url}" title="${esc(set.name)}"></span>`;
  }
  return `<span class="cf-set${r}">${icon('anvil')}</span>`;
}

/** Bas de la carte : numéro et rareté, puis code de l'extension, langue et artiste (« 007/120 R · ILO • FR ✎ Ilona »). */
function footHtml(card) {
  const set = card.cset;
  const artist = String(card.artist || '').trim();
  const r = RARITY_LETTER[card.crarity] || '';
  if (!set && !artist && !r) {
    return '<div class="cf-foot">Atelier</div>';
  }
  const pad = (n) => String(n).padStart(3, '0');
  const num = set && set.n ? `${pad(set.n)}/${pad(set.total)}` : '';
  const top = [num, r].filter(Boolean).join(' ');
  const code = set ? `${esc(set.code)} • ${card.lang === 'en' ? 'EN' : 'FR'}` : '';
  const brush = artist ? `<span class="cf-artist">${icon('brush')}${esc(artist)}</span>` : '';
  return `<div class="cf-foot cf-info">${top ? `<span>${esc(top)}</span>` : ''}<span>${code}${brush}</span></div>`;
}

/**
 * Le cadre dessiné d'une carte perso. art : attribut style de son illustration (ou "") ; frameUrl : son cadre importé ;
 * logoUrl : le logo de son extension perso.
 */
export function customFrameHtml(card, art, frameUrl = '', logoUrl = '') {
  const style = card.frame === IMPORTED && frameUrl ? IMPORTED : FRAMES.some(f => f[0] === card.frame) ? card.frame : 'modern';
  const cols = frameColors(card);
  const l = PALETTE[cols[0]];
  const r = PALETTE[cols[1] || cols[0]];
  const name = card.nameFr || card.name || '';
  const typeLine = card.typeLine || '';
  // En partie, Forge sépare les mots-clés du reste par une ligne vide (et des \r) : une ligne suffit sur la carte.
  const text = String(card.text || '').replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim();
  const loyalty = card.power === undefined && card.loyalty !== undefined && card.loyalty !== null && card.loyalty !== '';
  const pt = card.power !== undefined && card.toughness !== undefined ? `${card.power}/${card.toughness}` : loyalty ? String(card.loyalty) : '';
  const pips = card.cost ? (String(card.cost).match(/\{[^}]+\}/g) || String(card.cost).trim().split(/\s+/)).length : 0;
  const legendary = /légendaire|Legendary/.test(typeLine);
  const pw = /Planeswalker/.test(typeLine) && style !== 'token';
  // Le nom, le type et le texte rétrécissent pour tenir (comme sur les vraies cartes, au lieu d'être coupés).
  // Planeswalker : boîte plus haute (l'illustration est plus courte), lignes moins larges (les insignes de loyauté).
  const box = pw ? {...SPACE[style], w: SPACE[style].w - 14, h: SPACE[style].h + 10} : SPACE[style];
  const costWidth = style === 'token' || !pips ? 0 : pips * 5.96 + (pips - 1) * 0.5 + 2;
  // Taille déjà mesurée sur cet appareil pour cette carte dans ce cadre, sinon une estimation, vérifiée à l'affichage.
  // Texte d'ambiance (cartes perso) : en italique sous les capacités ; il compte dans la taille du texte.
  const flavor = String(card.flavor || '').trim();
  const key = fitKey(style, name, typeLine, flavor ? `${text}\n${flavor}` : text, card.cost);
  const known = FITTED.get(key);
  const sn = known ? known.sn : clampScale(0.93 * (box.t - costWidth) / Math.max(1, textWidth(name, true) * 6.6));
  const st = known ? known.st : clampScale(0.93 * box.y / Math.max(1, textWidth(typeLine, true) * (style === 'retro' ? 5 : 5.4)));
  const sr = known ? known.sr : rulesScale(flavor ? `${text}\n${flavor}` : text, box);
  const vars = `--fL:${l.f};--fR:${r.f};--bL:${l.b};--bR:${r.b};--xL:${l.x};--xR:${r.x};--e:${l.e};--ink:${l.ink};--ish:${l.ink === '#ffffff' ? 'rgb(0 0 0 / 0.9)' : 'rgb(255 255 255 / 0.7)'};--sn:${sn};--st:${st};--sr:${sr}`;
  const overlay = style === IMPORTED ? `<div class="cf-overlay" style="background-image:url(&quot;${esc(frameUrl)}&quot;)"></div>` : '';
  const light = style === IMPORTED && card.frameText === 'light' ? ' cf-light' : '';
  return `<div class="frame cf cf-${style}${legendary ? ' cf-legend' : ''}${pw ? ' cf-pw' : ''}${art ? '' : ' cf-noart'}${light}" style="${vars}"${known ? '' : ` data-fit="${esc(key)}"`}>
    <div class="cf-bg"></div>
    <div class="cf-art"${art}></div>
    ${overlay}
    <div class="cf-crown"></div>
    <div class="cf-title"><span class="cf-name">${esc(name)}</span><span class="cf-cost">${manaHtml(card.cost)}</span></div>
    <div class="cf-type"><span class="cf-tl">${esc(typeLine)}</span>${setSymbol(card, logoUrl)}</div>
    <div class="cf-icon">${typeIcon(typeLine)}</div>
    <div class="cf-box">${pw ? `<div class="cf-rules cf-pwrules">${planeswalkerRules(text)}</div>`
    : `<div class="cf-rules">${rulesHtml(text)}${flavor ? `<div class="cf-flavor">${esc(flavor).replace(/\n/g, '<br>')}</div>` : ''}</div>`}</div>
    ${pt && loyalty ? `<div class="cf-pt cf-loy"><svg viewBox="0 0 40 46" aria-hidden="true"><path d="M3 3H37V30L20 43L3 30Z"/></svg><span>${esc(pt)}</span></div>`
    : pt ? `<div class="cf-pt">${esc(pt)}</div>` : ''}
    ${footHtml(card)}
    ${card.fx && card.fx !== 'none' && FX.some(f => f[0] === card.fx) ? `<div class="cf-fx cf-fx-${card.fx}"></div>` : ''}
  </div>`;
}
