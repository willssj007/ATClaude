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
export function loadImage(node, key) {
  const img = node.querySelector('img.art');
  if (!img) {
    return;
  }
  if (!key || !prefs.get('images')) {
    node.classList.remove('has-img');
    img.removeAttribute('src');
    img.dataset.key = '';
    return;
  }
  if (img.dataset.key === key) {
    return;
  }
  img.dataset.key = key;
  node.classList.remove('has-img');
  img.onload = () => {
    if (img.dataset.key === key) {
      node.classList.add('has-img');
    }
  };
  if (missing.has(key)) {
    return;
  }
  img.onerror = () => {
    missing.add(key);
    node.classList.remove('has-img');
  };
  img.src = bridge.imageUrl(key);
}

/** Carte face visible, pour le catalogue et les dialogues. */
export function cardElement(card, extraClass = '') {
  if (!card || card.hidden) {
    return el(`<div class="mcard back ${extraClass}"><div class="face"></div></div>`);
  }
  const node = el(`<div class="mcard ${extraClass}"><div class="face"><img class="art" alt="" draggable="false">${frameHtml(card)}</div></div>`);
  node.title = card.nameFr || card.name || '';
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
    const target = e.target.closest(selector);
    if (!target || e.pointerType === 'mouse') {
      return;
    }
    fired = false;
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
