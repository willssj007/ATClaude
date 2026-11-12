// Atelier : cartes perso. Une carte se fait par un formulaire (nom, coût, types, force, mots-clés, capacités à choisir
// dans des modèles) ou en écrivant son script de Forge ; Forge la vérifie à chaque changement et l'aperçu montre la
// carte telle qu'elle sera en jeu. Les types de créature inventés se déclarent ici : sans ça, Forge ne
// les reconnaît pas et les effets qui les citent ne trouvent aucune carte.

import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {confirmBox, customBox} from './dialogs.js';
import {pickPhoto} from './account.js';
import {debounce, el, esc, rulesHtml, symbol, toast} from './util.js';
import {DFC_MODES, facePart, ACT_ZONES, AMOUNTS, CARD_KINDS, CARD_TYPES, CONDITIONS, CONDITIONS_N, COUNTER_TYPES, EFFECT_GROUPS, EMBLEMS, KEYWORDS, PERM_TYPES, PICKS, ROMAN, SAC_WHAT, SCOPES,
  SPELL_COSTS, SPELL_TYPES, STATIC_REPLACEMENTS, TAP_COUNTS, TAP_WHAT, tapCount, KW_ALL, KW_GROUPS, KW_OPTIONS, LANGS, MANA_CHOICES, TOKENS, WHEN, WHEN_GROUPS, WHEN_KINDS, whenKindOf, ANIM_KINDS, AIR_KINDS, MECH_WHO, MANA_KINDS, allTokens, buildScript, costParts,
  effectsFor, eminenceOk, keywordNumber, keywordOptions, keywordValue, modeEffectsFor, needsPT, newMode, readDisplay, setCustomTokens, setTypeNames, templates, withDisplay,
  PLAYER_EFFECTS, PLAYER_WHO, RARITIES, SAC_KINDS, SUBTYPES, whoChoices, attachOf, attachTemplates, cleanArtist, forgeSubtypes, typeLabel, cardSubtypes, linkSubtypes, scopesFor, subtypeAbilityText, subtypeInfo, subtypeIssues, whenFits, whenLabel} from './cardscript.js';
import {FRAMES, FRAME_COLORS, FRAME_TEXT, FX, IMPORTED, absoluteUrl} from './frames.js';

/** Le nom de chaque liste déroulante du formulaire, en titre de la liste ouverte au téléphone. */
const SELECT_TITLES = {when: 'Quand elle agit', effect: 'Ce qu\'elle fait', scope: 'Qui', keyword: 'Mot-clé', token: 'Jeton', mana: 'Mana',
  cond: 'Condition', amount: 'Nombre X', counter: 'Marqueur', permType: 'Type de permanent', cardKind: 'Type de carte', spellType: 'Type de sort',
  emblem: 'Emblème', level: 'Niveau de la classe', who: 'Joueur', chapter: 'Chapitre', sacWhat: 'Sacrifier', zone: 'D\'où elle s\'active',
  addCost: 'Coût en plus', tapXWhat: 'Engager quoi', tapXN: 'Combien en engager', whenKind: 'Quel type', animKind: 'Lesquels', animDur: 'Combien de temps', airKind: 'Sur quoi', mechWho: 'Qui', manaKind: 'Lesquels', dcWho: 'Sur quelles créatures', pick: 'Combien de modes', caseCond: 'À résoudre', amountSel: 'Nombre',
  whenCounter: 'Marqueur', amountCounter: 'Marqueur', condCounter: 'Marqueur', removeCounterType: 'Marqueur', sacKind: 'Sacrifie'};

/** Les types de marqueurs d'une liste déroulante (« charge », « temps », +1/+1…). */
const COUNTER_OPTIONS = COUNTER_TYPES.map(c => [c[0], c[1].replace(/[«»]/g, '').trim()]);
/** Une liste des types de marqueurs : attr « a » (capacité) ou « sf » (mode, effet enchaîné). */
function counterSelect(attr, key, value, def = 'P1P1') {
  const v = COUNTER_OPTIONS.some(c => c[0] === value) ? value : def;
  return `<select data-${attr}="${key}">${COUNTER_OPTIONS.map(([id, l]) => `<option value="${esc(id)}"${id === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}

function labelSelects(root) {
  root.querySelectorAll('select:not([aria-label])').forEach((sel) => {
    const k = sel.dataset.a || sel.dataset.sf || sel.dataset.case;
    const kw = sel.dataset.kwv;
    const t = k ? SELECT_TITLES[k] : kw ? (KW_ALL.find(x => x[0] === kw) || [])[1] : null;
    if (t) {
      sel.setAttribute('aria-label', t);
    }
  });
}

const NEW_CARD = () => ({
  name: '', cost: '', legendary: false, types: ['Creature'], subtypes: '', power: 2, toughness: 2, loyaltyStart: 3,
  keywords: [], kwValues: {}, abilities: [], frame: 'modern', frameColor: 'auto', lang: 'fr', fx: 'none', set: '', rarity: '', artist: '',
});
/** La présentation d'une carte (le verso d'une carte à deux faces garde celle du recto). */
const lookOf = (f) => ({frame: f.frame, frameColor: f.frameColor, lang: f.lang, frameText: f.frameText, fx: f.fx, hideText: f.hideText,
  set: f.set, rarity: f.rarity, artist: f.artist});
/** Le dernier artiste écrit : il est repris sur les nouvelles cartes. */
const ARTIST_KEY = 'at.atelier.artist';
function lastArtist() {
  try {
    return cleanArtist(localStorage.getItem(ARTIST_KEY) || '');
  } catch (e) {
    return '';
  }
}

/** L'extension perso écrite dans un script (son identifiant), ou "". */
function setIdOf(script) {
  return (String(script || '').match(/^SVar:AtelierSet:([a-z0-9]+)\s*$/m) || [])[1] || '';
}

/** Le logo d'une extension perso (pastille), ou un carré vide. */
function setLogoHtml(set, cls = '') {
  const url = set && set.logo ? bridge.imageUrl(set.logo) : '';
  return `<i class="ate-slogo${cls ? ' ' + cls : ''}${url ? '' : ' none'}"${url ? ` style="background-image:url(&quot;${esc(url)}&quot;)"` : ''}></i>`;
}

/** Un code d'extension tiré de son nom : les initiales (« Les Marées d'Ilona » : LMI). */
function codeFromName(name) {
  const words = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const code = words.length > 1 ? words.map(w => w[0]).join('') : (words[0] || '');
  return code.slice(0, words.length > 1 ? 5 : 3);
}
/** Nouveau jeton : une créature 1/1 verte sans coût, au cadre de jeton. */
const NEW_TOKEN = () => ({...NEW_CARD(), token: true, colors: ['G'], power: 1, toughness: 1, frame: 'token'});
const TOKEN_COLORS = [['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert']];
const NEW_ABILITY = () => ({when: 'etb', effect: 'draw', n: 1, filter: {type: '', other: false}, token: TOKENS[0][0],
  keyword: 'Flying', cost: '', tap: true, sac: false, loyalty: 1, mana: 'Any'});
/** Illustration : 480 × 352 (le cadre de l'illustration d'une carte). */
const ART = {w: 480, h: 352};

// Coût de mana au doigt : on touche les symboles au lieu de taper des lettres. La saisie au clavier reste là pour
// les coûts rares (phyrexian, hybride à deux, neige).
const PIPS = [['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert'], ['C', 'Incolore'], ['X', 'X']];
const HYBRIDS = ['W/U', 'U/B', 'B/R', 'R/G', 'G/W', 'W/B', 'U/R', 'B/G', 'R/W', 'G/U'];
const GENERIC_MAX = 20;

/** Coût découpé : la part générique, et les autres symboles dans l'ordre où on les a ajoutés. */
function costModel(text) {
  let generic = 0;
  const pips = [];
  for (const p of costParts(text)) {
    if (/^\d+$/.test(p)) {
      generic += Number(p);
    } else {
      pips.push(p);
    }
  }
  return {generic, pips};
}

/** Coût écrit dans l'ordre des cartes : X d'abord, puis le générique, puis les symboles de couleur. */
function costText({generic, pips}) {
  const parts = [...pips.filter(p => p === 'X'), ...(generic ? [String(generic)] : []), ...pips.filter(p => p !== 'X')];
  return parts.map(p => `{${p}}`).join('');
}

/** Les deux couleurs d'un hybride, dans l'ordre des cartes (« {W/U} », « {G/W} »...). */
function hybridOf(a, b) {
  return HYBRIDS.includes(`${a}/${b}`) ? `${a}/${b}` : `${b}/${a}`;
}

/** Coût que les boutons savent refaire ; sinon la saisie au clavier s'ouvre d'elle-même. */
function simpleCost(text) {
  return costParts(text).every(p => /^\d+$/.test(p) || 'WUBRGCX'.includes(p) || HYBRIDS.includes(p));
}

export class Atelier {
  constructor(root, {onChanged = () => {}} = {}) {
    this.root = root;
    this.onChanged = onChanged;
    this.data = null;
    // Appui long (ou clic droit) sur une carte : on l'inspecte en grand, comme ailleurs dans l'application ; le
    // toucher qui suit ne compte pas comme un clic.
    this.pressed = onLongPress(root, '.ate-tile, .ate-preview .mcard, .ate-frame', (node) => this.inspect(node));
  }

  inspect(node) {
    if (node.classList.contains('ate-tile')) {
      const entry = this.data && this.data.cards.find(c => c.name === node.dataset.name);
      if (entry && entry.card) {
        showZoom(entry.card);
      }
    } else if (this.lastCard) {
      const look = this.look();
      const shown = node.dataset.frame ? {...this.lastCard, frame: node.dataset.frame, frameColor: look.frameColor, frameText: look.frameText}
        : node.dataset.fx ? {...this.lastCard, frame: look.frame, frameColor: look.frameColor, frameText: look.frameText, fx: node.dataset.fx} : this.lastCard;
      showZoom(this.shown(shown));
    }
  }

  async show() {
    if (this.editing) {
      return;
    }
    this.root.innerHTML = '<div class="page"><h1>Atelier</h1><p class="muted">Chargement…</p></div>';
    try {
      this.useData(await bridge.request('customCards'));
    } catch (e) {
      this.root.innerHTML = `<div class="page"><h1>Atelier</h1><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    // Un éditeur ouvert entre-temps (« Autre illustration… » ferme la carte puis ouvre sa réimpression) : il reste.
    if (this.editing) {
      return;
    }
    this.renderList();
  }

  /** Cartes et jetons perso ; les jetons deviennent des choix de « Créer des jetons ». */
  useData(data) {
    this.data = data;
    // Les types de créature en français et en anglais : on peut taper « Dieu » comme « God ».
    if (!this.typeNames) {
      this.typeNames = bridge.request('creatureTypes').then((list) => {
        setTypeNames(list);
        this.typeList = list;
        // Une carte déjà ouverte : sa vérification tient compte des types en français.
        if (this.editing && this.check) {
          this.check();
        }
        return list;
      }).catch(() => []);
    }
    setCustomTokens((data.cards || []).filter(c => c.token && c.tokenScript).map(c => ({script: c.tokenScript, name: c.name})));
  }

  // ------------------------------------------------------------------ liste

  /** L'extension perso d'une carte (son identifiant, si l'extension existe encore), "" sans extension. */
  setOf(c) {
    if (c.reprint) {
      return c.set;
    }
    const id = setIdOf(c.script);
    return id && (this.data.sets || []).some(x => x.id === id) ? id : '';
  }

  renderList() {
    const d = this.data;
    const sets = d.sets || [];
    let setFilter = this.setFilter;
    if (setFilter === undefined) {
      try {
        setFilter = JSON.parse(localStorage.getItem('at.atelier.set') || '""');
      } catch (e) {
        setFilter = '';
      }
    }
    if (setFilter && setFilter !== '-' && !sets.some(x => x.id === setFilter)) {
      setFilter = '';
    }
    this.setFilter = setFilter;
    const inSet = (c) => !setFilter || (setFilter === '-' ? !this.setOf(c) : this.setOf(c) === setFilter);
    // Réimpressions (cartes officielles avec une illustration perso) : rangées avec les cartes de leur extension.
    const reprints = (d.reprints || []).map(r => ({name: r.nameFr || r.name, card: r.card, reprint: r, set: sets.some(x => x.id === r.set) ? r.set : ''}));
    const cards = [...d.cards.filter(c => !c.token && inSet(c)), ...reprints.filter(inSet)];
    const tokens = d.cards.filter(c => c.token && inSet(c));
    const noSet = d.cards.filter(c => !this.setOf(c)).length + reprints.filter(r => !r.set).length;
    const setChip = (v, label, count, set) => `<button class="chip${setFilter === v ? ' on' : ''}" data-sfilter="${esc(v)}">${set ? setLogoHtml(set) : ''}${esc(label)}
      <span class="ate-gn">${count}</span></button>`;
    const sel = this.selection;
    this.root.innerHTML = `<div class="page atelier${sel ? ' ate-selecting' : ''}">
      <div class="ate-top"><h1>Atelier</h1>${d.cards.length ? `<button class="btn" data-organize>${sel ? 'Terminé' : 'Organiser'}</button>` : ''}
        <button class="btn" data-reprint-new title="Une carte officielle (Sol Ring…) avec ton illustration, dans ton extension">＋ Réimpression</button>
        <button class="btn gold" data-new>＋ Nouvelle carte</button></div>
      <p class="muted small">Tes propres cartes, avec leurs effets : Forge les joue comme les vraies (pile, règles, IA). Elles
        se trouvent dans la recherche et le deck builder, et se jouent en Sandbox (pas en Planeswalker). Une <b>réimpression</b> est
        une carte officielle (Sol Ring…) avec ton illustration, ta rareté et ton artiste, dans ton extension : elle garde ses
        règles, et se choisit dans le deck builder comme une autre impression (pinceau d'une ligne du deck).</p>
      ${sets.length ? `<div class="ate-groups chips ate-setfilter">${setChip('', 'Toutes les extensions', d.cards.length + reprints.length)}${sets.map(x => setChip(x.id, x.name, d.cards.filter(c => this.setOf(c) === x.id).length + reprints.filter(r => r.set === x.id).length, x)).join('')}
        ${noSet ? setChip('-', 'Sans extension', noSet) : ''}</div>` : ''}
      ${sel ? `<div class="ate-selbar panel"><span><b>${sel.size}</b> choisie${sel.size > 1 ? 's' : ''} — touche les cartes à ranger</span>
        <button class="btn small gold" data-sput${sel.size ? '' : ' disabled'}>Mettre dans une extension…</button>
        <button class="btn small" data-rput${sel.size ? '' : ' disabled'}>Rareté…</button>
        <button class="btn small" data-gall>${cards.length + tokens.length && [...cards, ...tokens].every(c => sel.has(c.name)) ? 'Aucune' : 'Toutes'}</button></div>` : ''}
      <div class="ate-cardgroups"></div>
      <div class="ate-top"><h2>Mes extensions</h2><button class="btn" data-newset>＋ Nouvelle extension</button></div>
      <p class="muted small">Tes propres extensions : un nom, un code (comme « MH3 ») et un logo. Le logo s'affiche sur tes cartes à
        droite du type, de la couleur de leur rareté, avec leur numéro dans l'extension et l'artiste en bas. Chaque extension se
        cherche dans le menu des cartes et le deck builder (bouton « Extension »). Une carte se range dans une extension dans
        son onglet « Apparence », ou plusieurs à la fois avec « Organiser ».</p>
      <div class="ate-sets">${sets.length ? sets.map(x => `<button class="ate-set panel" data-editset="${esc(x.id)}">${setLogoHtml(x, 'big')}
        <span><b>${esc(x.name)}</b><span class="muted small">${esc(x.code)} · ${x.count} carte${x.count > 1 ? 's' : ''}</span></span></button>`).join('')
        : '<p class="muted">Aucune extension pour l\'instant.</p>'}</div>
      <div class="ate-top"><h2>Mes jetons</h2><button class="btn" data-new-token>＋ Nouveau jeton</button></div>
      <p class="muted small">Des jetons à toi (couleurs, types, force, mots-clés, capacités, illustration) : tes cartes perso
        les créent (effet « Créer des jetons »), et la triche « Ajouter un jeton » les propose en partie.</p>
      <div class="ate-grid ate-tokens">${tokens.length ? '' : `<p class="muted">${setFilter ? 'Aucun jeton dans cette extension.' : 'Aucun jeton perso pour l\'instant.'}</p>`}</div>
      <h2>Types de créature perso</h2>
      <p class="muted small">Un type de créature inventé doit être déclaré ici : Forge ne connaît que les types officiels, et
        un effet qui cite un type inconnu (« chaque créature de ce type que vous contrôlez ») ne trouverait aucune créature.</p>
      <div class="ate-types">${d.types.map(t => `<span class="ate-type">${esc(t)}<button data-untype="${esc(t)}" title="Retirer">✕</button></span>`).join('')}
        <span class="ate-addtype"><input type="text" placeholder="Nouveau type (un mot)" maxlength="30"><button class="btn small" data-addtype>Ajouter</button></span>
      </div>
    </div>`;
    const tileOf = (c) => {
      if (c.reprint) {
        const tile = el(`<div class="ate-tile ate-rptile" data-reprint="${esc(c.reprint.id)}"></div>`);
        tile.appendChild(cardElement(c.card));
        tile.appendChild(el(`<div class="ate-name">${esc(c.name)} <span class="ate-rpbadge" title="Réimpression d'une carte officielle">↻</span></div>`));
        return tile;
      }
      const tile = el(`<div class="ate-tile${sel && sel.has(c.name) ? ' picked' : ''}" data-name="${esc(c.name)}"></div>`);
      tile.appendChild(c.card ? cardElement(c.card) : el(`<div class="mcard"><div class="face"></div></div>`));
      tile.appendChild(el(`<div class="ate-name">${esc(c.name)}</div>`));
      if (sel) {
        tile.appendChild(el(`<span class="ate-pick">${sel.has(c.name) ? '✓' : ''}</span>`));
      }
      return tile;
    };
    // Toutes les extensions : un bloc par extension (puis les cartes sans extension) ; une extension choisie : ses cartes.
    const holder = this.root.querySelector('.ate-cardgroups');
    // Dans une extension : l'ordre de leurs numéros (« 007/120 »).
    const numbered = (list) => list.slice().sort((a, b) => ((a.card && a.card.cset && a.card.cset.n) || 9999) - ((b.card && b.card.cset && b.card.cset.n) || 9999));
    const blocks = !setFilter && sets.some(x => cards.some(c => this.setOf(c) === x.id))
      ? [...sets.map(x => [x, numbered(cards.filter(c => this.setOf(c) === x.id))]), ['-', cards.filter(c => !this.setOf(c))]].filter(b => b[1].length)
      : [[null, setFilter && setFilter !== '-' ? numbered(cards) : cards]];
    for (const [set, list] of blocks) {
      if (set) {
        holder.appendChild(el(`<h3 class="ate-gtitle">${set === '-' ? 'Sans extension' : `${setLogoHtml(set)}${esc(set.name)} <span class="muted small">${esc(set.code)}</span>`}
          <span class="ate-gn">${list.length}</span></h3>`));
      }
      const grid = el('<div class="ate-grid ate-cards"></div>');
      if (!list.length) {
        grid.appendChild(el(`<p class="muted">${setFilter ? 'Aucune carte dans cette extension.' : 'Aucune carte perso pour l\'instant.'}</p>`));
      }
      list.forEach(c => grid.appendChild(tileOf(c)));
      holder.appendChild(grid);
    }
    const tgrid = this.root.querySelector('.ate-tokens');
    tokens.forEach(c => tgrid.appendChild(tileOf(c)));
    this.root.onclick = async (e) => {
      if (this.pressed()) {
        return;
      }
      const rpt = e.target.closest('[data-reprint]');
      if (rpt) {
        if (!this.selection) {
          const r = (d.reprints || []).find(x => x.id === rpt.dataset.reprint);
          if (r) {
            this.editReprint(r, r.card);
          }
        }
        return;
      }
      if (e.target.closest('[data-reprint-new]')) {
        this.pickReprint();
        return;
      }
      const tile = e.target.closest('.ate-tile');
      const sf = e.target.closest('[data-sfilter]');
      if (sf) {
        this.setFilter = sf.dataset.sfilter;
        try {
          localStorage.setItem('at.atelier.set', JSON.stringify(this.setFilter));
        } catch (err) {
          // mémoire du navigateur indisponible : le filtre ne sera pas retenu
        }
        this.renderList();
        return;
      }
      if (e.target.closest('[data-newset]')) {
        this.editSet(null, () => this.renderList());
        return;
      }
      const es = e.target.closest('[data-editset]');
      if (es) {
        this.editSet((d.sets || []).find(x => x.id === es.dataset.editset), () => this.renderList());
        return;
      }
      if (e.target.closest('[data-rput]')) {
        this.askRarity([...this.selection]);
        return;
      }
      if (e.target.closest('[data-sput]')) {
        this.askSet([...this.selection]);
        return;
      }
      if (e.target.closest('[data-organize]')) {
        this.selection = this.selection ? null : new Set();
        this.renderList();
      } else if (tile && this.selection) {
        // Mode « Organiser » : toucher une carte la choisit (ou la retire du choix).
        const n = tile.dataset.name;
        if (this.selection.has(n)) {
          this.selection.delete(n);
        } else {
          this.selection.add(n);
        }
        this.renderList();
      } else if (e.target.closest('[data-gall]')) {
        const visible = [...this.root.querySelectorAll('.ate-tile[data-name]')].map(t => t.dataset.name);
        const all = visible.every(n => this.selection.has(n));
        visible.forEach(n => (all ? this.selection.delete(n) : this.selection.add(n)));
        this.renderList();
      } else if (e.target.closest('[data-new]')) {
        this.edit(null);
      } else if (e.target.closest('[data-new-token]')) {
        this.edit(null, {token: true});
      } else if (tile) {
        this.edit(d.cards.find(c => c.name === tile.dataset.name));
      } else if (e.target.closest('[data-untype]')) {
        await this.setTypes(d.types.filter(t => t !== e.target.closest('[data-untype]').dataset.untype));
      } else if (e.target.closest('[data-addtype]')) {
        const input = this.root.querySelector('.ate-addtype input');
        if (input.value.trim()) {
          await this.setTypes([...d.types, input.value.trim()]);
        }
      }
    };
    this.root.querySelector('.ate-addtype input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.root.querySelector('[data-addtype]').click();
      }
    });
  }

  /**
   * Crée (set null) ou modifie une extension perso : nom, code, logo (PNG, 256 px au plus) et sa teinte selon la
   * rareté. onSaved reçoit l'extension enregistrée.
   */
  editSet(set, onSaved) {
    let logo; // undefined : garder ; "" : retirer ; data URL : nouveau logo
    let logoUrl = set && set.logo ? bridge.imageUrl(set.logo) : '';
    let codeTouched = !!set;
    customBox(set ? `Extension « ${set.name} »` : 'Nouvelle extension', (body, footer, close) => {
      body.innerHTML = `<label class="ate-field"><span>Nom</span><input type="text" class="es-name" maxlength="40" placeholder="Les Marées d'Ilona" value="${esc(set ? set.name : '')}"></label>
        <label class="ate-field"><span>Code <span class="muted small">(2 à 6 lettres ou chiffres, comme « MH3 »)</span></span>
          <input type="text" class="es-code" maxlength="6" autocapitalize="characters" placeholder="LMI" value="${esc(set ? set.code : '')}"></label>
        <div class="ate-field"><span>Logo <span class="muted small">(une image carrée, sur fond transparent de préférence)</span></span>
          <div class="ate-esp"></div>
          <div class="ate-look-row"><button class="btn small" data-eslogo>Choisir une image…</button><button class="btn small" data-esnologo>Retirer le logo</button></div>
          <label class="tchip"><input type="checkbox" class="es-tint"${set && set.tint ? ' checked' : ''}><i></i><span>Couleur de la rareté</span></label>
          <p class="muted small">« Couleur de la rareté » garde la forme du logo et la colore comme les vrais symboles : noir (commune),
            argent (peu commune), or (rare), orange (mythique). Sans elle, le logo s'affiche tel quel. La rareté de chaque carte se
            choisit dans son onglet « Apparence », ou pour plusieurs cartes à la fois avec « Organiser » puis « Rareté… ».</p></div>`;
      const name = body.querySelector('.es-name');
      const code = body.querySelector('.es-code');
      const tint = body.querySelector('.es-tint');
      const previews = () => {
        const box = body.querySelector('.ate-esp');
        const url = logoUrl ? `url(&quot;${esc(absoluteUrl(logoUrl))}&quot;)` : '';
        box.innerHTML = !url ? '<span class="muted small">Pas de logo : l\'enclume de l\'Atelier, de la couleur de la rareté.</span>'
          : ['C', 'U', 'R', 'M'].map(r => tint.checked ? `<span class="cf-set cf-slogo cf-tint cf-r${r}" style="--logo:${url}"><i></i></span>`
            : `<span class="cf-set cf-slogo" style="background-image:${url}"></span>`).join('');
        body.querySelector('[data-esnologo]').classList.toggle('hidden', !logoUrl);
      };
      previews();
      name.addEventListener('input', () => {
        if (!codeTouched) {
          code.value = codeFromName(name.value);
        }
      });
      code.addEventListener('input', () => {
        codeTouched = true;
        code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      });
      tint.addEventListener('change', previews);
      body.addEventListener('click', (e) => {
        if (e.target.closest('[data-esnologo]')) {
          logo = '';
          logoUrl = '';
          previews();
        } else if (e.target.closest('[data-eslogo]')) {
          const input = el('<input type="file" accept="image/*" style="display:none">');
          document.body.appendChild(input);
          input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            input.remove();
            if (!file) {
              return;
            }
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
              // 256 px au plus, proportions et transparence gardées.
              const k = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
              canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
              canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
              URL.revokeObjectURL(url);
              logo = canvas.toDataURL('image/png');
              logoUrl = logo;
              previews();
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              toast('Image illisible.', {title: 'Logo', error: true});
            };
            img.src = url;
          });
          input.click();
        }
      });
      if (set) {
        const del = el('<button class="btn danger">Supprimer</button>');
        del.addEventListener('click', async () => {
          const n = set.count || 0;
          if (!await confirmBox('Supprimer l\'extension ?', `« ${set.name} » disparaîtra, avec son logo.${n ? ` Ses ${n} carte${n > 1 ? 's' : ''} restent, sans extension.` : ''}`,
            {yes: 'Supprimer', danger: true})) {
            return;
          }
          try {
            this.useData(await bridge.request('customSetDelete', {id: set.id}));
            close();
            this.onChanged();
            if (!this.editing) {
              this.renderList();
            }
          } catch (err) {
            toast(err.message, {error: true});
          }
        });
        footer.appendChild(del);
      }
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      const ok = el(`<button class="btn gold">${set ? 'Enregistrer' : 'Créer'}</button>`);
      ok.addEventListener('click', async () => {
        ok.disabled = true;
        try {
          const req = {id: set ? set.id : '', name: name.value, code: code.value, tint: tint.checked};
          if (logo !== undefined) {
            req.logo = logo;
          }
          const data = await bridge.request('customSetSave', req);
          this.useData(data);
          const saved = (data.sets || []).find(x => x.code === code.value.trim().toUpperCase());
          close();
          toast(set ? 'Extension enregistrée.' : `Extension « ${saved ? saved.name : name.value} » créée.`, {title: 'Atelier'});
          this.onChanged();
          if (saved && onSaved) {
            onSaved(saved);
          }
        } catch (err) {
          toast(err.message, {title: 'Extension', error: true, duration: 6000});
          ok.disabled = false;
        }
      });
      footer.append(cancel, ok);
      setTimeout(() => (set ? null : name.focus()), 50);
    }, {narrow: true});
  }

  /** Ranger les cartes choisies dans une extension (ou les en sortir). */
  askSet(names) {
    const sets = this.data.sets || [];
    customBox(`Ranger ${names.length} carte${names.length > 1 ? 's' : ''}`, (body, footer, close) => {
      body.innerHTML = `<p class="muted small">Dans l'extension :</p>
        <div class="chips ate-gpick">${sets.map(x => `<button class="chip" data-spick="${esc(x.id)}">${setLogoHtml(x)}${esc(x.name)} <span class="ate-gn">${esc(x.code)}</span></button>`).join('')}
        <button class="chip" data-spick="">Aucune extension</button><button class="chip ate-newset" data-snew>＋ Nouvelle extension…</button></div>`;
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-spick]');
        if (b) {
          close();
          await this.putInSet(names, b.dataset.spick);
        } else if (e.target.closest('[data-snew]')) {
          close();
          this.editSet(null, (set) => this.putInSet(names, set.id));
        }
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel);
    }, {narrow: true});
  }

  /** Donner une rareté aux cartes choisies (« Organiser »). */
  askRarity(names) {
    customBox(`Rareté de ${names.length} carte${names.length > 1 ? 's' : ''}`, (body, footer, close) => {
      body.innerHTML = `<div class="chips ate-gpick">${RARITIES.map(([v, l]) => `<button class="chip" data-rpick="${v}">${v ? `<i class="ate-rdot r${v}"></i>` : ''}${l}</button>`).join('')}</div>
        <p class="muted small">La rareté colore le logo de l'extension et s'écrit en bas de la carte. Elle se change aussi carte par carte, dans
          l'onglet « Apparence ».</p>`;
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-rpick]');
        if (b) {
          close();
          await this.putRarity(names, b.dataset.rpick);
        }
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel);
    }, {narrow: true});
  }

  /** Donne une rareté ("" : aucune) aux cartes nommées : la ligne est écrite dans leur script. */
  async putRarity(names, rarity) {
    let done = 0;
    for (const name of names) {
      const c = this.data.cards.find(x => x.name === name);
      if (!c || (readDisplay(c.script).rarity || '') === rarity) {
        continue;
      }
      try {
        await bridge.request('customSave', {script: withDisplay(c.script, {...readDisplay(c.script), rarity}), previous: c.name, art: null,
          form: c.form ? {...c.form, rarity} : null});
        done++;
      } catch (e) {
        toast(`${name} : ${e.message}`, {error: true, duration: 6000});
      }
    }
    if (done) {
      const label = (RARITIES.find(r => r[0] === rarity) || ['', ''])[1].toLowerCase();
      toast(`${done} carte${done > 1 ? 's' : ''} : ${rarity ? label : 'sans rareté'}.`, {title: 'Atelier'});
      this.onChanged();
    }
    this.selection = this.selection ? new Set() : null;
    await this.show();
  }

  /** Met les cartes nommées dans une extension ("" : sans extension) : la ligne est écrite dans leur script. */
  async putInSet(names, id) {
    let done = 0;
    for (const name of names) {
      const c = this.data.cards.find(x => x.name === name);
      if (!c || this.setOf(c) === id) {
        continue;
      }
      try {
        // La ligne de groupe d'avant la 0.6.6 (les groupes ont laissé la place aux extensions) s'en va au passage.
        const script = String(c.script || '').split('\n').filter(l => !/^SVar:AtelierGroup:/.test(l)).join('\n');
        const form = c.form ? {...c.form, set: id} : null;
        if (form) {
          delete form.group;
        }
        await bridge.request('customSave', {script: withDisplay(script, {...readDisplay(script), set: id}), previous: c.name, art: null, form});
        done++;
      } catch (e) {
        toast(`${name} : ${e.message}`, {error: true, duration: 6000});
      }
    }
    if (done) {
      const set = (this.data.sets || []).find(x => x.id === id);
      toast(set ? `${done} carte${done > 1 ? 's' : ''} dans « ${set.name} ».` : `${done} carte${done > 1 ? 's' : ''} sans extension.`, {title: 'Atelier'});
      this.onChanged();
    }
    this.selection = this.selection ? new Set() : null;
    await this.show();
  }

  async setTypes(types) {
    try {
      this.useData(await bridge.request('customTypes', {types}));
      this.renderList();
      this.onChanged();
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  // ------------------------------------------------------------------ édition

  /** Édite une carte perso (entry) ou en crée une (null). */
  /** Réimprimer une carte officielle : la chercher (en français ou en anglais), puis l'ouvrir dans l'éditeur. */
  pickReprint() {
    customBox('Réimprimer une carte', (body, footer, close) => {
      body.innerHTML = `<p class="muted small">Une carte officielle ou une de tes cartes perso, avec une autre illustration : elle garde son
        nom et ses règles ; tu choisis son illustration, son extension, sa rareté, son artiste et son cadre.</p>
        <input type="search" class="ate-rpq" placeholder="Anneau solaire, Sol Ring, Foudre…" autocomplete="off">
        <div class="card-grid ate-rpgrid"></div>`;
      const input = body.querySelector('.ate-rpq');
      const grid = body.querySelector('.ate-rpgrid');
      let token = 0;
      const run = debounce(async () => {
        const text = input.value.trim();
        const mine = ++token;
        if (text.length < 2) {
          grid.innerHTML = '';
          return;
        }
        try {
          const r = await bridge.request('searchCards', {query: {text, limit: 24}});
          if (mine !== token) {
            return;
          }
          grid.innerHTML = '';
          // Cartes officielles et cartes perso (une autre illustration sans doublon renommé) ; pas les réimpressions.
          const list = (r.cards || []).filter(c => !c.reprint);
          if (!list.length) {
            grid.appendChild(el('<p class="muted">Aucune carte.</p>'));
          }
          for (const c of list) {
            const cell = el('<div class="cell ate-rpcell"></div>');
            cell.appendChild(cardElement(c));
            cell.appendChild(el(`<div class="small">${esc(c.nameFr || c.name)}</div>`));
            cell.addEventListener('click', () => {
              close();
              this.editReprint(null, c);
            });
            grid.appendChild(cell);
          }
        } catch (err) {
          grid.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
        }
      }, 250);
      input.addEventListener('input', run);
      setTimeout(() => input.focus(), 50);
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel);
    }, {full: true});
  }

  /**
   * Éditeur d'une réimpression (rec : null pour une nouvelle ; base : la carte officielle telle que le catalogue la
   * donne) : son illustration et l'onglet Apparence (extension, rareté, artiste, cadre, effet visuel).
   */
  editReprint(rec, base) {
    this.editing = true;
    this.reprint = {id: rec ? rec.id : '', name: rec ? rec.name : base.name, base, nameFr: (rec && rec.nameFr) || base.nameFr || base.name};
    this.previous = null;
    this.art = null;
    this.artUrl = rec && base.customArt ? bridge.imageUrl(base.customArt) : '';
    this.frameImg = null;
    this.frameUrl = '';
    const rarityOf = {COMMON: 'C', UNCOMMON: 'U', RARE: 'R', MYTHIC_RARE: 'M', MythicRare: 'M', Common: 'C', Uncommon: 'U', Rare: 'R'};
    this.form = {...NEW_CARD(), frame: (rec && rec.frame) || 'modern', frameColor: (rec && rec.frameColor) || 'auto', frameText: (rec && rec.frameText) || 'dark',
      fx: (rec && rec.fx) || 'none', lang: 'fr', set: rec ? rec.set || '' : (this.setFilter && this.setFilter !== '-' ? this.setFilter : ''),
      rarity: rec ? rec.rarity || '' : base.crarity || rarityOf[base.rarity] || '', artist: rec ? rec.artist || '' : base.artist || lastArtist(),
      landText: rec ? rec.landText || '' : '', flavor: rec ? rec.flavor || '' : ''};
    this.mode = 'form';
    this.formUsed = false;
    this.tab = 'look';
    this.script = '';
    this.lastCard = null;
    this.root.onclick = null;
    this.root.innerHTML = `<div class="page atelier-edit ate-reprint">
      <div class="ate-top">
        <button class="btn small" data-back>← Retour</button>
        <h1>Réimpression — ${esc(this.reprint.nameFr)}</h1>
      </div>
      <div class="ate-body">
        <div class="ate-left"></div>
        <div class="ate-side panel">
          <div class="ate-preview"></div>
          <div class="ate-msg muted small"></div>
          <div class="ate-art"><button class="btn small" data-art>Illustration…</button><button class="btn small" data-noart>Retirer l'illustration</button></div>
          <div class="ate-actions">
            <button class="btn gold" data-save>Enregistrer</button>
            ${rec ? '<button class="btn danger" data-delete>Supprimer</button>' : ''}
          </div>
        </div>
      </div>
    </div>`;
    this.check = debounce(() => this.validate(), 150);
    this.root.addEventListener('click', this.onEditClick = (e) => this.editClick(e));
    this.root.addEventListener('pointerdown', this.onEditDrag = () => {});
    this.root.addEventListener('input', this.onEditInput = (e) => this.editInput(e));
    this.root.addEventListener('change', this.onEditInput);
    this.root.addEventListener('toggle', this.onEditToggle = () => {}, true);
    this.renderLeft();
  }

  /** Réimpression : le texte d'un terrain de base (rappel, grand symbole, rien) et un texte d'ambiance. */
  reprintTextHtml() {
    const basic = /^\(\{T\}\s?: (?:Add|Ajoutez) (?:\{[WUBRGCS]\})+(?: à votre réserve)?\.\)$/.test(String(this.reprint.base.text || '').trim());
    const lt = this.form.landText || '';
    return `${basic ? `<div class="ate-field"><span>Texte du terrain</span>
      <div class="chips ate-landtext">${[['', 'Rappel « {T} : Ajoutez… »'], ['symbol', 'Grand symbole de mana'], ['none', 'Pas de texte']].map(([v, l]) =>
        `<button class="chip${v === lt ? ' on' : ''}" data-rland="${v}">${esc(l)}</button>`).join('')}</div>
      <p class="muted small">Sans texte et avec le cadre « Illustration pleine » ou « Sans bord », l'illustration occupe toute la carte (full art).</p></div>` : ''}
      <label class="ate-field"><span>Texte d'ambiance <span class="muted small">(facultatif, en italique sous le texte)</span></span>
        <textarea data-rflavor rows="2" maxlength="240" placeholder="« Les plaines s'étendaient à perte de vue. »">${esc(this.form.flavor || '')}</textarea></label>`;
  }

  /** Aperçu d'une réimpression : la carte officielle (nom, coût, type et texte en français) dans le cadre choisi. */
  previewReprint() {
    const look = this.look();
    const set = ((this.data && this.data.sets) || []).find(x => x.id === look.set);
    const base = this.reprint.base;
    // Le numéro dans l'extension : celui de la réimpression enregistrée (pas celui de la carte perso qu'elle réimprime).
    const keepNumber = this.reprint.id && base.cset && set && base.cset.id === set.id;
    // Terrain de base : rappel de mana en français, grand symbole ou rien (comme le pont le fera en partie).
    const basicText = String(base.text || '').trim().match(/^\(\{T\}\s?: (?:Add|Ajoutez) ((?:\{[WUBRGCS]\})+)(?: à votre réserve)?\.\)$/);
    const land = basicText ? (this.form.landText === 'symbol' ? {text: '', landSymbol: basicText[1]} : this.form.landText === 'none' ? {text: ''}
      : {text: `({T} : Ajoutez ${basicText[1]}.)`}) : {};
    const card = {...base, ...land, flavor: this.form.flavor ? this.form.flavor : base.flavor, custom: true, reprint: true, image: '', frame: look.frame, frameColor: look.frameColor, frameText: look.frameText, fx: look.fx, lang: 'fr',
      crarity: look.rarity || undefined, artist: cleanArtist(look.artist) || undefined,
      cset: set ? {id: set.id, code: set.code, name: set.name, tint: !!set.tint, logo: set.logo, ...(keepNumber ? {n: base.cset.n, total: base.cset.total} : {})} : undefined};
    this.lastCard = card;
    this.renderLook();
    const preview = this.root.querySelector('.ate-preview');
    if (preview) {
      preview.innerHTML = '';
      const node = cardElement(this.shown(card));
      node.addEventListener('click', () => this.pressed() || showZoom(this.shown(card)));
      preview.appendChild(node);
    }
    const msg = this.root.querySelector('.ate-msg');
    if (msg) {
      msg.className = 'ate-msg small ok';
      msg.textContent = `« ${this.reprint.nameFr} » garde son nom et ses règles : seule l'apparence change.`;
    }
  }

  async saveReprint(button) {
    button.disabled = true;
    const look = this.look();
    const req = {id: this.reprint.id, name: this.reprint.name, set: look.set || '', rarity: look.rarity || '', artist: cleanArtist(look.artist),
      frame: look.frame, frameColor: look.frameColor, frameText: look.frameText, fx: look.fx, landText: this.form.landText || '', flavor: (this.form.flavor || '').trim()};
    if (this.art !== null) {
      req.art = this.art;
    }
    try {
      this.useData(await bridge.request('reprintSave', req));
      try {
        if (cleanArtist(look.artist)) {
          localStorage.setItem(ARTIST_KEY, cleanArtist(look.artist));
        }
      } catch (err) {
        // mémoire du navigateur indisponible : l'artiste ne sera pas repris
      }
      toast('Réimpression enregistrée : choisis-la dans le deck builder (pinceau d\'une ligne du deck), elle se joue avec ton illustration.', {title: 'Atelier', duration: 6000});
      this.onChanged();
      this.close();
    } catch (e) {
      toast(e.message, {title: 'Réimpression refusée', error: true, duration: 7000});
      button.disabled = false;
    }
  }

  async removeReprint() {
    if (!await confirmBox('Supprimer la réimpression ?', `Cette impression de « ${this.reprint.nameFr} » disparaîtra. Les decks qui l'utilisent reprennent
      l'impression officielle.`, {yes: 'Supprimer', danger: true})) {
      return;
    }
    try {
      this.useData(await bridge.request('reprintDelete', {id: this.reprint.id}));
      this.onChanged();
      this.close();
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  edit(entry, {token = false} = {}) {
    this.reprint = null;
    this.editing = true;
    this.previous = entry ? entry.name : null;
    this.art = null;
    this.artUrl = entry && entry.card && entry.card.customArt ? bridge.imageUrl(entry.card.customArt) : '';
    // Cadre importé : PNG à envoyer (null : garder celui de la carte, "" : le retirer) et son adresse à l'écran.
    this.frameImg = null;
    this.frameUrl = entry && entry.card && entry.card.customFrame ? bridge.imageUrl(entry.card.customFrame) : '';
    this.form = entry && entry.form ? Object.assign(NEW_CARD(), entry.form) : token ? NEW_TOKEN() : NEW_CARD();
    // Carte à deux faces : on modifie le recto ou le verso (this.front garde le recto pendant qu'on modifie le verso).
    this.face = 'front';
    this.front = null;
    this.backArt = null;
    this.backArtUrl = entry && entry.card && entry.card.back && entry.card.back.customArt ? bridge.imageUrl(entry.card.back.customArt) : '';
    if (!entry) {
      this.form.artist = lastArtist();
    }
    // Les groupes (avant la 0.6.6) ont laissé la place aux extensions.
    delete this.form.group;
    this.subNotes = [];
    this.form.token = !!(this.form.token || (entry && entry.token));
    this.form.colors = this.form.colors || [];
    this.form.kwValues = this.form.kwValues || {};
    this.kwOpen = new Set(['combat', ...KW_ALL.filter(k => this.form.keywords.includes(k[0])).map(k => k[3])]);
    this.moreOpen = new Set();
    this.costOpen = new Set();
    this.kwQuery = '';
    this.mode = entry && !entry.form ? 'script' : 'form';
    this.formUsed = this.mode === 'form'; // carte faite au formulaire (une carte en script n'en a pas)
    this.tab = 'edit';
    this.script = entry ? entry.script : '';
    // Le script fait foi pour la présentation (cadre, couleur, langue), même pour une carte faite au formulaire.
    if (entry) {
      Object.assign(this.form, readDisplay(entry.script));
    }
    this.lastCard = null;
    this.root.onclick = null;
    this.root.innerHTML = `<div class="page atelier-edit">
      <div class="ate-top">
        <button class="btn small" data-back>← Retour</button>
        <h1>${entry ? (this.form.token ? 'Modifier le jeton' : 'Modifier la carte') : this.form.token ? 'Nouveau jeton' : 'Nouvelle carte'}</h1>
        <div class="seg ate-mode"><button data-mode="form">Formulaire</button><button data-mode="script">Script Forge</button><button data-tab="look">Apparence</button></div>
      </div>
      <div class="ate-body">
        <div class="ate-left"></div>
        <div class="ate-side panel">
          <div class="ate-preview"></div>
          <div class="ate-msg muted small">Vérification par Forge…</div>
          <div class="ate-art"><button class="btn small" data-art>Illustration…</button><button class="btn small" data-noart>Retirer l'illustration</button></div>
          ${entry && !this.form.token && entry.card ? '<button class="btn small" data-alt-art title="Une réimpression : la même carte avec une autre illustration, sans la renommer">↻ Autre illustration…</button>' : ''}
          <div class="ate-actions">
            <button class="btn gold" data-save>Enregistrer</button>
            ${entry ? '<button class="btn danger" data-delete>Supprimer</button>' : ''}
          </div>
        </div>
      </div>
    </div>`;
    this.check = debounce(() => this.validate(), 350);
    this.root.addEventListener('click', this.onEditClick = (e) => this.editClick(e));
    this.root.addEventListener('pointerdown', this.onEditDrag = (e) => {
      const handle = e.target.closest('.ate-drag');
      if (handle) {
        this.startDrag(e, handle);
      }
    });
    this.root.addEventListener('input', this.onEditInput = (e) => this.editInput(e));
    this.root.addEventListener('change', this.onEditInput);
    // Groupes de mots-clés ouverts ou fermés : retenus d'un affichage du formulaire à l'autre.
    this.root.addEventListener('toggle', this.onEditToggle = (e) => {
      const more = e.target.dataset && e.target.dataset.more;
      if (more !== undefined) {
        if (e.target.open) {
          this.moreOpen.add(Number(more));
        } else {
          this.moreOpen.delete(Number(more));
        }
      }
      const costs = e.target.dataset && e.target.dataset.costs;
      if (costs !== undefined) {
        if (e.target.open) {
          this.costOpen.add(Number(costs));
        } else {
          this.costOpen.delete(Number(costs));
        }
      }
      const g = e.target.dataset && e.target.dataset.kwg;
      if (g) {
        if (e.target.open) {
          this.kwOpen.add(g);
        } else {
          this.kwOpen.delete(g);
        }
      }
    }, true);
    this.renderLeft();
  }

  close() {
    this.reprint = null;
    this.root.removeEventListener('click', this.onEditClick);
    this.root.removeEventListener('pointerdown', this.onEditDrag);
    this.root.removeEventListener('input', this.onEditInput);
    this.root.removeEventListener('change', this.onEditInput);
    this.root.removeEventListener('toggle', this.onEditToggle, true);
    this.editing = false;
    this.show();
  }

  /** Le formulaire décrit encore la carte (script ouvert pour le lire, sans le changer) : il est gardé pour la rouvrir. */
  formKept() {
    // Les lignes de présentation (cadre, couleur, langue) peuvent changer en mode script sans perdre le formulaire.
    const bare = (script) => withDisplay(script, {}).trim();
    return this.mode === 'form' || (this.formUsed && bare(this.script) === bare(buildScript(this.full())));
  }

  /** La carte entière : le recto, avec son verso (même pendant qu'on modifie le verso). */
  full() {
    if (this.face !== 'back' || !this.front) {
      return this.form;
    }
    return {...this.front, ...lookOf(this.form), back: facePart(this.form)};
  }

  /** Passe au recto ou au verso d'une carte à deux faces (le formulaire montre la face choisie). */
  switchFace(face) {
    if (face === this.face || this.mode !== 'form') {
      return;
    }
    if (face === 'back') {
      const front = this.form;
      this.front = front;
      this.form = Object.assign(NEW_CARD(), {types: ['Creature'], abilities: []}, front.back || {}, lookOf(front), {token: false});
      this.form.kwValues = this.form.kwValues || {};
      this.form.colors = this.form.colors || [];
      this.face = 'back';
    } else {
      const back = this.form;
      Object.assign(this.front, lookOf(back), {back: facePart(back)});
      this.form = this.front;
      this.front = null;
      this.face = 'front';
    }
    this.kwOpen = new Set(['combat', ...KW_ALL.filter(k => (this.form.keywords || []).includes(k[0])).map(k => k[3])]);
    this.moreOpen = new Set();
    this.costOpen = new Set();
    this.renderLeft();
  }

  /** Une seule face, ou deux (recto verso, jour et nuit, modale, aventure, préparée, bataille). */
  setDfc(value) {
    if (this.face === 'back') {
      this.switchFace('front');
    }
    const f = this.form;
    f.dfc = value;
    if (value && !f.back) {
      const spell = value === 'adventure' || value === 'prepare';
      f.back = {name: '', cost: spell || value === 'modal' ? '' : undefined, types: spell ? ['Sorcery'] : ['Creature'], power: 2, toughness: 2,
        keywords: [], kwValues: {}, abilities: [], colors: []};
    }
    if (value === 'adventure' || value === 'prepare') {
      const types = (f.back.types || []).filter(t => t === 'Instant' || t === 'Sorcery');
      f.back.types = types.length ? types : ['Sorcery'];
    }
    this.renderLeft();
  }

  /** Le verso d'une carte qui se transforme : pas de coût, des couleurs. */
  backNoCost() {
    const mode = DFC_MODES.find(m => m[0] && m[0] === (this.front || {}).dfc);
    return this.face === 'back' && !!mode && !mode[3];
  }

  /** Le choix des faces, en haut du formulaire. */
  facesHtml() {
    const front = this.face === 'back' ? this.front : this.form;
    if (!front || front.token) {
      return '';
    }
    const mode = DFC_MODES.find(m => m[0] === (front.dfc || '')) || DFC_MODES[0];
    const backName = this.face === 'back' ? this.form.name : (front.back && front.back.name);
    return `<div class="ate-field ate-faces"><span>Faces</span>
      <div class="ate-ab-row"><select data-dfc>${DFC_MODES.map(([v, l]) => `<option value="${v}"${v === mode[0] ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      ${mode[0] ? `<div class="seg ate-faceseg"><button data-face="front" class="${this.face !== 'back' ? 'on' : ''}">Recto${front.name ? ' : ' + esc(front.name) : ''}</button>
        <button data-face="back" class="${this.face === 'back' ? 'on' : ''}">Verso${backName ? ' : ' + esc(backName) : ''}</button></div>
        <p class="muted small">${esc(mode[4])} Le formulaire montre la face choisie ; l'illustration aussi.</p>` : ''}
      ${mode[0] === 'battle' && this.face !== 'back' ? `<label class="ate-field"><span>Défense de la bataille</span>
        <input type="number" data-k="defense" value="${esc(front.defense ?? 5)}" min="1" max="20" style="width:90px"></label>` : ''}
    </div>`;
  }

  currentScript() {
    return this.mode === 'form' ? buildScript(this.full()) : this.script;
  }

  /** Présentation de la carte : celle du formulaire, ou celle écrite dans le script. */
  look() {
    return this.mode === 'form' ? {frame: this.form.frame, frameColor: this.form.frameColor, lang: this.form.lang, frameText: this.form.frameText || 'dark', fx: this.form.fx || 'none',
      hideText: !!this.form.hideText, set: this.form.set || '', rarity: this.form.rarity || '', artist: this.form.artist || ''}
      : readDisplay(this.script);
  }

  setLook(patch) {
    if (this.mode === 'form') {
      Object.assign(this.form, patch);
    } else {
      this.script = withDisplay(this.script, {...this.look(), ...patch});
      const area = this.root.querySelector('.ate-script');
      if (area) {
        area.value = this.script;
      }
    }
    this.renderLook();
    this.check();
  }

  /** Extension perso, rareté et artiste (onglet Apparence). */
  extHtml() {
    const sets = (this.data && this.data.sets) || [];
    return `<div class="ate-field ate-look ate-ext"><span>Extension</span>
      <div class="chips ate-setpick"><button class="chip" data-lset="">Aucune</button>${sets.map(x => `<button class="chip" data-lset="${esc(x.id)}">${setLogoHtml(x)}${esc(x.name)}
        <span class="ate-gn">${esc(x.code)}</span></button>`).join('')}<button class="chip ate-newset" data-newset>＋ Nouvelle extension…</button></div>
    </div>
    <div class="ate-field ate-look"><span>Rareté</span>
      <div class="chips ate-rarpick">${RARITIES.map(([v, l]) => `<button class="chip" data-lrarity="${v}">${v ? `<i class="ate-rdot r${v}"></i>` : ''}${l}</button>`).join('')}</div>
    </div>
    <label class="ate-field ate-look"><span>Artiste <span class="muted small">(en bas de la carte, avec un pinceau)</span></span>
      <input type="text" data-lartist maxlength="60" placeholder="Qui a fait l'illustration : toi, ou son artiste"></label>
    <p class="muted small">Le logo de l'extension va à droite du type, de la couleur de la rareté. Le numéro de la carte dans l'extension, le code de l'extension et l'artiste vont en bas. Les extensions se créent ici ou dans « Mes extensions » de l'Atelier, et se cherchent dans le menu des cartes (bouton « Extension »).</p>`;
  }

  lookHtml() {
    return `${this.extHtml()}<div class="ate-field ate-look"><span>Présentation</span>
      <div class="ate-look-row">
        <div class="seg ate-lang">${LANGS.map(([v, l]) => `<button data-lang="${v}">${l}</button>`).join('')}</div>
        <label class="ate-fcolor" data-fcolor-box>Couleur du cadre <select data-fcolor>${FRAME_COLORS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="ate-fcolor" data-ftext-box>Texte <select data-ftext>${FRAME_TEXT.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      </div>
      <div class="ate-frames"></div>
      <div class="ate-look-row"><label class="ate-check" title="Les capacités restent dans le jeu (Forge, aperçu en partie), seule la carte imprimée les cache">
        <input type="checkbox" data-hidetext> Sur la carte, seulement le texte d'ambiance (cacher le texte des capacités)</label></div>
      <div class="ate-look-row ate-import">
        <button class="btn small" data-import-frame>Importer un cadre…</button>
        <button class="btn small" data-noframe>Retirer le cadre importé</button>
        <span class="muted small">Une image PNG de la carte entière, la fenêtre de l'illustration transparente.</span>
      </div>
      ${this.mode === 'script' ? '<p class="muted small">En mode script, le texte de la carte est celui du script : la langue choisie sert au type et aux mots-clés.</p>' : ''}
    </div>
    <div class="ate-field ate-look"><span>Effet visuel</span>
      <div class="ate-frames ate-fx"></div>
      <p class="muted small">Un reflet animé sur toute la carte, comme une carte premium : dans l'Atelier, la recherche, les decks et en partie. Il reste immobile si les animations sont coupées (Réglages).</p>
    </div>`;
  }

  /** Coche la présentation choisie, et montre la carte dans chaque cadre. */
  renderLook() {
    const look = this.look();
    this.root.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === look.lang));
    const sets = (this.data && this.data.sets) || [];
    const setNow = sets.some(x => x.id === look.set) ? look.set : '';
    this.root.querySelectorAll('[data-lset]').forEach(b => b.classList.toggle('on', b.dataset.lset === setNow));
    this.root.querySelectorAll('[data-lrarity]').forEach(b => b.classList.toggle('on', b.dataset.lrarity === (look.rarity || '')));
    const hide = this.root.querySelector('[data-hidetext]');
    if (hide) {
      hide.checked = !!look.hideText;
    }
    const artist = this.root.querySelector('[data-lartist]');
    if (artist && document.activeElement !== artist && artist.value !== (look.artist || '')) {
      artist.value = look.artist || '';
    }
    const sel = this.root.querySelector('[data-fcolor]');
    if (sel && sel.value !== look.frameColor) {
      sel.value = look.frameColor;
    }
    const text = this.root.querySelector('[data-ftext]');
    if (text && text.value !== look.frameText) {
      text.value = look.frameText;
    }
    // Couleur pour les cadres dessinés, couleur du texte pour un cadre importé.
    const imported = look.frame === IMPORTED && !!this.frameUrl;
    this.root.querySelectorAll('[data-fcolor-box]').forEach(n => n.classList.toggle('hidden', imported));
    this.root.querySelectorAll('[data-ftext-box]').forEach(n => n.classList.toggle('hidden', !imported));
    this.root.querySelectorAll('[data-noframe]').forEach(n => n.classList.toggle('hidden', !this.frameUrl));
    const strip = this.root.querySelector('.ate-frames');
    if (!strip || !this.lastCard) {
      return;
    }
    const list = this.frameUrl ? [...FRAMES, [IMPORTED, 'Importé']] : FRAMES;
    const sig = list.map(f => f[0]).join(',');
    if (strip.dataset.sig !== sig) {
      strip.innerHTML = '';
      strip.dataset.sig = sig;
      for (const [id, label] of list) {
        const b = el(`<button class="ate-frame" data-frame="${id}" title="${esc(label)}"><span>${esc(label)}</span></button>`);
        strip.appendChild(b);
      }
    }
    for (const b of strip.children) {
      const card = cardElement(this.shown({...this.lastCard, frame: b.dataset.frame, frameColor: look.frameColor, frameText: look.frameText, fx: 'none'}));
      const old = b.querySelector('.mcard');
      if (old) {
        old.replaceWith(card);
      } else {
        b.prepend(card);
      }
      b.classList.toggle('on', b.dataset.frame === look.frame);
    }
    this.renderFx();
  }

  /** La carte telle qu'elle sera : l'illustration et le cadre importé choisis ici, pas encore enregistrés. */
  shown(card) {
    const art = this.face === 'back' ? this.backArtUrl || this.artUrl : this.artUrl;
    return {...card, customArt: null, customArtUrl: art, customFrame: null, customFrameUrl: this.frameUrl};
  }

  /** Cadre importé : une image PNG ramenée au format de la carte (504 × 704), transparence gardée. */
  importFrame() {
    const input = el('<input type="file" accept="image/png" style="display:none">');
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) {
        return;
      }
      if (file.type && file.type !== 'image/png') {
        toast('Le cadre doit être une image PNG (avec la fenêtre de l\'illustration transparente).', {title: 'Cadre', error: true});
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 504;
        canvas.height = 704;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        this.frameImg = canvas.toDataURL('image/png');
        this.frameUrl = this.frameImg;
        this.setLook({frame: IMPORTED});
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast('Image illisible.', {title: 'Cadre', error: true});
      };
      img.src = url;
    });
    input.click();
  }

  /** Vignettes des effets visuels : la carte telle qu'elle est, avec chaque effet. */
  renderFx() {
    const strip = this.root.querySelector('.ate-fx');
    if (!strip || !this.lastCard) {
      return;
    }
    const look = this.look();
    if (!strip.children.length) {
      for (const [id, label] of FX) {
        strip.appendChild(el(`<button class="ate-frame" data-fx="${id}" title="${esc(label)}"><span>${esc(label)}</span></button>`));
      }
    }
    for (const b of strip.children) {
      const card = cardElement(this.shown({...this.lastCard, frame: look.frame, frameColor: look.frameColor, frameText: look.frameText, fx: b.dataset.fx}));
      const old = b.querySelector('.mcard');
      if (old) {
        old.replaceWith(card);
      } else {
        b.prepend(card);
      }
      b.classList.toggle('on', b.dataset.fx === look.fx);
    }
  }

  renderLeft() {
    // Onglets : Formulaire et Script Forge (le contenu de la carte), Apparence (présentation et effets).
    this.root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', this.tab !== 'look' && b.dataset.mode === this.mode));
    this.root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', this.tab === 'look'));
    const left = this.root.querySelector('.ate-left');
    this.hyb = null;
    if (this.tab === 'look') {
      left.innerHTML = (this.reprint ? this.reprintTextHtml() : '') + this.lookHtml();
      this.renderLook();
      this.check();
      return;
    }
    if (this.mode === 'script') {
      left.innerHTML = `<p class="muted small">Le script tel que Forge le lit (format des fichiers de cartes de Forge :
        <code>Name:</code>, <code>ManaCost:</code>, <code>Types:</code>, <code>PT:</code>, <code>K:</code>, <code>T:</code>,
        <code>A:</code>, <code>S:</code>, <code>SVar:</code>, <code>Oracle:</code>). Tout ce que Forge sait faire est possible ici.</p>
        <textarea class="ate-script" spellcheck="false">${esc(this.script)}</textarea>`;
      this.renderLook();
      this.check();
      return;
    }
    const f = this.form;
    const colorsOnly = f.token || this.backNoCost();
    left.innerHTML = `${this.facesHtml()}
      <label class="ate-field"><span>Nom${this.face === 'back' ? ' du verso' : ''}</span><input type="text" data-k="name" value="${esc(f.name)}" placeholder="Gardienne des marées" maxlength="60"></label>
      ${colorsOnly ? `<div class="ate-field"><span>${f.token ? 'Couleurs du jeton' : 'Couleurs du verso (il n\'a pas de coût)'}</span><div class="ate-mana-pad ate-tcolors">${TOKEN_COLORS.map(([c, l]) =>
        `<button class="ate-pip${f.colors.includes(c) ? ' first' : ''}" data-tcolor="${c}" title="${l}">${symbol(c)}</button>`).join('')}
        <span class="muted small">${f.colors.length ? '' : 'Incolore'}</span></div></div>` : `<div class="ate-field"><span>Coût de mana</span>${this.manaHtml('form')}</div>`}
      <div class="ate-field"><span>Types</span><div class="ate-chips">
        ${this.face === 'back' || f.dfc ? '' : `<button class="chip ${f.token ? 'on' : ''}" data-tokenflag title="Un jeton : pas de coût, créé par les capacités">Jeton</button>`}
        <button class="chip ${f.legendary ? 'on' : ''}" data-legendary>Légendaire</button>
        ${CARD_TYPES.map(([v, l]) => `<button class="chip ${f.types.includes(v) ? 'on' : ''}" data-type="${v}">${l}</button>`).join('')}
      </div></div>
      <div class="ate-field"><span>Sous-types</span>${this.subtypesHtml(f)}</div>
      ${this.subtypeHtml(f)}
      ${needsPT(f) ? `<div class="ate-field ate-pt"><span>Force / endurance</span>
        <input type="number" data-k="power" value="${esc(f.power)}" min="0" max="99"> / <input type="number" data-k="toughness" value="${esc(f.toughness)}" min="0" max="99"></div>` : ''}
      ${f.types.includes('Planeswalker') ? `<label class="ate-field"><span>Loyauté de départ</span><input type="number" data-k="loyaltyStart" value="${esc(f.loyaltyStart)}" min="1" max="20"></label>` : ''}
      <div class="ate-field"><span>Mots-clés</span>${this.keywordsHtml(f)}</div>
      <div class="ate-field"><span>Capacités</span><div class="ate-abilities">${f.abilities.map((a, i) => this.abilityHtml(a, i)).join('')}</div>
        <div class="ate-add">${attachOf(f) ? `<button class="btn small gold" data-template-attach>＋ Pour ${esc(attachOf(f).fr)}…</button>` : ''}
        <button class="btn small gold" data-template>＋ Capacité toute prête…</button>
        <button class="btn small" data-addab>＋ Capacité vide</button>
        <button class="btn small" data-addcustom title="Une capacité avec ses options ouvertes : nombre X, condition, « et puis »">＋ Effet perso</button></div></div>
      <label class="ate-field"><span>Texte d'ambiance <span class="muted small">(flavor text : en italique, sous les capacités ; facultatif)</span></span>
        <textarea data-k="flavor" rows="2" maxlength="240" placeholder="« La marée ne choisit pas : elle emporte tout. »">${esc(f.flavor || '')}</textarea></label>`;
    this.renderLook();
    this.check();
    labelSelects(left);
  }

  /** Les volets ouverts (« plus d'options », « autres coûts ») suivent leur capacité quand l'ordre change. */
  reindexOpen(map) {
    for (const key of ['moreOpen', 'costOpen']) {
      this[key] = new Set([...this[key]].map(map).filter(j => j >= 0));
    }
  }

  /** Déplace une capacité (l'ordre des capacités est celui du texte de la carte). */
  moveAbility(from, to) {
    if (document.activeElement && this.root.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    const list = this.form.abilities;
    if (from === to || to < 0 || to >= list.length) {
      return;
    }
    list.splice(to, 0, list.splice(from, 1)[0]);
    this.reindexOpen((j) => (j === from ? to : from < to && j > from && j <= to ? j - 1 : to < from && j >= to && j < from ? j + 1 : j));
    this.renderLeft();
    const box = this.root.querySelector(`[data-ab="${to}"]`);
    if (box) {
      box.classList.add('ate-moved');
      box.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      setTimeout(() => box.classList.remove('ate-moved'), 700);
    }
  }

  /**
   * Glisser une capacité par sa poignée ⠿ : elle suit le doigt (ou la souris), les autres s'écartent, et elle prend sa
   * place en la lâchant. L'écran défile tout seul près des bords.
   */
  startDrag(e, handle) {
    const from = Number(handle.dataset.drag);
    const box = handle.closest('.ate-ab');
    const boxes = [...this.root.querySelectorAll('.ate-abilities > .ate-ab')];
    if (!box || boxes.length < 2) {
      return;
    }
    e.preventDefault();
    // Un champ en cours de saisie s'enregistre d'abord, à sa capacité (avant que l'ordre change).
    if (document.activeElement && this.root.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    // Positions de départ (dans la page) : le milieu de chaque capacité, et la hauteur de celle qu'on déplace.
    const start = e.clientY + window.scrollY;
    const mids = boxes.map(b => {
      const r = b.getBoundingClientRect();
      return r.top + window.scrollY + r.height / 2;
    });
    const height = box.getBoundingClientRect().height + 12;
    let to = from;
    let lastY = e.clientY;
    let scrollTimer = null;
    box.classList.add('ate-dragging');
    if (handle.setPointerCapture) {
      handle.setPointerCapture(e.pointerId);
    }
    const update = () => {
      const y = lastY + window.scrollY;
      box.style.transform = `translateY(${y - start}px)`;
      // La nouvelle place : le nombre d'autres capacités dont le milieu est au-dessus du doigt.
      to = mids.filter((m, k) => k !== from && m < y).length;
      boxes.forEach((b, k) => {
        if (b !== box) {
          const shift = from < to && k > from && k <= to ? -height : to < from && k >= to && k < from ? height : 0;
          b.style.transform = shift ? `translateY(${shift}px)` : '';
        }
      });
    };
    const move = (ev) => {
      lastY = ev.clientY;
      update();
      clearInterval(scrollTimer);
      scrollTimer = null;
      const edge = 80;
      if (lastY < edge || lastY > window.innerHeight - edge) {
        const step = lastY < edge ? -14 : 14;
        scrollTimer = setInterval(() => {
          window.scrollBy(0, step);
          update();
        }, 16);
      }
    };
    const end = () => {
      clearInterval(scrollTimer);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      boxes.forEach(b => {
        b.style.transform = '';
      });
      box.classList.remove('ate-dragging');
      if (to !== from) {
        this.moveAbility(from, to);
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /** La langue des noms de sous-types de la carte : celle choisie dans le sélecteur, sinon celle du texte de la carte. */
  subLang(f = this.form) {
    return f.subLang === 'en' || f.subLang === 'fr' ? f.subLang : f.lang === 'en' ? 'en' : 'fr';
  }

  /** Les sous-types en pastilles (toucher ✕ en retire un), le bouton qui ouvre le sélecteur, et la saisie au clavier. */
  subtypesHtml(f) {
    const lang = this.subLang(f);
    const list = forgeSubtypes(f.subtypes);
    return `<div class="ate-subbox">${list.map(en => `<span class="chip on ate-subchip">${esc(typeLabel(en, lang))}${typeLabel(en, lang) !== en && lang === 'fr'
      ? `<small>${esc(en)}</small>` : ''}<button data-subdel="${esc(en)}" title="Retirer">✕</button></span>`).join('')}
      <button class="chip ate-subadd" data-subpick>＋ ${list.length ? 'Ajouter' : 'Choisir les sous-types'}</button></div>
      <details class="ate-subkb"><summary class="muted small">Saisie au clavier</summary>
        <input type="text" data-k="subtypes" value="${esc(f.subtypes)}" placeholder="Humain Sorcier, ou Human Wizard (séparés par des espaces)"></details>`;
  }

  /**
   * Sélecteur de types, avec recherche (sans accents, en français comme en anglais) et noms en français ou en anglais :
   * multi (les sous-types de la carte) ou un seul type (un filtre « chaque Elfe… », « toutes » permis). onDone(types en
   * anglais, langue choisie).
   */
  pickTypes({multi = false, current = [], title = 'Sous-types', allowAll = false, onDone}) {
    const f = this.form;
    let lang = this.subLang(f);
    const chosen = new Set(current);
    const creature = (this.typeList || (this.data.creatureTypes || []).map(en => ({en, fr: en})));
    const custom = (this.data && this.data.types) || [];
    const fits = (st) => st[2].some(t => f.types.includes(t));
    // Les groupes : ceux qui vont avec la carte, les types perso, les types de créature, les autres sous-types.
    const groups = multi ? [
      ['Pour cette carte', SUBTYPES.filter(st => st[0] !== 'Mount' && fits(st)).map(st => ({en: st[0], fr: st[1], no: !!st[3].no}))],
      ['Types perso', custom.map(t => ({en: t, fr: t}))],
      ['Types de créature', creature.map(t => ({en: t.en, fr: t.fr || t.en}))],
      ['Autres sous-types', SUBTYPES.filter(st => st[0] !== 'Mount' && !fits(st)).map(st => ({en: st[0], fr: st[1], no: !!st[3].no}))],
    ] : [['Types perso', custom.map(t => ({en: t, fr: t}))], ['Types de créature', creature.map(t => ({en: t.en, fr: t.fr || t.en}))]];
    const plain = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    customBox(title, (body, footer, close) => {
      body.innerHTML = `<div class="ate-tp-head"><div class="ate-tp-top">
          <input type="search" class="ate-tpq" placeholder="Chercher : elfe, dragon, équipement, forêt…" enterkeyhint="search">
          <div class="seg ate-tp-lang"><button data-tplang="fr">Français</button><button data-tplang="en">English</button></div>
        </div>
        ${multi ? '<div class="ate-tp-chosen chips"></div>' : ''}</div>
        <div class="ate-tp-list"></div>`;
      const input = body.querySelector('.ate-tpq');
      const listBox = body.querySelector('.ate-tp-list');
      const chosenBox = body.querySelector('.ate-tp-chosen');
      const name = (t) => (lang === 'en' ? t.en : t.fr);
      const other = (t) => (lang === 'en' ? t.fr : t.en);
      const paint = () => {
        body.querySelectorAll('[data-tplang]').forEach(b => b.classList.toggle('on', b.dataset.tplang === lang));
        if (chosenBox) {
          chosenBox.innerHTML = chosen.size ? [...chosen].map(en => `<button class="chip on" data-tpdel="${esc(en)}">${esc(typeLabel(en, lang))} ✕</button>`).join('')
            : '<span class="muted small">Aucun sous-type pour l\'instant : touche ceux de la carte.</span>';
        }
        const q = plain(input.value.trim());
        let html = allowAll && !q ? `<button class="ate-tp-item${!chosen.size ? ' on' : ''}" data-tpall>Toutes (aucun type)</button>` : '';
        let exact = false;
        for (const [label, items] of groups) {
          // Par ordre alphabétique des noms affichés (« Ange », « Antilope »… en français ; « Angel »… en anglais).
          const hits = items.filter(t => !q || plain(t.en).includes(q) || plain(t.fr).includes(q))
            .sort((x, y) => plain(name(x)).localeCompare(plain(name(y)), lang));
          if (!hits.length) {
            continue;
          }
          exact = exact || hits.some(t => plain(t.en) === q || plain(t.fr) === q);
          html += `<div class="ate-tplgroup">${esc(label)} <span class="ate-gn">${hits.length}</span></div>`
            + hits.slice(0, q ? 400 : 1000).map(t => `<button class="ate-tp-item${chosen.has(t.en) ? ' on' : ''}" data-tp="${esc(t.en)}">
              <span>${esc(name(t))}</span>${other(t) !== name(t) ? `<small>${esc(other(t))}</small>` : ''}${t.no ? '<small class="warn">sans sa mécanique</small>' : ''}
              ${chosen.has(t.en) ? '<b>✓</b>' : ''}</button>`).join('');
        }
        // Un type qui n'est dans aucune liste (un type inventé) : on peut l'écrire tel quel.
        if (q && !exact && /^[\p{L}][\p{L}'-]*$/u.test(input.value.trim())) {
          html += `<button class="ate-tp-item" data-tpfree="${esc(input.value.trim())}"><span>Utiliser « ${esc(input.value.trim())} » tel quel</span>
            <small>un type que Forge ne connaît pas : déclare-le dans « Types de créature perso »</small></button>`;
        }
        listBox.innerHTML = html || '<p class="muted small">Rien ne correspond.</p>';
      };
      paint();
      input.addEventListener('input', paint);
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tp],[data-tpdel],[data-tplang],[data-tpall],[data-tpfree]');
        if (!b) {
          return;
        }
        if (b.dataset.tplang) {
          lang = b.dataset.tplang;
        } else if (b.dataset.tpall !== undefined) {
          close();
          onDone([], lang);
          return;
        } else if (b.dataset.tpdel) {
          chosen.delete(b.dataset.tpdel);
        } else {
          const en = b.dataset.tp || b.dataset.tpfree;
          if (!multi) {
            close();
            onDone([en], lang);
            return;
          }
          if (chosen.has(en)) {
            chosen.delete(en);
          } else {
            chosen.add(en);
          }
          if (b.dataset.tpfree) {
            input.value = '';
          }
        }
        paint();
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel);
      if (multi) {
        const ok = el('<button class="btn gold">OK</button>');
        ok.addEventListener('click', () => {
          close();
          onDone([...chosen], lang);
        });
        footer.append(ok);
      }
    }, {narrow: true});
  }

  /** Sous-types choisis (types de Forge) : écrits dans la langue choisie, puis reliés à leur mécanique. */
  setSubtypes(list, lang) {
    this.form.subLang = lang;
    this.form.subtypes = list.map(en => typeLabel(en, lang)).join(' ');
    this.subNotes = linkSubtypes(this.form);
    this.renderLeft();
  }

  /**
   * Ce que font les sous-types de la carte dans le jeu, avec leurs réglages : la capacité d'une nourriture ou d'un indice
   * (qu'on peut retirer), le mana d'une forêt, les coûts des niveaux d'une classe, la condition d'une affaire, et ce
   * que l'Atelier vient d'ajouter pour qu'un sous-type marche (le mot-clé Équipement, « Enchanter : joueur »…).
   */
  subtypeHtml(f) {
    const rows = [];
    for (const en of cardSubtypes(f)) {
      const st = subtypeInfo(en);
      if (!st) {
        continue;
      }
      const [, fr, , m] = st;
      const name = `<b>${esc(fr)}</b>`;
      if (m.no) {
        rows.push(`<div class="ate-sub warn">${name} ${esc(m.no)}</div>`);
      } else if (m.ability) {
        const on = !(f.subOff || []).includes(en);
        const t = subtypeAbilityText(en, f.lang).replace(/CARDNAME/g, f.name || (f.lang === 'en' ? 'this card' : 'cette carte'));
        rows.push(`<label class="ate-sub ate-check"><input type="checkbox" data-subab="${esc(en)}"${on ? ' checked' : ''}> ${name}
          <span>${rulesHtml(t)}</span> <span class="muted small">(la capacité des jetons ${esc(fr)})</span></label>`);
      } else if (m.mana) {
        rows.push(`<div class="ate-sub">${name} ${rulesHtml(`{T} : Ajoutez {${m.mana}}.`)} <span class="muted small">— donné par le type de terrain, comme dans le jeu</span></div>`);
      } else if (m.levels) {
        rows.push(`<div class="ate-sub">${name} <span class="muted small">${esc(m.note)}</span>
          <div class="ate-kwv-row"><span class="muted small">Coût du niveau 2</span>${this.manaHtml('lvl:2')}</div>
          <div class="ate-kwv-row"><span class="muted small">Coût du niveau 3</span>${this.manaHtml('lvl:3')}</div></div>`);
      } else if (m.solve) {
        rows.push(`<div class="ate-sub">${name} <span class="muted small">À résoudre —</span> ${this.caseHtml(f)}<div class="muted small">${esc(m.note)}</div></div>`);
      } else if (m.note) {
        rows.push(`<div class="ate-sub">${name} <span class="muted small">${esc(m.note)}</span></div>`);
      }
    }
    const notes = this.subNotes && this.subNotes.length ? `<div class="ate-sub ok">✓ ${this.subNotes.map(esc).join(' · ')}</div>` : '';
    return rows.length || notes ? `<div class="ate-subs">${notes}${rows.join('')}</div>` : '';
  }

  /** La condition « À résoudre — » d'une affaire : une des conditions avec un nombre (pas « votre tour », ni le kick). */
  caseHtml(f) {
    const list = CONDITIONS.filter(([id]) => !['none', 'yourTurn', 'notYourTurn', 'kicked', 'tappedAtLeast'].includes(id));
    const c = f.caseCond || '';
    return `<select data-case="caseCond"><option value="">— choisir —</option>${list.map(([id, l]) => `<option value="${id}"${id === c ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${CONDITIONS_N.includes(c) ? `<input type="number" data-case="caseN" value="${esc(f.caseN ?? 3)}" min="0" max="99" style="width:64px" title="N">` : ''}
      ${c === 'control' ? `<input type="text" data-case="caseType" data-typepick readonly value="${esc(f.caseType || '')}" placeholder="toutes, ou un type" style="width:140px">` : ''}`;
  }

  /** Mots-clés par groupes repliables (ou ceux qui correspondent à la recherche), puis la valeur de ceux qui en ont une. */
  keywordsHtml(f) {
    const values = KW_ALL.filter(k => k[4] && f.keywords.includes(k[0])).map((k) => {
      if (k[4] === 'cost') {
        return `<div class="ate-kwv-row"><span class="muted small">${esc(k[1])}</span>${this.manaHtml('kw:' + k[0])}</div>`;
      }
      if (k[4] === 'ncost') {
        return `<div class="ate-kwv-row"><label class="ate-kwv-n"><span class="muted small">${esc(k[1])}</span>
          <input type="number" data-kwn="${esc(k[0])}" value="${esc(keywordNumber(f, k[0]))}" min="1" max="20"></label>${this.manaHtml('kw:' + k[0])}</div>`;
      }
      if (k[4] === 'sel') {
        const v = keywordValue(f, k[0]);
        return `<label class="ate-kwv-row ate-kwv-n"><span class="muted small">${esc(k[1])}${k[0] === 'Affinity' ? ' pour' : ''}</span>
          <select data-kwv="${esc(k[0])}">${(KW_OPTIONS[k[0]] || []).map(o => `<option value="${esc(o[0])}"${o[0] === v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
      }
      if (k[4] === 'text') {
        return `<label class="ate-kwv-row ate-kwv-n"><span class="muted small">${esc(k[1])}</span>
          <input type="text" class="ate-kwv-text" data-kwv="${esc(k[0])}" value="${esc(keywordValue(f, k[0]))}" placeholder="le nom exact de l'autre carte"></label>`;
      }
      if (k[4] === 'type') {
        return `<label class="ate-kwv-row ate-kwv-n"><span class="muted small">${esc(k[1])}</span>
          <input type="text" class="ate-kwv-text" data-kwv="${esc(k[0])}" data-typepick readonly value="${esc(keywordValue(f, k[0]))}" placeholder="un type de créature : Elfe"></label>`;
      }
      return `<label class="ate-kwv-row ate-kwv-n"><span class="muted small">${esc(k[1])}${k[4] === 'gen' ? ' (coût générique)' : ''}</span>
        <input type="number" data-kwv="${esc(k[0])}" value="${esc(keywordValue(f, k[0]))}" min="${k[4] === 'gen' ? 0 : 1}" max="20"></label>`;
    }).join('');
    return `<div class="ate-kw"><input type="search" class="ate-kwq" placeholder="Chercher un mot-clé : vol, kick, suspension, enchanter…" value="${esc(this.kwQuery || '')}">
      <div class="ate-kwbox">${this.keywordChipsHtml(f)}</div></div>${values ? `<div class="ate-kwv">${values}</div>` : ''}`;
  }

  /** Les mots-clés : par groupes, ou ceux qui correspondent à la recherche (en français ou en anglais, sans accents). */
  keywordChipsHtml(f) {
    const plain = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = plain(this.kwQuery || '').trim();
    const chip = (k) => `<button class="chip ${f.keywords.includes(k[0]) ? 'on' : ''}" data-kw="${esc(k[0])}" title="${esc(k[2])}">${esc(k[1])}</button>`;
    if (q) {
      const hits = KW_ALL.filter(k => plain(k[1]).includes(q) || plain(k[2]).includes(q));
      return hits.length ? `<div class="ate-chips ate-kwhits">${hits.map(chip).join('')}</div>` : '<p class="muted small">Aucun mot-clé ne correspond.</p>';
    }
    return `<div class="ate-kwgs">${KW_GROUPS.map(([g, label]) => {
      const list = KW_ALL.filter(k => k[3] === g);
      const on = list.filter(k => f.keywords.includes(k[0])).length;
      return `<details class="ate-kwg" data-kwg="${g}"${this.kwOpen.has(g) ? ' open' : ''}>
        <summary>${esc(label)}${on ? ` <b class="ate-kwn">${on}</b>` : ''}</summary>
        <div class="ate-chips">${list.map(chip).join('')}</div>
      </details>`;
    }).join('')}</div>`;
  }

  /** Type proposé dans les capacités toutes prêtes : un type perso de la carte, sinon son dernier sous-type. */
  guessType() {
    const subs = String(this.form.subtypes || '').trim().split(/\s+/).filter(Boolean);
    const custom = (this.data && this.data.types) || [];
    return subs.find(t => custom.includes(t)) || subs[subs.length - 1] || '';
  }

  /** Liste de phrases toutes faites ; celle qu'on touche devient une capacité du formulaire, à ajuster ensuite. */
  pickTemplate(onlyAttach = false) {
    // Celles de ce que la carte équipe ou enchante d'abord (« La créature équipée a le contact mortel »), puis les autres.
    const at = attachOf(this.form);
    const own = attachTemplates(this.form).map(t => ({...t, group: at ? `Pour ${at.fr}` : ''}));
    const list = onlyAttach ? own : [...own, ...templates(this.guessType()).map(t => ({...t, group: own.length ? 'Autres capacités' : ''}))];
    const plain = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    customBox(onlyAttach && at ? `Pour ${at.fr}` : 'Capacité toute prête', (body, footer, close) => {
      body.innerHTML = `<p class="muted small">Touche une phrase : elle s'ajoute aux capacités, et tu peux ensuite changer le type, le mot-clé ou le nombre.</p>
        <input type="search" class="ate-tplq" placeholder="Chercher : contact mortel, +1/+1, attaque, pioche…" enterkeyhint="search">
        <div class="ate-templates"></div>`;
      const box = body.querySelector('.ate-templates');
      const paint = (q) => {
        const f = plain(q.trim());
        let group = null;
        let html = '';
        list.forEach((t, i) => {
          if (f && !plain(t.label).includes(f)) {
            return;
          }
          if (t.group && t.group !== group) {
            group = t.group;
            html += `<div class="ate-tplgroup">${esc(group)}</div>`;
          }
          html += `<button class="ate-template" data-i="${i}">${rulesHtml(t.label)}</button>`;
        });
        box.innerHTML = html || '<p class="muted small">Aucune phrase ne correspond : essaie un autre mot, ou ajoute une capacité vide.</p>';
      };
      paint('');
      body.querySelector('.ate-tplq').addEventListener('input', (e) => paint(e.target.value));
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) {
          return;
        }
        const t = list[Number(b.dataset.i)];
        this.form.abilities.push(JSON.parse(JSON.stringify(t.a)));
        close();
        this.renderLeft();
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel);
    }, {narrow: true});
  }

  /** Coût de la carte (« form ») ou d'une capacité activée (« ab:2 »). */
  manaValue(target) {
    if (target.startsWith('lvl:')) {
      return (this.form.classCosts || {})[target.slice(4)] || '';
    }
    if (target.startsWith('kw:')) {
      return keywordValue(this.form, target.slice(3)) || '';
    }
    if (target.startsWith('prod:')) {
      return (this.form.abilities[Number(target.slice(5))] || {}).manaSymbols || '';
    }
    return target === 'form' ? this.form.cost : (this.form.abilities[Number(target.slice(3))] || {}).cost || '';
  }

  setManaValue(target, value) {
    if (target === 'form') {
      this.form.cost = value;
    } else if (target.startsWith('lvl:')) {
      this.form.classCosts = {...(this.form.classCosts || {}), [target.slice(4)]: value};
    } else if (target.startsWith('kw:')) {
      this.form.kwValues = {...this.form.kwValues, [target.slice(3)]: value};
    } else if (target.startsWith('prod:')) {
      this.form.abilities[Number(target.slice(5))].manaSymbols = value;
    } else {
      this.form.abilities[Number(target.slice(3))].cost = value;
    }
  }

  /** Sélecteur de coût : le coût en symboles (toucher un symbole le retire), les boutons pour en ajouter. */
  manaHtml(target) {
    const value = this.manaValue(target);
    const key = target === 'form' ? 'data-k="cost"' : target.startsWith('lvl:') ? `data-lvl="${esc(target.slice(4))}"` : target.startsWith('kw:') ? `data-kwv="${esc(target.slice(3))}"`
      : target.startsWith('prod:') ? 'data-a="manaSymbols"' : 'data-a="cost"';
    return `<div class="ate-mana" data-mana="${esc(target)}">
      <div class="ate-mana-show">${this.manaShowHtml(value, target)}</div>
      <div class="ate-mana-pad">${this.manaPadHtml(value, target)}</div>
      <details class="ate-mana-kb"${simpleCost(value) ? '' : ' open'}><summary class="muted small">Saisie au clavier</summary>
        <input type="text" ${key} value="${esc(value)}" placeholder="2WU ou {2}{W}{U} ; hybride {W/U}, phyrexian {W/P}"></details>
    </div>`;
  }

  manaShowHtml(value, target = '') {
    const parts = costParts(value);
    if (!parts.length) {
      return `<span class="muted small">${target.startsWith('prod:') ? 'Aucun mana' : 'Pas de coût'} : touche les symboles en dessous.</span>`;
    }
    return parts.map((p, i) => `<button class="ate-pip-on" data-pipat="${i}" title="Retirer ce symbole">${symbol(p)}</button>`).join('')
      + '<button class="ate-mana-clear" data-pipclear title="Tout effacer">✕</button>';
  }

  manaPadHtml(value, target) {
    if (target.startsWith('prod:')) {
      // Mana produit : un symbole par mana ({G}{U}, {C}{C}) ; ni X, ni générique, ni hybride.
      return PIPS.filter(([p]) => p !== 'X').map(([p, label]) => `<button class="ate-pip" data-pip="${p}" title="${label}">${symbol(p)}</button>`).join('');
    }
    const {generic} = costModel(value);
    const hyb = this.hyb && this.hyb.target === target ? this.hyb : null;
    const phy = this.phy === target;
    return PIPS.map(([p, label]) => {
      const off = (hyb || phy) && !'WUBRG'.includes(p);
      return `<button class="ate-pip${hyb && hyb.first === p ? ' first' : ''}" data-pip="${p}" title="${label}"${off ? ' disabled' : ''}>${symbol(p)}</button>`;
    }).join('')
      + `<span class="ate-gen" title="Mana générique"><button data-gen="-1" title="Un de moins"${generic ? '' : ' disabled'}>−</button>${symbol(String(generic))}`
      + `<button data-gen="1" title="Un de plus"${generic < GENERIC_MAX ? '' : ' disabled'}>+</button></span>`
      + `<button class="chip ate-hyb${hyb ? ' on' : ''}" data-hybrid title="Symbole à deux couleurs">Hybride</button>`
      + `<button class="chip ate-hyb${phy ? ' on' : ''}" data-phyrexian title="Mana phyrexian : payable avec 2 points de vie">Phyrexian ϕ</button>`
      + (phy ? '<span class="muted small ate-hyb-hint">Touche une couleur.</span>' : '')
      + (hyb ? `<span class="muted small ate-hyb-hint">${hyb.first ? 'Et la seconde couleur ?' : 'Touche deux couleurs.'}</span>` : '');
  }

  /** Un bouton du sélecteur de coût a été touché. */
  manaClick(box, b) {
    const target = box.dataset.mana;
    const value = this.manaValue(target);
    const m = costModel(value);
    const hyb = this.hyb && this.hyb.target === target ? this.hyb : null;
    let next = value;
    if (b.dataset.hybrid !== undefined) {
      this.hyb = hyb ? null : {target, first: ''};
      this.phy = null;
    } else if (b.dataset.phyrexian !== undefined) {
      this.phy = this.phy === target ? null : target;
      this.hyb = null;
    } else if (b.dataset.pip && this.phy === target && 'WUBRG'.includes(b.dataset.pip)) {
      m.pips.push(`${b.dataset.pip}/P`);
      next = costText(m);
    } else if (b.dataset.pip) {
      const p = b.dataset.pip;
      if (hyb && !hyb.first) {
        hyb.first = p;
      } else if (hyb && hyb.first === p) {
        hyb.first = '';
      } else {
        m.pips.push(hyb ? hybridOf(hyb.first, p) : p);
        if (hyb) {
          hyb.first = '';
        }
        next = costText(m);
      }
    } else if (b.dataset.gen) {
      m.generic = Math.max(0, Math.min(GENERIC_MAX, m.generic + Number(b.dataset.gen)));
      next = costText(m);
    } else if (b.dataset.pipat !== undefined) {
      const parts = costParts(value);
      const i = Number(b.dataset.pipat);
      if (/^\d+$/.test(parts[i]) && Number(parts[i]) > 1) {
        parts[i] = String(Number(parts[i]) - 1);
      } else {
        parts.splice(i, 1);
      }
      next = parts.map(p => `{${p}}`).join('');
    } else if (b.dataset.pipclear !== undefined) {
      next = '';
      this.hyb = null;
    }
    this.setManaValue(target, next);
    this.paintMana(box, true);
    if (next !== value) {
      this.check();
    }
  }

  /** Redessine le sélecteur sans toucher à la saisie au clavier (sauf si on le demande : elle suit les boutons). */
  paintMana(box, input) {
    const target = box.dataset.mana;
    const value = this.manaValue(target);
    box.querySelector('.ate-mana-show').innerHTML = this.manaShowHtml(value, target);
    box.querySelector('.ate-mana-pad').innerHTML = this.manaPadHtml(value, target);
    if (input) {
      box.querySelector('.ate-mana-kb input').value = value;
    }
  }

  abilityHtml(a, i) {
    const w = WHEN.find(x => x.id === a.when) || WHEN[0];
    const effects = effectsFor(a.when, this.form);
    const e = effects.find(x => x.id === a.effect) || effects[0];
    const isStatic = a.when === 'static';
    const sel = (attr, list, value, extra = '') => `<select data-a="${attr}"${extra}>${list.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const scope = a.scope || 'you';
    const filterShown = isStatic ? e.scope && ['you', 'opp', 'all', 'tokens'].includes(scope) : (w.filter || e.filter);
    const otherShown = !isStatic || ['you', 'all'].includes(scope);
    const subs = cardSubtypes(this.form);
    const isClass = subs.includes('Class');
    const isCase = subs.includes('Case');
    const moreCosts = w.cost && (a.payLife || a.discardCost || a.sacWhat || a.exileGY || a.removeCounters || a.untapQ || a.payEnergy || a.waterbend || a.sorcery || a.oncePerTurn || a.yourTurnOnly || a.zone);
    const count = this.form.abilities.length;
    return `<div class="ate-ab panel" data-ab="${i}">
      ${count > 1 ? `<div class="ate-ab-order"><span class="ate-drag" data-drag="${i}" title="Glisser vers le haut ou le bas pour changer l'ordre sur la carte">⠿</span>
        <span class="muted small">Capacité ${i + 1} sur ${count}</span>
        <button class="ate-mv" data-mvab="${i}" data-dir="-1" title="Monter"${i === 0 ? ' disabled' : ''}>▲</button>
        <button class="ate-mv" data-mvab="${i}" data-dir="1" title="Descendre"${i === count - 1 ? ' disabled' : ''}>▼</button></div>` : ''}
      <div class="ate-ab-row"><select data-a="when" aria-label="Quand elle agit">${WHEN_GROUPS.map(([kind, label]) => `<optgroup label="${esc(label)}">${WHEN.filter(x => x.kind === kind
          && (whenFits(x, this.form) || x.id === a.when))
        // Ceux de ce que la carte équipe ou enchante d'abord (« Quand la créature équipée attaque »).
        .sort((p, q) => Number(!!q.attach) - Number(!!p.attach))
        .map(x => `<option value="${x.id}"${x.id === a.when ? ' selected' : ''}>${esc(whenLabel(x, this.form))}</option>`).join('')}</optgroup>`).join('')}</select>
        <button class="ate-x" data-delab="${i}" title="Retirer cette capacité">✕</button></div>
      ${w.counterSel ? `<div class="ate-ab-row"><span class="muted small">Marqueur</span>${counterSelect('a', 'whenCounter', a.whenCounter, 'CHARGE')}
        ${w.nth ? `<span class="muted small">N =</span><input type="number" data-a="whenN" value="${esc(a.whenN ?? 3)}" min="1" max="20" style="width:64px">` : ''}</div>` : ''}
      ${w.kinds || w.nLabel ? `<div class="ate-ab-row">${w.kinds ? `${sel('whenKind', WHEN_KINDS[w.kinds].map(k => [k[0], k[1]]), whenKindOf(w, a.whenKind)[0])}` : ''}
        ${w.nLabel ? `<span class="muted small">${esc(w.nLabel)}</span><input type="number" data-a="whenN" value="${esc(a.whenN ?? 3)}" min="1" max="20" style="width:64px">` : ''}</div>` : ''}
      <div class="ate-ab-row"><input type="text" class="ate-abname" data-a="flavor" value="${esc(a.flavor || '')}" maxlength="40"
        placeholder="Nom de la capacité (facultatif)"></div>
      ${isClass ? `<div class="ate-ab-row"><span class="muted small">Niveau</span>${sel('level', [['1', '1 (dès l\'arrivée)'], ['2', '2'], ['3', '3']], String(a.level || 1))}
        <span class="muted small">la capacité marche à partir de ce niveau de la classe</span></div>` : ''}
      ${isCase ? `<div class="ate-ab-row"><label class="ate-check"><input type="checkbox" data-a="solved"${a.solved ? ' checked' : ''}> Résolue —
        <span class="muted small">ne marche qu'une fois l'affaire résolue</span></label></div>` : ''}
      ${eminenceOk(a.when) && this.form.legendary ? `<div class="ate-ab-row"><label class="ate-check" title="Pour un commandant : la capacité marche aussi quand il est dans la zone de commandement">
        <input type="checkbox" data-a="eminence"${a.eminence ? ' checked' : ''}> Éminence <span class="muted small">(marche aussi depuis la zone de commandement)</span></label></div>` : ''}
      ${a.when === 'chapter' ? `<div class="ate-ab-row"><span class="muted small">Chapitre</span>${sel('chapter', ROMAN.map((r, k) => [String(k + 1), r]), String(a.chapter || 1))}
        ${sel('chapterTo', [['', 'ce chapitre seulement'], ...ROMAN.map((r, k) => [String(k + 1), `jusqu'au chapitre ${r}`]).filter(([v]) => Number(v) > Number(a.chapter || 1))],
          Number(a.chapterTo) > Number(a.chapter || 1) ? String(a.chapterTo) : '')}
        <span class="muted small">la saga avance d'un chapitre à chacun de vos tours ; plusieurs capacités sur un chapitre se suivent</span></div>` : ''}
      ${w.cost ? `<div class="ate-ab-cost"><span class="muted small">Coût</span>${this.manaHtml('ab:' + i)}</div>
        <div class="ate-ab-row"><label class="ate-check"><input type="checkbox" data-a="tap"${a.tap ? ' checked' : ''}> ${symbol('T')} l'engager</label>
        <label class="ate-check"><input type="checkbox" data-a="sac"${a.sac ? ' checked' : ''}> la sacrifier</label></div>
        <div class="ate-ab-row"><label class="ate-check"><input type="checkbox" data-a="tapX"${a.tapX ? ' checked' : ''}> engager</label>
        ${a.tapX ? `<select data-a="tapXN" aria-label="Combien">${TAP_COUNTS.map(([v, l]) => `<option value="${v}"${v === String(a.tapXN || 'X') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          <select data-a="tapXWhat">${TAP_WHAT.map(([v, l]) => `<option value="${v}"${v === (a.tapXWhat || 'token') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          ${a.tapXWhat === 'type' ? `<input type="text" data-a="tapXType" data-typepick readonly value="${esc(a.tapXType || '')}" placeholder="un type : Elf" style="width:120px">` : ''}
          <span class="muted small">dégagés que vous contrôlez${tapCount(a) ? '' : ' (X au choix en jouant, au moins 1)'}</span>` : ''}</div>
        <details class="ate-more ate-costs"${moreCosts || this.costOpen.has(i) ? ' open' : ''} data-costs="${i}"><summary>Autres coûts et restrictions${moreCosts ? ' <b class="ate-kwn">✓</b>' : ''}
          <span class="muted small">— PV, défausse, sacrifice, {Q}, rituel, cimetière…</span></summary>
          <div class="ate-ab-row"><span class="muted small">Payer</span><input type="number" data-a="payLife" value="${esc(a.payLife || 0)}" min="0" max="20" style="width:64px">
            <span class="muted small">points de vie</span><input type="number" data-a="payEnergy" value="${esc(a.payEnergy || 0)}" min="0" max="10" style="width:64px"><span class="muted small">${symbol('E')}</span></div>
          <div class="ate-ab-row"><span class="muted small">Maîtriser l'Eau {N}</span><input type="number" data-a="waterbend" value="${esc(a.waterbend || 0)}" min="0" max="12" style="width:64px">
            <span class="muted small">(engager ses artefacts et créatures aide à payer, {1} chacun)</span></div>
          <div class="ate-ab-row"><span class="muted small">Sacrifier</span>${sel('sacWhat', SAC_WHAT.map(s => [s[0], s[0] ? s[2] : 'rien d\'autre']), a.sacWhat || '')}
            <label class="ate-check"><input type="checkbox" data-a="discardCost" value="card"${a.discardCost === 'card' ? ' checked' : ''}> se défausser d'une carte</label></div>
          <div class="ate-ab-row"><span class="muted small">Exiler</span><input type="number" data-a="exileGY" value="${esc(a.exileGY || 0)}" min="0" max="10" style="width:64px">
            <span class="muted small">cartes de votre cimetière</span></div>
          <div class="ate-ab-row"><span class="muted small">Retirer</span><input type="number" data-a="removeCounters" value="${esc(a.removeCounters || 0)}" min="0" max="10" style="width:64px">
            <span class="muted small">marqueurs</span>${counterSelect('a', 'removeCounterType', a.removeCounterType)}<span class="muted small">de cette carte</span></div>
          <div class="ate-ab-row"><label class="ate-check"><input type="checkbox" data-a="untapQ"${a.untapQ ? ' checked' : ''}> ${symbol('Q')} la dégager</label>
            <label class="ate-check"><input type="checkbox" data-a="sorcery"${a.sorcery ? ' checked' : ''}> seulement comme un rituel</label>
            <label class="ate-check"><input type="checkbox" data-a="oncePerTurn"${a.oncePerTurn ? ' checked' : ''}> une fois par tour</label>
            <label class="ate-check"><input type="checkbox" data-a="yourTurnOnly"${a.yourTurnOnly ? ' checked' : ''}> pendant votre tour</label></div>
          <div class="ate-ab-row"><span class="muted small">S'active</span>${sel('zone', ACT_ZONES.map(z => [z[0], z[2]]), a.zone || '')}
            ${a.zone === 'Graveyard' ? `<label class="ate-check"><input type="checkbox" data-a="exileSelf"${a.exileSelf ? ' checked' : ''}> en l'exilant de votre cimetière</label>` : ''}
            ${a.zone === 'Hand' ? '<span class="muted small">en se défaussant de cette carte</span>' : ''}</div>
        </details>` : ''}
      ${a.when === 'spell' ? `<div class="ate-ab-row"><span class="muted small">Coût en plus</span>${sel('addCost', SPELL_COSTS.map(c => [c[0], c[0] ? c[2] : 'aucun']), a.addCost || '')}
        ${a.addCost === 'payLife' || a.addCost === 'waterbend' ? `<input type="number" data-a="addCostN" value="${esc(a.addCostN || 2)}" min="1" max="20" style="width:64px">` : ''}</div>` : ''}
      ${w.loyalty ? `<div class="ate-ab-row"><span class="muted small">Loyauté</span>${this.loyaltyHtml(a)}<span class="muted small">− pour retirer des marqueurs, + pour en ajouter</span></div>` : ''}
      <div class="ate-ab-row"><select data-a="effect" aria-label="Ce qu'elle fait">${EFFECT_GROUPS.filter(([g]) => effects.some(x => x.group === g)).map(([g, label]) => `<optgroup label="${esc(label)}">${effects
        .filter(x => x.group === g).map(x => `<option value="${x.id}"${x.id === e.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${e.n && !(e.mana && a.mana === 'Symbols') ? (!isStatic && !e.modal && !e.mana && a.amount && a.amount !== 'fixed' ? '<b class="ate-xbadge" title="Nombre calculé">X</b>'
          : `<input type="number" data-a="n" value="${esc(a.n)}" min="0" max="99" style="width:70px" title="Nombre">`) : ''}</div>
      ${e.n && !e.mana && !e.modal && !isStatic ? this.amountRow(a, 'a', a) : ''}
      ${isStatic && e.scope ? `<div class="ate-ab-row"><span class="muted small">Qui</span>${sel('scope', scopesFor(this.form, scope), scope)}</div>` : ''}
      ${e.modal ? this.modesHtml(a) : ''}
      ${this.optionRows(a, e, 'a', i, a.when)}
      ${filterShown ? `<div class="ate-ab-row"><span class="muted small">Créatures</span>
        <input type="text" data-a="ftype" data-typepick readonly value="${esc((a.filter || {}).type || '')}" placeholder="toutes, ou un type : Elf" style="width:170px">
        ${otherShown ? `<label class="ate-check"><input type="checkbox" data-a="fother"${(a.filter || {}).other ? ' checked' : ''}> autres que celle-ci</label>` : ''}</div>` : ''}
      ${isStatic ? this.staticCondHtml(a, e) : ''}
      ${!e.modal && !isStatic ? this.moreHtml(a, i, e) : ''}
    </div>`;
  }

  /**
   * Les réglages propres à un effet (dans une capacité, un mode ou un effet enchaîné) : jeton, mana, mot-clé, type de
   * permanent, type de carte, marqueur, type de sort, X, emblème. attr : « a » (la capacité) ou « sf » (un mode).
   */
  optionRows(h, e, attr, i, when) {
    const sel = (k, list, value) => `<select data-${attr}="${k}">${list.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const row = (label, html) => `<div class="ate-ab-row">${label ? `<span class="muted small">${esc(label)}</span>` : ''}${html}</div>`;
    let out = '';
    if (PLAYER_WHO.has(e.id)) {
      // Le joueur touché : ciblé, chaque adversaire, le joueur défenseur (« Quand elle attaque »), ce joueur…
      const list = whoChoices(e.id, when, this.form);
      const curse = (attachOf(this.form) || {}).kind === 'player';
      const def = curse && PLAYER_EFFECTS.has(e.id) && h.who === undefined ? 'enchanted' : 'target';
      out += row('Joueur', sel('who', list, list.some(x => x[0] === h.who) ? h.who : def));
    }
    if (e.token) {
      out += row('', this.tokenSelectHtml(h, attr));
    }
    if (e.mana) {
      const choices = attr === 'a' ? MANA_CHOICES : MANA_CHOICES.filter(([v]) => v !== 'Symbols');
      out += row('', sel('mana', choices, h.mana || 'Any'));
      if (attr === 'a' && h.mana === 'Symbols') {
        out += `<div class="ate-ab-cost"><span class="muted small">Mana ajouté</span>${this.manaHtml('prod:' + i)}</div>`;
      }
    }
    if (e.keyword) {
      out += row('', sel('keyword', KEYWORDS, h.keyword || 'Flying'));
    }
    if (e.pt) {
      out += row('Quoi', sel('permType', PERM_TYPES.map(t => [t[0], t[2].replace(/ ciblée?$/, '').replace(/^une? /, '')]), h.permType || 'creature'));
    }
    if (e.ct) {
      out += row('Quelle carte', sel('cardKind', CARD_KINDS.map(t => [t[0], t[2]]), h.cardKind || 'card'));
    }
    if (e.sacKind) {
      out += row('Sacrifie', sel('sacKind', SAC_KINDS.map(k => [k[0], k[2]]), h.sacKind || 'creature'));
    }
    if (e.counter) {
      out += row('Marqueurs', sel('counter', COUNTER_TYPES.map(c => [c[0], c[1].replace(/[«»]/g, '').trim()]), h.counter || 'P1P1'));
    }
    if (e.counterEach) {
      const list = [['ALL', 'de chaque type'], ...COUNTER_OPTIONS];
      out += row('Marqueurs', sel('counter', list, list.some(c => c[0] === h.counter) ? h.counter : 'ALL')
        + sel('dcWho', [['you', 'sur vos créatures'], ['all', 'sur toutes les créatures']], h.dcWho || 'you'));
    }
    if (e.anim) {
      out += row('Lesquels', sel('animKind', ANIM_KINDS.map(k => [k[0], k[1]]), h.animKind || 'lands')
        + `<input type="text" data-${attr}="animType" data-typepick readonly value="${esc(h.animType || '')}" placeholder="type de créature (facultatif)" style="width:170px">`
        + (e.anim === 'static' ? '' : sel('animDur', [['eot', 'jusqu\'à la fin du tour'], ['perm', 'pour toujours']], h.animDur || 'eot')));
    }
    if (e.mechWho) {
      out += row('Qui', sel('mechWho', MECH_WHO, MECH_WHO.some(w => w[0] === h.mechWho) ? h.mechWho : when === 'spell' ? 'target' : 'self'));
    }
    if (e.manaKind) {
      out += row('Lesquels', sel('manaKind', MANA_KINDS.map(k => [k[0], k[1]]), h.manaKind || 'lands'));
    }
    if (e.airKind) {
      out += row('Sur', sel('airKind', AIR_KINDS.map(k => [k[0], k[1]]), h.airKind || 'creature'));
    }
    if (e.spellType) {
      out += row('Quels sorts', sel('spellType', SPELL_TYPES.map(t => [t[0], t[2]]), h.spellType || 'all')
        + (h.spellType === 'type' ? `<input type="text" data-${attr}="spellTypeName" data-typepick readonly value="${esc(h.spellTypeName || '')}" placeholder="un type : Elf" style="width:120px">` : ''));
    }
    if (e.amountSel) {
      // +X/+X : par défaut, un marqueur sur elle ; la force et l'endurance (définies) : le nombre de créatures.
      const amount = h.amount && h.amount !== 'fixed' ? h.amount : e.id === 'anthemX' ? 'counters' : 'creatures';
      out += row('X =', sel('amount', AMOUNTS.filter(([v]) => !['fixed', 'tapped', 'xPaid'].includes(v)).map(([v, l]) => [v, l.replace(/^X = /, '')]), amount)
        + (amount === 'typeCount' ? `<input type="text" data-${attr}="amountType" data-typepick readonly value="${esc(h.amountType || '')}" placeholder="un type : Elf" style="width:120px">` : '')
        + (amount === 'counters' ? counterSelect(attr, 'amountCounter', h.amountCounter) : ''));
    }
    if (e.emblem) {
      const em = h.emblem || 'anthem';
      out += row('L\'emblème', sel('emblem', EMBLEMS, em));
      if (['anthem', 'extraLand', 'reduceCost'].includes(em)) {
        out += row('N', `<input type="number" data-${attr}="n" value="${esc(h.n ?? 1)}" min="1" max="20" style="width:70px">`);
      }
      if (em === 'grantKeyword') {
        out += row('', sel('keyword', KEYWORDS, h.keyword || 'Flying'));
      }
    }
    return out;
  }

  /** « Tant que … » d'un effet permanent : la condition, son nombre et son type. */
  staticCondHtml(a) {
    const repl = STATIC_REPLACEMENTS.has(a.effect);
    const list = CONDITIONS.filter(([v]) => !['tappedAtLeast', 'kicked'].includes(v) && !(repl && ['yourTurn', 'notYourTurn'].includes(v)));
    const cond = a.cond || 'none';
    return `<div class="ate-ab-row"><span class="muted small">Tant que</span>
      <select data-a="cond">${list.map(([v, l]) => `<option value="${v}"${v === cond ? ' selected' : ''}>${esc(v === 'none' ? 'Toujours' : l.replace(/^Si /, '').replace(/^S'il /, 'Il '))}</option>`).join('')}</select>
      ${CONDITIONS_N.includes(cond) ? `<input type="number" data-a="condN" value="${esc(a.condN ?? 3)}" min="0" max="99" style="width:70px" title="N">` : ''}
      ${cond === 'control' ? `<input type="text" data-a="condType" data-typepick readonly value="${esc(a.condType || '')}" placeholder="toutes, ou un type" style="width:140px">` : ''}
      ${cond === 'countersAtLeast' ? counterSelect('a', 'condCounter', a.condCounter, 'CHARGE') : ''}</div>`;
  }

  /** Loyauté d'une capacité de planeswalker au doigt (le clavier des téléphones n'a pas toujours le signe moins). */
  loyaltyHtml(a) {
    const v = Math.max(-20, Math.min(20, Math.round(Number(a.loyalty) || 0)));
    const shown = v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0';
    return `<span class="ate-loy"><button data-loy="-1" title="Un de moins"${v <= -20 ? ' disabled' : ''}>−</button>
      <b class="ate-loy-v${v > 0 ? ' up' : v < 0 ? ' down' : ''}">${shown}</b><button data-loy="1" title="Un de plus"${v >= 20 ? ' disabled' : ''}>+</button></span>`;
  }

  /** Jeton créé : ceux d'usage courant et les jetons perso, celui choisi parmi tous ceux de Forge, et « Autre jeton… ». */
  tokenSelectHtml(holder, attr) {
    const list = allTokens();
    const extra = !list.some(t => t[0] === holder.token) && Array.isArray(holder.tokenDef) && holder.tokenDef[0] === holder.token ? [holder.tokenDef] : [];
    return `<select data-${attr}="token">${[...list, ...extra].map(t => `<option value="${esc(t[0])}"${t[0] === holder.token ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}
      <option value="__more">Autre jeton de Forge… (lapin, trésor, tous les jetons)</option></select>`;
  }

  /** Tous les jetons de Forge, à chercher par nom : le choisi devient le jeton créé par la capacité (ou le mode). */
  async pickToken(holder) {
    if (!this.forgeTokens) {
      try {
        this.forgeTokens = await bridge.request('tokenList');
      } catch (err) {
        toast(err.message, {error: true});
        return;
      }
    }
    const list = this.forgeTokens;
    const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const keys = list.map(r => norm(`${r[1]} ${r[3]} ${r[0]}`));
    customBox('Choisir un jeton', (body, footer, close) => {
      body.innerHTML = `<input type="search" class="ate-tok-q" placeholder="Chercher : lapin, trésor, 2/2, vol, vert…">
        <div class="ate-tok-list"></div>`;
      const q = body.querySelector('.ate-tok-q');
      const out = body.querySelector('.ate-tok-list');
      const paint = () => {
        const words = norm(q.value).split(/\s+/).filter(Boolean);
        const hits = list.filter((r, i) => words.every(w => keys[i].includes(w)));
        out.innerHTML = hits.length ? hits.slice(0, 150).map(r => `<button class="ate-tok${r[0] === holder.token ? ' on' : ''}" data-s="${esc(r[0])}">${esc(r[1])}</button>`).join('')
          + (hits.length > 150 ? `<p class="muted small">Et ${hits.length - 150} autres : précise la recherche.</p>` : '')
          : '<p class="muted small">Aucun jeton ne correspond.</p>';
      };
      q.addEventListener('input', debounce(paint, 120));
      paint();
      out.addEventListener('click', (e) => {
        const b = e.target.closest('[data-s]');
        const r = b && list.find(x => x[0] === b.dataset.s);
        if (!r) {
          return;
        }
        holder.token = r[0];
        holder.tokenDef = r;
        close();
        this.renderLeft();
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel);
      setTimeout(() => q.focus(), 50);
    }, {narrow: true});
  }

  /** Un effet dans un encadré : un mode de « Choisissez l'un — » (sub « modes ») ou un effet enchaîné (sub « then »). */
  subEffectHtml(a, m, k, sub, title, canDelete) {
    const effects = modeEffectsFor(a.when, this.form);
    const e = effects.find(x => x.id === m.effect) || effects[0];
    const f = m.filter || {type: '', other: false};
    return `<div class="ate-mode" data-sub="${sub}" data-si="${k}">
      <div class="ate-ab-row ate-mode-head"><b class="small">${esc(title)}</b>
        ${sub === 'modes' && (a.modes || []).length > 1 ? `<button class="ate-mv" data-mvsub="modes" data-si="${k}" data-dir="-1" title="Monter"${k === 0 ? ' disabled' : ''}>▲</button>
          <button class="ate-mv" data-mvsub="modes" data-si="${k}" data-dir="1" title="Descendre"${k === (a.modes || []).length - 1 ? ' disabled' : ''}>▼</button>` : ''}
        ${canDelete ? `<button class="ate-x" data-delsub="${k}" title="Retirer">✕</button>` : ''}</div>
      ${sub === 'modes' ? `<div class="ate-ab-row"><input type="text" class="ate-modename" data-sf="flavor" value="${esc(m.flavor || '')}" maxlength="40"
        placeholder="Nom du mode (facultatif)"></div>` : ''}
      <div class="ate-ab-row"><select data-sf="effect" aria-label="Ce qu'il fait">${EFFECT_GROUPS.filter(([g]) => effects.some(x => x.group === g)).map(([g, label]) => `<optgroup label="${esc(label)}">${effects
        .filter(x => x.group === g).map(x => `<option value="${x.id}"${x.id === e.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${e.n ? (sub === 'then' && !e.mana && m.amount && m.amount !== 'fixed' ? '<b class="ate-xbadge" title="Nombre calculé">X</b>'
          : `<input type="number" data-sf="n" value="${esc(m.n)}" min="0" max="99" style="width:70px" title="Nombre">`) : ''}</div>
      ${sub === 'then' && e.n && !e.mana ? this.amountRow(m, 'sf', a, true) : ''}
      ${this.optionRows(m, e, 'sf', null, a.when)}
      ${e.filter ? `<div class="ate-ab-row"><span class="muted small">Créatures</span>
        <input type="text" data-sf="ftype" data-typepick readonly value="${esc(f.type)}" placeholder="toutes, ou un type : Elf" style="width:170px">
        <label class="ate-check"><input type="checkbox" data-sf="fother"${f.other ? ' checked' : ''}> autres que celle-ci</label></div>` : ''}
      ${sub === 'then' ? this.thenCondHtml(a, m) : ''}
    </div>`;
  }

  /** Condition propre à un effet enchaîné (paliers : « puis, si au moins trois ont été engagés, … »). */
  thenCondHtml(a, m) {
    const tapped = a.when === 'activated' && a.tapX;
    const cond = CONDITIONS_N.includes(m.cond);
    return `<div class="ate-ab-row"><span class="muted small">Seulement</span>
      <select data-sf="cond">${CONDITIONS.filter(([v]) => v !== 'tappedAtLeast' || tapped).map(([v, l]) => `<option value="${v}"${v === (m.cond || 'none') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${cond ? `<input type="number" data-sf="condN" value="${esc(m.condN ?? 3)}" min="0" max="99" style="width:70px" title="N">` : ''}
      ${m.cond === 'control' ? `<input type="text" data-sf="condType" data-typepick readonly value="${esc(m.condType || '')}" placeholder="toutes, ou un type" style="width:140px">` : ''}
      ${m.cond === 'countersAtLeast' ? counterSelect('sf', 'condCounter', m.condCounter, 'CHARGE') : ''}</div>`;
  }

  /** Les modes de « Choisissez l'un — » : chacun son effet et ses réglages ; 2 ou 3 modes. */
  modesHtml(a) {
    const modes = a.modes || [];
    const pick = a.pick || 'one';
    const min = pick === 'two' ? 3 : 2;
    const hint = {one: 'on choisit un des modes', two: 'on choisit deux modes différents', oneOrMore: 'on choisit un mode ou plusieurs (jusqu\'à tous)'}[pick];
    return `<div class="ate-modes">
      <div class="ate-ab-row"><span class="muted small">Combien</span><select data-a="pick">${PICKS.map(([v, l]) => `<option value="${v}"${v === pick ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <p class="muted small">Au moment de jouer, ${hint}.</p>
      ${modes.map((m, k) => this.subEffectHtml(a, m, k, 'modes', `• Mode ${k + 1}`, modes.length > min)).join('')}
      ${modes.length < 3 ? '<button class="btn small" data-addsub="modes">＋ Un autre mode</button>' : ''}</div>`;
  }

  /**
   * Le nombre d'un effet : celui indiqué (N), ou X (payé avec {X} dans le coût, ou calculé pendant la partie : créatures,
   * points de vie perdus…). Un effet enchaîné peut aussi reprendre le même X, ou le nombre de permanents touchés juste avant.
   */
  amountRow(m, key, parent, chained = false) {
    const tapped = parent.when === 'activated' && parent.tapX;
    const list = AMOUNTS.filter(([v]) => v !== 'tapped' || tapped).map(([v, l]) => [v, v === 'fixed' ? 'N : le nombre indiqué' : l]);
    if (chained) {
      list.splice(1, 0, ['same', 'X = le même X que l\'effet principal'], ['prev', 'X = le nombre de permanents détruits, exilés ou sacrifiés juste avant']);
    }
    const v = m.amount || 'fixed';
    return `<div class="ate-ab-row"><span class="muted small">Nombre</span>
      <select data-${key}="amount">${list.map(([o, l]) => `<option value="${o}"${o === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${v === 'typeCount' ? `<input type="text" data-${key}="amountType" data-typepick readonly value="${esc(m.amountType || '')}" placeholder="un type : Elf" style="width:130px">` : ''}
      ${v === 'counters' ? counterSelect(key, 'amountCounter', m.amountCounter) : ''}</div>`;
  }

  /**
   * « Plus d'options » d'une capacité, sans écrire de script : un nombre X calculé pendant la partie, une condition
   * (« seulement si … ») et jusqu'à deux effets enchaînés (« …, puis … »).
   */
  moreHtml(a, i, e) {
    const then = a.then || [];
    const used = (a.cond && a.cond !== 'none') || then.length > 0;
    const open = this.moreOpen.has(i) || used;
    const tapped = a.when === 'activated' && a.tapX;
    const cond = CONDITIONS_N.includes(a.cond);
    return `<details class="ate-more" data-more="${i}"${open ? ' open' : ''}>
      <summary>Effet perso${used ? ' <b class="ate-kwn">✓</b>' : ''} <span class="muted small">— condition, « et puis »</span></summary>
      <div class="ate-ab-row"><span class="muted small">Seulement</span>
        <select data-a="cond">${CONDITIONS.filter(([v]) => v !== 'tappedAtLeast' || tapped).map(([v, l]) => `<option value="${v}"${v === (a.cond || 'none') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        ${cond ? `<input type="number" data-a="condN" value="${esc(a.condN ?? 3)}" min="0" max="99" style="width:70px" title="N">` : ''}
        ${a.cond === 'control' ? `<input type="text" data-a="condType" data-typepick readonly value="${esc(a.condType || '')}" placeholder="toutes, ou un type" style="width:140px">` : ''}
        ${a.cond === 'countersAtLeast' ? counterSelect('a', 'condCounter', a.condCounter, 'CHARGE') : ''}</div>
      <div class="ate-modes">${then.map((m, k) => this.subEffectHtml(a, m, k, 'then', 'Et puis', true)).join('')}
        ${then.length < 2 ? '<button class="btn small" data-addsub="then">＋ Et puis… (un autre effet)</button>' : ''}</div>
    </details>`;
  }

  editClick(e) {
    if (this.pressed()) {
      return;
    }
    // Un champ « un type : Elfe » : le sélecteur de types (au lieu de la liste du téléphone, qui sautait).
    const tp = e.target.closest('input[data-typepick]');
    if (tp) {
      e.preventDefault();
      this.pickTypes({title: tp.dataset.kwv !== undefined ? 'Type de créature' : 'Créatures d\'un type', current: tp.value ? forgeSubtypes(tp.value) : [],
        allowAll: tp.dataset.kwv === undefined, onDone: (list, lang) => {
          tp.value = list.length ? typeLabel(list[0], lang) : '';
          tp.dispatchEvent(new Event('input', {bubbles: true}));
          tp.dispatchEvent(new Event('change', {bubbles: true}));
        }});
      return;
    }
    const b = e.target.closest('button');
    if (!b) {
      return;
    }
    const f = this.form;
    if (b.dataset.subpick !== undefined) {
      this.pickTypes({multi: true, current: forgeSubtypes(f.subtypes), onDone: (list, lang) => this.setSubtypes(list, lang)});
      return;
    }
    if (b.dataset.subdel) {
      // Retirer « Équipement » retire aussi le mot-clé qui le donnait (sinon la carte resterait un équipement).
      const gone = b.dataset.subdel;
      f.keywords = f.keywords.filter(k => keywordOptions(k).sub !== gone);
      this.setSubtypes(forgeSubtypes(f.subtypes).filter(t => t !== gone), this.subLang());
      return;
    }
    const mana = b.closest('[data-mana]');
    if (mana) {
      this.manaClick(mana, b);
      return;
    }
    if (b.dataset.loy) {
      const a = f.abilities[Number(b.closest('[data-ab]').dataset.ab)];
      a.loyalty = Math.max(-20, Math.min(20, Math.round(Number(a.loyalty) || 0) + Number(b.dataset.loy)));
      b.closest('.ate-loy').outerHTML = this.loyaltyHtml(a);
      this.check();
      return;
    }
    if (b.dataset.importFrame !== undefined) {
      this.importFrame();
    } else if (b.dataset.noframe !== undefined) {
      this.frameImg = '';
      this.frameUrl = '';
      this.setLook(this.look().frame === IMPORTED ? {frame: 'modern'} : {});
    } else if (b.dataset.lset !== undefined) {
      this.setLook({set: b.dataset.lset});
    } else if (b.dataset.lrarity !== undefined) {
      this.setLook({rarity: b.dataset.lrarity});
    } else if (b.dataset.newset !== undefined) {
      this.editSet(null, (set) => {
        this.renderLeft();
        this.setLook({set: set.id});
      });
    } else if (b.dataset.lang) {
      this.setLook({lang: b.dataset.lang});
    } else if (b.dataset.frame) {
      this.setLook({frame: b.dataset.frame});
    } else if (b.dataset.fx) {
      this.setLook({fx: b.dataset.fx});
    } else if (b.dataset.tab) {
      this.tab = 'look';
      this.renderLeft();
    } else if (b.dataset.back !== undefined) {
      this.close();
    } else if (b.dataset.mode) {
      const fromLook = this.tab === 'look';
      this.tab = 'edit';
      if (b.dataset.mode === this.mode) {
        if (fromLook) {
          this.renderLeft();
        }
        return;
      }
      if (b.dataset.mode === 'script') {
        if (this.face === 'back') {
          this.switchFace('front');
        }
        this.script = buildScript(this.form);
        this.mode = 'script';
        this.renderLeft();
      } else if (this.formKept()) {
        Object.assign(f, readDisplay(this.script));
        this.mode = 'form';
        this.renderLeft();
      } else {
        confirmBox('Revenir au formulaire ?', 'Les changements faits dans le script seront perdus : le formulaire reprend là où il était.',
          {yes: 'Revenir au formulaire'}).then((yes) => {
          if (yes) {
            Object.assign(f, readDisplay(this.script));
            this.mode = 'form';
            this.formUsed = true;
            this.renderLeft();
          }
        });
      }
    } else if (b.dataset.legendary !== undefined) {
      f.legendary = !f.legendary;
      this.renderLeft();
    } else if (b.dataset.tokenflag !== undefined) {
      f.token = !f.token;
      if (f.token && !f.colors.length) {
        f.colors = [...'WUBRG'].filter(c => costParts(f.cost).some(p => p.includes(c)));
      }
      this.renderLeft();
    } else if (b.dataset.tcolor) {
      const c = b.dataset.tcolor;
      f.colors = f.colors.includes(c) ? f.colors.filter(x => x !== c) : [...f.colors, c];
      this.renderLeft();
    } else if (b.dataset.type) {
      const t = b.dataset.type;
      f.types = f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t];
      this.renderLeft();
    } else if (b.dataset.kw) {
      const k = b.dataset.kw;
      const adding = !f.keywords.includes(k);
      f.keywords = adding ? [...f.keywords, k] : f.keywords.filter(x => x !== k);
      // Enchanter fait une aura, Équipement un équipement, Pilotage un véhicule : le type de carte qui va avec.
      const o = keywordOptions(k);
      if (adding && o.base && !f.types.includes(o.base)) {
        f.types = [...f.types.filter(t => !(o.base === 'Enchantment' && t === 'Creature' && k === 'Enchant') && !(o.base === 'Artifact' && t === 'Creature' && k !== 'Reconfigure' && k !== 'Living metal')), o.base];
      }
      this.renderLeft();
    } else if (b.dataset.template !== undefined) {
      this.pickTemplate();
    } else if (b.dataset.templateAttach !== undefined) {
      this.pickTemplate(true);
    } else if (b.dataset.addcustom !== undefined) {
      // Une capacité vide, ses options d'effet perso ouvertes.
      f.abilities.push(NEW_ABILITY());
      this.moreOpen.add(f.abilities.length - 1);
      this.renderLeft();
      const box = this.root.querySelector(`[data-ab="${f.abilities.length - 1}"]`);
      if (box) {
        box.scrollIntoView({block: 'start', behavior: 'smooth'});
      }
    } else if (b.dataset.addab !== undefined) {
      const a = NEW_ABILITY();
      if (f.types.includes('Instant') || f.types.includes('Sorcery')) {
        a.when = 'spell';
      } else if (f.types.includes('Planeswalker')) {
        a.when = 'loyalty';
      }
      f.abilities.push(a);
      this.renderLeft();
    } else if (b.dataset.addsub || b.dataset.delsub !== undefined) {
      const i = Number(b.closest('[data-ab]').dataset.ab);
      const a = f.abilities[i];
      const sub = b.dataset.addsub || b.closest('[data-sub]').dataset.sub;
      a[sub] = a[sub] || [];
      if (b.dataset.addsub) {
        a[sub].push(newMode('gainLife'));
      } else {
        a[sub].splice(Number(b.dataset.delsub), 1);
      }
      if (sub === 'then') {
        this.moreOpen.add(i);
      }
      this.renderLeft();
    } else if (b.dataset.delab !== undefined) {
      const k = Number(b.dataset.delab);
      f.abilities.splice(k, 1);
      this.reindexOpen((j) => (j === k ? -1 : j > k ? j - 1 : j));
      this.renderLeft();
    } else if (b.dataset.mvab !== undefined) {
      const k = Number(b.dataset.mvab);
      this.moveAbility(k, k + Number(b.dataset.dir));
    } else if (b.dataset.mvsub !== undefined) {
      // Un mode (ou un effet enchaîné) monte ou descend.
      const a = f.abilities[Number(b.closest('[data-ab]').dataset.ab)];
      const list = a[b.dataset.mvsub];
      const k = Number(b.dataset.si);
      const to = k + Number(b.dataset.dir);
      if (list && to >= 0 && to < list.length) {
        list.splice(to, 0, list.splice(k, 1)[0]);
        this.renderLeft();
      }
    } else if (b.dataset.art !== undefined) {
      pickPhoto({w: ART.w, h: ART.h, round: false, title: 'Recadrer l\'illustration', use: 'Utiliser cette illustration'}).then((data) => {
        if (data && this.face === 'back') {
          this.backArt = data;
          this.backArtUrl = data;
          this.check();
        } else if (data) {
          this.art = data;
          this.artUrl = data;
          this.check();
        }
      });
    } else if (b.dataset.noart !== undefined) {
      if (this.face === 'back') {
        this.backArt = '';
        this.backArtUrl = '';
      } else {
        this.art = '';
        this.artUrl = '';
      }
      this.check();
    } else if (b.dataset.face) {
      this.switchFace(b.dataset.face);
    } else if (b.dataset.rland !== undefined) {
      this.form.landText = b.dataset.rland;
      this.root.querySelectorAll('[data-rland]').forEach(x => x.classList.toggle('on', x === b));
      this.check();
    } else if (b.dataset.altArt !== undefined) {
      // Une autre illustration de cette carte perso : une réimpression (la carte enregistrée, sans les changements en cours).
      const entry = (this.data.cards || []).find(c => c.name === this.previous);
      if (entry && entry.card) {
        this.close();
        this.editReprint(null, entry.card);
      }
    } else if (b.dataset.save !== undefined) {
      if (this.reprint) {
        this.saveReprint(b);
      } else {
        this.save(b);
      }
    } else if (b.dataset.delete !== undefined) {
      if (this.reprint) {
        this.removeReprint();
      } else {
        this.remove();
      }
    }
  }

  editInput(e) {
    if (e.target && e.target.dataset && e.target.dataset.rflavor !== undefined) {
      this.form.flavor = e.target.value;
      this.check();
      return;
    }
    const t = e.target;
    if (t.classList.contains('ate-script')) {
      this.script = t.value;
      this.check();
      return;
    }
    if (t.dataset.dfc !== undefined) {
      if (e.type === 'change') {
        this.setDfc(t.value);
      }
      return;
    }
    if (t.dataset.hidetext !== undefined) {
      if (e.type === 'change') {
        this.setLook({hideText: t.checked});
      }
      return;
    }
    if (t.dataset.lartist !== undefined) {
      // L'artiste : écrit dans la carte sans redessiner les vignettes à chaque lettre (la vérification le fera).
      if (e.type === 'input') {
        if (this.mode === 'form') {
          this.form.artist = t.value;
        } else {
          this.script = withDisplay(this.script, {...this.look(), artist: t.value});
          const area = this.root.querySelector('.ate-script');
          if (area) {
            area.value = this.script;
          }
        }
        this.check();
      }
      return;
    }
    if (t.dataset.fcolor !== undefined || t.dataset.ftext !== undefined) {
      if (e.type === 'change') {
        this.setLook(t.dataset.fcolor !== undefined ? {frameColor: t.value} : {frameText: t.value});
      }
      return;
    }
    if (t.classList.contains('ate-kwq')) {
      // Seulement en tapant : la fin de saisie (« change », au toucher d'un mot-clé) ne doit pas redessiner la liste
      // sous le doigt.
      if (e.type !== 'input' || t.value === (this.kwQuery || '')) {
        return;
      }
      this.kwQuery = t.value;
      const box = this.root.querySelector('.ate-kwbox');
      if (box) {
        box.innerHTML = this.keywordChipsHtml(this.form);
      }
      return;
    }
    if (t.dataset.lvl !== undefined) {
      this.form.classCosts = {...(this.form.classCosts || {}), [t.dataset.lvl]: t.value};
      this.repaintMana(t);
      this.check();
      return;
    }
    if (t.dataset.subab !== undefined) {
      // La capacité d'un sous-type (nourriture, indice…) : cochée, elle est sur la carte.
      const off = new Set(this.form.subOff || []);
      if (t.checked) {
        off.delete(t.dataset.subab);
      } else {
        off.add(t.dataset.subab);
      }
      this.form.subOff = [...off];
      this.check();
      return;
    }
    if (t.dataset.case !== undefined) {
      this.form[t.dataset.case] = t.type === 'number' ? Number(t.value) : t.value;
      if (e.type === 'change' && t.dataset.case === 'caseCond') {
        this.renderLeft();
        return;
      }
      this.check();
      return;
    }
    if (t.dataset.kwn !== undefined) {
      this.form.kwValues = {...this.form.kwValues, [`${t.dataset.kwn}#n`]: t.value};
      this.check();
      return;
    }
    if (t.dataset.kwv !== undefined) {
      this.form.kwValues = {...this.form.kwValues, [t.dataset.kwv]: t.type === 'number' ? t.value : t.value};
      this.repaintMana(t);
      this.check();
      return;
    }
    if (t.dataset.k) {
      this.form[t.dataset.k] = t.type === 'number' ? Number(t.value) : t.value;
      if (t.dataset.k === 'subtypes' && e.type === 'change') {
        // Chaque sous-type avec sa mécanique : le mot-clé Équipement, « Enchanter : joueur » pour une malédiction…
        this.subNotes = linkSubtypes(this.form);
        this.renderLeft();
        return;
      }
      this.repaintMana(t);
      this.check();
      return;
    }
    const box = t.closest('[data-ab]');
    if (box && t.dataset.sf) {
      const holder = t.closest('[data-sub]');
      const m = this.form.abilities[Number(box.dataset.ab)][holder.dataset.sub][Number(holder.dataset.si)];
      const k = t.dataset.sf;
      if (k === 'token' && t.value === '__more') {
        t.value = m.token;
        this.pickToken(m);
        return;
      }
      if (k === 'ftype') {
        m.filter = {...(m.filter || {other: false}), type: t.value.trim()};
      } else if (k === 'fother') {
        m.filter = {...(m.filter || {type: ''}), other: t.checked};
      } else {
        m[k] = t.type === 'number' ? Number(t.value) : t.value;
      }
      if (e.type === 'change' && ['effect', 'cond', 'emblem', 'spellType', 'amount'].includes(k)) {
        this.renderLeft();
        return;
      }
      this.check();
      return;
    }
    if (!box || !t.dataset.a) {
      return;
    }
    const a = this.form.abilities[Number(box.dataset.ab)];
    const k = t.dataset.a;
    if (k === 'token' && t.value === '__more') {
      t.value = a.token;
      this.pickToken(a);
      return;
    }
    if (k === 'ftype') {
      a.filter.type = t.value.trim();
    } else if (k === 'fother') {
      a.filter.other = t.checked;
    } else if (t.type === 'checkbox') {
      const v = t.getAttribute('value');
      a[k] = v ? (t.checked ? v : '') : t.checked;
    } else {
      a[k] = t.type === 'number' ? Number(t.value) : t.value;
    }
    this.repaintMana(t);
    if (e.type === 'change' && k === 'when' && a.when === 'static' && (!a.scope || a.scope === 'you')) {
      // Sur un équipement, une aura, une fortification, un effet permanent touche d'abord ce qu'elle équipe ou enchante.
      const at = attachOf(this.form);
      if (at) {
        a.scope = at.scope;
      }
    }
    if (e.type === 'change' && k === 'when' && a.when === 'chapter' && !this.form.types.includes('Enchantment')) {
      // Un chapitre : la carte est une saga (enchantement).
      this.form.types = [...this.form.types.filter(x => x !== 'Creature'), 'Enchantment'];
    }
    if (k === 'mana' && a.mana === 'Symbols' && !costParts(a.manaSymbols).length) {
      a.manaSymbols = '{G}{U}';
    }
    if (e.type === 'change' && ['when', 'chapter', 'effect', 'amount', 'cond', 'tapX', 'tapXN', 'tapXWhat', 'pick', 'mana', 'scope', 'spellType', 'addCost', 'zone', 'emblem'].includes(k)) {
      if (k === 'when' && !effectsFor(a.when, this.form).some(x => x.id === a.effect)) {
        a.effect = effectsFor(a.when, this.form)[0].id;
      }
      if (a.effect === 'modal') {
        // Deux modes pour commencer ; ceux qui ne vont pas avec ce « quand » (un sort ne se régénère pas) changent.
        a.modes = (a.modes && a.modes.length >= 2 ? a.modes : [newMode('draw'), newMode('gainLife')])
          .map(m => (modeEffectsFor(a.when).some(x => x.id === m.effect) ? m : newMode('draw')));
        // « Choisissez deux » : trois modes au moins.
        while (a.pick === 'two' && a.modes.length < 3) {
          a.modes.push(newMode(a.modes.length === 2 ? 'scry' : 'gainLife'));
        }
      }
      if (a.then) {
        a.then = a.then.map(m => (modeEffectsFor(a.when).some(x => x.id === m.effect) ? m : newMode('draw')));
      }
      this.renderLeft();
      return;
    }
    this.check();
  }

  /** Saisie au clavier d'un coût : les symboles au-dessus suivent. */
  repaintMana(input) {
    const box = input.closest('[data-mana]');
    if (box) {
      this.paintMana(box, false);
    }
  }

  async validate() {
    if (this.reprint) {
      this.previewReprint();
      return;
    }
    const token = (this.vToken || 0) + 1;
    this.vToken = token;
    const msg = this.root.querySelector('.ate-msg');
    const preview = this.root.querySelector('.ate-preview');
    if (!msg) {
      return;
    }
    try {
      const r = await bridge.request('customValidate', {script: this.currentScript(), previous: this.previous});
      if (token !== this.vToken) {
        return;
      }
      preview.innerHTML = '';
      // En modifiant le verso : l'aperçu montre le verso (une aventure, une carte préparée : la carte entière).
      const card = this.face === 'back' && r.card.back ? {...r.card.back} : r.card;
      this.lastCard = card;
      this.renderLook();
      const node = cardElement(this.shown(card));
      node.addEventListener('click', () => this.pressed() || showZoom(this.shown(card)));
      preview.appendChild(node);
      preview.classList.remove('stale');
      // Ce que le jeu dirait des sous-types (une leçon sur une créature, une saga sans chapitre…), puis Forge.
      const warnings = [...(this.mode === 'script' ? [] : subtypeIssues(this.form)), ...r.warnings];
      msg.className = 'ate-msg small ' + (warnings.length ? 'warn' : 'ok');
      msg.innerHTML = warnings.length ? warnings.map(esc).join('<br>') : '✓ Forge accepte la carte.';
      this.valid = true;
    } catch (err) {
      if (token !== this.vToken) {
        return;
      }
      preview.classList.add('stale');
      msg.className = 'ate-msg small error';
      msg.textContent = err.message;
      this.valid = false;
    }
  }

  async save(button) {
    button.disabled = true;
    try {
      const kept = this.formKept();
      if (kept && this.mode === 'script') {
        Object.assign(this.form, readDisplay(this.script));
      }
      await bridge.request('customSave', {script: this.currentScript(), previous: this.previous, art: this.art,
        form: kept ? this.full() : null, frameImage: this.frameImg, backArt: this.backArt});
      try {
        if (cleanArtist(this.look().artist)) {
          localStorage.setItem(ARTIST_KEY, cleanArtist(this.look().artist));
        }
      } catch (err) {
        // mémoire du navigateur indisponible : l'artiste ne sera pas repris
      }
      toast(this.form.token ? 'Jeton enregistré : tes cartes perso peuvent le créer, et la triche le propose en partie.'
        : 'Carte enregistrée : elle est dans la recherche et le deck builder.', {title: 'Atelier'});
      this.onChanged();
      this.close();
    } catch (e) {
      toast(e.message, {title: 'Carte refusée', error: true, duration: 7000});
      button.disabled = false;
    }
  }

  async remove() {
    if (!await confirmBox(this.form.token ? 'Supprimer le jeton ?' : 'Supprimer la carte ?', this.form.token
      ? `« ${this.previous} » disparaîtra de l'Atelier. Les cartes qui le créent ne pourront plus être enregistrées sans changer de jeton.`
      : `« ${this.previous} » disparaîtra de l'Atelier et des recherches. Les decks qui la contiennent la perdront au prochain lancement.`,
      {yes: 'Supprimer', danger: true})) {
      return;
    }
    try {
      await bridge.request('customDelete', {name: this.previous});
      this.onChanged();
      this.close();
    } catch (e) {
      toast(e.message, {error: true});
    }
  }
}
