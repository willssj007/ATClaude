// Explorateur des decks publics de Moxfield (onglet Decks) : recherche, commandant, format, tri, bracket et couleurs,
// résultats en tuiles comme ses propres decks, aperçu de la liste et ajout à « Mes decks » en un geste.

import {bridge} from './bridge.js';
import {cardElement, showZoom} from './cards.js';
import {customBox} from './dialogs.js';
import {deckTile, identityHtml} from './decks.js';
import {icon} from './icons.js';
import {debounce, el, esc, prefs, toast} from './util.js';

const FORMATS = [['commander', 'Commander'], ['duelCommander', 'Duel Commander'], ['brawl', 'Brawl'], ['oathbreaker', 'Oathbreaker'],
  ['standard', 'Standard'], ['pioneer', 'Pioneer'], ['modern', 'Modern'], ['legacy', 'Legacy'], ['vintage', 'Vintage'], ['pauper', 'Pauper'],
  ['', 'Tous les formats']];
const SORTS = [['views', 'Les plus vus'], ['likes', 'Les plus aimés'], ['updated', 'Mis à jour récemment'], ['created', 'Les plus récents']];
const COLORS = ['W', 'U', 'B', 'R', 'G'];
const PAGE = 30;
// Avec un filtre de couleurs (appliqué aux résultats reçus), on lit quelques pages de plus pour remplir l'écran.
const COLOR_PAGES = 5;

const fmtNum = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',') + ' k' : Number(n).toLocaleString('fr-FR'));

export class MoxfieldExplorer {
  /**
   * @param root      conteneur (l'écran Decks)
   * @param onBack    retour à « Mes decks »
   * @param onImport  (résultat de fetchMoxfield, {edit}) : ouvrir dans l'éditeur, ou ajouter directement
   */
  constructor(root, {onBack, onImport}) {
    this.root = root;
    this.onBack = onBack;
    this.onImport = onImport;
    const saved = prefs.get('moxfieldFilters');
    this.q = {text: '', commander: '', format: 'commander', sort: 'views', bracket: 0, colors: [], ...(saved && typeof saved === 'object' ? saved : {})};
    this.q.text = '';
    this.seq = 0;
  }

  show() {
    const q = this.q;
    this.root.innerHTML = `<div class="page mox">
      <div class="mox-head">
        <button class="btn small ghost" data-back>${icon('chevronLeft')} Mes decks</button>
        <div class="mox-title"><h1>Explorer Moxfield</h1><span class="muted small">Les decks publics de la communauté, à ajouter en un geste</span></div>
      </div>
      <div class="search-head mox-filters">
        <div class="search-bar main"><label class="sh-q">${icon('search')}<input type="search" class="mx-text" placeholder="Nom du deck, archétype, auteur…" value="${esc(q.text)}" autocomplete="off"><span class="total mx-total"></span></label></div>
        <div class="search-filters">
          <div class="sh-row">
            <div class="mx-cmd"><span class="mx-lbl">${icon('crown')}</span><input type="text" class="mx-commander" placeholder="Commandant (ex. Atraxa)" value="${esc(q.commander)}" autocomplete="off">
              <button class="mx-clear${q.commander ? '' : ' hidden'}" title="Tous les commandants">✕</button><div class="mx-sugg hidden"></div></div>
            <select class="mx-format" aria-label="Format">${FORMATS.map(([v, l]) => `<option value="${v}"${v === q.format ? ' selected' : ''}>${l}</option>`).join('')}</select>
            <select class="mx-sort" aria-label="Tri">${SORTS.map(([v, l]) => `<option value="${v}"${v === q.sort ? ' selected' : ''}>${l}</option>`).join('')}</select>
          </div>
          <div class="sh-row">
            <div class="seg mx-bracket" title="Bracket Commander">${[0, 1, 2, 3, 4, 5].map(b => `<button data-b="${b}" class="${q.bracket === b ? 'on' : ''}">${b ? 'B' + b : 'Tout bracket'}</button>`).join('')}</div>
            <div class="mx-colors" title="Couleurs exactes du deck">${COLORS.map(c => `<button class="pip-btn${q.colors.includes(c) ? ' on' : ''}" data-c="${c}">${identityHtml(c)}</button>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="mx-status muted small"></div>
      <div class="deck-list mx-results"></div>
      <div class="mx-more hidden"><button class="btn">Plus de decks</button></div>
      <p class="muted small mx-note">Moxfield n'a pas d'API publique officielle : la recherche utilise celle de son site, qui peut changer ou refuser une demande.</p>
    </div>`;
    this.bind();
    this.search(true);
  }

  bind() {
    const r = this.root;
    r.querySelector('[data-back]').addEventListener('click', () => this.onBack());
    r.querySelector('.mx-text').addEventListener('input', debounce((e) => {
      this.q.text = e.target.value;
      this.search(true);
    }, 400));
    r.querySelector('.mx-format').addEventListener('change', (e) => {
      this.q.format = e.target.value;
      this.search(true);
    });
    r.querySelector('.mx-sort').addEventListener('change', (e) => {
      this.q.sort = e.target.value;
      this.search(true);
    });
    r.querySelector('.mx-bracket').addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (!b) {
        return;
      }
      this.q.bracket = Number(b.dataset.b);
      r.querySelectorAll('.mx-bracket [data-b]').forEach(x => x.classList.toggle('on', x === b));
      this.search(true);
    });
    r.querySelector('.mx-colors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) {
        return;
      }
      b.classList.toggle('on');
      this.q.colors = [...r.querySelectorAll('.mx-colors .on')].map(x => x.dataset.c);
      this.search(true);
    });
    // Commandant : suggestions tirées des cartes de Forge (noms français ou anglais), recherche par son nom anglais.
    const cmd = r.querySelector('.mx-commander');
    const sugg = r.querySelector('.mx-sugg');
    const clear = r.querySelector('.mx-clear');
    const pick = (name) => {
      this.q.commander = name;
      cmd.value = name;
      sugg.classList.add('hidden');
      clear.classList.toggle('hidden', !name);
      this.search(true);
    };
    cmd.addEventListener('input', debounce(async () => {
      const text = cmd.value.trim();
      if (text.length < 2) {
        sugg.classList.add('hidden');
        if (!text && this.q.commander) {
          pick('');
        }
        return;
      }
      try {
        const res = await bridge.request('searchCards', {query: {text, commandersOnly: true, offset: 0, limit: 8}});
        const cards = (res.cards || []).filter(c => c.canBeCommander !== false);
        sugg.replaceChildren(...cards.map(c => {
          const b = el(`<button><b>${esc(c.nameFr || c.name)}</b>${c.nameFr && c.nameFr !== c.name ? `<span class="muted small"> ${esc(c.name)}</span>` : ''}</button>`);
          b.addEventListener('click', () => pick(c.name));
          return b;
        }));
        sugg.classList.toggle('hidden', !cards.length);
      } catch (e) {
        sugg.classList.add('hidden');
      }
    }, 200));
    cmd.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = sugg.querySelector('button');
        if (first && !sugg.classList.contains('hidden')) {
          first.click();
        }
      }
    });
    clear.addEventListener('click', () => pick(''));
    r.querySelector('.mx-more button').addEventListener('click', () => this.search(false));
    r.querySelector('.mx-results').addEventListener('click', (e) => {
      const tile = e.target.closest('.deck-tile');
      if (tile && tile._deck) {
        this.preview(tile._deck, !!e.target.closest('[data-add]'));
      }
    });
  }

  /** Nouvelle recherche (fresh) ou page suivante. Les couleurs sont filtrées sur les résultats reçus. */
  async search(fresh) {
    const seq = ++this.seq;
    const r = this.root;
    const status = r.querySelector('.mx-status');
    const results = r.querySelector('.mx-results');
    const more = r.querySelector('.mx-more');
    if (fresh) {
      this.page = 0;
      this.shown = 0;
      this.seen = new Set();
      results.replaceChildren();
      prefs.set('moxfieldFilters', {...this.q, text: ''});
    }
    status.textContent = 'Recherche sur Moxfield…';
    more.classList.add('hidden');
    const q = {text: this.q.text, commander: this.q.commander, format: this.q.format, sort: this.q.sort, pageSize: PAGE};
    if (this.q.bracket) {
      q.minBracket = this.q.bracket;
      q.maxBracket = this.q.bracket;
    }
    const wanted = this.q.colors.slice().sort((a, b) => COLORS.indexOf(a) - COLORS.indexOf(b)).join('');
    let added = 0;
    let res = null;
    try {
      for (let i = 0; i < (wanted ? COLOR_PAGES : 1); i++) {
        res = await bridge.request('moxfieldSearch', {query: {...q, page: ++this.page}});
        if (seq !== this.seq) {
          return;
        }
        const decks = (res.decks || []).filter(d => !this.seen.has(d.key) && (!wanted || (d.hasColors && d.identity === wanted)));
        decks.forEach(d => this.seen.add(d.key));
        this.addTiles(decks);
        added += decks.length;
        if (!res.more || added >= 12) {
          break;
        }
      }
    } catch (e) {
      if (seq === this.seq) {
        status.textContent = e.message;
      }
      return;
    }
    this.shown += added;
    const total = res && res.total >= 0 ? res.total : null;
    r.querySelector('.mx-total').textContent = total !== null && !wanted ? `${fmtNum(total)} deck${total > 1 ? 's' : ''}` : '';
    status.textContent = this.shown ? '' : 'Aucun deck ne correspond. Élargis la recherche (format, bracket, couleurs).';
    more.classList.toggle('hidden', !(res && res.more));
  }

  addTiles(decks) {
    const results = this.root.querySelector('.mx-results');
    for (const d of decks) {
      const tile = deckTile(d, '<button class="btn small gold" data-add>Ajouter</button>', d.author ? 'par ' + d.author : 'Moxfield');
      tile.classList.add('mx-tile');
      tile.querySelector('.info').insertAdjacentHTML('beforeend', `<div class="mx-stats muted small"><span>${icon('heart')}${fmtNum(d.likes)}</span>
        <span>${icon('eye')}${fmtNum(d.views)}</span>${d.bracket ? `<span class="mx-b">B${d.bracket}</span>` : ''}</div>`);
      tile._deck = d;
      results.appendChild(tile);
    }
  }

  /**
   * Aperçu visuel du deck (liste lue sur Moxfield) : le commandant en grand, la courbe de mana et la répartition par
   * type, puis toutes les cartes en images, groupées par type (toucher une carte l'agrandit). « Ajouter » enregistre
   * le deck tout de suite, « Modifier » l'ouvre dans le deck builder.
   */
  preview(d, addNow) {
    customBox(d.name, (body, footer, close) => {
      body.innerHTML = `<div class="mxv">
          <aside class="mxv-side">
            <div class="mxv-cmd"></div>
            <div class="mxv-meta muted small">${esc(d.author ? 'Par ' + d.author : '')}${d.updated ? ' · mis à jour le ' + new Date(d.updated).toLocaleDateString('fr-FR') : ''}</div>
            <div class="mxv-stats">${identityHtml(d.identity)}<span>${icon('heart')}${fmtNum(d.likes)}</span><span>${icon('eye')}${fmtNum(d.views)}</span>${d.bracket ? `<span class="mx-b">Bracket ${d.bracket}</span>` : ''}</div>
            <div class="mxv-summary"></div>
          </aside>
          <section class="mxv-cards"><div class="mxv-loading muted">${icon('book')} Lecture de la liste sur Moxfield…</div></section>
        </div>`;
      const cmdBox = body.querySelector('.mxv-cmd');
      // En attendant la liste : l'illustration du commandant de la tuile.
      if (d.image) {
        cmdBox.appendChild(cardElement({name: (d.commanders || [])[0] || d.name, image: d.image}));
      }
      const edit = el('<button class="btn">Modifier avant d\'ajouter</button>');
      const add = el(`<button class="btn gold">${icon('check')} Ajouter à mes decks</button>`);
      edit.disabled = add.disabled = true;
      const cancel = el('<button class="btn ghost">Fermer</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel, edit, add);
      let result = null;
      bridge.request('fetchMoxfield', {url: d.url}).then((res) => {
        result = res;
        this.renderDeck(body, res);
        edit.disabled = add.disabled = false;
        if (addNow) {
          add.click();
        }
      }).catch((e) => {
        body.querySelector('.mxv-cards').innerHTML = `<div class="mxv-loading">${esc(e.message)}</div>`;
      });
      edit.addEventListener('click', () => {
        close();
        this.onImport(result, {edit: true, source: d});
      });
      add.addEventListener('click', async () => {
        add.disabled = true;
        try {
          await this.onImport(result, {edit: false, source: d});
          close();
        } catch (e) {
          toast(e.message, {error: true});
          add.disabled = false;
        }
      });
    }, {full: true});
  }

  /** Commandant(s), courbe de mana, types, puis les cartes en images par type. */
  renderDeck(body, res) {
    const s = res.deck.sections;
    const cmdBox = body.querySelector('.mxv-cmd');
    if (s.commander.length) {
      cmdBox.replaceChildren(...s.commander.map((l) => {
        const node = cardElement(l.card);
        node._card = l.card;
        return node;
      }));
      cmdBox.classList.toggle('two', s.commander.length > 1);
    }
    const lines = [...s.main];
    const total = lines.reduce((n, l) => n + (l.count || 1), 0);
    const groups = new Map(TYPES.map(([key, label]) => [key, {label, lines: [], n: 0}]));
    const curve = new Array(8).fill(0);
    for (const l of lines) {
      const key = typeOf(l.card);
      const g = groups.get(key);
      g.lines.push(l);
      g.n += l.count || 1;
      if (key !== 'land') {
        curve[Math.min(7, Math.max(0, Math.round(l.card.cmc || 0)))] += l.count || 1;
      }
    }
    const peak = Math.max(1, ...curve);
    body.querySelector('.mxv-summary').innerHTML = `
      <div class="mxv-h">Courbe de mana</div>
      <div class="mxv-curve">${curve.map((n, i) => `<div class="bar" title="${n} carte(s) à ${i}${i === 7 ? '+' : ''}"><b>${n || ''}</b><i style="--h:${(n / peak).toFixed(3)}"></i><span>${i === 7 ? '7+' : i}</span></div>`).join('')}</div>
      <div class="mxv-h">${total} cartes${s.side.length ? ` · ${s.side.reduce((n, l) => n + (l.count || 1), 0)} en réserve` : ''}</div>
      <div class="mxv-types">${[...groups.values()].filter(g => g.n).map(g => `<span><b>${g.n}</b> ${esc(g.label.toLowerCase())}</span>`).join('')}</div>
      ${res.unknown && res.unknown.length ? `<div class="muted small">${res.unknown.length} carte(s) inconnue(s) de Forge, laissée(s) de côté.</div>` : ''}`;
    const box = body.querySelector('.mxv-cards');
    box.replaceChildren();
    for (const g of groups.values()) {
      if (!g.n) {
        continue;
      }
      const grid = el('<div class="mxv-grid"></div>');
      for (const l of g.lines.sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0) || (a.card.nameFr || a.card.name).localeCompare(b.card.nameFr || b.card.name))) {
        const cell = el('<div class="mxv-card"></div>');
        const node = cardElement(l.card);
        node._card = l.card;
        cell.appendChild(node);
        if ((l.count || 1) > 1) {
          cell.appendChild(el(`<span class="mxv-n">×${l.count}</span>`));
        }
        grid.appendChild(cell);
      }
      box.append(el(`<h3 class="mxv-group">${esc(g.label)} <span>${g.n}</span></h3>`), grid);
    }
    body.querySelector('.mxv').addEventListener('click', (e) => {
      const card = e.target.closest('.mcard');
      if (card && card._card) {
        showZoom(card._card);
      }
    });
  }
}

/** Types dans l'ordre d'affichage (une créature-artefact compte comme créature, comme sur Moxfield). */
const TYPES = [['creature', 'Créatures'], ['planeswalker', 'Planeswalkers'], ['battle', 'Batailles'], ['instant', 'Éphémères'],
  ['sorcery', 'Rituels'], ['artifact', 'Artefacts'], ['enchantment', 'Enchantements'], ['land', 'Terrains'], ['other', 'Autres']];

function typeOf(card) {
  const t = (card.typeEn || card.type || card.typeLine || '').toLowerCase();
  for (const [key] of TYPES) {
    if (key !== 'other' && t.includes(key === 'creature' ? 'creature' : key)) {
      return key;
    }
  }
  // Type en français seulement (cartes sans type anglais) : quelques mots-clés.
  const fr = (card.typeLine || '').toLowerCase();
  const map = [['créature', 'creature'], ['planeswalker', 'planeswalker'], ['bataille', 'battle'], ['éphémère', 'instant'], ['rituel', 'sorcery'],
    ['artefact', 'artifact'], ['enchantement', 'enchantment'], ['terrain', 'land']];
  const hit = map.find(([w]) => fr.includes(w));
  return hit ? hit[1] : 'other';
}
