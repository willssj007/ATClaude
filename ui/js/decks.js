// Decks : liste, édition (deck builder orienté Commander), import Moxfield ou texte, export.

import {bracketBadgeHtml, openAnalysis, openDeckStats, openEdhrec, summaryLineHtml} from './analysis.js';
import {bridge} from './bridge.js';
import {addFlipButton, cardElement, loadImage, showZoom, onLongPress} from './cards.js';
import {isPlaneswalker, loadCareer, wildcardsHtml} from './career.js';
import {confirmBox, customBox} from './dialogs.js';
import {icon} from './icons.js';
import {MoxfieldExplorer} from './explore.js';
import {SearchPanel} from './search.js';
import {esc, el, manaHtml, prefs, toast, debounce} from './util.js';

/** Clé de prix d'une carte : son impression (nom, édition, numéro). */
function priceKey(card) {
  return `${card.name}|${card.set || ''}|${card.number || ''}`;
}

const GROUPS = [
  ['Créatures', c => c.creature],
  ['Planeswalkers', c => /planeswalker/i.test(c.typeEn)],
  ['Éphémères', c => /instant/i.test(c.typeEn)],
  ['Rituels', c => /sorcery/i.test(c.typeEn)],
  ['Artefacts', c => /artifact/i.test(c.typeEn)],
  ['Enchantements', c => /enchantment/i.test(c.typeEn)],
  ['Batailles', c => /battle/i.test(c.typeEn)],
  ['Terrains', c => c.land],
  ['Autres', () => true],
];

// Messages de validation de Forge (en anglais), traduits pour l'affichage.
const PROBLEMS = [
  [/should have at least (\d+) cards/i, 'doit contenir au moins $1 cartes'],
  [/should have no more than (\d+) cards/i, 'ne doit pas dépasser $1 cartes'],
  [/must not contain more than (\d+) copies of the card (.+)/i, 'ne doit pas contenir plus de $1 exemplaire(s) de $2'],
  [/contains the following illegal cards:/i, 'contient des cartes interdites ou hors identité :'],
  [/contains one or more cards that do not match the commanders color identity:?/i, 'contient des cartes hors de l\'identité de couleur du commandant :'],
  [/contains the nonexisting card (.+)/i, 'contient une carte inconnue : $1'],
  [/has an illegal commander partnership/i, 'a des commandants qui ne peuvent pas être associés'],
  [/has an illegal commander/i, 'a un commandant non valide'],
  [/has too many commanders/i, 'a trop de commandants'],
  [/must have a sideboard of (\d+) to (\d+) cards or no sideboard at all/i, 'doit avoir une réserve de $1 à $2 cartes, ou aucune'],
  [/^Deck /, 'Le deck '],
];

function translateProblem(text) {
  return PROBLEMS.reduce((s, [re, to]) => s.replace(re, to), String(text));
}

/**
 * Tuile de deck façon Arena : l'illustration du commandant (recadrée sur l'image de la carte) en bandeau,
 * puis le nom, le commandant et l'identité de couleur.
 */
export function deckTile(d, actionHtml, subtitle) {
  const tile = el(`<div class="deck-tile panel" data-key="${esc(d.key)}">
    <div class="deck-art" style="--id-grad:${identityGradient(d.identity)}"><div class="deck-art-img"></div><div class="deck-pips">${identityHtml(d.identity)}</div></div>
    <div class="deck-body">
      <div class="info"><b title="${esc(d.name)}">${esc(d.name)}</b>
        <div class="muted small">${esc((d.commanders || []).join(' & ') || subtitle)}</div>
        ${(d.commanders || []).length ? `<div class="muted small">${esc(subtitle)}</div>` : ''}</div>
      ${actionHtml}
    </div></div>`);
  if (d.image && prefs.get('images')) {
    const url = bridge.imageUrl(d.image, prefs.get('imageLang'));
    const img = new Image();
    img.onload = () => {
      tile.querySelector('.deck-art-img').style.backgroundImage = `url("${url}")`;
      tile.querySelector('.deck-art').classList.add('has-img');
    };
    img.src = url;
  }
  return tile;
}

/** Pastilles bracket / puissance sur des tuiles déjà affichées (calculées en arrière-plan). */
export async function fillBadges(tiles) {
  const keys = tiles.map(t => t.dataset.key).filter(k => !k.startsWith('random'));
  if (!keys.length) {
    return;
  }
  try {
    const sums = await bridge.request('deckSummaries', {keys});
    for (const t of tiles) {
      const sum = sums[t.dataset.key];
      if (sum && t.isConnected && !t.querySelector('.bk-badge')) {
        t.querySelector('.deck-art').insertAdjacentHTML('beforeend', bracketBadgeHtml(sum));
      }
    }
  } catch (e) {
    // pas de pastille : l'analyse reste disponible dans l'éditeur
  }
}

const ID_COLORS = {W: '#e9e2c4', U: '#3d8fd8', B: '#5d5263', R: '#d9553b', G: '#3c9a5a'};

function identityGradient(identity) {
  const cols = (identity || '').split('').map(c => ID_COLORS[c]).filter(Boolean);
  if (!cols.length) {
    return 'linear-gradient(135deg, #8a8aa0, #4a4a5c)';
  }
  if (cols.length === 1) {
    cols.push(cols[0]);
  }
  return `linear-gradient(135deg, ${cols.join(', ')})`;
}

export function identityHtml(identity) {
  return identity ? manaHtml(identity.split('').map(c => `{${c}}`).join('')) : '<span class="muted small">incolore</span>';
}

function deckText(deck) {
  const lines = [];
  const s = deck.sections;
  if (s.commander.length) {
    lines.push('Commander');
    s.commander.forEach(l => lines.push(`${l.count} ${l.card.name}`));
    lines.push('');
  }
  lines.push('Deck');
  s.main.forEach(l => lines.push(`${l.count} ${l.card.name}`));
  if (s.side.length) {
    lines.push('', 'Sideboard');
    s.side.forEach(l => lines.push(`${l.count} ${l.card.name}`));
  }
  return lines.join('\n');
}

/** « Kathrill, distorseur d'aspect », ou « Thrasios & Tymna » pour des partenaires. */
function commanderNames(deck) {
  return ((deck.sections && deck.sections.commander) || []).map(l => l.card.nameFr || l.card.name).join(' & ');
}

export class Decks {
  constructor(root, {onPlay, onChanged}) {
    this.root = root;
    this.onPlay = onPlay;
    this.onChanged = onChanged;
    this.data = {decks: [], precons: []};
    this.deck = null;
  }

  async show() {
    if (this.deck || this.exploring) {
      return;
    }
    await this.list();
  }

  async list() {
    this.deck = null;
    this.exploring = false;
    // Mode Planeswalker : les decks de la carrière, construits avec la collection ; pas de préconstruits.
    const pw = isPlaneswalker();
    this.data = await bridge.request('listDecks', pw ? {career: true} : {});
    const mine = this.data.decks;
    this.root.innerHTML = `<div class="page">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <h1 style="margin:0;flex:1">${pw ? 'Mes decks Planeswalker' : 'Mes decks'}</h1>
        ${pw ? '' : '<button class="btn" data-new="constructed">+ Deck construit</button>'}
        <button class="btn" data-explore>${icon('search')} Explorer Moxfield</button>
        <button class="btn" data-import>⇩ Importer (Moxfield, texte)</button>
        <button class="btn gold" data-new="commander">+ Deck Commander</button>
      </div>
      ${pw ? '<p class="muted small" style="margin-top:-6px">Seulement les cartes de ta collection : gagne des duels et ouvre des boosters pour en avoir plus.</p>' : ''}
      <div class="deck-list mine">${mine.length ? '' : `<div class="panel" style="padding:18px"><p>Aucun deck pour l'instant.</p><p class="muted">${pw
        ? 'Commence ta carrière dans Duel : un premier deck t\'y attend.'
        : 'Crée un deck Commander, importe une liste Moxfield, ou pars d\'un des decks préconstruits ci-dessous.'}</p></div>`}</div>
      ${pw ? '' : `<h2 style="margin-top:28px">Préconstruits Commander <span class="muted small">(${this.data.precons.length}, fournis par Forge)</span></h2>
      <input type="search" class="precon-q" placeholder="Filtrer les préconstruits…" style="width:min(420px,100%);margin-bottom:10px">
      <div class="deck-list precons"></div>`}
    </div>`;
    const box = this.root.querySelector('.mine');
    const mineTiles = mine.map(d => deckTile(d, `<button class="btn small gold" data-play${d.career && !d.legal ? ' disabled title="Deck incomplet"' : ''}>${pw ? 'Duel' : 'Jouer'}</button>`,
      `${d.format === 'commander' ? 'Commander' : 'Construit'} · ${d.count} cartes${d.career && !d.legal ? ' · incomplet' : ''}`));
    mineTiles.forEach(t => box.appendChild(t));
    fillBadges(mineTiles);
    const renderPrecons = (filter = '') => {
      const f = filter.toLowerCase();
      const list = this.root.querySelector('.precons');
      const tiles = this.data.precons
        .filter(p => !f || p.name.toLowerCase().includes(f) || (p.commanders || []).some(c => c.toLowerCase().includes(f)))
        .slice(0, 80).map(p => deckTile(p, '<button class="btn small" data-copy>Copier</button>', 'Préconstruit'));
      list.replaceChildren(...tiles);
      fillBadges(tiles);
    };
    if (!pw) {
      renderPrecons();
      this.root.querySelector('.precon-q').addEventListener('input', debounce(e => renderPrecons(e.target.value), 150));
    }
    this.root.onclick = async (e) => {
      if (this.deck || this.exploring) {
        return;
      }
      const tile = e.target.closest('.deck-tile');
      const newBtn = e.target.closest('[data-new]');
      if (e.target.closest('[data-explore]')) {
        this.explore();
      } else if (newBtn) {
        this.edit({name: '', format: newBtn.dataset.new, career: pw, sections: {commander: [], main: [], side: []}});
      } else if (e.target.closest('[data-import]')) {
        this.importDialog();
      } else if (tile && e.target.closest('[data-play]')) {
        this.onPlay(tile.dataset.key);
      } else if (tile) {
        const deck = await bridge.request('loadDeck', {name: tile.dataset.key});
        if (e.target.closest('[data-copy]') || tile.dataset.key.startsWith('precon:')) {
          deck.name = deck.name.replace(/\s*\[.*$/, '') + ' (copie)';
        } else {
          deck.previousName = deck.name;
        }
        deck.career = tile.dataset.key.startsWith('career:');
        this.edit(deck);
      }
    };
  }

  /** Explorateur des decks publics de Moxfield (la liste revient avec « Mes decks »). */
  explore() {
    this.exploring = true;
    new MoxfieldExplorer(this.root, {
      onBack: () => this.list(),
      onImport: async (result, {edit, source}) => {
        const deck = result.deck;
        if (result.unknown && result.unknown.length) {
          toast(`${result.unknown.length} carte(s) inconnue(s) de Forge, laissée(s) de côté :\n${result.unknown.slice(0, 8).join('\n')}`, {title: 'Import partiel', error: true, duration: 9000});
        }
        // Mode Planeswalker : le deck devient un deck de carrière, à compléter avec sa collection (éditeur).
        deck.career = isPlaneswalker();
        if (edit || deck.career) {
          this.exploring = false;
          this.edit(deck);
          this.dirty = true;
          return;
        }
        const taken = new Set(((this.data && this.data.decks) || []).map(d => d.name));
        const base = (source.name || deck.name || 'Deck Moxfield').trim();
        let name = base;
        for (let n = 2; taken.has(name); n++) {
          name = `${base} (${n})`;
        }
        deck.name = name;
        await bridge.request('saveDeck', {deck});
        taken.add(name);
        if (this.data) {
          this.data.decks.push({name});
        }
        toast(`« ${name} » est dans tes decks.`, {title: 'Deck ajouté'});
      },
    }).show();
  }

  /** Clé du deck en cours d'édition (« career:Nom » pour un deck Planeswalker). */
  deckKey(name = this.deck.name) {
    return (this.deck.career ? 'career' : this.deck.format) + ':' + name;
  }

  // ------------------------------------------------------------------ deck builder

  edit(deck) {
    this.deck = deck;
    this.analysis = null;
    this.dirty = false;
    // Un deck sans nom (ou nommé d'après son commandant) prend le nom de son commandant, et le suit.
    this.autoName = !deck.name || deck.name === commanderNames(deck) ? deck.name || '' : null;
    this.root.innerHTML = `<div class="tabs-mobile seg"><button data-tab="left" class="on">${icon('search')} Recherche</button><button data-tab="right">${icon('cards')} Deck <b class="tab-count"></b></button></div>
      <div class="builder">
        <div class="left"></div>
        <div class="right panel"></div>
      </div>`;
    const left = this.root.querySelector('.left');
    const right = this.root.querySelector('.right');
    right.classList.add('mobile-hidden');
    this.search = new SearchPanel(left, {
      owned: !!deck.career,
      onAdd: (card) => this.add(card, 'main', true),
      onRemove: (card) => this.remove(card.name, this.count(card.name, 'main') ? 'main' : 'side'),
      onPick: (card) => showZoom(card, card.canBeCommander && this.deck.format === 'commander'
        ? '<p class="muted small">Ajoute la carte puis touche ♛ dans le deck pour en faire le commandant.</p>' : ''),
      counts: (name) => this.count(name),
      identityLock: () => this.deck.format === 'commander' && this.deck.sections.commander.length ? this.identity() : null,
    });
    this.root.querySelector('.tabs-mobile').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) {
        return;
      }
      this.root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      left.classList.toggle('mobile-hidden', b.dataset.tab !== 'left');
      right.classList.toggle('mobile-hidden', b.dataset.tab !== 'right');
    });
    this.prices = new Map();
    this.priceError = '';
    this.renderDeck();
    this.analyze();
    this.loadPrices();
    this.search.search(true);
  }

  identity() {
    const set = new Set();
    for (const l of this.deck.sections.commander) {
      for (const c of l.card.identity || '') {
        set.add(c);
      }
    }
    return 'WUBRG'.split('').filter(c => set.has(c)).join('');
  }

  count(name, only) {
    const s = this.deck.sections;
    const lines = only ? s[only] : [...s.commander, ...s.main];
    return lines.filter(l => l.card.name === name).reduce((a, l) => a + l.count, 0);
  }

  /** Nombre de cartes du deck (commandant compris) et le compte visé par le format. */
  totals() {
    const s = this.deck.sections;
    return {total: [...s.commander, ...s.main].reduce((a, l) => a + l.count, 0), target: this.deck.format === 'commander' ? 100 : 60};
  }

  add(card, section = 'main', fromSearch = false) {
    // Mode Planeswalker : pas plus d'exemplaires que dans la collection (terrains de base illimités).
    if (this.deck.career && !card.basic && card.owned !== undefined && card.owned >= 0 && this.count(card.name) >= card.owned) {
      toast(card.owned ? `Tu n'as que ${card.owned} exemplaire${card.owned > 1 ? 's' : ''} de ${card.nameFr}.` : `${card.nameFr} n'est pas dans ta collection.`, {error: true});
      return;
    }
    const list = this.deck.sections[section];
    const line = list.find(l => l.card.name === card.name);
    if (line) {
      line.count++;
    } else {
      list.push({count: 1, card});
    }
    if (this.deck.format === 'commander' && section === 'main' && !card.basic && this.count(card.name) > 1 && !/any number|up to/i.test(card.textEn || '')) {
      toast(`${card.nameFr} est déjà dans le deck (Commander : un seul exemplaire).`);
    } else if (fromSearch && this.root.querySelector('.right.mobile-hidden') && getComputedStyle(this.root.querySelector('.tabs-mobile')).display !== 'none') {
      // Sur téléphone, le deck n'est pas à l'écran pendant la recherche : on dit où on en est.
      const {total, target} = this.totals();
      toast(`${card.nameFr} ajoutée · ${total + 1} / ${target}`, {duration: 1300});
    }
    this.changed();
  }

  remove(name, section) {
    const list = this.deck.sections[section];
    const i = list.findIndex(l => l.card.name === name);
    if (i >= 0) {
      list[i].count--;
      if (list[i].count <= 0) {
        list.splice(i, 1);
      }
    }
    this.changed();
  }

  setCommander(name) {
    const s = this.deck.sections;
    const line = s.main.find(l => l.card.name === name) || s.side.find(l => l.card.name === name);
    if (!line) {
      return;
    }
    if (s.commander.length >= 2) {
      toast('Deux commandants au maximum (partenaires).', {error: true});
      return;
    }
    this.remove(name, s.main.includes(line) ? 'main' : 'side');
    s.commander.push({count: 1, card: line.card});
    this.changed();
    this.search.search(true);
  }

  unsetCommander(name) {
    const s = this.deck.sections;
    const i = s.commander.findIndex(l => l.card.name === name);
    if (i >= 0) {
      const [line] = s.commander.splice(i, 1);
      this.add(line.card, 'main');
      this.search.search(true);
    }
  }

  changed() {
    this.dirty = true;
    this.followCommander();
    this.renderDeck();
    this.loadPricesSoon();
    this.search && this.search.refreshCounts();
    this.validate();
    this.analyze();
  }

  /** Le nom suit le commandant tant qu'on ne l'a pas changé soi-même. */
  followCommander() {
    const d = this.deck;
    const names = commanderNames(d);
    if (this.autoName === null || !names || d.name !== this.autoName) {
      return;
    }
    d.name = names;
    this.autoName = names;
    const input = this.root.querySelector('.deck-name');
    if (input && input.value !== names) {
      input.value = names;
    }
  }

  loadPricesSoon = debounce(() => this.loadPrices(), 1200);

  analyze = debounce(async () => {
    const deck = this.deck;
    try {
      const a = await bridge.request('analyzeDeck', {deck});
      if (deck !== this.deck) {
        return;
      }
      this.analysis = a;
    } catch (e) {
      this.analysis = null;
    }
    const slot = this.root.querySelector('.analysis-slot');
    if (slot) {
      slot.innerHTML = summaryLineHtml(this.analysis);
    }
  }, 400);

  validate = debounce(async () => {
    try {
      const r = await bridge.request('validateDeck', {deck: this.deck});
      this.problems = r.problems;
    } catch (e) {
      this.problems = [e.message];
    }
    const box = this.root.querySelector('.problems');
    if (box) {
      box.classList.toggle('ok', !this.problems.length);
      box.textContent = this.problems.length ? this.problems.map(translateProblem).join('\n') : '✓ Deck valide pour ce format.';
    }
  }, 300);

  renderDeck() {
    const right = this.root.querySelector('.right');
    const d = this.deck;
    const s = d.sections;
    const {total, target} = this.totals();
    const tabCount = this.root.querySelector('.tab-count');
    if (tabCount) {
      tabCount.textContent = `${total}/${target}`;
    }
    const images = prefs.get('deckView') === 'images';
    const curve = Array(8).fill(0);
    let lands = 0;
    for (const l of s.main) {
      if (l.card.land) {
        lands += l.count;
      } else {
        curve[Math.min(7, Math.floor(l.card.cmc || 0))] += l.count;
      }
    }
    const maxBar = Math.max(1, ...curve);
    const groups = GROUPS.map(([label, test]) => [label, []]);
    for (const l of [...s.main].sort((a, b) => (a.card.cmc - b.card.cmc) || a.card.nameFr.localeCompare(b.card.nameFr))) {
      const gi = GROUPS.findIndex(([, test]) => test(l.card));
      groups[gi][1].push(l);
    }
    const row = (l, section) => `<div class="deck-row" data-name="${esc(l.card.name)}" data-section="${section}">
      <span class="qty">${l.count}</span><span class="nm" title="${esc(l.card.name)}">${esc(l.card.nameFr)}</span>${manaHtml(l.card.cost)}
      <button class="price" data-pk="${esc(priceKey(l.card))}" title="Prix Cardmarket (toucher : ouvrir la page Cardmarket)"></button>
      <span class="acts"><button data-act="art" title="Choisir l'illustration (impression)">${icon('brush')}</button>${section === 'main' && d.format === 'commander' && l.card.canBeCommander ? '<button data-act="cmd" title="Définir comme commandant">♛</button>' : ''}
      <button data-act="minus" title="Retirer">−</button><button data-act="plus" title="Ajouter">+</button></span></div>`;
    // Vue en images : la carte, son nombre d'exemplaires, le pinceau (choix de l'illustration) et les mêmes boutons.
    const tile = (l, section) => `<div class="db-card" data-name="${esc(l.card.name)}" data-section="${section}">
      <div class="db-art"></div>${l.count > 1 ? `<span class="db-qty">×${l.count}</span>` : ''}
      <button class="db-art-btn" data-act="art" title="Choisir l'illustration (impression)" aria-label="Choisir l'illustration">${icon('brush')}</button>
      <span class="db-acts">${section === 'main' && d.format === 'commander' && l.card.canBeCommander ? '<button data-act="cmd" title="Définir comme commandant">♛</button>' : ''}<button data-act="minus" title="Retirer">−</button><button data-act="plus" title="Ajouter">+</button></span></div>`;
    const lines = (list, section) => images ? `<div class="db-grid">${list.map(l => tile(l, section)).join('')}</div>` : list.map(l => row(l, section)).join('');
    const status = total === target ? 'full' : total > target ? 'over' : '';
    right.innerHTML = `
      <div class="db-head">
        <button class="btn small ghost" data-act="back" title="Retour à mes decks">←</button>
        <input type="text" class="deck-name" placeholder="Nom du deck" value="${esc(d.name)}">
        <button class="btn small gold" data-act="save">Enregistrer</button>
      </div>
      <div class="db-progress ${status}" title="${total} cartes sur ${target}"><i style="width:${Math.min(100, Math.round(total / target * 100))}%"></i>
        <span><b>${total}</b> / ${target} cartes · ${lands} terrains · identité ${identityHtml(this.identity())}</span></div>
      <div class="db-actions">
        <button class="btn small" data-act="play">${icon('swords')} Jouer</button>
        <button class="btn small" data-act="analysis">Analyse</button>
        ${d.format === 'commander' && !d.career ? '<button class="btn small" data-act="edhrec" title="Cartes et combos conseillés par EDHREC pour ce commandant">EDHREC</button>' : ''}
        <details class="db-more"><summary class="btn small" title="Autres actions">⋯ Plus</summary>
          <div class="db-menu panel">
            ${d.previousName ? '<button class="btn small" data-act="stats">Statistiques du deck</button>' : ''}
            <button class="btn small" data-act="export">Exporter la liste</button>
            <button class="btn small" data-act="import">Importer une liste</button>
            ${d.previousName ? '<button class="btn small danger" data-act="delete">Supprimer le deck</button>' : ''}
          </div></details>
      </div>
      ${d.career ? '<div class="builder-wc" style="margin-bottom:6px"></div>' : ''}
      <div class="muted small">${d.career ? 'Planeswalker · ' : ''}${d.format === 'commander' ? 'Commander' : 'Construit'}${d.format === 'commander' ? ' · 99 cartes et un commandant, un seul exemplaire de chaque (sauf terrains de base)' : ' · 60 cartes, 4 exemplaires au plus'}</div>
      <div class="deck-price"></div>
      <div class="analysis-slot">${summaryLineHtml(this.analysis)}</div>
      <div class="problems ok">Vérification…</div>
      ${d.format === 'commander' ? `<div class="deck-section"><h4>Commandant</h4>
        <div class="commander-slot">${s.commander.length ? '' : `<div class="cmd-empty"><span class="muted small">Pas encore de commandant : cherche une créature légendaire, ajoute-la, puis touche ♛ à côté d'elle dans le deck.</span>
          <button class="btn small gold" data-act="findcmd">${icon('crown')} Chercher un commandant</button></div>`}</div></div>` : ''}
      <div class="deck-section"><h4>Courbe de mana <span>${s.main.length ? '' : ''}</span></h4>
        <div class="curve">${curve.map((n, i) => `<div class="bar" style="height:${Math.round(n / maxBar * 100)}%"><i>${n || ''}</i><span>${i === 7 ? '7+' : i}</span></div>`).join('')}</div>
      </div>
      ${s.main.length || s.side.length ? `<div class="db-view"><span class="muted small">Cartes du deck</span>
        <span class="seg small"><button data-view="list"${images ? '' : ' class="on"'}>Liste</button><button data-view="images"${images ? ' class="on"' : ''}>Images</button></span></div>` : ''}
      ${groups.filter(([, list]) => list.length).map(([label, list]) => `<div class="deck-section"><h4>${label}<span>${list.reduce((a, l) => a + l.count, 0)}</span></h4>${lines(list, 'main')}</div>`).join('')}
      ${s.side.length ? `<div class="deck-section"><h4>Réserve<span>${s.side.reduce((a, l) => a + l.count, 0)}</span></h4>${lines(s.side, 'side')}</div>` : ''}
      ${s.main.length ? '' : '<p class="muted">Le deck est vide : cherche des cartes à gauche (onglet Recherche sur téléphone) et touche le bouton + d\'une carte pour l\'ajouter.</p>'}`;
    if (images) {
      for (const cell of right.querySelectorAll('.db-card')) {
        const card = this.lineCard(cell.dataset.name);
        if (card) {
          const c = cardElement(card);
          c._card = card;
          const art = cell.querySelector('.db-art');
          art.appendChild(c);
          addFlipButton(art, card);
        }
      }
    }
    const wcSlot = right.querySelector('.builder-wc');
    if (wcSlot) {
      loadCareer().then(c => {
        wcSlot.innerHTML = wildcardsHtml(c.wildcards);
      }).catch(() => {});
    }
    const slot = right.querySelector('.commander-slot');
    if (slot) {
      for (const l of s.commander) {
        const wrap = el(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px" data-cmd="${esc(l.card.name)}"></div>`);
        const c = cardElement(l.card);
        c._card = l.card;
        wrap.appendChild(c);
        wrap.appendChild(el(`<button class="price" data-pk="${esc(priceKey(l.card))}" title="Prix Cardmarket (toucher : ouvrir la page Cardmarket)"></button>`));
        wrap.appendChild(el(`<div style="display:flex;gap:4px"><button class="btn small ghost" data-act="cmdart" title="Choisir l'illustration du commandant">${icon('brush')}</button><button class="btn small ghost" data-act="uncmd">Retirer</button></div>`));
        slot.appendChild(wrap);
      }
    }
    right.querySelector('.deck-name').addEventListener('input', (e) => {
      d.name = e.target.value;
      this.dirty = true;
    });
    const consumed = onLongPress(right, '.deck-row, .mcard', (node) => {
      const card = node._card || this.lineCard(node.dataset.name);
      card && showZoom(card);
    });
    this.showPrices();
    right.onclick = async (e) => {
      if (consumed()) {
        return;
      }
      const priceBtn = e.target.closest('.price');
      if (priceBtn) {
        const p = this.prices && this.prices.get(priceBtn.dataset.pk);
        if (p && p.url) {
          bridge.openUrl(p.url);
        } else {
          toast(this.priceError || 'Pas de prix Cardmarket pour cette carte.');
        }
        return;
      }
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) {
        prefs.set('deckView', viewBtn.dataset.view);
        this.renderDeck();
        return;
      }
      const act = e.target.closest('[data-act]');
      const rowEl = e.target.closest('.deck-row, .db-card');
      if (act) {
        const a = act.dataset.act;
        const menu = act.closest('details.db-more');
        if (menu) {
          menu.open = false;
        }
        if (a === 'plus') {
          this.add(this.lineCard(rowEl.dataset.name), rowEl.dataset.section);
        } else if (a === 'minus') {
          this.remove(rowEl.dataset.name, rowEl.dataset.section);
        } else if (a === 'cmd') {
          this.setCommander(rowEl.dataset.name);
        } else if (a === 'art') {
          this.pickArt(rowEl.dataset.name);
        } else if (a === 'cmdart') {
          this.pickArt(act.closest('[data-cmd]').dataset.cmd);
        } else if (a === 'uncmd') {
          this.unsetCommander(act.closest('[data-cmd]').dataset.cmd);
        } else if (a === 'findcmd') {
          this.search.commandersOnly(true);
          const tab = this.root.querySelector('.tabs-mobile [data-tab="left"]');
          if (getComputedStyle(this.root.querySelector('.tabs-mobile')).display !== 'none') {
            tab.click();
          }
          toast('Seules les cartes qui peuvent être commandant sont affichées : ajoute la tienne avec +, puis touche ♛ dans le deck.', {duration: 4000});
        } else if (a === 'prices') {
          this.loadPrices(true);
        } else if (a === 'save') {
          await this.save();
        } else if (a === 'play') {
          if (await this.save()) {
            this.onPlay(this.deckKey());
          }
        } else if (a === 'analysis') {
          if (this.analysis) {
            openAnalysis(this.deck, this.analysis);
          } else {
            toast('Analyse en cours, réessaie dans un instant.');
          }
        } else if (a === 'edhrec') {
          if (!s.commander.length) {
            toast('Choisis d\'abord le commandant (♛) : EDHREC donne les cartes jouées avec lui.', {error: true});
          } else {
            openEdhrec(s.commander.map(l => l.card), {add: (card) => this.add(card), count: (name) => this.count(name)});
          }
        } else if (a === 'stats') {
          openDeckStats(this.deckKey(d.previousName), d.previousName);
        } else if (a === 'export') {
          this.exportDialog();
        } else if (a === 'import') {
          this.importDialog();
        } else if (a === 'delete') {
          if (await confirmBox('Supprimer le deck ?', `« ${d.previousName} » sera supprimé.`, {yes: 'Supprimer', danger: true})) {
            await bridge.request('deleteDeck', {name: this.deckKey(d.previousName)});
            toast('Deck supprimé.');
            this.onChanged();
            this.list();
          }
        } else if (a === 'back') {
          if (!this.dirty || await confirmBox('Quitter sans enregistrer ?', 'Les modifications seront perdues.', {yes: 'Quitter'})) {
            this.list();
          }
        }
        return;
      }
      if (rowEl) {
        const card = this.lineCard(rowEl.dataset.name);
        card && showZoom(card);
      }
    };
    this.validate();
  }

  /** Prix Cardmarket (en euros, via Scryfall) de toutes les cartes du deck ; les déjà connus ne sont pas redemandés. */
  async loadPrices(force = false) {
    const lines = [...this.deck.sections.commander, ...this.deck.sections.main, ...this.deck.sections.side];
    if (!lines.length) {
      this.prices = new Map();
      this.showPrices();
      return;
    }
    const seq = (this.priceSeq = (this.priceSeq || 0) + 1);
    const known = this.prices || new Map();
    if (!force && lines.every(l => known.has(priceKey(l.card)))) {
      this.showPrices();
      return;
    }
    this.pricesLoading = true;
    this.showPrices();
    try {
      const r = await bridge.request('deckPrices', {cards: lines.map(l => ({name: l.card.name, set: l.card.set || '', number: l.card.number || '', count: l.count}))});
      if (seq !== this.priceSeq) {
        return;
      }
      const map = new Map(known);
      for (const [k, v] of Object.entries(r.cards || {})) {
        map.set(k, v);
      }
      this.prices = map;
      this.priceError = '';
    } catch (err) {
      if (seq === this.priceSeq) {
        this.priceError = err.message;
      }
    } finally {
      if (seq === this.priceSeq) {
        this.pricesLoading = false;
        this.showPrices();
      }
    }
  }

  /** Met les prix connus dans le panneau du deck (lignes, commandant, total) sans le redessiner. */
  showPrices() {
    const right = this.root.querySelector('.builder .right');
    if (!right) {
      return;
    }
    const prices = this.prices || new Map();
    const euro = (v) => Number(v).toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
    for (const b of right.querySelectorAll('.price')) {
      const p = prices.get(b.dataset.pk);
      b.classList.toggle('approx', !!(p && p.approx));
      b.classList.toggle('none', !(p && p.eur));
      b.textContent = p && p.eur ? (p.approx ? '≈ ' : '') + euro(p.eur) : (this.pricesLoading ? '…' : '—');
      b.title = p && p.eur ? `${euro(p.eur)} sur Cardmarket${p.approx ? ' (prix d\'une autre impression)' : ''}${p.foil ? ` · foil ${euro(p.foil)}` : ''} — toucher pour ouvrir la page`
        : 'Pas de prix Cardmarket pour cette carte';
    }
    let total = 0;
    let missing = 0;
    let approx = 0;
    for (const l of [...this.deck.sections.commander, ...this.deck.sections.main, ...this.deck.sections.side]) {
      const p = prices.get(priceKey(l.card));
      if (p && p.eur) {
        total += l.count * Number(p.eur);
        approx += p.approx ? l.count : 0;
      } else {
        missing += l.count;
      }
    }
    const box = right.querySelector('.deck-price');
    if (box) {
      box.innerHTML = this.priceError && !prices.size
        ? `<span class="muted small">${esc(this.priceError)}</span> <button class="btn small ghost" data-act="prices">Réessayer</button>`
        : `<span class="dp-label">Prix du deck</span> <b>${this.pricesLoading && !prices.size ? '…' : euro(total)}</b>
          <span class="muted small">Cardmarket via Scryfall${missing ? ` · ${missing} carte${missing > 1 ? 's' : ''} sans prix` : ''}${approx ? ` · ${approx} estimée${approx > 1 ? 's' : ''} d'après une autre impression` : ''}</span>
          <button class="btn small ghost" data-act="prices" title="Relire les prix (gardés une journée)">Actualiser</button>`;
    }
  }

  /** Choix de l'illustration : toutes les impressions de la carte, les plus récentes d'abord. */
  pickArt(name) {
    const current = this.lineCard(name);
    if (!current) {
      return;
    }
    customBox(`Illustration — ${current.nameFr || current.name}`, async (body, footer, close) => {
      body.innerHTML = '<p class="muted">Recherche des impressions…</p>';
      let data;
      try {
        data = await bridge.request('prints', {name});
      } catch (err) {
        body.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
        return;
      }
      const prints = data.prints || [];
      body.innerHTML = `<p class="muted small">${prints.length} impression${prints.length > 1 ? 's' : ''}. Touche celle que tu veux : elle sera utilisée dans le deck et en partie (en français quand cette impression existe en français).</p>
        <div class="card-grid art-grid"></div>`;
      const grid = body.querySelector('.art-grid');
      // Les images se chargent quand elles arrivent à l'écran : certaines cartes ont plus de cent impressions.
      const seen = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            seen.unobserve(entry.target);
            loadImage(entry.target.querySelector('.mcard'), entry.target._print.image);
          }
        }
      }, {root: body, rootMargin: '200px'});
      for (const p of prints) {
        const print = {...p, exactArt: true};
        const cell = el(`<div class="cell art-cell${p.set === current.set && p.art === current.art ? ' on' : ''}" title="${esc(p.setName)}"></div>`);
        cell.appendChild(cardElement({...print, image: ''}));
        cell.querySelector('.mcard').dataset.exact = '1';
        cell.appendChild(el(`<div class="art-meta small"><b>${esc(p.setName)}</b><span class="muted">${esc(p.set)} · ${esc(p.number || '')}${p.year ? ' · ' + esc(p.year) : ''}</span></div>`));
        cell._print = print;
        grid.appendChild(cell);
        seen.observe(cell);
      }
      grid.addEventListener('click', async (e) => {
        const cell = e.target.closest('.art-cell');
        if (!cell) {
          return;
        }
        const print = cell._print;
        try {
          await bridge.request('chooseArt', {image: print.image});
        } catch (err) {
          toast(err.message, {error: true});
          return;
        }
        for (const list of Object.values(this.deck.sections)) {
          for (const l of list) {
            if (l.card.name === name) {
              l.card = print;
            }
          }
        }
        close();
        this.changed();
        toast(`Illustration : ${print.setName}.`);
      });
      const cancel = el('<button class="btn">Fermer</button>');
      cancel.addEventListener('click', close);
      footer.appendChild(cancel);
    }, {full: true});
  }

  lineCard(name) {
    const s = this.deck.sections;
    const line = [...s.commander, ...s.main, ...s.side].find(l => l.card.name === name);
    return line && line.card;
  }

  async save() {
    const d = this.deck;
    if (!d.name.trim()) {
      toast('Donne un nom au deck.', {error: true});
      this.root.querySelector('.deck-name').focus();
      return false;
    }
    d.name = d.name.trim().replace(/[\\/:*?"<>|]/g, '-');
    try {
      await bridge.request('saveDeck', {deck: d});
      d.previousName = d.name;
      this.dirty = false;
      toast(`« ${d.name} » enregistré.`);
      this.onChanged();
      this.renderDeck();
      return true;
    } catch (e) {
      toast(e.message, {error: true});
      return false;
    }
  }

  exportDialog() {
    const text = deckText(this.deck);
    customBox('Exporter le deck', (body, footer, close) => {
      const area = el('<textarea rows="16" readonly></textarea>');
      area.value = text;
      body.appendChild(el('<p class="muted small">Format texte compatible Moxfield, Archidekt et Arena (Importer &gt; coller).</p>'));
      body.appendChild(area);
      const copy = el('<button class="btn gold">Copier</button>');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Liste copiée.');
        } catch (e) {
          area.select();
          document.execCommand('copy');
          toast('Liste copiée.');
        }
      });
      const done = el('<button class="btn">Fermer</button>');
      done.addEventListener('click', close);
      footer.append(done, copy);
    });
  }

  importDialog() {
    customBox('Importer un deck', (body, footer, close) => {
      body.innerHTML = `<div class="field"><span>Lien Moxfield</span>
          <div style="display:flex;gap:6px"><input type="text" class="url" placeholder="https://www.moxfield.com/decks/..." style="flex:1"><button class="btn" data-mox>Récupérer</button></div>
          <div class="muted small">Le deck doit être public. Si Moxfield refuse, utilise l'import texte : Moxfield &gt; Exporter &gt; Copier en texte.</div></div>
        <div class="field"><span>Ou colle une liste</span>
          <textarea rows="12" class="txt" placeholder="Commander&#10;1 Atraxa, Praetors' Voice&#10;&#10;Deck&#10;1 Sol Ring&#10;1 Anneau solaire…"></textarea></div>
        <div class="status muted small"></div>`;
      const status = body.querySelector('.status');
      const finish = (result) => {
        const deck = result.deck;
        if (result.unknown && result.unknown.length) {
          toast(`${result.unknown.length} ligne(s) non reconnue(s) :\n${result.unknown.slice(0, 8).join('\n')}`, {title: 'Import partiel', error: true, duration: 9000});
        }
        close();
        // Mode Planeswalker : la liste importée devient un deck de carrière (les cartes non possédées sont signalées).
        deck.career = isPlaneswalker();
        this.edit(deck);
        this.dirty = true;
      };
      body.querySelector('[data-mox]').addEventListener('click', async () => {
        status.textContent = 'Connexion à Moxfield…';
        try {
          finish(await bridge.request('fetchMoxfield', {url: body.querySelector('.url').value}));
        } catch (e) {
          status.textContent = e.message;
        }
      });
      const go = el('<button class="btn gold">Importer la liste</button>');
      go.addEventListener('click', async () => {
        const text = body.querySelector('.txt').value;
        if (!text.trim()) {
          status.textContent = 'Colle d\'abord une liste.';
          return;
        }
        status.textContent = 'Lecture…';
        try {
          finish(await bridge.request('parseDeck', {text}));
        } catch (e) {
          status.textContent = e.message;
        }
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel, go);
    });
  }
}
