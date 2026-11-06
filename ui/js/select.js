// Listes déroulantes : chaque <select> de l'application devient un bouton qui ouvre une liste stylée
// (groupes, coche sur le choix en cours, recherche pour les longues listes), à la place du sélecteur d'Android.
// Le <select> d'origine reste dans la page, invisible : sa valeur et son événement « change » ne changent pas.

import {icon} from './icons.js';
import {esc} from './util.js';

const SEARCH_FROM = 8;
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
    if (openPanel._backdrop) {
      // Le voile reste un instant (transparent) : le toucher qui l'a fermé ne « clique » pas ce qu'il y a dessous.
      const back = openPanel._backdrop;
      back.classList.add('closing');
      setTimeout(() => back.remove(), 380);
    }
    if (openPanel._onViewport && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', openPanel._onViewport);
      window.visualViewport.removeEventListener('scroll', openPanel._onViewport);
    }
    openPanel.remove();
    openPanel = null;
  }
}

/** Sans accents ni majuscules : « équipée » se trouve en tapant « equipee ». */
const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Un écran tactile ou petit (téléphone en portrait comme en paysage) : la liste s'ouvre en panneau, pas sous le bouton. */
function sheetMode() {
  return matchMedia('(pointer: coarse)').matches || window.innerWidth < 640 || window.innerHeight < 520;
}

/** Le nom du champ, pour le titre du panneau : son libellé (« Qui », « Mot-clé »…), sinon son titre. */
function fieldTitle(select) {
  if (select.getAttribute('aria-label')) {
    return select.getAttribute('aria-label');
  }
  const label = select.closest('label');
  const own = label ? label.querySelector('span') : null;
  if (own && own.textContent.trim()) {
    return own.textContent.trim();
  }
  let prev = select.previousElementSibling;
  while (prev && prev.tagName === 'BUTTON') {
    prev = prev.previousElementSibling;
  }
  if (prev && /^(SPAN|LABEL)$/.test(prev.tagName) && prev.textContent.trim().length < 40) {
    return prev.textContent.trim();
  }
  return select.title || select.getAttribute('aria-label') || 'Choisir';
}

/** Le texte d'une option, avec ce qui correspond à la recherche en gras. */
function highlight(text, f) {
  if (!f) {
    return esc(text);
  }
  const i = plain(text).indexOf(f);
  if (i < 0) {
    return esc(text);
  }
  return esc(text.slice(0, i)) + '<b>' + esc(text.slice(i, i + f.length)) + '</b>' + esc(text.slice(i + f.length));
}

function openList(select, button) {
  closePanel();
  const items = [];
  let group = '';
  for (const node of select.children) {
    if (node.tagName === 'OPTGROUP') {
      items.push({group: node.label});
      for (const o of node.children) {
        items.push({option: o, group: undefined, inGroup: node.label});
      }
    } else if (node.tagName === 'OPTION') {
      items.push({option: node, inGroup: group});
    }
  }
  const count = items.filter(i => i.option).length;
  const sheet = sheetMode();
  const panel = document.createElement('div');
  panel.className = 'csel-panel' + (sheet ? ' sheet' : '') + (count >= SEARCH_FROM ? ' has-search' : '');
  panel._select = select;
  const searchable = count >= SEARCH_FROM;
  panel.innerHTML = `${sheet ? `<div class="csel-head"><span class="csel-title">${esc(fieldTitle(select))}</span>
      <button type="button" class="csel-close" aria-label="Fermer">✕</button></div>` : ''}
    ${searchable ? `<div class="csel-search">${icon('filter')}<input type="search" placeholder="Rechercher…" enterkeyhint="search">${sheet
      ? '<button type="button" class="csel-close csel-close2" aria-label="Fermer">✕</button>' : ''}</div>` : ''}
    <div class="csel-list" role="listbox"></div>`;
  const list = panel.querySelector('.csel-list');
  const render = (filter = '') => {
    const f = plain(filter.trim());
    let html = '';
    let pendingGroup = null;
    for (const it of items) {
      if (it.group !== undefined) {
        pendingGroup = it.group;
        continue;
      }
      const o = it.option;
      // La recherche porte sur l'option et sur son groupe (« équipée », « mot-clé », « permanent »…).
      if (f && !plain(o.textContent).includes(f) && !plain(it.inGroup).includes(f)) {
        continue;
      }
      if (pendingGroup !== null) {
        html += `<div class="csel-group">${esc(pendingGroup)}</div>`;
        pendingGroup = null;
      }
      const on = o.index === select.selectedIndex;
      html += `<button type="button" class="csel-item${on ? ' on' : ''}" data-i="${o.index}" role="option" aria-selected="${on}"${o.disabled ? ' disabled' : ''}>
        <span>${highlight(o.textContent, f)}</span>${on ? icon('check') : ''}</button>`;
    }
    list.innerHTML = html || '<div class="csel-empty muted small">Rien ne correspond.</div>';
  };
  render();
  const choose = (i) => {
    closePanel();
    if (i !== select.selectedIndex) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('input', {bubbles: true}));
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
    if (!sheet) {
      button.focus();
    }
  };
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.csel-item');
    if (b && !b.disabled) {
      choose(Number(b.dataset.i));
    }
  });
  panel.querySelectorAll('.csel-close').forEach(b => b.addEventListener('click', closePanel));
  const input = panel.querySelector('input');
  if (input) {
    input.addEventListener('input', () => {
      render(input.value);
      list.scrollTop = 0;
    });
    // Entrée : le premier choix qui correspond.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = list.querySelector('.csel-item:not([disabled])');
        if (first) {
          choose(Number(first.dataset.i));
        }
      }
    });
  }
  if (sheet) {
    // Un voile derrière le panneau : le toucher ferme la liste.
    const backdrop = document.createElement('div');
    backdrop.className = 'csel-backdrop';
    backdrop.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      closePanel();
    });
    document.body.appendChild(backdrop);
    panel._backdrop = backdrop;
  }
  document.body.appendChild(panel);
  openPanel = panel;
  button.classList.add('open');
  place(panel, button);
  if (sheet && window.visualViewport) {
    // Le clavier qui s'ouvre (la recherche) rétrécit l'écran : le panneau suit, il ne se ferme pas.
    panel._onViewport = () => place(panel, button);
    window.visualViewport.addEventListener('resize', panel._onViewport);
    window.visualViewport.addEventListener('scroll', panel._onViewport);
  }
  const current = list.querySelector('.csel-item.on');
  if (current) {
    current.scrollIntoView({block: 'center'});
  }
  if (input && !sheet && matchMedia('(pointer: fine)').matches) {
    input.focus();
  }
  if (!sheet) {
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
}

/**
 * Panneau (écran tactile) : en bas de l'écran en portrait, au milieu en paysage, à la hauteur de la partie visible (au-dessus du
 * clavier). Liste sous le bouton (souris) : en dessous s'il y a la place, sinon au-dessus ; jamais hors de l'écran.
 */
function place(panel, button) {
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth;
  const vh = vv ? vv.height : window.innerHeight;
  const top0 = vv ? vv.offsetTop : 0;
  const left0 = vv ? vv.offsetLeft : 0;
  if (panel.classList.contains('sheet')) {
    const landscape = vw > vh;
    // Écran bas (paysage, clavier ouvert) : le titre laisse sa place, la croix passe à côté de la recherche.
    panel.classList.toggle('compact', vh < 420);
    const width = Math.min(landscape ? 620 : 560, vw - 16);
    const maxH = Math.max(160, Math.min(vh - 16, landscape ? vh - 16 : vh * 0.86));
    panel.style.width = width + 'px';
    panel.style.maxHeight = maxH + 'px';
    // Avec une recherche, le panneau garde sa hauteur pendant qu'on tape (il ne saute pas à chaque lettre).
    panel.style.height = panel.querySelector('.csel-search') ? maxH + 'px' : '';
    panel.style.left = (left0 + (vw - width) / 2) + 'px';
    const h = Math.min(maxH, panel.scrollHeight);
    panel.style.top = (top0 + (landscape ? Math.max(8, (vh - h) / 2) : vh - h - 8)) + 'px';
    return;
  }
  const r = button.getBoundingClientRect();
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

// Fenêtre redimensionnée : la liste sous un bouton se replace ; un panneau suit déjà la partie visible de l'écran.
window.addEventListener('resize', () => {
  if (openPanel && !openPanel.classList.contains('sheet')) {
    const b = openPanel._select._csel;
    if (b && b.isConnected) {
      place(openPanel, b);
    } else {
      closePanel();
    }
  } else if (openPanel && !window.visualViewport) {
    place(openPanel, openPanel._select._csel);
  }
});
