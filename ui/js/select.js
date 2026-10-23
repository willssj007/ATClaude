// Listes déroulantes : chaque <select> de l'application devient un bouton qui ouvre une liste stylée
// (groupes, coche sur le choix en cours, recherche pour les longues listes), à la place du sélecteur d'Android.
// Le <select> d'origine reste dans la page, invisible : sa valeur et son événement « change » ne changent pas.

import {icon} from './icons.js';
import {esc} from './util.js';

const SEARCH_FROM = 12;
let openPanel = null;

/** Améliore les <select> présents sous {@code root}, puis ceux qui apparaîtront. */
export function enhanceSelects(root = document.body) {
  root.querySelectorAll('select').forEach(enhance);
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) {
          continue;
        }
        if (n.tagName === 'SELECT') {
          enhance(n);
        } else {
          n.querySelectorAll && n.querySelectorAll('select').forEach(enhance);
        }
      }
    }
  }).observe(root, {childList: true, subtree: true});
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPanel) {
      closePanel();
    }
  }, true);
}

function enhance(select) {
  if (select._csel || select.multiple || select.dataset.native !== undefined) {
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'csel';
  button.innerHTML = `<span class="csel-label"></span>${icon('chevronRight', 'csel-chev')}`;
  select.classList.add('csel-native');
  select.tabIndex = -1;
  select.after(button);
  select._csel = button;
  const sync = () => {
    const opt = select.options[select.selectedIndex];
    button.querySelector('.csel-label').textContent = opt ? opt.textContent : '';
    button.disabled = select.disabled;
    button.title = select.title || (opt ? opt.textContent : '');
  };
  // Une valeur changée par le code (select.value = ...) se voit aussi sur le bouton.
  for (const prop of ['value', 'selectedIndex']) {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, prop);
    Object.defineProperty(select, prop, {
      configurable: true,
      get() {
        return desc.get.call(this);
      },
      set(v) {
        desc.set.call(this, v);
        sync();
      },
    });
  }
  new MutationObserver(sync).observe(select, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected']});
  select.addEventListener('change', sync);
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (openPanel && openPanel._select === select) {
      closePanel();
    } else {
      openList(select, button);
    }
  });
  sync();
}

function closePanel() {
  if (openPanel) {
    openPanel._select._csel.classList.remove('open');
    openPanel.remove();
    openPanel = null;
  }
}

function openList(select, button) {
  closePanel();
  const items = [];
  for (const node of select.children) {
    if (node.tagName === 'OPTGROUP') {
      items.push({group: node.label});
      for (const o of node.children) {
        items.push({option: o});
      }
    } else if (node.tagName === 'OPTION') {
      items.push({option: node});
    }
  }
  const count = items.filter(i => i.option).length;
  const panel = document.createElement('div');
  panel.className = 'csel-panel';
  panel._select = select;
  panel.innerHTML = `${count >= SEARCH_FROM ? `<div class="csel-search">${icon('filter')}<input type="search" placeholder="Rechercher…"></div>` : ''}<div class="csel-list" role="listbox"></div>`;
  const list = panel.querySelector('.csel-list');
  const render = (filter = '') => {
    const f = filter.trim().toLowerCase();
    let html = '';
    let pendingGroup = null;
    for (const it of items) {
      if (it.group !== undefined) {
        pendingGroup = it.group;
        continue;
      }
      const o = it.option;
      if (f && !o.textContent.toLowerCase().includes(f)) {
        continue;
      }
      if (pendingGroup !== null) {
        html += `<div class="csel-group">${esc(pendingGroup)}</div>`;
        pendingGroup = null;
      }
      const on = o.index === select.selectedIndex;
      html += `<button type="button" class="csel-item${on ? ' on' : ''}" data-i="${o.index}" role="option" aria-selected="${on}"${o.disabled ? ' disabled' : ''}>
        <span>${esc(o.textContent)}</span>${on ? icon('check') : ''}</button>`;
    }
    list.innerHTML = html || '<div class="csel-empty muted small">Rien ne correspond.</div>';
  };
  render();
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.csel-item');
    if (!b || b.disabled) {
      return;
    }
    const i = Number(b.dataset.i);
    closePanel();
    if (i !== select.selectedIndex) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('input', {bubbles: true}));
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
    button.focus();
  });
  const input = panel.querySelector('input');
  if (input) {
    input.addEventListener('input', () => render(input.value));
  }
  document.body.appendChild(panel);
  openPanel = panel;
  button.classList.add('open');
  place(panel, button);
  const current = list.querySelector('.csel-item.on');
  if (current) {
    current.scrollIntoView({block: 'center'});
  }
  if (input && matchMedia('(pointer: fine)').matches) {
    input.focus();
  }
  // Toucher ailleurs ferme la liste.
  setTimeout(() => {
    const away = (e) => {
      if (!openPanel || openPanel !== panel) {
        document.removeEventListener('pointerdown', away, true);
        return;
      }
      if (!panel.contains(e.target) && e.target !== button && !button.contains(e.target)) {
        document.removeEventListener('pointerdown', away, true);
        closePanel();
      }
    };
    document.addEventListener('pointerdown', away, true);
  });
}

/** Sous le bouton s'il y a la place, sinon au-dessus ; jamais hors de l'écran. */
function place(panel, button) {
  const r = button.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(r.width, 240), vw - 16);
  panel.style.width = width + 'px';
  panel.style.left = Math.max(8, Math.min(r.left, vw - width - 8)) + 'px';
  const below = vh - r.bottom - 10;
  const above = r.top - 10;
  const maxH = Math.min(420, Math.max(below, above));
  panel.style.maxHeight = maxH + 'px';
  if (below >= Math.min(260, panel.scrollHeight) || below >= above) {
    panel.style.top = (r.bottom + 4) + 'px';
  } else {
    panel.style.top = Math.max(8, r.top - 4 - Math.min(maxH, panel.scrollHeight)) + 'px';
  }
}

window.addEventListener('resize', closePanel);
