// Panneau de recherche de cartes, partagé par le navigateur de cartes et le deck builder.

import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {esc, el, debounce} from './util.js';

const TYPES = [
  ['creature', 'Créature'], ['instant', 'Éphémère'], ['sorcery', 'Rituel'], ['artifact', 'Artefact'],
  ['enchantment', 'Enchantement'], ['planeswalker', 'Planeswalker'], ['land', 'Terrain'], ['battle', 'Bataille'], ['legendary', 'Légendaire'],
];
const PAGE = 60;

export class SearchPanel {
  /**
   * @param options.onPick   clic sur une carte
   * @param options.addLabel si présent, un bouton « + » ajoute la carte (onAdd)
   * @param options.counts   fonction nom -> exemplaires déjà dans le deck
   */
  constructor(root, {onPick, onAdd, counts, identityLock} = {}) {
    this.root = root;
    this.onPick = onPick;
    this.onAdd = onAdd;
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
    this.root.innerHTML = `<div class="search-bar">
        <input type="search" class="q" placeholder="Nom de carte (français ou anglais)…">
        <label class="check small"><input type="checkbox" class="intext"> dans le texte</label>
      </div>
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
      <div class="search-bar chips types">${TYPES.map(([k, l]) => `<span class="chip" data-type="${k}">${l}</span>`).join('')}</div>
      <div class="search-bar">
        <label class="check small"><input type="checkbox" class="legal"> Légales en Commander</label>
        <label class="check small"><input type="checkbox" class="cmdonly"> Peuvent être commandant</label>
        <span class="muted small total" style="margin-left:auto"></span>
      </div>
      <div class="results"><div class="card-grid"></div><div class="more muted small" style="text-align:center;padding:14px"></div></div>`;
    const r = this.root;
    const run = debounce(() => this.search(true), 220);
    r.querySelector('.q').addEventListener('input', (e) => {
      this.query.text = e.target.value;
      run();
    });
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
      if (e.target.closest('.add')) {
        this.onAdd && this.onAdd(cell._card);
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
    const query = {...this.query, offset: this.offset, limit: PAGE};
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
        const cell = el(`<div class="cell"></div>`);
        cell._card = card;
        cell.appendChild(cardElement(card));
        if (this.onAdd) {
          cell.appendChild(el('<button class="add" title="Ajouter au deck">+</button>'));
        }
        grid.appendChild(cell);
      }
      this.root.querySelector('.total').textContent = `${result.total.toLocaleString('fr-FR')} carte(s)`;
      this.root.querySelector('.more').textContent = this.offset < this.total ? 'Faites défiler pour voir la suite…' : (result.total ? '' : 'Aucune carte ne correspond.');
      this.refreshCounts();
    } catch (e) {
      this.root.querySelector('.more').textContent = e.message;
    } finally {
      this.loading = false;
    }
  }

  refreshCounts() {
    for (const cell of this.root.querySelectorAll('.cell')) {
      const n = this.counts(cell._card.name);
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
}

export function lockNote(identity) {
  return identity === null ? '' : `<span class="muted small">Recherche limitée à l'identité du commandant : ${esc(identity || 'incolore')}</span>`;
}
