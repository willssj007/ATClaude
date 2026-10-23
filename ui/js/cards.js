// Rendu d'une carte (catalogue ou partie) : image Scryfall servie par le pont, cadre dessiné en attendant.

import {bridge} from './bridge.js';
import {esc, el, frameClass, manaHtml, prefs, rulesHtml} from './util.js';

function ptText(card) {
  if (card.power !== undefined && card.toughness !== undefined) {
    return `${card.power}/${card.toughness}`;
  }
  if (card.loyalty !== undefined && card.loyalty !== null && card.loyalty !== '') {
    return String(card.loyalty);
  }
  return '';
}

function frameHtml(card) {
  const pt = ptText(card);
  const name = card.nameFr || card.name || '';
  return `<div class="frame ${frameClass(card)}">
    <div class="f-title"><span class="n">${esc(name)}</span>${manaHtml(card.cost)}</div>
    <div class="f-art"></div>
    <div class="f-type">${esc(card.typeLine || '')}</div>
    <div class="f-text">${rulesHtml(card.text || '')}</div>
    ${pt ? `<div class="f-pt">${esc(pt)}</div>` : ''}
  </div>`;
}

// Images introuvables pendant cette session : on ne les redemande pas à chaque rendu.
const missing = new Set();

/** Charge l'image d'une carte dans l'élément, si les images sont activées. */
export function loadImage(node, key, bust = '') {
  const img = node.querySelector('img.art');
  if (!img) {
    return;
  }
  if (!key || !prefs.get('images')) {
    node.classList.remove('has-img');
    img.removeAttribute('src');
    img.dataset.key = '';
    img.dataset.src = '';
    return;
  }
  // Illustration choisie dans le deck builder : cette impression précise, jamais une autre impression traduite.
  const url = bridge.imageUrl(key, prefs.get('imageLang')) + (node.dataset.exact === '1' ? '&exact=1' : '');
  if (img.dataset.src === url && !bust) {
    return;
  }
  img.dataset.key = key;
  img.dataset.src = url;
  node.classList.remove('has-img');
  img.onload = () => {
    if (img.dataset.src === url) {
      node.classList.add('has-img');
    }
  };
  if (missing.has(url) && !bust) {
    return;
  }
  img.onerror = () => {
    missing.add(url);
    node.classList.remove('has-img');
  };
  img.src = url + bust;
}

/** Recharge les images affichées (après un changement de langue des images). */
export function reloadImages() {
  missing.clear();
  document.querySelectorAll('img.art').forEach(img => {
    const node = img.closest('.mcard');
    if (node && img.dataset.key) {
      loadImage(node, img.dataset.key, '&v=' + Date.now());
    }
  });
}

// Une image d'abord servie en anglais (la version française était en cours de téléchargement) est prête.
bridge.on('imageReady', ({key}) => {
  document.querySelectorAll('img.art').forEach(img => {
    const node = img.closest('.mcard');
    if (node && img.dataset.key === key) {
      loadImage(node, key, '&v=' + Date.now());
    }
  });
});

/** Carte face visible, pour le catalogue et les dialogues. */
export function cardElement(card, extraClass = '') {
  if (!card || card.hidden) {
    return el(`<div class="mcard back ${extraClass}"><div class="face"></div></div>`);
  }
  const node = el(`<div class="mcard ${extraClass}"><div class="face"><img class="art" alt="" draggable="false">${frameHtml(card)}</div></div>`);
  node.title = card.nameFr || card.name || '';
  if (card.exactArt) {
    node.dataset.exact = '1';
  }
  loadImage(node, card.image);
  return node;
}

/** Remplace le cadre dessiné d'une carte déjà affichée (après un changement de caractéristiques). */
export function refreshFrame(node, card) {
  const frame = node.querySelector('.frame');
  if (frame) {
    frame.outerHTML = frameHtml(card);
  }
}

// ------------------------------------------------------------------ zoom

let zoomOpen = false;

export function showZoom(card, extraHtml = '') {
  const zoom = document.getElementById('zoom');
  zoom.innerHTML = '';
  const big = cardElement(card);
  zoom.appendChild(big);
  const nameFr = card.nameFr || card.name || '';
  const english = card.oracleName && card.oracleName !== nameFr ? card.oracleName
    : (card.nameFr && card.name !== card.nameFr ? card.name : '');
  const pt = ptText(card);
  const info = el(`<div class="zoom-info panel" style="padding:18px">
    <div class="name">${esc(nameFr)} ${manaHtml(card.cost)}</div>
    ${english ? `<div class="muted small">${esc(english)}</div>` : ''}
    <div class="type">${esc(card.typeLine || '')}${pt ? ' · ' + esc(pt) : ''}</div>
    <div class="text">${rulesHtml(card.text || '')}</div>
    ${card.textEn && card.textEn !== card.text ? `<div class="en">${rulesHtml(card.textEn)}</div>` : ''}
    ${extraHtml}
    <p class="muted small" style="margin-top:14px">Touchez n'importe où pour fermer.</p>
  </div>`);
  zoom.appendChild(info);
  if (card.back) {
    const back = cardElement(card.back);
    zoom.insertBefore(back, info);
  }
  zoom.classList.toggle('two', !!card.back);
  zoom.classList.remove('hidden');
  zoomOpen = true;
}

export function hideZoom() {
  if (!zoomOpen) {
    return false;
  }
  document.getElementById('zoom').classList.add('hidden');
  zoomOpen = false;
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('zoom').addEventListener('click', hideZoom);
});

/**
 * Appui long (mobile) ou clic droit (ordinateur) sur un élément : ouvre le zoom.
 * Renvoie une fonction à appeler dans le gestionnaire de clic pour ignorer le clic qui suit un appui long.
 */
export function onLongPress(root, selector, handler) {
  let timer = 0;
  let fired = false;
  let start = null;
  root.addEventListener('contextmenu', (e) => {
    const target = e.target.closest(selector);
    if (target) {
      e.preventDefault();
      handler(target);
    }
  });
  root.addEventListener('pointerdown', (e) => {
    // Nouveau geste : l'appui long précédent ne doit plus avaler de clic (le zoom a pu être fermé
    // ailleurs, sans clic sur le plateau).
    fired = false;
    clearTimeout(timer);
    const target = e.target.closest(selector);
    if (!target || e.pointerType === 'mouse') {
      return;
    }
    start = {x: e.clientX, y: e.clientY};
    timer = setTimeout(() => {
      fired = true;
      handler(target);
    }, 450);
  });
  const cancel = (e) => {
    if (start && e.type === 'pointermove' && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) {
      return;
    }
    clearTimeout(timer);
  };
  root.addEventListener('pointermove', cancel);
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  return () => {
    const was = fired;
    fired = false;
    return was;
  };
}

/**
 * Aperçu d'une carte au survol (souris) des éléments {@code selector} de {@code root} — listes de noms (triche,
 * jetons) — et zoom par appui long (tactile). {@code cardOf(node)} donne la carte de l'élément.
 */
export function hoverCard(root, selector, cardOf) {
  let tip = null;
  let check = 0;
  const hide = () => {
    clearInterval(check);
    tip && tip.remove();
    tip = null;
  };
  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') {
      return;
    }
    const node = e.target.closest(selector);
    const card = node && root.contains(node) ? cardOf(node) : null;
    if (!card) {
      hide();
      return;
    }
    if (tip && tip._node === node) {
      return;
    }
    hide();
    tip = el('<div class="hover-card"></div>');
    tip._node = node;
    tip.appendChild(cardElement(card));
    document.body.appendChild(tip);
    // À côté de la liste : à gauche s'il y a la place, sinon à droite.
    const r = node.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = r.left - w - 14;
    if (x < 8) {
      x = Math.min(innerWidth - w - 8, r.right + 14);
    }
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${Math.min(Math.max(8, r.top + r.height / 2 - h / 2), innerHeight - h - 8)}px`;
    // La liste peut disparaître sous la souris (dialogue fermé, résultats remplacés).
    check = setInterval(() => !node.isConnected && hide(), 250);
  });
  root.addEventListener('pointerout', (e) => {
    const to = e.relatedTarget;
    if (!to || !to.closest || !to.closest(selector)) {
      hide();
    }
  });
  root.addEventListener('pointerdown', hide);
  return onLongPress(root, selector, (node) => {
    const card = cardOf(node);
    if (card) {
      hide();
      showZoom(card);
    }
  });
}
