// Fenêtre de la pile : flottante, déplaçable au doigt ou à la souris, réductible en pastille,
// et réglable (taille, opacité, mode compact, ouverture automatique). Réglages gardés sur l'appareil.

import {el, prefs} from './util.js';

const DEFAULTS = {x: null, y: null, size: null, opacity: 1, compact: false, autoOpen: true, minimized: false};
const SIZES = {s: 200, m: 260, l: 340};

function load() {
  const saved = prefs.get('stackPanel');
  return {...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {})};
}

export class StackPanel {
  /**
   * @param table     conteneur de la partie (la fenêtre reste dans ses limites)
   * @param anchor    zone près de laquelle la fenêtre s'ouvre par défaut (le plateau)
   * @param pillHost  où mettre la pastille « Pile (n) » quand la fenêtre est réduite
   */
  constructor(table, {anchor, pillHost}) {
    this.table = table;
    this.anchor = anchor || table;
    this.settings = load();
    this.lastTop = null;
    this.count = 0;
    this.node = el(`<div class="stack-panel hidden">
      <header class="sp-head" title="Glisser pour déplacer la pile">
        <span class="sp-grip">⠿</span>
        <span class="sp-title">Pile</span>
        <button class="sp-btn" data-sp="settings" title="Réglages de la pile">⚙</button>
        <button class="sp-btn" data-sp="min" title="Masquer la pile (la pastille « Pile » la rouvre)">—</button>
      </header>
      <div class="sp-settings hidden"></div>
      <div class="sp-items"></div>
    </div>`);
    this.pill = el('<button class="stack-pill hidden" title="Afficher la pile"></button>');
    table.appendChild(this.node);
    (pillHost || table).appendChild(this.pill);
    this.items = this.node.querySelector('.sp-items');
    this.bind();
    this.apply();
  }

  save() {
    prefs.set('stackPanel', this.settings);
  }

  /** Applique taille, opacité, mode compact et position. */
  apply() {
    const s = this.settings;
    if (!SIZES[s.size]) {
      // Par défaut : petite sur téléphone, moyenne ailleurs.
      s.size = this.anchor.clientWidth && this.anchor.clientWidth < 700 ? 's' : 'm';
    }
    this.node.style.setProperty('--sp-width', SIZES[s.size] + 'px');
    this.node.style.opacity = String(s.opacity);
    this.node.classList.toggle('compact', !!s.compact);
    this.node.dataset.size = s.size;
    this.place();
  }

  /** Position : celle choisie par l'utilisateur (fraction de l'écran), sinon à droite du plateau, centrée. */
  place() {
    if (this.dragging) {
      return; // une mise à jour de la partie pendant le glissement ne ramène pas la fenêtre en arrière
    }
    const t = this.table.getBoundingClientRect();
    const a = this.anchor.getBoundingClientRect();
    const w = this.node.offsetWidth || SIZES[this.settings.size];
    const h = this.node.offsetHeight || 120;
    let x = this.settings.x === null ? a.right - t.left - w - 10 : this.settings.x * t.width;
    let y = this.settings.y === null ? a.top - t.top + (a.height - h) / 2 - 20 : this.settings.y * t.height;
    x = Math.max(4, Math.min(t.width - w - 4, x));
    y = Math.max(4, Math.min(t.height - Math.min(h, 60) - 4, y));
    this.node.style.left = x + 'px';
    this.node.style.top = y + 'px';
  }

  bind() {
    // Déplacement par la barre de titre.
    const head = this.node.querySelector('.sp-head');
    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.sp-btn')) {
        return;
      }
      const r = this.node.getBoundingClientRect();
      drag = {dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId};
      this.dragging = true;
      head.setPointerCapture(e.pointerId);
      this.node.classList.add('dragging');
      e.preventDefault();
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      const t = this.table.getBoundingClientRect();
      const x = Math.max(4, Math.min(t.width - this.node.offsetWidth - 4, e.clientX - t.left - drag.dx));
      const y = Math.max(4, Math.min(t.height - 40, e.clientY - t.top - drag.dy));
      this.node.style.left = x + 'px';
      this.node.style.top = y + 'px';
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      drag = null;
      this.dragging = false;
      this.node.classList.remove('dragging');
      const t = this.table.getBoundingClientRect();
      this.settings.x = parseFloat(this.node.style.left) / t.width;
      this.settings.y = parseFloat(this.node.style.top) / t.height;
      this.save();
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);

    this.node.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sp]');
      if (btn) {
        e.stopPropagation();
        if (btn.dataset.sp === 'min') {
          this.setMinimized(true);
        } else if (btn.dataset.sp === 'settings') {
          this.toggleSettings();
        }
        return;
      }
      if (e.target.closest('.sp-settings')) {
        e.stopPropagation();
      }
      // Les clics sur les éléments de la pile sont gérés par le plateau (après l'appui long).
    });
    this.pill.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMinimized(false);
    });
  }

  setMinimized(value) {
    this.settings.minimized = value;
    this.save();
    this.refreshVisibility();
  }

  refreshVisibility() {
    const empty = this.count === 0;
    this.node.classList.toggle('hidden', empty || this.settings.minimized);
    this.pill.classList.toggle('hidden', empty || !this.settings.minimized);
    this.pill.textContent = `Pile (${this.count}) ▸`;
    if (!this.node.classList.contains('hidden')) {
      this.place();
    }
  }

  toggleSettings() {
    const box = this.node.querySelector('.sp-settings');
    if (!box.classList.contains('hidden')) {
      box.classList.add('hidden');
      return;
    }
    const s = this.settings;
    box.innerHTML = `
      <div class="sp-row"><span>Taille</span><span class="seg">${['s', 'm', 'l'].map(k => `<button data-size="${k}" class="${s.size === k ? 'on' : ''}">${{s: 'P', m: 'M', l: 'G'}[k]}</button>`).join('')}</span></div>
      <label class="sp-row"><span>Opacité</span><input type="range" min="40" max="100" value="${Math.round(s.opacity * 100)}" data-set="opacity"></label>
      <label class="sp-row check"><input type="checkbox" data-set="compact" ${s.compact ? 'checked' : ''}> Compacte (cartes seules)</label>
      <label class="sp-row check"><input type="checkbox" data-set="autoOpen" ${s.autoOpen ? 'checked' : ''}> S'ouvrir quand un sort arrive</label>
      <div class="sp-row"><button class="btn small" data-reset>Replacer</button><button class="btn small" data-close>OK</button></div>`;
    box.classList.remove('hidden');
    box.onclick = (e) => {
      const size = e.target.closest('[data-size]');
      if (size) {
        s.size = size.dataset.size;
        box.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('on', b === size));
      } else if (e.target.closest('[data-reset]')) {
        s.x = null;
        s.y = null;
      } else if (e.target.closest('[data-close]')) {
        box.classList.add('hidden');
      } else {
        return;
      }
      this.save();
      this.apply();
    };
    box.oninput = (e) => {
      const input = e.target.closest('[data-set]');
      if (!input) {
        return;
      }
      if (input.dataset.set === 'opacity') {
        s.opacity = Number(input.value) / 100;
      } else {
        s[input.dataset.set] = input.checked;
      }
      this.save();
      this.apply();
    };
  }

  /**
   * Affiche les éléments de la pile. makeSlot(item) renvoie l'emplacement (.slot) de la carte source,
   * géré par le plateau pour garder les animations d'une zone à l'autre.
   */
  update(stack, players, makeSlot, targetsOf = () => '') {
    this.count = stack.length;
    if (!stack.length) {
      this.items.replaceChildren();
      this.lastTop = null;
      this.refreshVisibility();
      return;
    }
    const top = stack[0].id;
    if (top !== this.lastTop && this.settings.autoOpen && this.settings.minimized) {
      this.settings.minimized = false;
      this.save();
    }
    this.lastTop = top;
    const rows = stack.map((item, i) => {
      let row = this.items.querySelector(`.stack-item[data-sid="${item.id}"]`);
      if (!row) {
        row = el(`<div class="stack-item" data-sid="${item.id}"><div class="holder"></div><div class="sp-text"><div class="who"></div><div class="txt"></div><div class="tgt"></div></div></div>`);
      }
      // Le texte français dit « la créature ciblée » : on rappelle qui est visé.
      const targets = targetsOf(item);
      row.querySelector('.tgt').textContent = targets ? '→ ' + targets : '';
      const owner = players.find(p => p.id === item.controller);
      row.querySelector('.who').textContent = (owner ? owner.name : '') + (item.trigger ? ' · déclenchée' : item.ability ? ' · capacité' : ' · sort');
      row.querySelector('.txt').textContent = item.text;
      row.dataset.text = item.text;
      row.title = item.text;
      row.classList.toggle('top', i === 0);
      row.classList.toggle('selectable', !!item.selectable);
      if (item.source) {
        const holder = row.querySelector('.holder');
        const slot = makeSlot(item);
        if (holder.firstElementChild !== slot) {
          holder.replaceChildren(slot);
        }
      }
      return row;
    });
    this.items.replaceChildren(...rows);
    this.node.querySelector('.sp-title').innerHTML = `Pile <b>${stack.length}</b>`;
    this.refreshVisibility();
  }

  /** Élément affiché pour un élément de la pile (pour les flèches de ciblage). */
  itemNode(id) {
    if (this.node.classList.contains('hidden')) {
      return this.pill.classList.contains('hidden') ? null : this.pill;
    }
    return this.items.querySelector(`.stack-item[data-sid="${id}"]`);
  }
}
