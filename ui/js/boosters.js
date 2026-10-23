// Boosters (mode Planeswalker) : la boutique (toutes les extensions, de la plus récente à la plus ancienne),
// les boosters gagnés, et leur ouverture façon Arena : le paquet se déchire, les cartes sont distribuées face cachée,
// puis retournées une à une ; les rares et les mythiques brillent avant d'être révélées et explosent de lumière.

import {sfx} from './audio.js';
import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {forgetCareer, isPlaneswalker, loadCareer, manaAmount, setCareer} from './career.js';
import {icon} from './icons.js';
import {el, esc, prefs, toast} from './util.js';

const SET_TYPES = {CORE: 'Édition de base', EXPANSION: 'Extension', DRAFT: 'Draft', REPRINT: 'Réédition', STARTER: 'Initiation',
  COMMANDER: 'Commander', FUNNY: 'Humoristique', ONLINE: 'En ligne', BOXED_SET: 'Coffret', COLLECTOR_EDITION: 'Collector',
  MULTIPLAYER: 'Multijoueur', PROMO: 'Promo', DUEL_DECK: 'Duel Decks', OTHER: 'Autre'};

let sets = null;

export async function boosterSets() {
  if (!sets) {
    sets = await bridge.request('boosterSets');
  }
  return sets;
}

function hash(text) {
  let h = 0;
  for (const ch of String(text)) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}

/** Un booster : le vrai visuel quand Forge en connaît un, sinon un paquet dessiné aux couleurs de l'extension. */
export function packElement(set, {cover = 0, cls = ''} = {}) {
  const node = el(`<div class="pack ${cls}" style="--pk-h:${hash(set.code) % 360}">
    <div class="pack-drawn">
      <div class="pk-logo">MAGIC</div><div class="pk-sub">The Gathering</div>
      <div class="pk-emblem">${icon('spark')}</div>
      <div class="pk-name">${esc(set.name)}</div>
      <div class="pk-foot"><span>${esc(set.code)}</span><span>14 cartes</span></div>
    </div>
    <div class="pk-shine"></div>
  </div>`);
  if (set.art && prefs.get('images')) {
    const n = set.covers > 1 ? (cover || 1 + (hash(set.code) % set.covers)) : 0;
    const img = new Image();
    img.className = 'pack-img';
    img.alt = '';
    img.draggable = false;
    img.onload = () => node.classList.add('has-img');
    img.src = bridge.imageUrl('booster:' + set.code + (n ? '_' + n : ''), 'en');
    node.prepend(img);
  }
  return node;
}

function setOptions(list, current) {
  const byYear = new Map();
  for (const s of list) {
    const y = s.year || '—';
    if (!byYear.has(y)) {
      byYear.set(y, []);
    }
    byYear.get(y).push(s);
  }
  return [...byYear.entries()].map(([y, items]) => `<optgroup label="${esc(y)}">${items.map(s =>
    `<option value="${esc(s.code)}"${s.code === current ? ' selected' : ''}>${esc(s.name)} (${esc(s.code)})</option>`).join('')}</optgroup>`).join('');
}

export class BoostersScreen {
  constructor(root, {onDuel}) {
    this.root = root;
    this.onDuel = onDuel;
  }

  async show() {
    if (!isPlaneswalker()) {
      this.root.innerHTML = '<div class="page"><h1>Boosters</h1><p class="muted">Les boosters et le mana font partie du mode Planeswalker (à choisir sur l\'accueil).</p></div>';
      return;
    }
    let c;
    let list;
    try {
      [c, list] = await Promise.all([loadCareer(true), boosterSets()]);
    } catch (e) {
      this.root.innerHTML = `<div class="page"><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    if (!c.started) {
      this.root.innerHTML = `<div class="page"><h1>Boosters</h1><div class="panel" style="padding:18px">
        <p>Commence d'abord ta carrière de Planeswalker : ton premier deck t'attend dans Duel.</p>
        <button class="btn gold" data-duel>${icon('swords')} Aller au Duel</button></div></div>`;
      this.root.querySelector('[data-duel]').addEventListener('click', () => this.onDuel());
      return;
    }
    this.render(c, list);
  }

  render(c, list) {
    const current = list.find(s => s.code === prefs.get('boosterSet')) || list[0];
    const owned = c.boosters || [];
    const groups = new Map();
    for (const b of owned) {
      if (!groups.has(b.set)) {
        groups.set(b.set, []);
      }
      groups.get(b.set).push(b);
    }
    this.root.innerHTML = `<div class="page boosters-page">
      <div class="pw-head"><h1>Boosters</h1><div class="pw-stats">${manaAmount(c.mana, 'chip')}</div></div>
      <div class="shop panel">
        <div class="shop-pack"></div>
        <div class="shop-info">
          <span class="vs-label">Extension (${list.length}, de la plus récente à la plus ancienne)</span>
          <select class="shop-set">${setOptions(list, current.code)}</select>
          <h2 class="shop-name"></h2>
          <div class="muted small shop-meta"></div>
          <p class="muted small">14 cartes, au format des vrais boosters de l'extension : communes, peu communes, et au moins une rare ou une mythique.</p>
          <button class="btn gold big" data-buy>Acheter · ${manaAmount(c.price)}</button>
          <div class="muted small shop-need"></div>
        </div>
      </div>
      <h2 class="shelf-h">Tes boosters <span class="muted small">(${owned.length})</span></h2>
      <div class="pack-shelf">${owned.length ? '' : '<p class="muted">Aucun booster à ouvrir. Gagne des duels ou achète-en un ci-dessus.</p>'}</div>
    </div>`;
    const fill = (set) => {
      this.set = set;
      const slot = this.root.querySelector('.shop-pack');
      slot.replaceChildren(packElement(set, {cls: 'big'}));
      this.root.querySelector('.shop-name').textContent = set.name;
      this.root.querySelector('.shop-meta').textContent = `${set.code} · ${set.year} · ${SET_TYPES[set.type] || set.type}`;
      const buy = this.root.querySelector('[data-buy]');
      buy.disabled = c.mana < c.price;
      this.root.querySelector('.shop-need').textContent = c.mana < c.price
        ? `Il te manque ${(c.price - c.mana).toLocaleString('fr-FR')} mana : chaque duel gagné en rapporte ${c.winMana}.` : '';
    };
    fill(current);
    this.root.querySelector('.shop-set').addEventListener('change', (e) => {
      const s = list.find(x => x.code === e.target.value);
      if (s) {
        prefs.set('boosterSet', s.code);
        fill(s);
      }
    });
    this.root.querySelector('[data-buy]').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        const next = await bridge.request('buyBooster', {set: this.set.code});
        setCareer(next);
        sfx('coins_drop.mp3');
        toast(`Booster ${this.set.name} ajouté à tes boosters.`, {title: `−${c.price.toLocaleString('fr-FR')} mana`});
        this.render(next, list);
      } catch (err) {
        toast(err.message, {error: true});
        e.currentTarget.disabled = false;
      }
    });
    const shelf = this.root.querySelector('.pack-shelf');
    for (const [code, items] of groups) {
      const set = list.find(s => s.code === code) || {code, name: items[0].name || code, covers: 1, art: false};
      const tile = el(`<button class="shelf-pack" data-set="${esc(code)}" title="Ouvrir un booster ${esc(set.name)}">
        <span class="shelf-count">×${items.length}</span><span class="shelf-name">${esc(set.name)}</span></button>`);
      tile.prepend(packElement(set, {cls: 'small'}));
      tile.addEventListener('click', () => this.open(items[0], set, list));
      shelf.appendChild(tile);
    }
  }

  /** Ouvre un booster, puis propose le suivant de la même extension (ou un autre). */
  async open(booster, set, list) {
    await openPack(booster, set, async () => {
      const c = await loadCareer(true);
      const next = (c.boosters || []).find(b => b.set === booster.set) || (c.boosters || [])[0];
      return next ? {booster: next, set: list.find(s => s.code === next.set) || {code: next.set, name: next.name, covers: 1}} : null;
    });
    this.render(await loadCareer(), list);
  }
}

// ------------------------------------------------------------------ ouverture

const RANK = {Common: 1, BasicLand: 0, Uncommon: 2, Rare: 3, Special: 3, MythicRare: 4};
const rarityClass = (card) => card.rarity === 'MythicRare' ? 'mythic' : card.rarity === 'Rare' || card.rarity === 'Special' ? 'rare'
  : card.rarity === 'Uncommon' ? 'uncommon' : 'common';

/** Colonnes et largeur des cartes pour que les 14 tiennent à l'écran. */
function layout(count, stage) {
  const W = stage.clientWidth - 24;
  const H = stage.clientHeight - 24;
  let best = {cols: 7, w: 60};
  for (const cols of [7, 5, 4, 3]) {
    const rows = Math.ceil(count / cols);
    const gap = 10;
    const w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 63 / 88, 200);
    if (w > best.w) {
      best = {cols, w};
    }
  }
  return best;
}

/** Ouverture animée d'un booster. {@code next} renvoie le booster suivant à proposer (ou null). */
export function openPack(booster, set, next) {
  return new Promise((resolve) => {
    const ov = el(`<div class="po">
      <div class="po-stage"><div class="po-flash"></div><div class="po-pack"></div><div class="po-grid"></div></div>
      <div class="po-bar"><div class="po-title"><b>${esc(set.name)}</b><span class="muted small po-hint">Touche le booster pour l'ouvrir</span></div>
        <div class="po-actions"></div></div>
    </div>`);
    document.body.appendChild(ov);
    const stage = ov.querySelector('.po-stage');
    const holder = ov.querySelector('.po-pack');
    const grid = ov.querySelector('.po-grid');
    const actions = ov.querySelector('.po-actions');
    const hint = ov.querySelector('.po-hint');
    const pack = packElement(set, {cls: 'big'});
    holder.appendChild(pack);
    requestAnimationFrame(() => ov.classList.add('in'));
    let result = null;
    let opening = false;
    const close = () => {
      ov.classList.remove('in');
      setTimeout(() => ov.remove(), 250);
      resolve();
    };
    const closeBtn = el('<button class="btn">Plus tard</button>');
    closeBtn.addEventListener('click', close);
    actions.appendChild(closeBtn);

    const tear = async () => {
      if (opening) {
        return;
      }
      opening = true;
      closeBtn.remove();
      hint.textContent = 'Ouverture…';
      const request = bridge.request('openBooster', {id: booster.id}).then(r => {
        result = r;
      }, (e) => {
        result = {error: e.message};
      });
      holder.classList.add('shake');
      sfx('shuffle.mp3');
      await wait(560);
      // Le haut du paquet se déchire et s'envole.
      const top = pack.cloneNode(true);
      top.classList.add('po-top');
      pack.classList.add('po-bottom');
      holder.appendChild(top);
      holder.classList.remove('shake');
      holder.classList.add('torn');
      await Promise.all([request, wait(520)]);
      if (result.error) {
        toast(result.error, {error: true});
        close();
        return;
      }
      forgetCareer();
      deal(result.cards);
    };
    holder.addEventListener('click', tear);

    const deal = (cards) => {
      const fit = () => {
        const {cols, w} = layout(cards.length, stage);
        grid.style.setProperty('--cols', cols);
        grid.style.setProperty('--cw', `${Math.floor(w)}px`);
      };
      fit();
      // La barre du bas peut grandir (boutons sur deux lignes), l'écran tourner : les cartes suivent.
      if (window.ResizeObserver) {
        new ResizeObserver(fit).observe(stage);
      }
      const from = holder.getBoundingClientRect();
      const nodes = cards.map((card, i) => {
        const r = rarityClass(card);
        const node = el(`<div class="po-card r-${r}${card.foil ? ' foil' : ''}" style="--i:${i}">
          <div class="po-inner"><div class="po-back"></div><div class="po-front"></div></div>
          ${card.isNew ? '<span class="po-new">Nouvelle</span>' : ''}</div>`);
        node.querySelector('.po-back').appendChild(cardElement(null));
        node.querySelector('.po-front').appendChild(cardElement(card));
        node._card = card;
        grid.appendChild(node);
        return node;
      });
      // Chaque carte part du paquet et rejoint sa place.
      for (const node of nodes) {
        const to = node.getBoundingClientRect();
        node.style.setProperty('--dx', `${from.left + from.width / 2 - (to.left + to.width / 2)}px`);
        node.style.setProperty('--dy', `${from.top + from.height / 2 - (to.top + to.height / 2)}px`);
        node.style.setProperty('--rot', `${(Math.random() * 30 - 15).toFixed(1)}deg`);
      }
      holder.classList.add('gone');
      requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.add('dealt')));
      setTimeout(() => sfx('draw.mp3'), 120);
      hint.textContent = 'Touche les cartes pour les retourner';
      const all = el('<button class="btn gold">Tout retourner</button>');
      actions.replaceChildren(all);
      let left = nodes.length;
      const flip = (node) => {
        if (node.classList.contains('flipped')) {
          return false;
        }
        node.classList.add('flipped');
        left--;
        const r = rarityClass(node._card);
        if (r === 'rare' || r === 'mythic') {
          burst(node, r, stage);
          sfx(r === 'mythic' ? 'planeswalker.mp3' : 'enchant.mp3');
        } else {
          sfx('flip_card.mp3', 0.7);
        }
        if (!left) {
          finished();
        }
        return true;
      };
      const consumed = onLongPress(grid, '.po-card.flipped', (n) => showZoom(n._card));
      grid.addEventListener('click', (e) => {
        if (consumed()) {
          return;
        }
        const node = e.target.closest('.po-card');
        if (node && !flip(node)) {
          showZoom(node._card);
        }
      });
      all.addEventListener('click', async () => {
        all.disabled = true;
        // Les communes vite, puis une pause avant les meilleures cartes.
        for (const node of nodes) {
          if (node.classList.contains('flipped')) {
            continue;
          }
          const rank = RANK[node._card.rarity] || 1;
          await wait(rank >= 3 ? 520 : 110);
          flip(node);
        }
      });
      const finished = async () => {
        const fresh = cards.filter(c => c.isNew).length;
        const best = cards.reduce((m, c) => Math.max(m, RANK[c.rarity] || 0), 0);
        hint.textContent = `${fresh ? `${fresh} nouvelle${fresh > 1 ? 's' : ''} carte${fresh > 1 ? 's' : ''} dans ta collection` : 'Aucune nouvelle carte'}${best === 4 ? ' · une mythique !' : ''}`;
        const after = next ? await next().catch(() => null) : null;
        const done = el('<button class="btn">Terminé</button>');
        done.addEventListener('click', close);
        actions.replaceChildren(done);
        if (after) {
          const again = el(`<button class="btn gold">${icon('booster')} Ouvrir un autre (${esc(after.set.name)})</button>`);
          again.addEventListener('click', () => {
            ov.remove();
            openPack(after.booster, after.set, next).then(resolve);
          });
          actions.appendChild(again);
        }
      };
    };
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Éclat de lumière d'une rare (or) ou d'une mythique (rouge orangé, avec un flash sur tout l'écran). */
function burst(node, kind, stage) {
  if (!prefs.get('animations')) {
    return;
  }
  const b = el(`<div class="po-burst ${kind}"><i class="rays"></i><i class="ring"></i></div>`);
  const count = kind === 'mythic' ? 22 : 14;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const d = (kind === 'mythic' ? 120 : 80) + Math.random() * 60;
    const p = el('<b class="spark"></b>');
    p.style.setProperty('--x', `${Math.cos(a) * d}px`);
    p.style.setProperty('--y', `${Math.sin(a) * d}px`);
    p.style.setProperty('--delay', `${Math.random() * 120}ms`);
    b.appendChild(p);
  }
  node.appendChild(b);
  setTimeout(() => b.remove(), 1600);
  if (kind === 'mythic') {
    const flash = stage.querySelector('.po-flash');
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
  }
}
