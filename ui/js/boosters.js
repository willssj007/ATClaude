// Boosters (mode Planeswalker) : la boutique (toutes les extensions, de la plus récente à la plus ancienne),
// les boosters gagnés, et leur ouverture façon Arena : le paquet tombe sur la table et se charge de lumière, explose,
// les cartes jaillissent face cachée puis se retournent une à une ; les rares et les mythiques brillent avant d'être
// révélées, vibrent, puis explosent de lumière. Une carte déjà possédée devient un jeton de sa rareté.

import {sfx} from './audio.js';
import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {forgetCareer, isPlaneswalker, loadCareer, manaAmount, RARITY_FR, setCareer, wildcardHtml, wildcardsHtml} from './career.js';
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
    <div class="pack-drawn${set.feature ? ' has-feature' : ''}">
      <div class="pk-logo">MAGIC</div><div class="pk-sub">The Gathering</div>
      <div class="pk-emblem">${set.feature && prefs.get('images') ? `<span class="pk-art" style="background-image:url('${bridge.imageUrl(set.feature, 'en')}')"></span>` : icon('spark')}</div>
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
      <div class="pw-head"><h1>Boosters</h1><div class="pw-stats">${manaAmount(c.mana, 'chip')}${wildcardsHtml(c.wildcards)}</div></div>
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
  const W = stage.clientWidth - Math.min(80, stage.clientWidth * 0.06);
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

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const animated = () => prefs.get('animations') && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animation Web (WAAPI) qui se termine par une promesse ; instantanée si les animations sont coupées. */
function play(node, frames, options) {
  if (!animated() || !node.animate) {
    return Promise.resolve();
  }
  const a = node.animate(frames, {fill: 'both', ...options});
  return a.finished.catch(() => {});
}

/** Étincelles qui jaillissent d'un point de l'écran (explosion du paquet, révélation d'une rare). */
function sparks(layer, x, y, {count = 24, colors = ['#fff1c4', '#ffd27a'], spread = 220, size = 6, life = 900} = {}) {
  if (!animated()) {
    return;
  }
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.35 + Math.random() * 0.65);
    const p = document.createElement('b');
    p.className = 'po-spark';
    const s = size * (0.5 + Math.random());
    p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${colors[i % colors.length]};box-shadow:0 0 ${s * 2}px ${colors[i % colors.length]}`;
    layer.appendChild(p);
    play(p, [
      {transform: 'translate(-50%, -50%) scale(1)', opacity: 1},
      {transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 40}px)) scale(0.2)`, opacity: 0},
    ], {duration: life * (0.6 + Math.random() * 0.6), easing: 'cubic-bezier(.15,.7,.3,1)'}).then(() => p.remove());
  }
}

/** Ouverture animée d'un booster, façon Arena. {@code next} renvoie le booster suivant à proposer (ou null). */
export function openPack(booster, set, next) {
  return new Promise((resolve) => {
    const ov = el(`<div class="po">
      <div class="po-bg"><i class="po-rays"></i><div class="po-motes">${'<i></i>'.repeat(18)}</div></div>
      <div class="po-stage"><div class="po-fx"></div><div class="po-flash"></div>
        <div class="po-pack-wrap"><div class="po-pack"></div><i class="po-charge"></i></div>
        <div class="po-grid"></div></div>
      <div class="po-bar"><div class="po-title"><b>${esc(set.name)}</b><span class="muted small po-hint">Touche le booster pour l'ouvrir</span></div>
        <div class="po-actions"></div></div>
    </div>`);
    document.body.appendChild(ov);
    const stage = ov.querySelector('.po-stage');
    const fx = ov.querySelector('.po-fx');
    const wrap = ov.querySelector('.po-pack-wrap');
    const holder = ov.querySelector('.po-pack');
    const grid = ov.querySelector('.po-grid');
    const actions = ov.querySelector('.po-actions');
    const hint = ov.querySelector('.po-hint');
    const pack = packElement(set, {cls: 'big'});
    holder.appendChild(pack);
    requestAnimationFrame(() => ov.classList.add('in'));
    // Le paquet tombe sur la table, puis flotte ; il s'incline vers le doigt (ou la souris).
    play(wrap, [
      {transform: 'translateY(-110vh) rotate(-14deg) scale(.7)', opacity: 0},
      {transform: 'translateY(6%) rotate(3deg) scale(1.03)', opacity: 1, offset: 0.72},
      {transform: 'none', opacity: 1},
    ], {duration: 760, easing: 'cubic-bezier(.2,.8,.3,1)'}).then(() => wrap.classList.add('idle'));
    const tilt = (e) => {
      const r = wrap.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      holder.style.setProperty('--rx', `${(-y * 10).toFixed(1)}deg`);
      holder.style.setProperty('--ry', `${(x * 14).toFixed(1)}deg`);
    };
    ov.addEventListener('pointermove', tilt);
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
      ov.removeEventListener('pointermove', tilt);
      closeBtn.remove();
      hint.textContent = 'Ouverture…';
      const request = bridge.request('openBooster', {id: booster.id}).then(r => {
        result = r;
      }, (e) => {
        result = {error: e.message};
      });
      // Charge : le paquet tremble de plus en plus, la lumière perce les soudures.
      wrap.classList.remove('idle');
      wrap.classList.add('charging');
      sfx('shuffle.mp3');
      await Promise.all([request, play(holder, [
        {transform: 'scale(1)'}, {transform: 'scale(1.04) rotate(-2deg)'}, {transform: 'scale(1.06) rotate(2.5deg)'},
        {transform: 'scale(1.09) rotate(-3deg)'}, {transform: 'scale(1.12) rotate(3deg)'}, {transform: 'scale(1.16) rotate(0deg)'},
      ], {duration: 950, easing: 'ease-in'})]);
      if (result.error) {
        toast(result.error, {error: true});
        close();
        return;
      }
      forgetCareer();
      // Explosion : éclair blanc, le paquet vole en éclats, la table tremble.
      const r = wrap.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2 - sr.left;
      const cy = r.top + r.height / 2 - sr.top;
      ov.querySelector('.po-flash').classList.add('on');
      sparks(fx, cx, cy, {count: 40, spread: 320, size: 7, colors: ['#ffffff', '#fff1c4', '#ffd27a', '#ffb048']});
      play(stage, [{transform: 'translate(0,0)'}, {transform: 'translate(-6px,4px)'}, {transform: 'translate(5px,-4px)'},
        {transform: 'translate(-3px,2px)'}, {transform: 'translate(0,0)'}], {duration: 320});
      wrap.classList.remove('charging');
      play(wrap, [{transform: 'scale(1.16)', opacity: 1, filter: 'brightness(1)'}, {transform: 'scale(1.5)', opacity: 0, filter: 'brightness(3)'}],
        {duration: 360, easing: 'ease-out'}).then(() => wrap.classList.add('gone'));
      deal(result.cards, cx, cy);
    };
    wrap.addEventListener('click', tear);

    const deal = (cards, cx, cy) => {
      const fit = () => {
        const {cols, w} = layout(cards.length, stage);
        grid.style.setProperty('--cols', cols);
        grid.style.setProperty('--cw', `${Math.floor(w)}px`);
      };
      fit();
      if (window.ResizeObserver) {
        new ResizeObserver(fit).observe(stage);
      }
      const nodes = cards.map((card, i) => {
        const node = el(`<div class="po-card r-${rarityClass(card)}${card.foil ? ' foil' : ''}">
          <div class="po-tilt"><div class="po-inner"><div class="po-back"></div><div class="po-front"><i class="po-sheen"></i></div></div></div>
          ${card.dupe ? `<span class="po-tag dupe">${wildcardHtml(card.dupe)} Doublon → jeton ${esc(RARITY_FR[card.dupe])}</span>`
            : card.isNew ? '<span class="po-tag">Nouvelle</span>' : ''}</div>`);
        node.querySelector('.po-back').appendChild(cardElement(null));
        node.querySelector('.po-front').prepend(cardElement(card));
        node._card = card;
        node._i = i;
        grid.appendChild(node);
        return node;
      });
      // Les cartes jaillissent du paquet en gerbe, puis retombent à leur place.
      const sr = stage.getBoundingClientRect();
      nodes.forEach((node, i) => {
        const to = node.getBoundingClientRect();
        const dx = cx - (to.left + to.width / 2 - sr.left);
        const dy = cy - (to.top + to.height / 2 - sr.top);
        const spin = (Math.random() * 60 - 30).toFixed(1);
        play(node, [
          {transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(${spin}deg)`, opacity: 0},
          {transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 140}px) scale(.9) rotate(${-spin / 2}deg)`, opacity: 1, offset: 0.55},
          {transform: 'translate(0, 8px) scale(1.02) rotate(0deg)', opacity: 1, offset: 0.85},
          {transform: 'none', opacity: 1},
        ], {duration: 820, delay: 80 + i * 45, easing: 'cubic-bezier(.2,.7,.25,1)'});
      });
      setTimeout(() => sfx('draw.mp3'), 160);
      hint.textContent = 'Touche les cartes pour les retourner';
      const all = el('<button class="btn gold">Tout révéler</button>');
      actions.replaceChildren(all);
      let left = nodes.length;
      let busy = 0;
      // Inclinaison des cartes vers le doigt.
      grid.addEventListener('pointermove', (e) => {
        const card = e.target.closest('.po-card');
        grid.querySelectorAll('.po-card.hover').forEach(n => n !== card && n.classList.remove('hover'));
        if (!card) {
          return;
        }
        card.classList.add('hover');
        const r = card.getBoundingClientRect();
        const t = card.querySelector('.po-tilt');
        t.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 18).toFixed(1)}deg`);
        t.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 22).toFixed(1)}deg`);
        t.style.setProperty('--gx', `${((e.clientX - r.left) / r.width * 100).toFixed(0)}%`);
      });
      grid.addEventListener('pointerleave', () => grid.querySelectorAll('.po-card.hover').forEach(n => n.classList.remove('hover')));

      const flip = async (node) => {
        if (node.classList.contains('flipped') || node.classList.contains('revealing')) {
          return false;
        }
        busy++;
        node.classList.add('revealing');
        const kind = rarityClass(node._card);
        const tiltEl = node.querySelector('.po-tilt');
        if (kind === 'rare' || kind === 'mythic') {
          // Suspense : la carte vibre et sa lumière grandit avant de se retourner.
          ov.classList.toggle('dim', kind === 'mythic');
          await play(tiltEl, [
            {transform: 'scale(1)'}, {transform: 'scale(1.06) rotate(-1.5deg)'}, {transform: 'scale(1.1) rotate(1.5deg)'},
            {transform: 'scale(1.14) rotate(-1deg)'}, {transform: 'scale(1.18) rotate(0deg)'},
          ], {duration: kind === 'mythic' ? 700 : 420, easing: 'ease-in'});
        }
        node.classList.add('flipped');
        left--;
        if (kind === 'rare' || kind === 'mythic') {
          const r = node.getBoundingClientRect();
          const sr = stage.getBoundingClientRect();
          burst(node, kind, stage);
          sparks(fx, r.left + r.width / 2 - sr.left, r.top + r.height / 2 - sr.top, kind === 'mythic'
            ? {count: 46, spread: 300, size: 8, colors: ['#fff1c4', '#ffb27a', '#ff7a3a', '#ff4a2a'], life: 1300}
            : {count: 26, spread: 200, size: 6, colors: ['#fff6d8', '#ffe08a', '#f6c04a'], life: 1000});
          sfx(kind === 'mythic' ? 'planeswalker.mp3' : 'enchant.mp3');
          await play(tiltEl, [{transform: 'scale(1.18)'}, {transform: 'scale(1.28)', offset: 0.35}, {transform: 'scale(1)'}],
            {duration: kind === 'mythic' ? 1000 : 700, easing: 'cubic-bezier(.3,1.4,.5,1)'});
          ov.classList.remove('dim');
        } else {
          sfx('flip_card.mp3', 0.7);
          await play(tiltEl, [{transform: 'translateY(0) scale(1)'}, {transform: 'translateY(-12px) scale(1.08)', offset: 0.4}, {transform: 'none'}],
            {duration: 420, easing: 'ease-out'});
        }
        node.classList.remove('revealing');
        busy--;
        if (!left) {
          finished();
        }
        return true;
      };
      const consumed = onLongPress(grid, '.po-card.flipped', (n) => showZoom(n._card));
      grid.addEventListener('click', async (e) => {
        if (consumed()) {
          return;
        }
        const node = e.target.closest('.po-card');
        if (!node) {
          return;
        }
        if (node.classList.contains('flipped')) {
          showZoom(node._card);
        } else {
          flip(node);
        }
      });
      all.addEventListener('click', async () => {
        all.disabled = true;
        // De plus en plus vite pour les communes, une pause avant les meilleures cartes.
        let delay = 170;
        for (const node of nodes) {
          if (node.classList.contains('flipped')) {
            continue;
          }
          const rank = RANK[node._card.rarity] || 1;
          await wait(rank >= 3 ? 450 : delay);
          delay = Math.max(60, delay * 0.85);
          if (rank >= 3) {
            await flip(node);
          } else {
            flip(node);
          }
        }
      });
      const finished = async () => {
        while (busy) {
          await wait(80);
        }
        const fresh = cards.filter(c => c.isNew).length;
        const dupes = cards.filter(c => c.dupe);
        const best = cards.reduce((m, c) => Math.max(m, RANK[c.rarity] || 0), 0);
        const parts = [fresh ? `${fresh} nouvelle${fresh > 1 ? 's' : ''} carte${fresh > 1 ? 's' : ''}` : 'aucune nouvelle carte'];
        if (dupes.length) {
          parts.push(`${dupes.length} doublon${dupes.length > 1 ? 's' : ''} changé${dupes.length > 1 ? 's' : ''} en jeton${dupes.length > 1 ? 's' : ''}`);
        }
        if (best === 4) {
          parts.push('une mythique !');
        }
        hint.textContent = parts.join(' · ');
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

/** Éclat de lumière d'une rare (or) ou d'une mythique (rouge orangé, avec un flash sur tout l'écran). */
function burst(node, kind, stage) {
  if (!animated()) {
    return;
  }
  const b = el(`<div class="po-burst ${kind}"><i class="rays"></i><i class="ring"></i><i class="ring two"></i></div>`);
  node.appendChild(b);
  setTimeout(() => b.remove(), 1800);
  if (kind === 'mythic') {
    const flash = stage.querySelector('.po-flash');
    flash.classList.remove('on', 'mythic');
    void flash.offsetWidth;
    flash.classList.add('on', 'mythic');
  }
}
