// Atelier : cartes perso. Une carte se fait par un formulaire (nom, coût, types, force, mots-clés, capacités à choisir
// dans des modèles) ou en écrivant son script de Forge ; Forge la vérifie à chaque changement et l'aperçu montre la
// carte telle qu'elle sera en jeu. Les types de créature inventés se déclarent ici : sans ça, Forge ne
// les reconnaît pas et les effets qui les citent ne trouvent aucune carte.

import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {confirmBox, customBox} from './dialogs.js';
import {pickPhoto} from './account.js';
import {debounce, el, esc, rulesHtml, symbol, toast} from './util.js';
import {AMOUNTS, CARD_TYPES, CONDITIONS, EFFECT_GROUPS, KEYWORDS, TAP_WHAT, KW_ALL, KW_GROUPS, LANGS, MANA_CHOICES, TOKENS, WHEN, WHEN_GROUPS, allTokens, buildScript, costParts,
  effectsFor, keywordValue, modeEffectsFor, newMode, readDisplay, setCustomTokens, templates, withDisplay} from './cardscript.js';
import {FRAMES, FRAME_COLORS, FRAME_TEXT, FX, IMPORTED} from './frames.js';

const NEW_CARD = () => ({
  name: '', cost: '', legendary: false, types: ['Creature'], subtypes: '', power: 2, toughness: 2, loyaltyStart: 3,
  keywords: [], kwValues: {}, abilities: [], frame: 'modern', frameColor: 'auto', lang: 'fr', fx: 'none',
});
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
    this.renderList();
  }

  /** Cartes et jetons perso ; les jetons deviennent des choix de « Créer des jetons ». */
  useData(data) {
    this.data = data;
    setCustomTokens((data.cards || []).filter(c => c.token && c.tokenScript).map(c => ({script: c.tokenScript, name: c.name})));
  }

  // ------------------------------------------------------------------ liste

  renderList() {
    const d = this.data;
    const cards = d.cards.filter(c => !c.token);
    const tokens = d.cards.filter(c => c.token);
    this.root.innerHTML = `<div class="page atelier">
      <div class="ate-top"><h1>Atelier</h1><button class="btn gold" data-new>＋ Nouvelle carte</button></div>
      <p class="muted small">Tes propres cartes, avec leurs effets : Forge les joue comme les vraies (pile, règles, IA). Elles
        se trouvent dans la recherche et le deck builder, et se jouent en Sandbox (pas en Planeswalker).</p>
      <div class="ate-grid ate-cards">${cards.length ? '' : '<p class="muted">Aucune carte perso pour l\'instant.</p>'}</div>
      <div class="ate-top"><h2>Mes jetons</h2><button class="btn" data-new-token>＋ Nouveau jeton</button></div>
      <p class="muted small">Des jetons à toi (couleurs, types, force, mots-clés, capacités, illustration) : tes cartes perso
        les créent (effet « Créer des jetons »), et la triche « Ajouter un jeton » les propose en partie.</p>
      <div class="ate-grid ate-tokens">${tokens.length ? '' : '<p class="muted">Aucun jeton perso pour l\'instant.</p>'}</div>
      <h2>Types de créature perso</h2>
      <p class="muted small">Un type de créature inventé doit être déclaré ici : Forge ne connaît que les types officiels, et
        un effet qui cite un type inconnu (« chaque créature de ce type que vous contrôlez ») ne trouverait aucune créature.</p>
      <div class="ate-types">${d.types.map(t => `<span class="ate-type">${esc(t)}<button data-untype="${esc(t)}" title="Retirer">✕</button></span>`).join('')}
        <span class="ate-addtype"><input type="text" placeholder="Nouveau type (un mot)" maxlength="30"><button class="btn small" data-addtype>Ajouter</button></span>
      </div>
    </div>`;
    for (const [list, grid] of [[cards, this.root.querySelector('.ate-cards')], [tokens, this.root.querySelector('.ate-tokens')]]) {
      for (const c of list) {
        const tile = el(`<div class="ate-tile" data-name="${esc(c.name)}"></div>`);
        tile.appendChild(c.card ? cardElement(c.card) : el(`<div class="mcard"><div class="face"></div></div>`));
        tile.appendChild(el(`<div class="ate-name">${esc(c.name)}</div>`));
        grid.appendChild(tile);
      }
    }
    this.root.onclick = async (e) => {
      if (this.pressed()) {
        return;
      }
      const tile = e.target.closest('.ate-tile');
      if (e.target.closest('[data-new]')) {
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
  edit(entry, {token = false} = {}) {
    this.editing = true;
    this.previous = entry ? entry.name : null;
    this.art = null;
    this.artUrl = entry && entry.card && entry.card.customArt ? bridge.imageUrl(entry.card.customArt) : '';
    // Cadre importé : PNG à envoyer (null : garder celui de la carte, "" : le retirer) et son adresse à l'écran.
    this.frameImg = null;
    this.frameUrl = entry && entry.card && entry.card.customFrame ? bridge.imageUrl(entry.card.customFrame) : '';
    this.form = entry && entry.form ? Object.assign(NEW_CARD(), entry.form) : token ? NEW_TOKEN() : NEW_CARD();
    this.form.token = !!(this.form.token || (entry && entry.token));
    this.form.colors = this.form.colors || [];
    this.form.kwValues = this.form.kwValues || {};
    this.kwOpen = new Set(['combat', ...KW_ALL.filter(k => this.form.keywords.includes(k[0])).map(k => k[3])]);
    this.moreOpen = new Set();
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
          <div class="ate-actions">
            <button class="btn gold" data-save>Enregistrer</button>
            ${entry ? '<button class="btn danger" data-delete>Supprimer</button>' : ''}
          </div>
        </div>
      </div>
    </div>`;
    this.check = debounce(() => this.validate(), 350);
    this.root.addEventListener('click', this.onEditClick = (e) => this.editClick(e));
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
    this.root.removeEventListener('click', this.onEditClick);
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
    return this.mode === 'form' || (this.formUsed && bare(this.script) === bare(buildScript(this.form)));
  }

  currentScript() {
    return this.mode === 'form' ? buildScript(this.form) : this.script;
  }

  /** Présentation de la carte : celle du formulaire, ou celle écrite dans le script. */
  look() {
    return this.mode === 'form' ? {frame: this.form.frame, frameColor: this.form.frameColor, lang: this.form.lang, frameText: this.form.frameText || 'dark', fx: this.form.fx || 'none'}
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

  lookHtml() {
    return `<div class="ate-field ate-look"><span>Présentation</span>
      <div class="ate-look-row">
        <div class="seg ate-lang">${LANGS.map(([v, l]) => `<button data-lang="${v}">${l}</button>`).join('')}</div>
        <label class="ate-fcolor" data-fcolor-box>Couleur du cadre <select data-fcolor>${FRAME_COLORS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="ate-fcolor" data-ftext-box>Texte <select data-ftext>${FRAME_TEXT.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      </div>
      <div class="ate-frames"></div>
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
    return {...card, customArt: null, customArtUrl: this.artUrl, customFrame: null, customFrameUrl: this.frameUrl};
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
      left.innerHTML = this.lookHtml();
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
    const types = this.data.creatureTypes || [];
    left.innerHTML = `<datalist id="ate-subtypes">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <label class="ate-field"><span>Nom</span><input type="text" data-k="name" value="${esc(f.name)}" placeholder="Professeur X" maxlength="60"></label>
      ${f.token ? `<div class="ate-field"><span>Couleurs du jeton</span><div class="ate-mana-pad ate-tcolors">${TOKEN_COLORS.map(([c, l]) =>
        `<button class="ate-pip${f.colors.includes(c) ? ' first' : ''}" data-tcolor="${c}" title="${l}">${symbol(c)}</button>`).join('')}
        <span class="muted small">${f.colors.length ? '' : 'Incolore'}</span></div></div>` : `<div class="ate-field"><span>Coût de mana</span>${this.manaHtml('form')}</div>`}
      <div class="ate-field"><span>Types</span><div class="ate-chips">
        <button class="chip ${f.token ? 'on' : ''}" data-tokenflag title="Un jeton : pas de coût, créé par les capacités">Jeton</button>
        <button class="chip ${f.legendary ? 'on' : ''}" data-legendary>Légendaire</button>
        ${CARD_TYPES.map(([v, l]) => `<button class="chip ${f.types.includes(v) ? 'on' : ''}" data-type="${v}">${l}</button>`).join('')}
      </div></div>
      <label class="ate-field"><span>Sous-types</span><input type="text" data-k="subtypes" list="ate-subtypes" value="${esc(f.subtypes)}" placeholder="Human Wizard (séparés par des espaces)"></label>
      ${f.types.includes('Creature') ? `<div class="ate-field ate-pt"><span>Force / endurance</span>
        <input type="number" data-k="power" value="${esc(f.power)}" min="0" max="99"> / <input type="number" data-k="toughness" value="${esc(f.toughness)}" min="0" max="99"></div>` : ''}
      ${f.types.includes('Planeswalker') ? `<label class="ate-field"><span>Loyauté de départ</span><input type="number" data-k="loyaltyStart" value="${esc(f.loyaltyStart)}" min="1" max="20"></label>` : ''}
      <div class="ate-field"><span>Mots-clés</span>${this.keywordsHtml(f)}</div>
      <div class="ate-field"><span>Capacités</span><div class="ate-abilities">${f.abilities.map((a, i) => this.abilityHtml(a, i)).join('')}</div>
        <div class="ate-add"><button class="btn small gold" data-template>＋ Capacité toute prête…</button>
        <button class="btn small" data-addab>＋ Capacité vide</button>
        <button class="btn small" data-addcustom title="Une capacité avec ses options ouvertes : nombre X, condition, « et puis »">＋ Effet perso</button></div></div>`;
    this.renderLook();
    this.check();
  }

  /** Mots-clés par groupes repliables, puis la valeur de ceux qui en ont une (Annihilateur 2, Recyclage {2}…). */
  keywordsHtml(f) {
    const groups = KW_GROUPS.map(([g, label]) => {
      const list = KW_ALL.filter(k => k[3] === g);
      const on = list.filter(k => f.keywords.includes(k[0])).length;
      return `<details class="ate-kwg" data-kwg="${g}"${this.kwOpen.has(g) ? ' open' : ''}>
        <summary>${esc(label)}${on ? ` <b class="ate-kwn">${on}</b>` : ''}</summary>
        <div class="ate-chips">${list.map(k => `<button class="chip ${f.keywords.includes(k[0]) ? 'on' : ''}" data-kw="${esc(k[0])}">${esc(k[1])}</button>`).join('')}</div>
      </details>`;
    }).join('');
    const valued = KW_ALL.filter(k => k[4] && f.keywords.includes(k[0]));
    const values = valued.map((k) => {
      if (k[4] === 'cost') {
        return `<div class="ate-kwv-row"><span class="muted small">${esc(k[1])}</span>${this.manaHtml('kw:' + k[0])}</div>`;
      }
      return `<label class="ate-kwv-row ate-kwv-n"><span class="muted small">${esc(k[1])}${k[4] === 'gen' ? ' (coût générique)' : ''}</span>
        <input type="number" data-kwv="${esc(k[0])}" value="${esc(keywordValue(f, k[0]))}" min="${k[4] === 'gen' ? 0 : 1}" max="20"></label>`;
    }).join('');
    return `<div class="ate-kwgs">${groups}</div>${values ? `<div class="ate-kwv">${values}</div>` : ''}`;
  }

  /** Type proposé dans les capacités toutes prêtes : un type perso de la carte, sinon son dernier sous-type. */
  guessType() {
    const subs = String(this.form.subtypes || '').trim().split(/\s+/).filter(Boolean);
    const custom = (this.data && this.data.types) || [];
    return subs.find(t => custom.includes(t)) || subs[subs.length - 1] || '';
  }

  /** Liste de phrases toutes faites ; celle qu'on touche devient une capacité du formulaire, à ajuster ensuite. */
  pickTemplate() {
    const list = templates(this.guessType());
    customBox('Capacité toute prête', (body, footer, close) => {
      body.innerHTML = `<p class="muted small">Touche une phrase : elle s'ajoute aux capacités, et tu peux ensuite changer le type, le mot-clé ou le nombre.</p>
        <div class="ate-templates">${list.map((t, i) => `<button class="ate-template" data-i="${i}">${rulesHtml(t.label)}</button>`).join('')}</div>`;
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
    if (target.startsWith('kw:')) {
      return keywordValue(this.form, target.slice(3)) || '';
    }
    return target === 'form' ? this.form.cost : (this.form.abilities[Number(target.slice(3))] || {}).cost || '';
  }

  setManaValue(target, value) {
    if (target === 'form') {
      this.form.cost = value;
    } else if (target.startsWith('kw:')) {
      this.form.kwValues = {...this.form.kwValues, [target.slice(3)]: value};
    } else {
      this.form.abilities[Number(target.slice(3))].cost = value;
    }
  }

  /** Sélecteur de coût : le coût en symboles (toucher un symbole le retire), les boutons pour en ajouter. */
  manaHtml(target) {
    const value = this.manaValue(target);
    const key = target === 'form' ? 'data-k="cost"' : target.startsWith('kw:') ? `data-kwv="${esc(target.slice(3))}"` : 'data-a="cost"';
    return `<div class="ate-mana" data-mana="${esc(target)}">
      <div class="ate-mana-show">${this.manaShowHtml(value)}</div>
      <div class="ate-mana-pad">${this.manaPadHtml(value, target)}</div>
      <details class="ate-mana-kb"${simpleCost(value) ? '' : ' open'}><summary class="muted small">Saisie au clavier</summary>
        <input type="text" ${key} value="${esc(value)}" placeholder="2WU ou {2}{W}{U} ; hybride {W/U}, phyrexian {W/P}"></details>
    </div>`;
  }

  manaShowHtml(value) {
    const parts = costParts(value);
    if (!parts.length) {
      return '<span class="muted small">Pas de coût : touche les symboles en dessous.</span>';
    }
    return parts.map((p, i) => `<button class="ate-pip-on" data-pipat="${i}" title="Retirer ce symbole">${symbol(p)}</button>`).join('')
      + '<button class="ate-mana-clear" data-pipclear title="Tout effacer">✕</button>';
  }

  manaPadHtml(value, target) {
    const {generic} = costModel(value);
    const hyb = this.hyb && this.hyb.target === target ? this.hyb : null;
    return PIPS.map(([p, label]) => {
      const off = hyb && !'WUBRG'.includes(p);
      return `<button class="ate-pip${hyb && hyb.first === p ? ' first' : ''}" data-pip="${p}" title="${label}"${off ? ' disabled' : ''}>${symbol(p)}</button>`;
    }).join('')
      + `<span class="ate-gen" title="Mana générique"><button data-gen="-1" title="Un de moins"${generic ? '' : ' disabled'}>−</button>${symbol(String(generic))}`
      + `<button data-gen="1" title="Un de plus"${generic < GENERIC_MAX ? '' : ' disabled'}>+</button></span>`
      + `<button class="chip ate-hyb${hyb ? ' on' : ''}" data-hybrid title="Symbole à deux couleurs">Hybride</button>`
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
    box.querySelector('.ate-mana-show').innerHTML = this.manaShowHtml(value);
    box.querySelector('.ate-mana-pad').innerHTML = this.manaPadHtml(value, target);
    if (input) {
      box.querySelector('.ate-mana-kb input').value = value;
    }
  }

  abilityHtml(a, i) {
    const w = WHEN.find(x => x.id === a.when) || WHEN[0];
    const effects = effectsFor(a.when);
    const e = effects.find(x => x.id === a.effect) || effects[0];
    const filter = w.filter || e.filter;
    return `<div class="ate-ab panel" data-ab="${i}">
      <div class="ate-ab-row"><select data-a="when">${WHEN_GROUPS.map(([kind, label]) => `<optgroup label="${esc(label)}">${WHEN.filter(x => x.kind === kind)
        .map(x => `<option value="${x.id}"${x.id === a.when ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select>
        <button class="ate-x" data-delab="${i}" title="Retirer cette capacité">✕</button></div>
      ${w.cost ? `<div class="ate-ab-cost"><span class="muted small">Coût</span>${this.manaHtml('ab:' + i)}</div>
        <div class="ate-ab-row"><label class="ate-check"><input type="checkbox" data-a="tap"${a.tap ? ' checked' : ''}> ${symbol('T')} l'engager</label>
        <label class="ate-check"><input type="checkbox" data-a="sac"${a.sac ? ' checked' : ''}> la sacrifier</label></div>
        <div class="ate-ab-row"><label class="ate-check"><input type="checkbox" data-a="tapX"${a.tapX ? ' checked' : ''}> engager X</label>
        ${a.tapX ? `<select data-a="tapXWhat">${TAP_WHAT.map(([v, l]) => `<option value="${v}"${v === (a.tapXWhat || 'token') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
          ${a.tapXWhat === 'type' ? `<input type="text" data-a="tapXType" list="ate-subtypes" value="${esc(a.tapXType || '')}" placeholder="un type : Elf" style="width:120px">` : ''}
          <span class="muted small">dégagés que vous contrôlez (X au choix en jouant)</span>` : ''}</div>` : ''}
      ${w.loyalty ? `<div class="ate-ab-row"><span class="muted small">Loyauté</span><input type="number" data-a="loyalty" value="${esc(a.loyalty)}" min="-20" max="20" style="width:80px"><span class="muted small">(+1, −2…)</span></div>` : ''}
      <div class="ate-ab-row"><select data-a="effect">${EFFECT_GROUPS.filter(([g]) => effects.some(x => x.group === g)).map(([g, label]) => `<optgroup label="${esc(label)}">${effects
        .filter(x => x.group === g).map(x => `<option value="${x.id}"${x.id === e.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${e.n ? `<input type="number" data-a="n" value="${esc(a.n)}" min="0" max="99" style="width:70px" title="Nombre">` : ''}</div>
      ${e.modal ? this.modesHtml(a) : ''}
      ${e.token ? `<div class="ate-ab-row"><select data-a="token">${allTokens().map(t => `<option value="${esc(t[0])}"${t[0] === a.token ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></div>` : ''}
      ${e.mana ? `<div class="ate-ab-row"><select data-a="mana">${MANA_CHOICES.map(([v, l]) => `<option value="${v}"${v === (a.mana || 'Any') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
      ${e.keyword ? `<div class="ate-ab-row"><select data-a="keyword">${KEYWORDS.map(([v, l]) => `<option value="${v}"${v === a.keyword ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
      ${filter ? `<div class="ate-ab-row"><span class="muted small">Créatures</span>
        <input type="text" data-a="ftype" list="ate-subtypes" value="${esc(a.filter.type)}" placeholder="toutes, ou un type : Elf" style="width:170px">
        <label class="ate-check"><input type="checkbox" data-a="fother"${a.filter.other ? ' checked' : ''}> autres que celle-ci</label></div>` : ''}
      ${!e.modal && a.when !== 'static' ? this.moreHtml(a, i, e) : ''}
    </div>`;
  }

  /** Un effet dans un encadré : un mode de « Choisissez l'un — » (sub « modes ») ou un effet enchaîné (sub « then »). */
  subEffectHtml(a, m, k, sub, title, canDelete) {
    const effects = modeEffectsFor(a.when);
    const e = effects.find(x => x.id === m.effect) || effects[0];
    const f = m.filter || {type: '', other: false};
    return `<div class="ate-mode" data-sub="${sub}" data-si="${k}">
      <div class="ate-ab-row ate-mode-head"><b class="small">${esc(title)}</b>
        ${canDelete ? `<button class="ate-x" data-delsub="${k}" title="Retirer">✕</button>` : ''}</div>
      <div class="ate-ab-row"><select data-sf="effect">${EFFECT_GROUPS.filter(([g]) => effects.some(x => x.group === g)).map(([g, label]) => `<optgroup label="${esc(label)}">${effects
        .filter(x => x.group === g).map(x => `<option value="${x.id}"${x.id === e.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select>
        ${e.n ? `<input type="number" data-sf="n" value="${esc(m.n)}" min="0" max="99" style="width:70px" title="Nombre">` : ''}</div>
      ${e.token ? `<div class="ate-ab-row"><select data-sf="token">${allTokens().map(t => `<option value="${esc(t[0])}"${t[0] === m.token ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></div>` : ''}
      ${e.mana ? `<div class="ate-ab-row"><select data-sf="mana">${MANA_CHOICES.map(([v, l]) => `<option value="${v}"${v === (m.mana || 'Any') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
      ${e.keyword ? `<div class="ate-ab-row"><select data-sf="keyword">${KEYWORDS.map(([v, l]) => `<option value="${v}"${v === m.keyword ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
      ${e.filter ? `<div class="ate-ab-row"><span class="muted small">Créatures</span>
        <input type="text" data-sf="ftype" list="ate-subtypes" value="${esc(f.type)}" placeholder="toutes, ou un type : Elf" style="width:170px">
        <label class="ate-check"><input type="checkbox" data-sf="fother"${f.other ? ' checked' : ''}> autres que celle-ci</label></div>` : ''}
      ${sub === 'then' ? this.thenCondHtml(a, m) : ''}
    </div>`;
  }

  /** Condition propre à un effet enchaîné (paliers : « puis, si au moins trois ont été engagés, … »). */
  thenCondHtml(a, m) {
    const tapped = a.when === 'activated' && a.tapX;
    const cond = m.cond && m.cond !== 'none';
    return `<div class="ate-ab-row"><span class="muted small">Seulement</span>
      <select data-sf="cond">${CONDITIONS.filter(([v]) => v !== 'tappedAtLeast' || tapped).map(([v, l]) => `<option value="${v}"${v === (m.cond || 'none') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${cond ? `<input type="number" data-sf="condN" value="${esc(m.condN ?? 3)}" min="0" max="99" style="width:70px" title="N">` : ''}
      ${m.cond === 'control' ? `<input type="text" data-sf="condType" list="ate-subtypes" value="${esc(m.condType || '')}" placeholder="toutes, ou un type" style="width:140px">` : ''}</div>`;
  }

  /** Les modes de « Choisissez l'un — » : chacun son effet et ses réglages ; 2 ou 3 modes. */
  modesHtml(a) {
    const modes = a.modes || [];
    return `<div class="ate-modes"><p class="muted small">Au moment de jouer, on choisit un des modes.</p>
      ${modes.map((m, k) => this.subEffectHtml(a, m, k, 'modes', `• Mode ${k + 1}`, modes.length > 2)).join('')}
      ${modes.length < 3 ? '<button class="btn small" data-addsub="modes">＋ Un autre mode</button>' : ''}</div>`;
  }

  /**
   * « Plus d'options » d'une capacité, sans écrire de script : un nombre X calculé pendant la partie, une condition
   * (« seulement si … ») et jusqu'à deux effets enchaînés (« …, puis … »).
   */
  moreHtml(a, i, e) {
    const then = a.then || [];
    const used = (a.amount && a.amount !== 'fixed') || (a.cond && a.cond !== 'none') || then.length > 0;
    const open = this.moreOpen.has(i) || used;
    const tapped = a.when === 'activated' && a.tapX;
    const amounts = AMOUNTS.filter(([v]) => v !== 'tapped' || tapped);
    const amount = e.n && !e.mana ? `<div class="ate-ab-row"><span class="muted small">Nombre</span>
        <select data-a="amount">${amounts.map(([v, l]) => `<option value="${v}"${v === (a.amount || 'fixed') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        ${a.amount === 'typeCount' ? `<input type="text" data-a="amountType" list="ate-subtypes" value="${esc(a.amountType || '')}" placeholder="un type : Elf" style="width:130px">` : ''}</div>` : '';
    const cond = a.cond && a.cond !== 'none';
    return `<details class="ate-more" data-more="${i}"${open ? ' open' : ''}>
      <summary>Effet perso${used ? ' <b class="ate-kwn">✓</b>' : ''} <span class="muted small">— nombre X, condition, « et puis »</span></summary>
      ${amount}
      <div class="ate-ab-row"><span class="muted small">Seulement</span>
        <select data-a="cond">${CONDITIONS.filter(([v]) => v !== 'tappedAtLeast' || tapped).map(([v, l]) => `<option value="${v}"${v === (a.cond || 'none') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
        ${cond ? `<input type="number" data-a="condN" value="${esc(a.condN ?? 3)}" min="0" max="99" style="width:70px" title="N">` : ''}
        ${a.cond === 'control' ? `<input type="text" data-a="condType" list="ate-subtypes" value="${esc(a.condType || '')}" placeholder="toutes, ou un type" style="width:140px">` : ''}</div>
      <div class="ate-modes">${then.map((m, k) => this.subEffectHtml(a, m, k, 'then', 'Et puis', true)).join('')}
        ${then.length < 2 ? '<button class="btn small" data-addsub="then">＋ Et puis… (un autre effet)</button>' : ''}</div>
    </details>`;
  }

  editClick(e) {
    if (this.pressed()) {
      return;
    }
    const b = e.target.closest('button');
    if (!b) {
      return;
    }
    const f = this.form;
    const mana = b.closest('[data-mana]');
    if (mana) {
      this.manaClick(mana, b);
      return;
    }
    if (b.dataset.importFrame !== undefined) {
      this.importFrame();
    } else if (b.dataset.noframe !== undefined) {
      this.frameImg = '';
      this.frameUrl = '';
      this.setLook(this.look().frame === IMPORTED ? {frame: 'modern'} : {});
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
        this.script = buildScript(f);
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
      f.keywords = f.keywords.includes(k) ? f.keywords.filter(x => x !== k) : [...f.keywords, k];
      this.renderLeft();
    } else if (b.dataset.template !== undefined) {
      this.pickTemplate();
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
      f.abilities.splice(Number(b.dataset.delab), 1);
      this.renderLeft();
    } else if (b.dataset.art !== undefined) {
      pickPhoto({w: ART.w, h: ART.h, round: false, title: 'Recadrer l\'illustration', use: 'Utiliser cette illustration'}).then((data) => {
        if (data) {
          this.art = data;
          this.artUrl = data;
          this.check();
        }
      });
    } else if (b.dataset.noart !== undefined) {
      this.art = '';
      this.artUrl = '';
      this.check();
    } else if (b.dataset.save !== undefined) {
      this.save(b);
    } else if (b.dataset.delete !== undefined) {
      this.remove();
    }
  }

  editInput(e) {
    const t = e.target;
    if (t.classList.contains('ate-script')) {
      this.script = t.value;
      this.check();
      return;
    }
    if (t.dataset.fcolor !== undefined || t.dataset.ftext !== undefined) {
      if (e.type === 'change') {
        this.setLook(t.dataset.fcolor !== undefined ? {frameColor: t.value} : {frameText: t.value});
      }
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
      this.repaintMana(t);
      this.check();
      return;
    }
    const box = t.closest('[data-ab]');
    if (box && t.dataset.sf) {
      const holder = t.closest('[data-sub]');
      const m = this.form.abilities[Number(box.dataset.ab)][holder.dataset.sub][Number(holder.dataset.si)];
      const k = t.dataset.sf;
      if (k === 'ftype') {
        m.filter = {...(m.filter || {other: false}), type: t.value.trim()};
      } else if (k === 'fother') {
        m.filter = {...(m.filter || {type: ''}), other: t.checked};
      } else {
        m[k] = t.type === 'number' ? Number(t.value) : t.value;
      }
      if (e.type === 'change' && (k === 'effect' || k === 'cond')) {
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
    if (k === 'ftype') {
      a.filter.type = t.value.trim();
    } else if (k === 'fother') {
      a.filter.other = t.checked;
    } else if (t.type === 'checkbox') {
      a[k] = t.checked;
    } else {
      a[k] = t.type === 'number' ? Number(t.value) : t.value;
    }
    this.repaintMana(t);
    if (e.type === 'change' && ['when', 'effect', 'amount', 'cond', 'tapX', 'tapXWhat'].includes(k)) {
      if (k === 'when' && !effectsFor(a.when).some(x => x.id === a.effect)) {
        a.effect = effectsFor(a.when)[0].id;
      }
      if (a.effect === 'modal') {
        // Deux modes pour commencer ; ceux qui ne vont pas avec ce « quand » (un sort ne se régénère pas) changent.
        a.modes = (a.modes && a.modes.length >= 2 ? a.modes : [newMode('draw'), newMode('gainLife')])
          .map(m => (modeEffectsFor(a.when).some(x => x.id === m.effect) ? m : newMode('draw')));
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
      this.lastCard = r.card;
      this.renderLook();
      const node = cardElement(this.shown(r.card));
      node.addEventListener('click', () => this.pressed() || showZoom(this.shown(r.card)));
      preview.appendChild(node);
      preview.classList.remove('stale');
      msg.className = 'ate-msg small ' + (r.warnings.length ? 'warn' : 'ok');
      msg.innerHTML = r.warnings.length ? r.warnings.map(esc).join('<br>') : '✓ Forge accepte la carte.';
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
        form: kept ? this.form : null, frameImage: this.frameImg});
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
