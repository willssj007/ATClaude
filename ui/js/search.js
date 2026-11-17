// Panneau de recherche de cartes, partagé par le navigateur de cartes et le deck builder.

import {bridge} from './bridge.js';
import {addFlipButton, cardElement, onLongPress, showZoom} from './cards.js';
import {customBox} from './dialogs.js';
import {esc, el, debounce, prefs, toast} from './util.js';
import {ecoOn} from './perf.js';
import {icon} from './icons.js';
import {RARITY_FR, rarityKey, setCareer, wildcardHtml} from './career.js';

const COLOR_NAMES = {W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert', C: 'Incolore'};
// Types de créature de Forge, avec leur nom français (chargés une fois, pour les suggestions du filtre).
let creatureTypes = null;
function loadCreatureTypes() {
  if (!creatureTypes) {
    creatureTypes = bridge.request('creatureTypes').catch(() => {
      creatureTypes = null;
      return [];
    });
  }
  return creatureTypes;
}

const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Le type de Forge (anglais) d'un type tapé en français ou en anglais (« elfe », « Elf ») ; sinon le texte tel quel. */
function creatureTypeOf(text, list) {
  const t = plain(text);
  if (!t) {
    return '';
  }
  const hit = list.find(x => plain(x.fr) === t || plain(x.en) === t);
  return hit ? hit.en : text.trim();
}

const TYPES = [
  ['creature', 'Créature'], ['instant', 'Éphémère'], ['sorcery', 'Rituel'], ['artifact', 'Artefact'],
  ['enchantment', 'Enchantement'], ['planeswalker', 'Planeswalker'], ['land', 'Terrain'], ['battle', 'Bataille'], ['legendary', 'Légendaire'], ['world', 'Monde'],
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
      // Les extensions perso (Atelier) d'abord, avec leur logo ; leur code de recherche est « @id ».
      const mine = await bridge.request('customSets').catch(() => []);
      const custom = mine.map(x => ({code: '@' + x.id, name: x.name, setCode: x.code, count: x.count, logo: x.logo}));
      const render = (text) => {
        const t = text.trim().toLowerCase();
        const own = custom.filter(e => !t || e.name.toLowerCase().includes(t) || e.setCode.toLowerCase().startsWith(t));
        const ownHtml = own.length ? `<p class="muted small ed-head">Tes extensions</p>${own.map(e => `<button class="ed-item ed-own${current && current.code === e.code ? ' on' : ''}" data-code="${esc(e.code)}">
          <i class="ed-logo"${e.logo ? ` style="background-image:url(&quot;${esc(bridge.imageUrl(e.logo))}&quot;)"` : ''}></i><b>${esc(e.name)}</b>
          <span class="muted small">${esc(e.setCode)} · Atelier · ${e.count} carte${e.count > 1 ? 's' : ''}</span></button>`).join('')}
          ${all.length ? '<p class="muted small ed-head">Extensions officielles</p>' : ''}` : '';
        const hits = all.filter(e => !t || e.name.toLowerCase().includes(t) || e.code.toLowerCase().startsWith(t));
        // Code exact, puis noms qui commencent par le texte, puis le reste (du plus récent au plus ancien).
        const rank = (e) => !t ? 0 : e.code.toLowerCase() === t ? 0 : e.name.toLowerCase().startsWith(t) ? 1 : 2;
        const shown = hits.map((e, i) => [e, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([e]) => e).slice(0, 250);
        list.innerHTML = (ownHtml + shown.map(e => `<button class="ed-item${current && current.code === e.code ? ' on' : ''}" data-code="${esc(e.code)}">
          <b>${esc(e.name)}</b><span class="muted small">${esc(e.code)} · ${esc(e.year)} · ${esc(SET_TYPES[e.type] || e.type)} · ${e.count} cartes</span></button>`).join(''))
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
          resolve(custom.find(x => x.code === b.dataset.code) || all.find(x => x.code === b.dataset.code));
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
  constructor(root, {onPick, onAdd, onRemove, counts, identityLock, owned = false, onBought, popularFirst = false} = {}) {
    this.root = root;
    this.onBought = onBought;
    // Mode Planeswalker : seulement les cartes de la collection, avec le nombre d'exemplaires possédés.
    this.owned = owned;
    this.onPick = onPick;
    this.onAdd = onAdd;
    this.onRemove = onRemove;
    this.counts = counts || (() => 0);
    this.identityLock = identityLock || (() => null);
    // Le texte cherché : dans le nom, et dans le texte des cartes (chaque mot, n'importe où) sauf si on décoche « Dans le texte ».
    this.query = {text: '', inText: true, colors: [], colorMode: 'any', types: [], typeMode: 'all', commanderLegal: false, commandersOnly: false, popular: popularFirst};
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
          <label class="sh-q">${icon('search')}<input type="search" class="q" placeholder="Nom ou mots du texte (français ou anglais)…" enterkeyhint="search"><span class="total"></span></label>
          <button class="sh-pill filters-btn" title="Afficher ou masquer les filtres">${icon('filter')}<span>Filtres</span><b class="n"></b></button>
          ${this.owned ? '<label class="tchip missing-toggle" title="Montrer aussi les cartes que tu n\'as pas, à acheter avec un jeton de leur rareté"><input type="checkbox" class="missing"><i></i><span>Manquantes</span></label>' : ''}
        </div>
        <div class="search-filters">
          <div class="sh-row">
            <div class="color-filter">${['W', 'U', 'B', 'R', 'G', 'C'].map(c => `<span class="ms ${c === 'C' ? '' : 'ms-' + c}" data-color="${c}" title="${COLOR_NAMES[c]}">${c === 'C' ? '◇' : ''}</span>`).join('')}</div>
            <select class="mode" title="Comment comparer les couleurs choisies">
              <option value="any">Au moins une de ces couleurs</option>
              <option value="identity">Dans cette identité</option>
              <option value="exact">Exactement ces couleurs</option>
            </select>
            <div class="sh-cmc" title="Valeur de mana (coût converti)"><span>VM</span><input type="number" class="cmin" placeholder="min" min="0" aria-label="Valeur de mana minimale"><i>–</i><input type="number" class="cmax" placeholder="max" min="0" aria-label="Valeur de mana maximale"></div>
          </div>
          <div class="sh-row chips types">${TYPES.map(([k, l]) => `<span class="chip" data-type="${k}">${l}</span>`).join('')}
            <select class="tmode" title="Comment comparer les types choisis" aria-label="Types choisis">
              <option value="all">Au moins tous ces types</option>
              <option value="any">Au moins un de ces types</option>
              <option value="exact">Exactement ces types</option>
            </select></div>
          <div class="sh-row">
            <button class="sh-pill set-btn" title="N'afficher que les cartes d'une extension">${icon('book')}<span>Extension : toutes</span></button>
            <label class="tchip" title="Chercher aussi les mots dans le texte des cartes (chacun, n'importe où)"><input type="checkbox" class="intext" checked><i></i><span>Dans le texte</span></label>
            <label class="tchip"><input type="checkbox" class="legal"><i></i><span>Légales en Commander</span></label>
            <label class="tchip"><input type="checkbox" class="cmdonly"><i></i><span>Peuvent être commandant</span></label>
            ${this.owned ? '' : '<label class="tchip" title="Seulement les cartes faites dans l\'Atelier"><input type="checkbox" class="customonly"><i></i><span>Cartes perso</span></label>'}
          </div>
          <div class="sh-row">
            <label class="sh-ctype" title="Les créatures de ce type (Elfe, Dragon, Zombie…), changelins compris">${icon('swords')}
              <input type="search" class="ctype" list="ctype-list" placeholder="Type de créature (Elfe, Dragon…)" autocomplete="off"></label>
            <datalist id="ctype-list"></datalist>
            <select class="sort" title="Ordre des cartes">
              <option value="popular"${this.query.popular ? ' selected' : ''}>Les plus jouées d'abord</option>
              <option value="name"${this.query.popular ? '' : ' selected'}>Par nom</option>
            </select>
          </div>
        </div>
        <div class="sh-active"></div>
      </div>
      <div class="results"><div class="sh-status muted small"></div><div class="card-grid"></div><div class="more muted small" style="text-align:center;padding:14px"></div></div>`;
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
    // Plusieurs types : tous à la fois (une créature-enchantement), un seul suffit, ou exactement ceux-là.
    r.querySelector('.tmode').addEventListener('change', (e) => {
      this.query.typeMode = e.target.value;
      if (this.query.types.length) {
        run();
      }
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
    const customOnly = r.querySelector('.customonly');
    if (customOnly) {
      customOnly.addEventListener('change', (e) => {
        this.query.custom = e.target.checked;
        run();
      });
    }
    r.querySelector('.set-btn').addEventListener('click', async () => {
      const ed = await pickEdition(this.edition);
      if (!ed) {
        return;
      }
      this.edition = ed.code ? ed : null;
      this.query.set = ed.code || undefined;
      r.querySelector('.set-btn span').textContent = ed.code ? `Extension : ${ed.name}` : 'Extension : toutes';
      r.querySelector('.set-btn').title = ed.code ? `${ed.name} (${ed.code})` : 'N\'afficher que les cartes d\'une extension';
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
    loadCreatureTypes().then((list) => {
      const dl = r.querySelector('#ctype-list');
      if (dl && list.length) {
        dl.innerHTML = list.map(x => `<option value="${esc(x.fr)}">${x.fr !== x.en ? esc(x.en) : ''}</option>`).join('');
      }
    });
    r.querySelector('.sort').addEventListener('change', (e) => {
      this.query.popular = e.target.value === 'popular';
      run();
    });
    r.querySelector('.ctype').addEventListener('input', async (e) => {
      const list = await loadCreatureTypes();
      this.query.creatureType = creatureTypeOf(e.target.value, list) || undefined;
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
    // Les filtres actifs, en pastilles qu'on retire d'un toucher (même filtres repliés).
    r.querySelector('.sh-active').addEventListener('click', (e) => {
      const b = e.target.closest('[data-clear]');
      if (b) {
        this.clearFilter(b.dataset.clear, b.dataset.v);
        this.countFilters();
        this.search(true);
      }
    });
    r.querySelector('.sh-status').addEventListener('click', (e) => {
      if (e.target.closest('[data-clear-all]')) {
        this.clearFilter('all');
        this.countFilters();
        this.search(true);
      }
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
    const query = this.pageQuery(this.offset);
    try {
      // La page suivante a pu être demandée d'avance (voir prefetchNext) : elle s'affiche tout de suite.
      const ahead = !fresh && this.ahead && this.ahead.key === JSON.stringify(query) ? this.ahead.result : null;
      this.ahead = null;
      const result = await (ahead || bridge.request('searchCards', {query}));
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
      const total = this.root.querySelector('.total');
      total.textContent = `${result.total.toLocaleString('fr-FR')} carte${result.total > 1 ? 's' : ''}`;
      total.title = this.owned ? 'Cartes de ta collection qui correspondent' : 'Cartes qui correspondent';
      // Faute de frappe : les noms les plus proches ; rien du tout : quoi essayer.
      const status = this.root.querySelector('.sh-status');
      const filters = this.activeFilters().length;
      const typed = esc(String(this.query.text || '').trim());
      status.innerHTML = result.fuzzy ? `Aucune carte ne s'appelle « ${typed} » : voici les noms les plus proches.`
        : !result.total ? `Aucune carte ne correspond${typed ? ` à « ${typed} »` : ''}. Essaie un autre mot, en français ou en anglais${filters
          ? `, ou retire un filtre. <button class="btn small" data-clear-all>Retirer les filtres</button>` : '.'}`
          : `${result.total.toLocaleString('fr-FR')} carte${result.total > 1 ? 's' : ''}`;
      status.classList.toggle('sh-note', !!result.fuzzy || !result.total);
      this.root.querySelector('.more').textContent = this.offset < this.total ? 'Faites défiler pour voir la suite…' : '';
      this.refreshCounts();
      this.prefetchNext(seq);
    } catch (e) {
      this.root.querySelector('.more').textContent = e.message;
    } finally {
      this.loading = false;
    }
  }

  /** La requête d'une page de résultats (filtres, collection, identité du commandant). */
  pageQuery(offset) {
    const query = {...this.query, offset, limit: PAGE, owned: (this.owned && !this.showMissing) || undefined,
      ownedInfo: this.owned || undefined};
    const lock = this.identityLock();
    if (lock !== null && lock !== undefined) {
      query.colors = (lock || 'C').split('');
      query.colorMode = 'identity';
      query.commanderLegal = true;
    }
    return query;
  }

  /**
   * Quand le moteur n'a rien d'autre à faire : la page suivante des résultats, et les images de ses premières cartes
   * (le moteur les télécharge et les garde) : en faisant défiler, elles arrivent sans attente.
   */
  prefetchNext(seq) {
    if (this.offset >= this.total) {
      return;
    }
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
    idle(() => {
      if (seq !== this.seq || this.loading || this.offset >= this.total) {
        return;
      }
      const query = this.pageQuery(this.offset);
      const key = JSON.stringify(query);
      const result = bridge.request('searchCards', {query});
      this.ahead = {key, result};
      result.then((r) => {
        if (!prefs.get('images') || !this.ahead || this.ahead.key !== key) {
          return;
        }
        const lang = prefs.get('imageLang');
        for (const card of r.cards.slice(0, 24)) {
          if (card.image) {
            const img = new Image();
            img.fetchPriority = 'low';
            img.decoding = 'async';
            img.src = bridge.imageUrl(card.image, lang) + (ecoOn() ? '&size=s' : '');
          }
        }
      }, () => {
        if (this.ahead && this.ahead.key === key) {
          this.ahead = null;
        }
      });
    }, {timeout: 1500});
  }

  cell(card) {
    const cell = el(`<div class="cell${card.owned === 0 ? ' unowned' : ''}"></div>`);
    cell._card = card;
    // Mode économie : petites images dans la grille aussi (l'agrandissement montre toujours l'image entière).
    cell.appendChild(cardElement(card, '', {small: ecoOn()}));
    addFlipButton(cell, card);
    if (card.owned > 0) {
      cell.appendChild(el(`<div class="owned-n" title="Exemplaires dans ta collection">${icon('book')}${card.owned}</div>`));
    }
    // Les staples : la carte se joue dans beaucoup de préconstruits Commander.
    if (card.precons >= 10 && !card.basic) {
      cell.appendChild(el(`<div class="staple" title="Jouée dans ${card.precons} préconstruits Commander">★ ${card.precons}</div>`));
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
      + (q.commanderLegal ? 1 : 0) + (q.commandersOnly ? 1 : 0) + (q.custom ? 1 : 0) + (q.set ? 1 : 0) + (q.creatureType ? 1 : 0);
    this.root.querySelector('.filters-btn .n').textContent = n ? String(n) : '';
    const list = this.activeFilters();
    this.root.querySelector('.sh-active').innerHTML = list.length
      ? list.map(([key, v, label]) => `<button class="sh-chip" data-clear="${key}" data-v="${esc(v)}" title="Retirer ce filtre">${esc(label)}<b>✕</b></button>`).join('')
        + (list.length > 1 ? '<button class="sh-chip sh-chip-all" data-clear="all">Tout effacer</button>' : '') : '';
  }

  /** Les filtres en cours : [clé, valeur, libellé] (les couleurs, chaque type, la valeur de mana, l'extension…). */
  activeFilters() {
    const q = this.query;
    const out = [];
    const modes = {any: '', identity: ' (identité)', exact: ' (exactement)'};
    if (q.colors.length) {
      out.push(['colors', '', `${q.colors.map(c => COLOR_NAMES[c]).join(', ')}${modes[q.colorMode] || ''}`]);
    }
    for (const t of q.types) {
      out.push(['type', t, (TYPES.find(x => x[0] === t) || [t, t])[1]]);
    }
    if (q.cmcMin !== undefined || q.cmcMax !== undefined) {
      out.push(['cmc', '', q.cmcMin !== undefined && q.cmcMax !== undefined ? `VM ${q.cmcMin}–${q.cmcMax}` : q.cmcMin !== undefined ? `VM ${q.cmcMin} ou plus` : `VM ${q.cmcMax} ou moins`]);
    }
    if (q.set) {
      out.push(['set', '', this.edition ? this.edition.name : q.set]);
    }
    if (q.creatureType) {
      out.push(['ctype', '', this.root.querySelector('.ctype').value || q.creatureType]);
    }
    if (q.commanderLegal) {
      out.push(['legal', '', 'Légales en Commander']);
    }
    if (q.commandersOnly) {
      out.push(['cmdonly', '', 'Peuvent être commandant']);
    }
    if (q.custom) {
      out.push(['custom', '', 'Cartes perso']);
    }
    return out;
  }

  /** Retire un filtre (ou tous, « all ») et remet son réglage à zéro dans le panneau des filtres. */
  clearFilter(key, v) {
    const r = this.root;
    const q = this.query;
    const all = key === 'all';
    if (all || key === 'colors') {
      q.colors = [];
      r.querySelectorAll('[data-color].on').forEach(x => x.classList.remove('on'));
    }
    if (all || key === 'type') {
      q.types = all ? [] : q.types.filter(t => t !== v);
      r.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', q.types.includes(x.dataset.type)));
    }
    if (all || key === 'cmc') {
      q.cmcMin = undefined;
      q.cmcMax = undefined;
      r.querySelector('.cmin').value = '';
      r.querySelector('.cmax').value = '';
    }
    if (all || key === 'set') {
      q.set = undefined;
      this.edition = null;
      const b = r.querySelector('.set-btn');
      b.querySelector('span').textContent = 'Extension : toutes';
      b.title = 'N\'afficher que les cartes d\'une extension';
      b.classList.remove('on');
    }
    if (all || key === 'ctype') {
      q.creatureType = undefined;
      r.querySelector('.ctype').value = '';
    }
    for (const [k, cls, prop] of [['legal', '.legal', 'commanderLegal'], ['cmdonly', '.cmdonly', 'commandersOnly'], ['custom', '.customonly', 'custom']]) {
      if ((all || key === k) && r.querySelector(cls)) {
        q[prop] = false;
        r.querySelector(cls).checked = false;
      }
    }
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
