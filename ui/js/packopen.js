// Ouverture des boosters, façon Arena. Un booster : il arrive en glissant, flotte et suit le doigt ; on le touche (ou on
// glisse dessus) : une ligne de lumière court sur la soudure, le haut s'arrache, la lumière jaillit, les cartes sortent du
// paquet et se rangent face cachée. La rareté se devine à la lueur du dos (argent, or, rouge orangé) ; une rare ou une
// mythique se charge de lumière avant de se retourner, puis éclate. Plusieurs boosters : ils s'ouvrent tous ensemble, et
// les cartes se rangent par rareté (les rares et mythiques face cachée, à révéler).
//
// Fluidité : seules la position, l'échelle et l'opacité sont animées (calculées par la carte graphique), les particules
// sont dessinées sur un seul canvas, et les images des cartes sont chargées avant leur arrivée.
// Maintenir le doigt sur une carte retournée l'agrandit au centre tant qu'on appuie ; un simple toucher ouvre sa fiche.

import {sfx} from './audio.js';
import {bridge} from './bridge.js';
import {cardElement, showZoom} from './cards.js';
import {forgetCareer, RARITY_FR, wildcardHtml} from './career.js';
import {icon} from './icons.js';
import {el, esc, prefs, toast} from './util.js';

const RANK = {BasicLand: 0, Common: 1, Uncommon: 2, Rare: 3, Special: 3, MythicRare: 4};
const rarityClass = (card) => card.rarity === 'MythicRare' ? 'mythic' : card.rarity === 'Rare' || card.rarity === 'Special' ? 'rare'
  : card.rarity === 'Uncommon' ? 'uncommon' : 'common';
const GOLD = ['#fff6d8', '#ffe08a', '#f6c04a', '#ffd27a'];
const EMBER = ['#fff1c4', '#ffb27a', '#ff7a3a', '#ff4a2a'];
const LIGHT = ['#ffffff', '#fff1c4', '#ffd27a', '#ffb048'];

const animated = () => prefs.get('animations') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/** Animation Web (WAAPI) qui se termine par une promesse ; instantanée si les animations sont coupées. */
function play(node, frames, options) {
  if (!animated() || !node.animate) {
    return Promise.resolve();
  }
  return node.animate(frames, {fill: 'both', ...options}).finished.catch(() => {});
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

// ------------------------------------------------------------------ particules (un canvas pour tout l'écran)

class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.list = [];
    this.sprites = new Map();
    this.running = false;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.canvas.clientWidth * this.dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * this.dpr);
  }

  /** Point lumineux d'une couleur, dessiné une fois puis recopié (bien plus rapide qu'un dégradé par particule). */
  sprite(color) {
    if (!this.sprites.has(color)) {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
      this.sprites.set(color, c);
    }
    return this.sprites.get(color);
  }

  /** Gerbe d'étincelles depuis (x, y), en pixels de l'écran ; up : surtout vers le haut. */
  burst(x, y, {count = 30, colors = GOLD, speed = 7, size = 14, life = 1100, up = false, gravity = 0.12} = {}) {
    if (!animated()) {
      return;
    }
    for (let i = 0; i < count; i++) {
      const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9 : Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.75);
      this.list.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, born: performance.now(),
        life: life * (0.6 + Math.random() * 0.6), size: size * (0.4 + Math.random() * 0.8), color: colors[i % colors.length]});
    }
    this.start();
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(3, (now - last) / 16.7);
      last = now;
      const {ctx, dpr} = this;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      this.list = this.list.filter(p => now - p.born < p.life);
      for (const p of this.list) {
        p.vy += p.g * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - (now - p.born) / p.life;
        const s = p.size * (0.4 + k * 0.6) * dpr;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.drawImage(this.sprite(p.color), p.x * dpr - s / 2, p.y * dpr - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (this.list.length && this.canvas.isConnected) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.running = false;
      }
    };
    requestAnimationFrame(frame);
  }
}

// ------------------------------------------------------------------ outils

/** Charge et décode les images des cartes avant leur arrivée (au plus quelques secondes), pour des retournements nets. */
function preload(cards, maxMs = 1800) {
  if (!prefs.get('images')) {
    return Promise.resolve();
  }
  const lang = prefs.get('imageLang');
  const jobs = cards.filter(c => c && c.image).map(c => {
    const img = new Image();
    img.src = bridge.imageUrl(c.image, lang) + (c.exactArt ? '&exact=1' : '');
    return (img.decode ? img.decode() : new Promise(r => { img.onload = r; })).catch(() => {});
  });
  return Promise.race([Promise.all(jobs), wait(maxMs)]);
}

/** Colonnes et largeur des cartes pour qu'elles tiennent dans la zone (count cartes). */
function layout(count, box) {
  const W = box.clientWidth - Math.min(60, box.clientWidth * 0.05);
  const H = box.clientHeight - 16;
  // Deux rangées de 7 comme sur Arena, sauf si les cartes y seraient nettement plus petites (écran en hauteur).
  let best = {cols: 7, w: 50};
  for (const cols of [7, 5, 4, 3]) {
    const rows = Math.ceil(count / cols);
    const gap = 10;
    const w = Math.min((W - gap * (cols - 1)) / cols, ((H - gap * (rows - 1)) / rows) * 63 / 88, 210);
    if (w > best.w * (cols === 7 ? 1 : 1.15)) {
      best = {cols, w};
    }
  }
  return best;
}

function center(node, stage) {
  const r = node.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return {x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top, sx: r.left + r.width / 2, sy: r.top + r.height / 2};
}

/** Une carte du booster, face cachée : lueur de sa rareté, retournement en 3D, étiquette « Nouvelle » ou doublon. */
function cardNode(card, count = 1) {
  const kind = rarityClass(card);
  const node = el(`<div class="bo-card r-${kind}${card.foil ? ' foil' : ''}">
    <i class="bo-aura"></i>
    <div class="bo-lift"><div class="bo-tilt"><div class="bo-flip"><div class="bo-back"></div><div class="bo-front"><i class="bo-sweep"></i></div></div></div></div>
    ${count > 1 ? `<span class="bo-count">×${count}</span>` : ''}
    ${card.dupe ? `<span class="bo-tag dupe">${wildcardHtml(card.dupe)} Doublon → jeton ${esc(RARITY_FR[card.dupe])}</span>`
      : card.isNew ? '<span class="bo-tag">Nouvelle</span>' : ''}</div>`);
  node.querySelector('.bo-back').appendChild(cardElement(null));
  node.querySelector('.bo-front').prepend(cardElement(card));
  node._card = card;
  node._kind = kind;
  return node;
}

/** Le décor commun : fond, canvas des particules, scène, barre du bas et loupe (appui long). */
function overlay(title) {
  const ov = el(`<div class="bo">
    <div class="bo-bg"><i class="bo-glow"></i><i class="bo-rays"></i></div>
    <div class="bo-stage"><div class="bo-flash"></div></div>
    <canvas class="bo-fx"></canvas>
    <div class="bo-bar"><div class="bo-title"><b>${esc(title)}</b><span class="muted small bo-hint"></span></div>
      <div class="bo-actions"></div></div>
    <div class="bo-inspect"></div>
  </div>`);
  document.body.appendChild(ov);
  const fx = new Particles(ov.querySelector('.bo-fx'));
  const onResize = () => fx.resize();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(() => ov.classList.add('in'));
  return {
    ov, fx,
    stage: ov.querySelector('.bo-stage'),
    actions: ov.querySelector('.bo-actions'),
    hint: ov.querySelector('.bo-hint'),
    close() {
      window.removeEventListener('resize', onResize);
      ov.classList.remove('in');
      setTimeout(() => ov.remove(), 260);
    },
  };
}

/** Éclair sur toute la scène (ouverture, mythique). */
function flash(stage, kind = '') {
  if (!animated()) {
    return;
  }
  const f = stage.querySelector('.bo-flash');
  f.className = 'bo-flash';
  void f.offsetWidth;
  f.className = `bo-flash on ${kind}`;
}

/** Anneaux et rayons autour d'une carte qui vient d'être révélée (rare : or, mythique : rouge orangé). */
function burst(node, kind) {
  if (!animated()) {
    return;
  }
  const b = el(`<div class="bo-burst ${kind}"><i class="rays"></i><i class="ring"></i><i class="ring two"></i></div>`);
  node.appendChild(b);
  setTimeout(() => b.remove(), 1700);
}

/**
 * Cartes d'une zone : retournement au toucher, fiche au toucher d'une carte retournée, loupe tant qu'on appuie
 * (au doigt comme à la souris). onFlipped(node) après chaque retournement.
 */
function interactive(view, zone, onFlipped) {
  const {ov, fx, stage} = view;
  const lens = ov.querySelector('.bo-inspect');
  let busy = 0;
  let pressTimer = 0;
  let inspecting = null;
  let swallowClick = false;

  const flip = async (node) => {
    if (node.classList.contains('flipped') || node.classList.contains('revealing')) {
      return false;
    }
    busy++;
    node.classList.add('revealing');
    const kind = node._kind;
    const lift = node.querySelector('.bo-lift');
    const big = kind === 'rare' || kind === 'mythic';
    if (big) {
      // Suspense : la carte grossit, tremble, et sa lueur monte.
      node.classList.add('charging');
      ov.classList.toggle('dim', kind === 'mythic');
      await play(lift, [
        {transform: 'scale(1) rotate(0deg)'}, {transform: 'scale(1.06) rotate(-1.2deg)'}, {transform: 'scale(1.1) rotate(1.4deg)'},
        {transform: 'scale(1.13) rotate(-1deg)'}, {transform: 'scale(1.16) rotate(0deg)'},
      ], {duration: kind === 'mythic' ? 680 : 400, easing: 'ease-in'});
    }
    node.classList.add('flipped');
    node.classList.remove('charging');
    if (big) {
      const c = center(node, stage);
      burst(node, kind);
      fx.burst(c.sx, c.sy, kind === 'mythic' ? {count: 60, colors: EMBER, speed: 9, size: 18, life: 1500}
        : {count: 34, colors: GOLD, speed: 7, size: 14, life: 1100});
      if (kind === 'mythic') {
        flash(stage, 'mythic');
      }
      sfx(kind === 'mythic' ? 'reveal_mythic' : 'reveal_rare');
      await play(lift, [{transform: 'scale(1.16)'}, {transform: 'scale(1.26)', offset: 0.3}, {transform: 'scale(1)'}],
        {duration: kind === 'mythic' ? 950 : 650, easing: 'cubic-bezier(.3,1.4,.5,1)'});
      ov.classList.remove('dim');
    } else {
      sfx('flip_card.mp3', 0.6);
      await play(lift, [{transform: 'translateY(0) scale(1)'}, {transform: 'translateY(-10px) scale(1.06)', offset: 0.45}, {transform: 'none'}],
        {duration: 460, easing: 'cubic-bezier(.25,.8,.3,1)'});
    }
    node.classList.remove('revealing');
    busy--;
    onFlipped(node);
    return true;
  };

  // Loupe : la carte retournée grandit jusqu'au centre tant qu'on appuie, puis revient à sa place.
  const inspect = (node) => {
    const r = node.querySelector('.bo-front').getBoundingClientRect();
    lens.replaceChildren(cardElement(node._card, 'bo-lens-card'));
    const big = lens.firstChild;
    lens.classList.add('on');
    const target = big.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (target.left + target.width / 2);
    const dy = r.top + r.height / 2 - (target.top + target.height / 2);
    const s = r.width / target.width;
    play(big, [{transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.6}, {transform: 'none', opacity: 1}],
      {duration: 240, easing: 'cubic-bezier(.2,.8,.3,1)'});
    inspecting = {node, dx, dy, s};
  };
  const release = () => {
    clearTimeout(pressTimer);
    if (!inspecting) {
      return;
    }
    const {dx, dy, s} = inspecting;
    inspecting = null;
    const big = lens.firstChild;
    play(big, [{transform: 'none', opacity: 1}, {transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0}],
      {duration: 200, easing: 'ease-in'}).then(() => {
      if (!inspecting) {
        lens.classList.remove('on');
        lens.replaceChildren();
      }
    });
  };
  let start = null;
  zone.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    const node = e.target.closest('.bo-card.flipped');
    if (!node) {
      return;
    }
    start = {x: e.clientX, y: e.clientY};
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      swallowClick = true;
      inspect(node);
    }, 280);
  });
  zone.addEventListener('pointermove', (e) => {
    if (start && !inspecting && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) {
      clearTimeout(pressTimer); // défilement : pas de loupe
    }
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  zone.addEventListener('contextmenu', (e) => e.target.closest('.bo-card') && e.preventDefault());
  zone.addEventListener('click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    const node = e.target.closest('.bo-card');
    if (!node) {
      return;
    }
    if (node.classList.contains('flipped')) {
      showZoom(node._card);
    } else {
      flip(node);
    }
  });
  // Inclinaison de la carte survolée vers le doigt ou la souris.
  zone.addEventListener('pointermove', (e) => {
    const node = e.target.closest('.bo-card');
    if (!node || e.pointerType === 'touch') {
      return;
    }
    const r = node.getBoundingClientRect();
    node.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 16).toFixed(1)}deg`);
    node.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 20).toFixed(1)}deg`);
  });
  const cleanup = () => {
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
  };
  return {flip, busy: () => busy, cleanup};
}

/**
 * Retourne les cartes encore cachées l'une après l'autre, de plus en plus vite ; une pause avant les meilleures, qu'on
 * laisse se révéler entièrement (sauf {@code fast} : seules les mythiques attendent).
 */
async function revealAll(nodes, flip, fast = false) {
  let delay = 160;
  for (const node of nodes) {
    if (node.classList.contains('flipped') || node.classList.contains('revealing')) {
      continue;
    }
    const rank = RANK[node._card.rarity] || 1;
    await wait(rank >= 3 && !fast ? 380 : delay);
    delay = Math.max(fast ? 90 : 50, delay * 0.84);
    if (fast ? rank >= 4 : rank >= 3) {
      await flip(node);
    } else {
      flip(node);
    }
  }
}

function summary(cards) {
  const fresh = cards.filter(c => c.isNew).length;
  const dupes = cards.filter(c => c.dupe).length;
  const mythics = cards.filter(c => c.rarity === 'MythicRare').length;
  const parts = [fresh ? `${fresh} nouvelle${fresh > 1 ? 's' : ''} carte${fresh > 1 ? 's' : ''}` : 'aucune nouvelle carte'];
  if (dupes) {
    parts.push(`${dupes} doublon${dupes > 1 ? 's' : ''} changé${dupes > 1 ? 's' : ''} en jeton${dupes > 1 ? 's' : ''}`);
  }
  if (mythics) {
    parts.push(mythics > 1 ? `${mythics} mythiques !` : 'une mythique !');
  }
  return parts.join(' · ');
}

// ------------------------------------------------------------------ un booster

/**
 * Ouvre un booster. {@code more} (facultatif) renvoie la suite à proposer à la fin : {next: {booster, set}, rest: [...]}
 * où rest sont les boosters encore fermés (pour « Tout ouvrir »).
 */
export function openPack(booster, set, more) {
  return new Promise((resolve) => {
    const view = overlay(set.name);
    const {ov, fx, stage, actions, hint} = view;
    hint.textContent = 'Touche le booster (ou glisse dessus) pour l\'ouvrir';
    const wrap = el(`<div class="bo-pack-wrap"><div class="bo-pack-float"><div class="bo-pack">
      <div class="bo-part body"></div><div class="bo-part flap"></div><i class="bo-seam"></i><i class="bo-pack-light"></i>
    </div></div></div>`);
    wrap.querySelector('.body').appendChild(packElement(set, {cls: 'big'}));
    wrap.querySelector('.flap').appendChild(packElement(set, {cls: 'big'}));
    stage.appendChild(wrap);
    const packEl = wrap.querySelector('.bo-pack');
    play(wrap, [
      {transform: 'translateY(70vh) rotate(9deg) scale(.6)', opacity: 0},
      {transform: 'translateY(-4%) rotate(-2deg) scale(1.03)', opacity: 1, offset: 0.7},
      {transform: 'none', opacity: 1},
    ], {duration: 720, easing: 'cubic-bezier(.2,.85,.3,1)'}).then(() => wrap.classList.add('idle'));

    // Le paquet s'incline vers le doigt ; glisser dessus l'ouvre aussi.
    let down = null;
    const tilt = (e) => {
      const r = wrap.getBoundingClientRect();
      packEl.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 16).toFixed(1)}deg`);
      packEl.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 24).toFixed(1)}deg`);
      if (down && Math.abs(e.clientX - down.x) > 50) {
        tear();
      }
    };
    ov.addEventListener('pointermove', tilt);
    wrap.addEventListener('pointerdown', (e) => {
      down = {x: e.clientX};
    });
    wrap.addEventListener('click', () => tear());

    let done = false;
    const close = () => {
      if (done) {
        return;
      }
      done = true;
      view.close();
      if (controls) {
        controls.cleanup();
      }
      resolve();
    };
    const later = el('<button class="btn">Plus tard</button>');
    later.addEventListener('click', close);
    actions.appendChild(later);
    let controls = null;
    let opening = false;

    const tear = async () => {
      if (opening) {
        return;
      }
      opening = true;
      down = null;
      ov.removeEventListener('pointermove', tilt);
      later.remove();
      hint.textContent = 'Ouverture…';
      let result = null;
      const request = bridge.request('openBooster', {id: booster.id})
        .then(r => (result = r), e => (result = {error: e.message}))
        .then(() => result.cards && preload(result.cards));
      wrap.classList.remove('idle');
      sfx('booster_open');
      // Le paquet se tasse, la soudure s'illumine d'un bord à l'autre, puis le haut s'arrache.
      await play(packEl, [{transform: 'scale(1)'}, {transform: 'scale(1.04, .96)', offset: 0.5}, {transform: 'scale(1)'}],
        {duration: 260, easing: 'ease-in-out'});
      packEl.classList.add('torn');
      const c = center(wrap, stage);
      fx.burst(c.sx, c.sy - wrap.offsetHeight * 0.36, {count: 36, colors: LIGHT, speed: 8, size: 15, up: true, life: 1200});
      await Promise.all([request, wait(animated() ? 560 : 0)]);
      if (result.error) {
        toast(result.error, {error: true});
        close();
        return;
      }
      forgetCareer();
      flash(stage);
      play(wrap, [{transform: 'none', opacity: 1}, {transform: 'translateY(26%) scale(.9)', opacity: 0}],
        {duration: 520, delay: 200, easing: 'cubic-bezier(.5,0,.8,.6)'}).then(() => wrap.remove());
      deal(result.cards, c);
    };

    const deal = (cards, from) => {
      const grid = el('<div class="bo-grid"></div>');
      stage.appendChild(grid);
      const fit = () => {
        const {cols, w} = layout(cards.length, stage);
        grid.style.setProperty('--cols', cols);
        grid.style.setProperty('--cw', `${Math.floor(w)}px`);
      };
      fit();
      const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
      if (ro) {
        ro.observe(stage);
      }
      const nodes = cards.map(card => cardNode(card));
      nodes.forEach(n => grid.appendChild(n));
      // Les cartes sortent du paquet, une à une, et filent à leur place.
      const top = from.y - 40;
      nodes.forEach((node, i) => {
        const t = center(node, stage);
        play(node, [
          {transform: `translate(${from.x - t.x}px, ${top - t.y}px) scale(.42) rotate(${(i % 2 ? 1 : -1) * (6 + i)}deg)`, opacity: 0},
          {transform: `translate(${(from.x - t.x) * 0.3}px, ${(top - t.y) * 0.3 - 30}px) scale(.92) rotate(${(i % 2 ? -1 : 1) * 3}deg)`, opacity: 1, offset: 0.6},
          {transform: 'none', opacity: 1},
        ], {duration: 640, delay: 60 + i * 42, easing: 'cubic-bezier(.2,.9,.25,1)'});
      });
      setTimeout(() => sfx('draw.mp3'), 140);
      hint.textContent = 'Touche une carte pour la retourner · maintiens le doigt pour l\'agrandir';
      const all = el('<button class="btn gold">Tout révéler</button>');
      actions.replaceChildren(all);
      let left = nodes.length;
      controls = interactive(view, grid, () => {
        left--;
        if (!left) {
          finished();
        }
      });
      all.addEventListener('click', () => {
        all.disabled = true;
        revealAll(nodes, controls.flip);
      });

      const finished = async () => {
        while (controls.busy()) {
          await wait(60);
        }
        if (ro) {
          ro.disconnect();
        }
        hint.textContent = summary(cards);
        const after = more ? await more().catch(() => null) : null;
        const end = el('<button class="btn">Terminé</button>');
        end.addEventListener('click', close);
        actions.replaceChildren(end);
        if (after && after.rest && after.rest.length > 1) {
          const allBtn = el(`<button class="btn">${icon('booster')} Tout ouvrir (${after.rest.length})</button>`);
          allBtn.addEventListener('click', () => {
            done = true;
            controls.cleanup();
            ov.remove();
            openPacks(after.rest, after.setFor).then(resolve);
          });
          actions.appendChild(allBtn);
        }
        if (after && after.next) {
          const again = el(`<button class="btn gold">${icon('booster')} Ouvrir le suivant (${esc(after.next.set.name)})</button>`);
          again.addEventListener('click', () => {
            done = true;
            controls.cleanup();
            ov.remove();
            openPack(after.next.booster, after.next.set, more).then(resolve);
          });
          actions.appendChild(again);
        }
      };
    };
  });
}

// ------------------------------------------------------------------ plusieurs boosters

/** Les cartes de plusieurs boosters, une entrée par carte et par impression, avec leur nombre. */
function merge(packs) {
  const by = new Map();
  for (const p of packs) {
    for (const card of p.cards) {
      const k = `${card.name}|${card.image || ''}|${card.foil ? 1 : 0}`;
      const e = by.get(k);
      if (e) {
        e.count++;
        e.card.isNew = e.card.isNew || card.isNew;
        e.dupes += card.dupe ? 1 : 0;
      } else {
        by.set(k, {card: {...card}, count: 1, dupes: card.dupe ? 1 : 0});
      }
    }
  }
  return [...by.values()].sort((a, b) => (RANK[b.card.rarity] || 0) - (RANK[a.card.rarity] || 0)
    || (b.card.foil ? 1 : 0) - (a.card.foil ? 1 : 0) || String(a.card.nameFr || a.card.name).localeCompare(String(b.card.nameFr || b.card.name), 'fr'));
}

/**
 * Ouvre plusieurs boosters d'un coup (boosters : [{id, set, name}] ; setFor(code) : l'extension pour son visuel).
 * Les rares et mythiques arrivent face cachée, les autres face visible ; tout se range par rareté.
 */
export function openPacks(boosters, setFor) {
  return new Promise((resolve) => {
    const list = boosters.slice(0, 100);
    const view = overlay(`${list.length} boosters`);
    const {ov, fx, stage, actions, hint} = view;
    hint.textContent = 'Touche les boosters pour tous les ouvrir';
    // Éventail de paquets (au plus 7 montrés).
    const fan = el('<div class="bo-fan"></div>');
    const shown = list.slice(0, 7);
    shown.forEach((b, i) => {
      const k = i - (shown.length - 1) / 2;
      const p = el(`<div class="bo-fan-pack" style="--k:${k};--i:${i}"><div class="bo-pack"><div class="bo-part body"></div>
        <div class="bo-part flap"></div><i class="bo-seam"></i><i class="bo-pack-light"></i></div></div>`);
      const set = setFor(b.set);
      p.querySelector('.body').appendChild(packElement(set, {cls: 'big'}));
      p.querySelector('.flap').appendChild(packElement(set, {cls: 'big'}));
      fan.appendChild(p);
    });
    if (list.length > shown.length) {
      fan.appendChild(el(`<span class="bo-fan-more">+${list.length - shown.length}</span>`));
    }
    stage.appendChild(fan);
    play(fan, [{transform: 'translateY(60vh) scale(.7)', opacity: 0}, {transform: 'translateY(-3%) scale(1.02)', opacity: 1, offset: 0.72},
      {transform: 'none', opacity: 1}], {duration: 720, easing: 'cubic-bezier(.2,.85,.3,1)'}).then(() => fan.classList.add('idle'));

    let controls = null;
    let done = false;
    const close = () => {
      if (done) {
        return;
      }
      done = true;
      view.close();
      if (controls) {
        controls.cleanup();
      }
      resolve();
    };
    const later = el('<button class="btn">Plus tard</button>');
    later.addEventListener('click', close);
    const go = el(`<button class="btn gold">${icon('booster')} Tout ouvrir</button>`);
    actions.append(later, go);
    let opening = false;
    const tear = async () => {
      if (opening) {
        return;
      }
      opening = true;
      later.remove();
      go.remove();
      hint.textContent = 'Ouverture…';
      let result = null;
      const request = bridge.request('openBoosters', {ids: list.map(b => b.id)})
        .then(r => (result = r), e => (result = {error: e.message}))
        .then(() => result.packs && preload(merge(result.packs).filter(e => RANK[e.card.rarity] >= 3).map(e => e.card)));
      fan.classList.remove('idle');
      sfx('booster_open');
      // Les paquets s'ouvrent l'un après l'autre, en rafale.
      const packs = [...fan.querySelectorAll('.bo-pack')];
      for (const [i, p] of packs.entries()) {
        setTimeout(() => {
          p.classList.add('torn');
          const c = center(p, stage);
          fx.burst(c.sx, c.sy - p.offsetHeight * 0.36, {count: 18, colors: LIGHT, speed: 7, size: 13, up: true, life: 1000});
        }, i * 110);
      }
      await Promise.all([request, wait(animated() ? 420 + packs.length * 110 : 0)]);
      if (result.error) {
        toast(result.error, {error: true});
        close();
        return;
      }
      forgetCareer();
      flash(stage);
      await play(fan, [{transform: 'none', opacity: 1}, {transform: 'translateY(20%) scale(.9)', opacity: 0}],
        {duration: 420, easing: 'cubic-bezier(.5,0,.8,.6)'});
      fan.remove();
      results(result.packs);
    };
    fan.addEventListener('click', tear);
    go.addEventListener('click', tear);

    const results = (packs) => {
      const entries = merge(packs);
      const cards = packs.flatMap(p => p.cards);
      const box = el('<div class="bo-results"></div>');
      stage.appendChild(box);
      const groups = [['mythic', 'Mythiques'], ['rare', 'Rares'], ['uncommon', 'Peu communes'], ['common', 'Communes et terrains']];
      const hidden = [];
      let n = 0;
      for (const [kind, label] of groups) {
        const items = entries.filter(e => rarityClass(e.card) === kind);
        if (!items.length) {
          continue;
        }
        const total = items.reduce((a, e) => a + e.count, 0);
        const sec = el(`<section class="bo-sec r-${kind}"><h3>${label} <span class="muted small">${total}</span></h3><div class="bo-sec-grid"></div></section>`);
        box.appendChild(sec); // dans la page avant d'animer ses cartes
        const grid = sec.querySelector('.bo-sec-grid');
        for (const e of items) {
          const node = cardNode({...e.card, dupe: e.dupes === e.count ? e.card.dupe : null}, e.count);
          if (kind === 'mythic' || kind === 'rare') {
            hidden.push(node);
          } else {
            node.classList.add('flipped');
          }
          grid.appendChild(node);
          // Les premières arrivent en douceur ; au-delà, elles sont simplement là (rapide même avec beaucoup de cartes).
          if (n < 48) {
            play(node, [{transform: 'translateY(24px) scale(.9)', opacity: 0}, {transform: 'none', opacity: 1}],
              {duration: 380, delay: 40 + n * 22, easing: 'cubic-bezier(.2,.9,.3,1)'});
          }
          n++;
        }
      }
      setTimeout(() => sfx('draw.mp3'), 120);
      hint.textContent = `${summary(cards)} · ${hidden.length ? 'touche une carte pour la retourner, ' : ''}maintiens le doigt pour l'agrandir`;
      let left = hidden.length;
      const end = el('<button class="btn">Terminé</button>');
      end.addEventListener('click', close);
      controls = interactive(view, box, () => {
        left--;
        if (!left) {
          actions.replaceChildren(end);
        }
      });
      if (hidden.length) {
        const all = el('<button class="btn gold">Tout révéler</button>');
        all.addEventListener('click', () => {
          all.disabled = true;
          revealAll([...hidden].reverse(), controls.flip, true);
        });
        actions.replaceChildren(end, all);
      } else {
        actions.replaceChildren(end);
      }
    };
  });
}
