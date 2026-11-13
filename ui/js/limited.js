// Formats limités de la Sandbox, contre l'IA : scellé (six boosters), draft (huit joueurs, sept IA), avec les boosters
// d'une extension de Magic ou d'une extension perso de l'Atelier ; et les énigmes de Forge (une situation à résoudre).

import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {confirmBox} from './dialogs.js';
import {icon} from './icons.js';
import {esc, prefs, toast} from './util.js';

const BASICS = [['Plains', 'W', 'Plaine'], ['Island', 'U', 'Île'], ['Swamp', 'B', 'Marais'], ['Mountain', 'R', 'Montagne'], ['Forest', 'G', 'Forêt']];
const DIFFICULTY = {Common: 'Facile', Uncommon: 'Moyenne', Rare: 'Difficile', Mythic: 'Très difficile', Special: 'Spéciale'};

function colorsOf(card) {
  return [...'WUBRG'].filter(c => String(card.cost || '').includes(c));
}

export class LimitedScreen {
  constructor(root, {onStart}) {
    this.root = root;
    this.onStart = onStart;
    this.stage = 'home';
    this.tab = prefs.get('limitedTab') || 'sealed';
    this.set = prefs.get('limitedSet') || '';
    this.pool = [];
    this.deck = [];
    this.lands = {};
    this.puzzleFilter = '';
    onLongPress(root, '.mcard', (node) => node._card && showZoom(node._card));
  }

  async show() {
    if (this.stage === 'home') {
      await this.renderHome();
    }
  }

  // ------------------------------------------------------------------ accueil : mode, extension, énigmes

  async renderHome() {
    if (!this.sets) {
      this.root.innerHTML = '<div class="page"><p class="muted">Chargement des extensions…</p></div>';
      try {
        this.sets = await bridge.request('limitedSets');
      } catch (e) {
        this.root.innerHTML = `<div class="page"><p class="error">${esc(e.message)}</p></div>`;
        return;
      }
    }
    const {sets, custom} = this.sets;
    if (!this.set) {
      this.set = (sets[0] && sets[0].code) || '';
    }
    const opt = (s) => `<option value="${esc(s.code)}"${s.code === this.set ? ' selected' : ''}>${esc(s.name)}${s.year ? ` (${esc(s.year)})` : ''}${s.count ? ` — ${s.count} cartes` : ''}</option>`;
    const tab = (v, ic, l) => `<button data-tab="${v}" class="${this.tab === v ? 'on' : ''}">${icon(ic)} ${l}</button>`;
    this.root.innerHTML = `<div class="page lim">
      <h1>Limité et énigmes</h1>
      <p class="muted">Des formats contre l'IA de Forge, en dehors des decks : le <b>scellé</b> (tu ouvres six boosters et tu
        construis un deck de 40 cartes), le <b>draft</b> (huit joueurs dont sept IA ouvrent trois boosters chacun : tu prends une
        carte et tu passes le reste), et les <b>énigmes</b> (une situation de jeu toute prête à résoudre).</p>
      <div class="seg lim-tabs">${tab('sealed', 'booster', 'Scellé')}${tab('draft', 'cards', 'Draft')}${tab('puzzles', 'book', 'Énigmes')}</div>
      ${this.tab === 'puzzles' ? '<div class="lim-puzzles"></div>' : `<div class="panel lim-setup">
        <label class="field"><span>Boosters de</span><select data-set>
          ${custom.length ? `<optgroup label="Mes extensions (Atelier)">${custom.map(opt).join('')}</optgroup>` : ''}
          <optgroup label="Extensions de Magic">${sets.map(opt).join('')}</optgroup></select></label>
        <p class="muted small">${this.tab === 'sealed' ? 'Six boosters pour toi, six autres pour l\'IA (Forge construit son deck). Puis ton deck : au moins 40 cartes, terrains de base à volonté.'
          : 'Trois rondes de 14 ou 15 choix : le booster passe à gauche, puis à droite, puis à gauche. L\'IA garde ses couleurs. Puis ton deck de 40 cartes contre un des drafteurs IA.'}
          Une extension perso donne des boosters de 10 communes, 3 peu communes et une rare (ou mythique) : range tes cartes par rareté dans l'Atelier.</p>
        <button class="btn gold" data-lstart>${this.tab === 'sealed' ? `${icon('booster')} Ouvrir mes six boosters` : `${icon('cards')} Commencer le draft`}</button>
      </div>`}
    </div>`;
    this.root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      prefs.set('limitedTab', this.tab);
      this.renderHome();
    }));
    const sel = this.root.querySelector('[data-set]');
    if (sel) {
      sel.addEventListener('change', () => {
        this.set = sel.value;
        prefs.set('limitedSet', this.set);
      });
    }
    const go = this.root.querySelector("[data-lstart]");
    if (go) {
      go.addEventListener('click', () => (this.tab === 'sealed' ? this.startSealed() : this.startDraft()));
    }
    if (this.tab === 'puzzles') {
      this.renderPuzzles();
    }
  }

  // ------------------------------------------------------------------ énigmes

  async renderPuzzles() {
    const box = this.root.querySelector('.lim-puzzles');
    if (!this.puzzles) {
      box.innerHTML = '<p class="muted">Chargement des énigmes…</p>';
      try {
        this.puzzles = await bridge.request('puzzles');
      } catch (e) {
        box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
        return;
      }
    }
    const list = this.puzzles;
    const solved = list.filter(p => p.solved).length;
    const f = this.puzzleFilter;
    const shown = list.filter(p => !f || (f === 'todo' ? !p.solved : p.difficulty === f));
    const chip = (v, l) => `<button class="chip${f === v ? ' on' : ''}" data-pf="${v}">${l}</button>`;
    box.innerHTML = `<p class="muted small">${list.length} énigmes de Forge (la plupart des « Possibility Storm »), ${solved} résolue${solved > 1 ? 's' : ''}.
      La situation est mise en place au début de la partie ; l'objectif s'affiche en haut. Gagner la partie résout l'énigme.</p>
      <div class="chips">${chip('', 'Toutes')}${chip('todo', 'À résoudre')}${Object.entries(DIFFICULTY).map(([k, l]) => chip(k, l)).join('')}</div>
      <div class="lim-plist">${shown.map(p => `<button class="panel lim-p${p.solved ? ' done' : ''}" data-puzzle="${esc(p.id)}">
        <span class="lim-pn">${p.solved ? icon('check') : icon('book')} ${esc(p.name)}</span>
        <span class="muted small">${esc(p.goal)} · ${esc(DIFFICULTY[p.difficulty] || p.difficulty || '')}${p.turns && p.turns !== '1' ? ` · ${esc(p.turns)} tours` : ''}</span>
        <span class="small">${esc(p.description)}</span></button>`).join('') || '<p class="muted">Aucune énigme ici.</p>'}</div>`;
    box.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => {
      this.puzzleFilter = b.dataset.pf;
      this.renderPuzzles();
    }));
    box.querySelectorAll('[data-puzzle]').forEach(b => b.addEventListener('click', () => {
      const p = list.find(x => x.id === b.dataset.puzzle);
      this.puzzles = null; // la liste se relira (énigme résolue)
      toast(`${p.goal} — ${p.description}`, {title: p.name, duration: 9000});
      this.onStart({puzzle: p.id, format: 'constructed', players: [{name: 'Moi', ai: false}, {name: 'IA', ai: true}]});
    }));
  }

  // ------------------------------------------------------------------ scellé

  async startSealed() {
    this.root.innerHTML = '<div class="page"><p class="muted">Ouverture des boosters…</p></div>';
    try {
      const r = await bridge.request('limitedSealed', {set: this.set});
      this.pool = r.pool;
      this.deck = [];
      this.lands = {};
      this.stage = 'build';
      this.renderOpened(r.packs);
    } catch (e) {
      toast(e.message, {title: 'Scellé', error: true});
      this.stage = 'home';
      this.renderHome();
    }
  }

  /** Les six boosters ouverts, l'un sous l'autre, avant la construction du deck. */
  renderOpened(packs) {
    this.root.innerHTML = `<div class="page lim">
      <div class="lim-top"><h2>${icon('booster')} Tes six boosters</h2><button class="btn gold" data-build>Construire mon deck →</button></div>
      <div class="lim-packs"></div></div>`;
    const host = this.root.querySelector('.lim-packs');
    packs.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'lim-pack';
      row.innerHTML = `<h3 class="muted small">Booster ${i + 1}</h3><div class="lim-grid"></div>`;
      p.forEach(c => row.querySelector('.lim-grid').appendChild(this.cardNode(c)));
      host.appendChild(row);
    });
    this.root.querySelector('[data-build]').addEventListener('click', () => this.renderBuild());
  }

  cardNode(c, cls = '') {
    const n = cardElement(c, cls);
    n._card = c;
    return n;
  }

  // ------------------------------------------------------------------ draft

  async startDraft() {
    this.root.innerHTML = '<div class="page"><p class="muted">Ouverture des boosters des huit joueurs…</p></div>';
    try {
      const st = await bridge.request('draftStart', {set: this.set});
      this.stage = 'draft';
      this.renderDraft(st);
    } catch (e) {
      toast(e.message, {title: 'Draft', error: true});
      this.stage = 'home';
      this.renderHome();
    }
  }

  renderDraft(st) {
    if (st.done) {
      this.pool = st.pool;
      this.deck = [];
      this.lands = {};
      this.stage = 'build';
      toast('Draft terminé : construis ton deck de 40 cartes.', {title: 'Draft'});
      this.renderBuild();
      return;
    }
    this.root.innerHTML = `<div class="page lim">
      <div class="lim-top"><h2>${icon('cards')} Booster ${st.round} · choix ${st.pick}</h2>
        <span class="muted small">Le booster passe à ${st.left ? 'gauche' : 'droite'} · ${st.pool.length} carte${st.pool.length > 1 ? 's' : ''} prise${st.pool.length > 1 ? 's' : ''}</span>
        <button class="btn small" data-quit>Abandonner le draft</button></div>
      <p class="muted small">Touche une carte pour la prendre (appui long : la lire en grand).</p>
      <div class="lim-grid lim-draft"></div>
      <h3 class="muted small">Mes cartes</h3><div class="lim-grid lim-mini"></div></div>`;
    const grid = this.root.querySelector('.lim-draft');
    st.pack.forEach(c => {
      const n = this.cardNode(c);
      n.addEventListener('click', async () => {
        if (this.picking) {
          return;
        }
        this.picking = true;
        n.classList.add('picked');
        try {
          this.renderDraft(await bridge.request('draftPick', {name: c.name}));
        } catch (e) {
          toast(e.message, {error: true});
        } finally {
          this.picking = false;
        }
      });
      grid.appendChild(n);
    });
    const mine = this.root.querySelector('.lim-mini');
    st.pool.forEach(c => mine.appendChild(this.cardNode(c)));
    this.root.querySelector('[data-quit]').addEventListener('click', async () => {
      if (await confirmBox('Abandonner le draft ?', 'Les cartes prises seront perdues.', {yes: 'Abandonner', danger: true})) {
        this.stage = 'home';
        this.renderHome();
      }
    });
  }

  // ------------------------------------------------------------------ construction du deck

  landCount() {
    return Object.values(this.lands).reduce((a, b) => a + b, 0);
  }

  renderBuild() {
    const inDeck = new Map();
    this.deck.forEach(i => inDeck.set(i, true));
    const total = this.deck.length + this.landCount();
    const colors = new Set(this.deck.flatMap(i => colorsOf(this.pool[i])));
    this.root.innerHTML = `<div class="page lim">
      <div class="lim-top"><h2>${icon('cards')} Mon deck : <b class="${total >= 40 ? 'ok' : 'warn'}">${total}</b> / 40</h2>
        <button class="btn" data-auto title="Le deck que Forge construirait avec tes cartes">Deck automatique</button>
        <button class="btn gold" data-play${total >= 40 ? '' : ' disabled'}>${icon('swords')} Jouer contre l'IA</button>
        <button class="btn small" data-quit>Abandonner</button></div>
      <div class="lim-lands panel"><span class="muted small">Terrains de base</span>${BASICS.map(([en, c, fr]) => `<span class="lim-land${colors.has(c) ? ' used' : ''}">
          <button class="btn small" data-land="${en}" data-d="-1">−</button><b>${this.lands[en] || 0}</b><button class="btn small" data-land="${en}" data-d="1">＋</button> ${esc(fr)}</span>`).join('')}
        <button class="btn small" data-autoland title="17 terrains selon les couleurs de tes sorts">17 auto</button></div>
      <h3>Dans le deck (${this.deck.length} sorts et terrains) <span class="muted small">touche pour retirer</span></h3>
      <div class="lim-grid lim-deck"></div>
      <h3>Mes autres cartes (${this.pool.length - this.deck.length}) <span class="muted small">touche pour ajouter</span></h3>
      <div class="lim-grid lim-side"></div></div>`;
    const deckGrid = this.root.querySelector('.lim-deck');
    const side = this.root.querySelector('.lim-side');
    const order = (a, b) => (this.pool[a].cmc || 0) - (this.pool[b].cmc || 0) || String(this.pool[a].nameFr || this.pool[a].name).localeCompare(this.pool[b].nameFr || this.pool[b].name);
    [...this.deck].sort(order).forEach(i => {
      const n = this.cardNode(this.pool[i]);
      n.addEventListener('click', () => {
        this.deck = this.deck.filter(x => x !== i);
        this.renderBuild();
      });
      deckGrid.appendChild(n);
    });
    this.pool.map((c, i) => i).filter(i => !inDeck.has(i)).sort(order).forEach(i => {
      const n = this.cardNode(this.pool[i]);
      n.addEventListener('click', () => {
        this.deck.push(i);
        this.renderBuild();
      });
      side.appendChild(n);
    });
    this.root.querySelectorAll('[data-land]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.land;
      this.lands[k] = Math.max(0, (this.lands[k] || 0) + Number(b.dataset.d));
      this.renderBuild();
    }));
    this.root.querySelector('[data-autoland]').addEventListener('click', () => {
      const counts = {};
      this.deck.forEach(i => colorsOf(this.pool[i]).forEach(c => {
        counts[c] = (counts[c] || 0) + 1;
      }));
      const sum = Object.values(counts).reduce((a, b) => a + b, 0);
      this.lands = {};
      let left = 17;
      const list = BASICS.filter(([, c]) => counts[c]).sort((a, b) => counts[b[1]] - counts[a[1]]);
      list.forEach(([en, c], k) => {
        const n = k === list.length - 1 ? left : Math.max(1, Math.round(17 * counts[c] / sum));
        this.lands[en] = Math.min(left, n);
        left -= this.lands[en];
      });
      if (!list.length) {
        toast('Ajoute d\'abord des sorts au deck : les terrains suivent leurs couleurs.', {title: 'Terrains'});
      }
      this.renderBuild();
    });
    this.root.querySelector('[data-auto]').addEventListener('click', async () => {
      try {
        const r = await bridge.request('limitedAuto');
        const used = new Set();
        this.deck = [];
        for (const name of r.cards) {
          const i = this.pool.findIndex((c, k) => c.name === name && !used.has(k));
          if (i >= 0) {
            used.add(i);
            this.deck.push(i);
          }
        }
        this.lands = r.lands || {};
        this.renderBuild();
      } catch (e) {
        toast(e.message, {error: true});
      }
    });
    this.root.querySelector('[data-play]').addEventListener('click', async () => {
      try {
        const setup = await bridge.request('limitedSetup', {cards: this.deck.map(i => this.pool[i].name), lands: this.lands, name: 'Moi'});
        this.onStart(setup);
      } catch (e) {
        toast(e.message, {title: 'Deck refusé', error: true});
      }
    });
    this.root.querySelector('[data-quit]').addEventListener('click', async () => {
      if (await confirmBox('Abandonner ?', 'Tes cartes de ce scellé ou de ce draft seront perdues.', {yes: 'Abandonner', danger: true})) {
        this.stage = 'home';
        this.renderHome();
      }
    });
  }
}
