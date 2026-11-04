// Atelier : cartes perso. Une carte se fait par un formulaire (nom, coût, types, force, mots-clés, capacités à choisir
// dans des modèles) ou en écrivant son script de Forge ; Forge la vérifie à chaque changement et l'aperçu montre la
// carte telle qu'elle sera en jeu. Les types de créature inventés (« X-Men ») se déclarent ici : sans ça, Forge ne
// les reconnaît pas et les effets qui les citent ne trouvent aucune carte.

import {bridge} from './bridge.js';
import {cardElement, showZoom} from './cards.js';
import {confirmBox} from './dialogs.js';
import {pickPhoto} from './account.js';
import {debounce, el, esc, toast} from './util.js';
import {CARD_TYPES, KEYWORDS, TOKENS, WHEN, buildScript, effectsFor} from './cardscript.js';

const NEW_CARD = () => ({
  name: '', cost: '', legendary: false, types: ['Creature'], subtypes: '', power: 2, toughness: 2, loyaltyStart: 3,
  keywords: [], abilities: [],
});
const NEW_ABILITY = () => ({when: 'etb', effect: 'draw', n: 1, filter: {type: '', other: false}, token: TOKENS[0][0],
  keyword: 'Flying', cost: '', tap: true, sac: false, loyalty: 1});
/** Illustration : 480 × 352 (le cadre de l'illustration d'une carte). */
const ART = {w: 480, h: 352};

export class Atelier {
  constructor(root, {onChanged = () => {}} = {}) {
    this.root = root;
    this.onChanged = onChanged;
    this.data = null;
  }

  async show() {
    if (this.editing) {
      return;
    }
    this.root.innerHTML = '<div class="page"><h1>Atelier</h1><p class="muted">Chargement…</p></div>';
    try {
      this.data = await bridge.request('customCards');
    } catch (e) {
      this.root.innerHTML = `<div class="page"><h1>Atelier</h1><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    this.renderList();
  }

  // ------------------------------------------------------------------ liste

  renderList() {
    const d = this.data;
    this.root.innerHTML = `<div class="page atelier">
      <div class="ate-top"><h1>Atelier</h1><button class="btn gold" data-new>＋ Nouvelle carte</button></div>
      <p class="muted small">Tes propres cartes, avec leurs effets : Forge les joue comme les vraies (pile, règles, IA). Elles
        se trouvent dans la recherche et le deck builder, et se jouent en Sandbox (pas en Planeswalker).</p>
      <div class="ate-grid">${d.cards.length ? '' : '<p class="muted">Aucune carte perso pour l\'instant.</p>'}</div>
      <h2>Types de créature perso</h2>
      <p class="muted small">Un type inventé (« X-Men ») doit être déclaré ici : Forge ne connaît que les types officiels, et
        un effet qui cite un type inconnu (« chaque X-Men que vous contrôlez ») ne trouverait aucune créature.</p>
      <div class="ate-types">${d.types.map(t => `<span class="ate-type">${esc(t)}<button data-untype="${esc(t)}" title="Retirer">✕</button></span>`).join('')}
        <span class="ate-addtype"><input type="text" placeholder="Nouveau type (un mot)" maxlength="30"><button class="btn small" data-addtype>Ajouter</button></span>
      </div>
    </div>`;
    const grid = this.root.querySelector('.ate-grid');
    for (const c of d.cards) {
      const tile = el(`<div class="ate-tile" data-name="${esc(c.name)}"></div>`);
      tile.appendChild(c.card ? cardElement(c.card) : el(`<div class="mcard"><div class="face"></div></div>`));
      tile.appendChild(el(`<div class="ate-name">${esc(c.name)}</div>`));
      grid.appendChild(tile);
    }
    this.root.onclick = async (e) => {
      const tile = e.target.closest('.ate-tile');
      if (e.target.closest('[data-new]')) {
        this.edit(null);
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
      this.data = await bridge.request('customTypes', {types});
      this.renderList();
      this.onChanged();
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  // ------------------------------------------------------------------ édition

  /** Édite une carte perso (entry) ou en crée une (null). */
  edit(entry) {
    this.editing = true;
    this.previous = entry ? entry.name : null;
    this.art = null;
    this.artUrl = entry && entry.card && entry.card.customArt ? bridge.imageUrl(entry.card.customArt) : '';
    this.form = entry && entry.form ? Object.assign(NEW_CARD(), entry.form) : NEW_CARD();
    this.mode = entry && !entry.form ? 'script' : 'form';
    this.formUsed = this.mode === 'form'; // carte faite au formulaire (une carte en script n'en a pas)
    this.script = entry ? entry.script : '';
    this.root.onclick = null;
    this.root.innerHTML = `<div class="page atelier-edit">
      <div class="ate-top">
        <button class="btn small" data-back>← Retour</button>
        <h1>${entry ? 'Modifier la carte' : 'Nouvelle carte'}</h1>
        <div class="seg ate-mode"><button data-mode="form">Formulaire</button><button data-mode="script">Script Forge</button></div>
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
    this.renderLeft();
  }

  close() {
    this.root.removeEventListener('click', this.onEditClick);
    this.root.removeEventListener('input', this.onEditInput);
    this.root.removeEventListener('change', this.onEditInput);
    this.editing = false;
    this.show();
  }

  /** Le formulaire décrit encore la carte (script ouvert pour le lire, sans le changer) : il est gardé pour la rouvrir. */
  formKept() {
    return this.mode === 'form' || (this.formUsed && this.script.trim() === buildScript(this.form).trim());
  }

  currentScript() {
    return this.mode === 'form' ? buildScript(this.form) : this.script;
  }

  renderLeft() {
    this.root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === this.mode));
    const left = this.root.querySelector('.ate-left');
    if (this.mode === 'script') {
      left.innerHTML = `<p class="muted small">Le script tel que Forge le lit (format des fichiers de cartes de Forge :
        <code>Name:</code>, <code>ManaCost:</code>, <code>Types:</code>, <code>PT:</code>, <code>K:</code>, <code>T:</code>,
        <code>A:</code>, <code>S:</code>, <code>SVar:</code>, <code>Oracle:</code>). Tout ce que Forge sait faire est possible ici.</p>
        <textarea class="ate-script" spellcheck="false">${esc(this.script)}</textarea>`;
      this.check();
      return;
    }
    const f = this.form;
    const types = this.data.creatureTypes || [];
    left.innerHTML = `<datalist id="ate-subtypes">${types.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <label class="ate-field"><span>Nom</span><input type="text" data-k="name" value="${esc(f.name)}" placeholder="Professeur X" maxlength="60"></label>
      <label class="ate-field"><span>Coût de mana</span><input type="text" data-k="cost" value="${esc(f.cost)}" placeholder="2WU ou {2}{W}{U} (hybride : {W/U})"></label>
      <div class="ate-field"><span>Types</span><div class="ate-chips">
        <button class="chip ${f.legendary ? 'on' : ''}" data-legendary>Légendaire</button>
        ${CARD_TYPES.map(([v, l]) => `<button class="chip ${f.types.includes(v) ? 'on' : ''}" data-type="${v}">${l}</button>`).join('')}
      </div></div>
      <label class="ate-field"><span>Sous-types</span><input type="text" data-k="subtypes" list="ate-subtypes" value="${esc(f.subtypes)}" placeholder="Human X-Men (séparés par des espaces)"></label>
      ${f.types.includes('Creature') ? `<div class="ate-field ate-pt"><span>Force / endurance</span>
        <input type="number" data-k="power" value="${esc(f.power)}" min="0" max="99"> / <input type="number" data-k="toughness" value="${esc(f.toughness)}" min="0" max="99"></div>` : ''}
      ${f.types.includes('Planeswalker') ? `<label class="ate-field"><span>Loyauté de départ</span><input type="number" data-k="loyaltyStart" value="${esc(f.loyaltyStart)}" min="1" max="20"></label>` : ''}
      <div class="ate-field"><span>Mots-clés</span><div class="ate-chips">
        ${KEYWORDS.map(([v, l]) => `<button class="chip ${f.keywords.includes(v) ? 'on' : ''}" data-kw="${v}">${l}</button>`).join('')}
      </div></div>
      <div class="ate-field"><span>Capacités</span><div class="ate-abilities">${f.abilities.map((a, i) => this.abilityHtml(a, i)).join('')}</div>
        <button class="btn small" data-addab>＋ Ajouter une capacité</button></div>`;
    this.check();
  }

  abilityHtml(a, i) {
    const w = WHEN.find(x => x.id === a.when) || WHEN[0];
    const effects = effectsFor(a.when);
    const e = effects.find(x => x.id === a.effect) || effects[0];
    const filter = w.filter || e.filter;
    return `<div class="ate-ab panel" data-ab="${i}">
      <div class="ate-ab-row"><select data-a="when">${WHEN.map(x => `<option value="${x.id}"${x.id === a.when ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        <button class="ate-x" data-delab="${i}" title="Retirer cette capacité">✕</button></div>
      ${w.cost ? `<div class="ate-ab-row"><span class="muted small">Coût</span><input type="text" data-a="cost" value="${esc(a.cost)}" placeholder="{1}{R}" style="width:90px">
        <label class="ate-check"><input type="checkbox" data-a="tap"${a.tap ? ' checked' : ''}> {T}</label>
        <label class="ate-check"><input type="checkbox" data-a="sac"${a.sac ? ' checked' : ''}> la sacrifier</label></div>` : ''}
      ${w.loyalty ? `<div class="ate-ab-row"><span class="muted small">Loyauté</span><input type="number" data-a="loyalty" value="${esc(a.loyalty)}" min="-20" max="20" style="width:80px"><span class="muted small">(+1, −2…)</span></div>` : ''}
      <div class="ate-ab-row"><select data-a="effect">${effects.map(x => `<option value="${x.id}"${x.id === e.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        ${e.n ? `<input type="number" data-a="n" value="${esc(a.n)}" min="0" max="99" style="width:70px" title="Nombre">` : ''}</div>
      ${e.token ? `<div class="ate-ab-row"><select data-a="token">${TOKENS.map(t => `<option value="${t[0]}"${t[0] === a.token ? ' selected' : ''}>${esc(t[1])}</option>`).join('')}</select></div>` : ''}
      ${e.keyword ? `<div class="ate-ab-row"><select data-a="keyword">${KEYWORDS.map(([v, l]) => `<option value="${v}"${v === a.keyword ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
      ${filter ? `<div class="ate-ab-row"><span class="muted small">Créatures</span>
        <input type="text" data-a="ftype" list="ate-subtypes" value="${esc(a.filter.type)}" placeholder="toutes, ou un type : X-Men" style="width:170px">
        <label class="ate-check"><input type="checkbox" data-a="fother"${a.filter.other ? ' checked' : ''}> autres que celle-ci</label></div>` : ''}
    </div>`;
  }

  editClick(e) {
    const b = e.target.closest('button');
    if (!b) {
      return;
    }
    const f = this.form;
    if (b.dataset.back !== undefined) {
      this.close();
    } else if (b.dataset.mode) {
      if (b.dataset.mode === this.mode) {
        return;
      }
      if (b.dataset.mode === 'script') {
        this.script = buildScript(f);
        this.mode = 'script';
        this.renderLeft();
      } else if (this.formKept()) {
        this.mode = 'form';
        this.renderLeft();
      } else {
        confirmBox('Revenir au formulaire ?', 'Les changements faits dans le script seront perdus : le formulaire reprend là où il était.',
          {yes: 'Revenir au formulaire'}).then((yes) => {
          if (yes) {
            this.mode = 'form';
            this.formUsed = true;
            this.renderLeft();
          }
        });
      }
    } else if (b.dataset.legendary !== undefined) {
      f.legendary = !f.legendary;
      this.renderLeft();
    } else if (b.dataset.type) {
      const t = b.dataset.type;
      f.types = f.types.includes(t) ? f.types.filter(x => x !== t) : [...f.types, t];
      this.renderLeft();
    } else if (b.dataset.kw) {
      const k = b.dataset.kw;
      f.keywords = f.keywords.includes(k) ? f.keywords.filter(x => x !== k) : [...f.keywords, k];
      this.renderLeft();
    } else if (b.dataset.addab !== undefined) {
      const a = NEW_ABILITY();
      if (f.types.includes('Instant') || f.types.includes('Sorcery')) {
        a.when = 'spell';
      } else if (f.types.includes('Planeswalker')) {
        a.when = 'loyalty';
      }
      f.abilities.push(a);
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
    if (t.dataset.k) {
      this.form[t.dataset.k] = t.type === 'number' ? Number(t.value) : t.value;
      this.check();
      return;
    }
    const box = t.closest('[data-ab]');
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
    if (e.type === 'change' && (k === 'when' || k === 'effect')) {
      if (k === 'when' && !effectsFor(a.when).some(x => x.id === a.effect)) {
        a.effect = effectsFor(a.when)[0].id;
      }
      this.renderLeft();
      return;
    }
    this.check();
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
      const node = cardElement({...r.card, customArtUrl: this.artUrl});
      node.addEventListener('click', () => showZoom({...r.card, customArtUrl: this.artUrl}));
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
      await bridge.request('customSave', {script: this.currentScript(), previous: this.previous, art: this.art,
        form: this.formKept() ? this.form : null});
      toast('Carte enregistrée : elle est dans la recherche et le deck builder.', {title: 'Atelier'});
      this.onChanged();
      this.close();
    } catch (e) {
      toast(e.message, {title: 'Carte refusée', error: true, duration: 7000});
      button.disabled = false;
    }
  }

  async remove() {
    if (!await confirmBox('Supprimer la carte ?', `« ${this.previous} » disparaîtra de l'Atelier et des recherches. Les decks qui la contiennent la perdront au prochain lancement.`,
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
