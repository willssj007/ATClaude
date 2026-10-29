// Panneau de recherche de cartes, partagé par le navigateur de cartes et le deck builder.

import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {customBox} from './dialogs.js';
import {esc, el, debounce, toast} from './util.js';
import {icon} from './icons.js';
import {RARITY_FR, rarityKey, setCareer, wildcardHtml} from './career.js';

const TYPES = [
  ['creature', 'Créature'], ['instant', 'Éphémère'], ['sorcery', 'Rituel'], ['artifact', 'Artefact'],
  ['enchantment', 'Enchantement'], ['planeswalker', 'Planeswalker'], ['land', 'Terrain'], ['battle', 'Bataille'], ['legendary', 'Légendaire'],
];
const PAGE = 60;
const SET_TYPES = {CORE: 'Édition de base', EXPANSION: 'Extension', COMMANDER: 'Commander', DRAFT: 'Draft', REPRINT: 'Réédition',
  STARTER: 'Initiation', DUEL_DECK: 'Duel Decks', BOXED_SET: 'Coffret', PROMO: 'Promo', ONLINE: 'En ligne', COLLECTOR_EDITION: 'Collector',
  MULTIPLAYER: 'Multijoueur', FUNNY: 'Humoristique', OTHER: 'Autre'};
let editions = null;

async function loadEditions() {
  if (!editions) {
    editions = await bridge.request('editions');
  }
  return editions;
}

/** Liste des extensions, avec recherche par nom ou code ; renvoie l'extension choisie, ou null. */
function pickEdition(current) {
  return new Promise((resolve) => {
    let answered = false;
    const box = customBox('Extension', async (body, footer, close) => {
      body.innerHTML = '<input type="search" class="ed-q" placeholder="Nom ou code de l\'extension (ex. Bloomburrow, MH3)…" style="width:100%"><div class="ed-list"><p class="muted">Chargement…</p></div>';
      const list = body.querySelector('.ed-list');
      const all = await loadEditions();
      const render = (text) => {
        const t = text.trim().toLowerCase();
        const hits = all.filter(e => !t || e.name.toLowerCase().includes(t) || e.code.toLowerCase().startsWith(t));
        // Code exact, puis noms qui commencent par le texte, puis le reste (du plus récent au plus ancien).
        const rank = (e) => !t ? 0 : e.code.toLowerCase() === t ? 0 : e.name.toLowerCase().startsWith(t) ? 1 : 2;
        const shown = hits.map((e, i) => [e, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([e]) => e).slice(0, 250);
        list.innerHTML = shown.map(e => `<button class="ed-item${current && current.code === e.code ? ' on' : ''}" data-code="${esc(e.code)}">
          <b>${esc(e.name)}</b><span class="muted small">${esc(e.code)} · ${esc(e.year)} · ${esc(SET_TYPES[e.type] || e.type)} · ${e.count} cartes</span></button>`).join('')
          || '<p class="muted">Aucune extension ne correspond.</p>';
      };
      render('');
      const q = body.querySelector('.ed-q');
      q.addEventListener('input', () => render(q.value));
      setTimeout(() => q.focus(), 50);
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-code]');
        if (b) {
          answered = true;
          resolve(all.find(x => x.code === b.dataset.code));
          close();
        }
      });
      const any = el('<button class="btn">Toutes les extensions</button>');
      any.addEventListener('click', () => {
        answered = true;
        resolve({code: '', name: ''});
        close();
      });
      footer.appendChild(any);
    }, {narrow: true});
    box.back.addEventListener('click', (e) => e.target === box.back && !answered && resolve(null));
  });
}

export class SearchPanel {
  /**
   * @param options.onPick   clic sur une carte
   * @param options.addLabel si présent, un bouton « + » ajoute la carte (onAdd)
   * @param options.counts   fonction nom -> exemplaires déjà dans le deck
   * @param options.onRemove si présent, un bouton « − » retire un exemplaire (cartes déjà dans le deck)
   */
  constructor(root, {onPick, onAdd, onRemove, counts, identityLock, owned = false, onBought} = {}) {
    this.root = root;
    this.onBought = onBought;
    // Mode Planeswalker : seulement les cartes de la collection, avec le nombre d'exemplaires possédés.
    this.owned = owned;
    this.onPick = onPick;
    this.onAdd = onAdd;
    this.onRemove = onRemove;
    this.counts = counts || (() => 0);
    this.identityLock = identityLock || (() => null);
    this.query = {text: '', inText: false, colors: [], colorMode: 'any', types: [], commanderLegal: false, commandersOnly: false};
    this.offset = 0;
    this.total = 0;
    this.loading = false;
    this.seq = 0;
    this.build();
  }

  build() {
    // En-tête fixe (le nom et le bouton des filtres) : seules les cartes défilent dessous.
    // Les filtres se replient sur les écrans bas ; le bouton dit combien sont actifs.
    this.root.innerHTML = `<div class="search-head">
        <div class="search-bar main">
          <input type="search" class="q" placeholder="Nom de carte (français ou anglais)…">
          <button class="btn small filters-btn" title="Afficher ou masquer les filtres">${icon('filter')}<span>Filtres</span><b class="n"></b></button>
          ${this.owned ? '<label class="check small missing-toggle" title="Montrer aussi les cartes que tu n\'as pas, à acheter avec un jeton de leur rareté"><input type="checkbox" class="missing"> Cartes manquantes</label>' : ''}
          <span class="muted small total"></span>
        </div>
        <div class="search-filters">
          <div class="search-bar">
            <div class="color-filter">${['W', 'U', 'B', 'R', 'G', 'C'].map(c => `<span class="ms ${c === 'C' ? '' : 'ms-' + c}" data-color="${c}" title="${c}">${c === 'C' ? '◇' : ''}</span>`).join('')}</div>
            <select class="mode">
              <option value="any">Au moins une de ces couleurs</option>
              <option value="identity">Dans cette identité</option>
              <option value="exact">Exactement ces couleurs</option>
            </select>
            <input type="number" class="cmin" placeholder="VM ≥" title="Valeur de mana minimale" min="0" style="width:76px">
            <input type="number" class="cmax" placeholder="VM ≤" title="Valeur de mana maximale" min="0" style="width:76px">
          </div>
          <div class="search-bar"><button class="btn small set-btn" title="N'afficher que les cartes d'une extension">${icon('book')}<span>Extension : toutes</span></button></div>
          <div class="search-bar chips types">${TYPES.map(([k, l]) => `<span class="chip" data-type="${k}">${l}</span>`).join('')}</div>
          <div class="search-bar">
            <label class="check small"><input type="checkbox" class="intext"> Chercher aussi dans le texte</label>
            <label class="check small"><input type="checkbox" class="legal"> Légales en Commander</label>
            <label class="check small"><input type="checkbox" class="cmdonly"> Peuvent être commandant</label>
          </div>
        </div>
      </div>
      <div class="results"><div class="card-grid"></div><div class="more muted small" style="text-align:center;padding:14px"></div></div>`;
    const r = this.root;
    const head = r.querySelector('.search-head');
    const short = window.matchMedia('(max-height: 620px), (max-width: 640px)');
    head.classList.toggle('folded', short.matches);
    r.querySelector('.filters-btn').addEventListener('click', () => head.classList.toggle('folded'));
    const run = debounce(() => {
      this.countFilters();
      this.search(true);
    }, 220);
    r.querySelector('.q').addEventListener('input', (e) => {
      this.query.text = e.target.value;
      run();
    });
    const missing = r.querySelector('.missing');
    if (missing) {
      missing.addEventListener('change', (e) => {
        this.showMissing = e.target.checked;
        this.search(true);
      });
    }
    r.querySelector('.intext').addEventListener('change', (e) => {
      this.query.inText = e.target.checked;
      run();
    });
    r.querySelector('.mode').addEventListener('change', (e) => {
      this.query.colorMode = e.target.value;
      run();
    });
    r.querySelector('.cmin').addEventListener('input', (e) => {
      this.query.cmcMin = e.target.value === '' ? undefined : Number(e.target.value);
      run();
    });
    r.querySelector('.cmax').addEventListener('input', (e) => {
      this.query.cmcMax = e.target.value === '' ? undefined : Number(e.target.value);
      run();
    });
    r.querySelector('.legal').addEventListener('change', (e) => {
      this.query.commanderLegal = e.target.checked;
      run();
    });
    r.querySelector('.cmdonly').addEventListener('change', (e) => {
      this.query.commandersOnly = e.target.checked;
      run();
    });
    r.querySelector('.set-btn').addEventListener('click', async () => {
      const ed = await pickEdition(this.edition);
      if (!ed) {
        return;
      }
      this.edition = ed.code ? ed : null;
      this.query.set = ed.code || undefined;
      r.querySelector('.set-btn span').textContent = ed.code ? `Extension : ${ed.name}` : 'Extension : toutes';
      r.querySelector('.set-btn').classList.toggle('on', !!ed.code);
      this.countFilters();
      this.search(true);
    });
    r.querySelector('.color-filter').addEventListener('click', (e) => {
      const c = e.target.closest('[data-color]');
      if (!c) {
        return;
      }
      c.classList.toggle('on');
      this.query.colors = [...r.querySelectorAll('[data-color].on')].map(x => x.dataset.color);
      run();
    });
    r.querySelector('.types').addEventListener('click', (e) => {
      const c = e.target.closest('[data-type]');
      if (!c) {
        return;
      }
      c.classList.toggle('on');
      this.query.types = [...r.querySelectorAll('[data-type].on')].map(x => x.dataset.type);
      run();
    });
    const results = r.querySelector('.results');
    results.addEventListener('scroll', () => {
      if (results.scrollTop + results.clientHeight > results.scrollHeight - 300) {
        this.search(false);
      }
    });
    const consumed = onLongPress(results, '.cell', (cell) => cell._card && showZoom(cell._card));
    results.addEventListener('click', (e) => {
      if (consumed()) {
        return;
      }
      const cell = e.target.closest('.cell');
      if (!cell) {
        return;
      }
      if (e.target.closest('.buy')) {
        this.buy(cell);
        return;
      }
      if (e.target.closest('.add')) {
        this.onAdd && this.onAdd(cell._card);
        this.refreshCounts();
        return;
      }
      if (e.target.closest('.rm')) {
        this.onRemove && this.onRemove(cell._card);
        this.refreshCounts();
        return;
      }
      if (this.onPick) {
        this.onPick(cell._card);
      } else {
        showZoom(cell._card);
      }
    });
  }

  /** Recherche : remet à zéro (fresh) ou charge la page suivante. */
  async search(fresh) {
    if (!fresh && (this.loading || this.offset >= this.total)) {
      return;
    }
    const seq = ++this.seq;
    if (fresh) {
      this.offset = 0;
    }
    this.loading = true;
    const query = {...this.query, offset: this.offset, limit: PAGE, owned: (this.owned && !this.showMissing) || undefined,
      ownedInfo: this.owned || undefined};
    const lock = this.identityLock();
    if (lock !== null && lock !== undefined) {
      query.colors = (lock || 'C').split('');
      query.colorMode = 'identity';
      query.commanderLegal = true;
    }
    try {
      const result = await bridge.request('searchCards', {query});
      if (seq !== this.seq && fresh) {
        return;
      }
      const grid = this.root.querySelector('.card-grid');
      if (fresh) {
        grid.innerHTML = '';
        this.root.querySelector('.results').scrollTop = 0;
      }
      this.total = result.total;
      this.offset += result.cards.length;
      for (const card of result.cards) {
        grid.appendChild(this.cell(card));
      }
      this.root.querySelector('.total').textContent = `${result.total.toLocaleString('fr-FR')} carte(s)${this.owned ? ' dans ta collection' : ''}`;
      this.root.querySelector('.more').textContent = this.offset < this.total ? 'Faites défiler pour voir la suite…' : (result.total ? '' : 'Aucune carte ne correspond.');
      this.refreshCounts();
    } catch (e) {
      this.root.querySelector('.more').textContent = e.message;
    } finally {
      this.loading = false;
    }
  }

  cell(card) {
    const cell = el(`<div class="cell${card.owned === 0 ? ' unowned' : ''}"></div>`);
    cell._card = card;
    cell.appendChild(cardElement(card));
    if (card.owned > 0) {
      cell.appendChild(el(`<div class="owned-n" title="Exemplaires dans ta collection">${icon('book')}${card.owned}</div>`));
    }
    if (card.owned === 0) {
      const r = rarityKey(card);
      cell.appendChild(el(`<button class="buy" title="Acheter avec un jeton ${RARITY_FR[r]}">${wildcardHtml(r)}<span>Acheter</span></button>`));
    } else if (this.onAdd) {
      cell.appendChild(el('<button class="add" title="Ajouter au deck" aria-label="Ajouter au deck">+</button>'));
      if (this.onRemove) {
        cell.appendChild(el('<button class="rm" title="Retirer un exemplaire du deck" aria-label="Retirer du deck">−</button>'));
      }
    }
    return cell;
  }

  /** Mode Planeswalker : achète la carte avec un jeton de sa rareté. */
  async buy(cell) {
    const card = cell._card;
    try {
      const r = await bridge.request('careerBuyCard', {name: card.name, set: card.set || '', art: card.art || 0});
      setCareer(r);
      toast(`${card.nameFr} rejoint ta collection (jeton ${RARITY_FR[r.spent]} dépensé).`);
      card.owned = 1;
      const fresh = this.cell(card);
      cell.replaceWith(fresh);
      this.refreshCounts();
      this.onBought && this.onBought(card);
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  /** Nombre de filtres actifs, affiché sur le bouton quand ils sont repliés. */
  countFilters() {
    const q = this.query;
    const n = (q.colors.length ? 1 : 0) + q.types.length + (q.cmcMin !== undefined ? 1 : 0) + (q.cmcMax !== undefined ? 1 : 0)
      + (q.inText ? 1 : 0) + (q.commanderLegal ? 1 : 0) + (q.commandersOnly ? 1 : 0) + (q.set ? 1 : 0);
    this.root.querySelector('.filters-btn .n').textContent = n ? String(n) : '';
  }

  refreshCounts() {
    for (const cell of this.root.querySelectorAll('.cell')) {
      const n = this.counts(cell._card.name);
      cell.classList.toggle('in-deck', n > 0);
      let badge = cell.querySelector('.count');
      if (n > 0) {
        if (!badge) {
          badge = el('<div class="count"></div>');
          cell.appendChild(badge);
        }
        badge.textContent = '×' + n;
      } else if (badge) {
        badge.remove();
      }
    }
  }

  focus() {
    this.root.querySelector('.q').focus();
  }

  /** N'affiche que les cartes qui peuvent être commandant (bouton « Chercher un commandant » du deck builder). */
  commandersOnly(on = true) {
    const box = this.root.querySelector('.cmdonly');
    if (box.checked !== on) {
      box.checked = on;
      box.dispatchEvent(new Event('change'));
    }
  }
}

export function lockNote(identity) {
  return identity === null ? '' : `<span class="muted small">Recherche limitée à l'identité du commandant : ${esc(identity || 'incolore')}</span>`;
}
