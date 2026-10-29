// Boosters (mode Planeswalker) : la boutique (toutes les extensions, de la plus récente à la plus ancienne) et les
// boosters gagnés, à ouvrir un par un ou tous ensemble (l'ouverture elle-même : js/packopen.js). Une carte déjà
// possédée devient un jeton de sa rareté.

import {sfx} from './audio.js';
import {bridge} from './bridge.js';
import {isPlaneswalker, loadCareer, manaAmount, setCareer, wildcardsHtml} from './career.js';
import {icon} from './icons.js';
import {openPack, openPacks, packElement} from './packopen.js';
import {packScene, webglOk} from './pack3d.js';
import {shopHtml, themeClicked} from './themes.js';
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
      <div class="shelf-head"><h2 class="shelf-h">Tes boosters <span class="muted small">(${owned.length})</span></h2>
        ${owned.length > 1 ? `<button class="btn gold" data-open-all>${icon('booster')} Tout ouvrir (${owned.length})</button>` : ''}</div>
      <div class="pack-shelf">${owned.length ? '' : '<p class="muted">Aucun booster à ouvrir. Gagne des duels ou achète-en un ci-dessus.</p>'}</div>
      <div class="theme-shop"></div>
    </div>`;
    const themeShop = this.root.querySelector('.theme-shop');
    shopHtml().then(html => {
      themeShop.innerHTML = html;
    }).catch(() => {});
    themeShop.addEventListener('click', async (e) => {
      if (await themeClicked(e.target)) {
        // Achat : le mana affiché en haut change.
        const next = await loadCareer(true);
        if (next.mana !== c.mana) {
          this.render(next, list);
        }
      }
    });
    const fill = (set) => {
      this.set = set;
      const slot = this.root.querySelector('.shop-pack');
      slot.replaceChildren(packElement(set, {cls: 'big'}));
      slot.classList.remove('has-3d');
      // Vitrine en 3D : le booster tourne lentement, on le fait pivoter du doigt (le dessin CSS reste en attendant).
      if (this.shop3d) {
        this.shop3d.dispose();
        this.shop3d = null;
      }
      if (webglOk()) {
        const host = el('<div class="shop-pack3d"></div>');
        slot.appendChild(host);
        const token = this.shopToken = {};
        packScene(host, [set], {spin: true, arrive: false}).then((scene) => {
          if (!scene) {
            host.remove();
          } else if (this.shopToken !== token || !host.isConnected) {
            scene.dispose();
          } else {
            this.shop3d = scene;
            slot.classList.add('has-3d');
          }
        }).catch(() => host.remove());
      }
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
    const setFor = (code) => list.find(s => s.code === code) || {code, name: (owned.find(b => b.set === code) || {}).name || code, covers: 1, art: false};
    for (const [code, items] of groups) {
      const set = setFor(code);
      const tile = el(`<div class="shelf-item"><button class="shelf-pack" data-set="${esc(code)}" title="Ouvrir un booster ${esc(set.name)}">
        <span class="shelf-count">×${items.length}</span><span class="shelf-name">${esc(set.name)}</span></button>
        ${items.length > 1 ? `<button class="btn small shelf-all" title="Ouvrir les ${items.length} boosters ${esc(set.name)}">Tout ouvrir</button>` : ''}</div>`);
      tile.querySelector('.shelf-pack').prepend(packElement(set, {cls: 'small'}));
      tile.querySelector('.shelf-pack').addEventListener('click', () => this.open(items[0], set, list));
      const all = tile.querySelector('.shelf-all');
      if (all) {
        all.addEventListener('click', () => this.openMany(items, setFor, list));
      }
      shelf.appendChild(tile);
    }
    const openAll = this.root.querySelector('[data-open-all]');
    if (openAll) {
      openAll.addEventListener('click', () => this.openMany(owned, setFor, list));
    }
  }

  /** Ouvre un booster, puis propose le suivant de la même extension (ou tous ceux qui restent). */
  async open(booster, set, list) {
    const setFor = (code) => list.find(s => s.code === code) || {code, name: code, covers: 1};
    await openPack(booster, set, async () => {
      const c = await loadCareer(true);
      const rest = c.boosters || [];
      const next = rest.find(b => b.set === booster.set) || rest[0];
      return next ? {next: {booster: next, set: setFor(next.set)}, rest, setFor} : null;
    });
    this.render(await loadCareer(true), list);
  }

  /** Ouvre plusieurs boosters d'un coup. */
  async openMany(boosters, setFor, list) {
    await openPacks(boosters, setFor);
    this.render(await loadCareer(true), list);
  }
}
