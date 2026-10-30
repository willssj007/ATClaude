// Explorateur des decks publics de Moxfield (onglet Decks) : recherche, commandant, format, tri, bracket et couleurs,
// résultats en tuiles comme ses propres decks, aperçu de la liste et ajout à « Mes decks » en un geste.

import {bridge} from './bridge.js';
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
      const stats = [d.author ? 'par ' + d.author : '', `${icon('heart')}${fmtNum(d.likes)}`, `${icon('eye')}${fmtNum(d.views)}`].filter(Boolean);
      const tile = deckTile(d, '<button class="btn small gold" data-add>Ajouter</button>', '');
      tile.classList.add('mx-tile');
      const sub = tile.querySelector('.info');
      sub.insertAdjacentHTML('beforeend', `<div class="mx-stats muted small">${stats.join('<span class="sep">·</span>')}${d.bracket ? `<span class="mx-b">B${d.bracket}</span>` : ''}</div>`);
      tile._deck = d;
      results.appendChild(tile);
    }
  }

  /** Aperçu du deck (liste lue sur Moxfield) ; « Ajouter » l'enregistre tout de suite, « Modifier » ouvre l'éditeur. */
  preview(d, addNow) {
    customBox(d.name, (body, footer, close) => {
      body.innerHTML = `<div class="mx-preview">
          <div class="muted small">${esc(d.author ? 'Par ' + d.author : '')}${d.updated ? ' · mis à jour le ' + new Date(d.updated).toLocaleDateString('fr-FR') : ''}</div>
          <div class="mx-pv-stats">${identityHtml(d.identity)}<span>${icon('heart')}${fmtNum(d.likes)}</span><span>${icon('eye')}${fmtNum(d.views)}</span>${d.bracket ? `<span class="mx-b">Bracket ${d.bracket}</span>` : ''}</div>
          <div class="mx-pv-list muted">Lecture de la liste sur Moxfield…</div>
        </div>`;
      const list = body.querySelector('.mx-pv-list');
      const edit = el('<button class="btn">Modifier avant d\'ajouter</button>');
      const add = el(`<button class="btn gold">${icon('check')} Ajouter à mes decks</button>`);
      edit.disabled = add.disabled = true;
      const cancel = el('<button class="btn ghost">Fermer</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel, edit, add);
      let result = null;
      bridge.request('fetchMoxfield', {url: d.url}).then((res) => {
        result = res;
        const s = res.deck.sections;
        const count = (lines) => lines.reduce((n, l) => n + (l.count || 1), 0);
        const names = (lines) => lines.map(l => `${l.count > 1 ? l.count + ' ' : ''}${esc(l.card.nameFr || l.card.name)}`);
        list.classList.remove('muted');
        list.innerHTML = `${s.commander.length ? `<div><b>Commandant :</b> ${names(s.commander).join(' & ')}</div>` : ''}
          <div class="muted small">${count(s.main)} cartes dans le deck${s.side.length ? `, ${count(s.side)} en réserve` : ''}${res.unknown && res.unknown.length ? ` · ${res.unknown.length} carte(s) inconnue(s) de Forge` : ''}</div>
          <div class="mx-pv-cards">${names(s.main).map(n => `<span>${n}</span>`).join('')}</div>`;
        edit.disabled = add.disabled = false;
        if (addNow) {
          add.click();
        }
      }).catch((e) => {
        list.textContent = e.message;
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
    });
  }
}
