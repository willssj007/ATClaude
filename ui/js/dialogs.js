// Dialogues : questions de Forge pendant la partie, et petites boîtes de l'interface.

import {bridge} from './bridge.js';
import {cardElement, showZoom, onLongPress} from './cards.js';
import {esc, el, debounce, rulesHtml} from './util.js';

const root = () => document.getElementById('dialogs');
const open = new Map();

function shell({title, message = '', narrow = false, peekable = true}) {
  const back = el(`<div class="modal-back">
    <div class="modal${narrow ? ' narrow' : ''}">
      <header><h2>${esc(title || 'Choix')}</h2>${peekable ? '<button class="btn small ghost peek-btn" title="Voir le plateau">👁 Plateau</button>' : ''}</header>
      <div class="body">${message ? `<div class="message">${esc(message)}</div>` : ''}</div>
      <footer></footer>
    </div>
  </div>`);
  const peek = back.querySelector('.peek-btn');
  if (peek) {
    peek.addEventListener('click', () => {
      back.classList.toggle('peek');
      peek.textContent = back.classList.contains('peek') ? '▲ Revenir au choix' : '👁 Plateau';
    });
  }
  root().appendChild(back);
  return {
    back,
    body: back.querySelector('.body'),
    footer: back.querySelector('footer'),
    close() {
      back.remove();
    },
  };
}

function button(label, cls = '') {
  return el(`<button class="btn ${cls}">${esc(label)}</button>`);
}

function zoomable(container) {
  const consumed = onLongPress(container, '.mcard', (node) => {
    if (node._card) {
      showZoom(node._card);
    }
  });
  return consumed;
}

// ------------------------------------------------------------------ questions de Forge

const handlers = {
  choose(d, s, done) {
    const items = d.items || [];
    const min = Math.max(0, d.min);
    const max = d.max < 0 ? items.length : d.max;
    const chosen = new Set((d.selected || []).filter(i => i < items.length));
    const withCards = items.some(i => i.card || i.paper);
    const counter = el('<span class="muted" style="margin-right:auto"></span>');
    const ok = button('Valider', 'gold');
    const update = () => {
      counter.textContent = max > 1 ? `${chosen.size} / ${max} sélectionné(s)${min > 0 ? ` · minimum ${min}` : ''}` : '';
      ok.disabled = chosen.size < min || chosen.size > max;
    };
    const toggle = (i, node) => {
      if (chosen.has(i)) {
        chosen.delete(i);
      } else {
        if (max === 1) {
          chosen.clear();
          s.body.querySelectorAll('.on').forEach(n => n.classList.remove('on'));
        }
        if (chosen.size >= max) {
          return;
        }
        chosen.add(i);
      }
      node.classList.toggle('on', chosen.has(i));
      update();
    };

    if (withCards) {
      const grid = el('<div class="choice-grid"></div>');
      const consumed = zoomable(grid);
      items.forEach((item, i) => {
        const card = item.card || item.paper;
        const pick = el('<div class="pick"></div>');
        const node = card ? cardElement(card) : el(`<div class="mcard back"><div class="face"></div></div>`);
        node._card = card;
        pick.appendChild(node);
        const label = card && (card.name === item.label || card.nameFr === item.label) ? '' : item.label;
        if (label) {
          pick.appendChild(el(`<div class="lbl">${rulesHtml(label)}</div>`));
        }
        pick.classList.toggle('on', chosen.has(i));
        pick.addEventListener('click', () => {
          if (!consumed()) {
            toggle(i, pick);
          }
        });
        pick.addEventListener('dblclick', () => {
          if (min <= 1 && max >= 1) {
            chosen.clear();
            chosen.add(i);
            done([...chosen]);
          }
        });
        grid.appendChild(pick);
      });
      s.body.appendChild(grid);
    } else {
      const list = el('<div class="choice-list"></div>');
      const instant = min === 1 && max === 1;
      let filter = '';
      const render = () => {
        list.innerHTML = '';
        const f = filter.toLowerCase();
        let shown = 0;
        items.forEach((item, i) => {
          if (f && !item.label.toLowerCase().includes(f)) {
            return;
          }
          if (shown++ > 300) {
            return;
          }
          const b = el(`<button>${rulesHtml(item.label)}</button>`);
          b.classList.toggle('on', chosen.has(i));
          b.addEventListener('click', () => {
            if (instant) {
              done([i]);
              return;
            }
            toggle(i, b);
          });
          list.appendChild(b);
        });
        if (shown > 300) {
          list.appendChild(el(`<div class="muted small">${shown - 300} autres résultats : affine la recherche.</div>`));
        }
      };
      if (items.length > 12) {
        const input = el('<input type="search" class="choice-filter" placeholder="Filtrer…">');
        input.addEventListener('input', debounce(() => {
          filter = input.value;
          render();
        }, 120));
        s.body.appendChild(input);
        setTimeout(() => input.focus(), 50);
      }
      render();
      s.body.appendChild(list);
      if (instant) {
        ok.classList.add('hidden');
      }
    }
    s.footer.appendChild(counter);
    if (min === 0) {
      const none = button(max === 1 ? 'Aucun' : 'Ne rien choisir');
      none.addEventListener('click', () => done([]));
      s.footer.appendChild(none);
    }
    ok.addEventListener('click', () => done([...chosen]));
    s.footer.appendChild(ok);
    update();
  },

  option(d, s, done) {
    if (d.card) {
      const grid = el('<div class="choice-grid"></div>');
      const node = cardElement(d.card);
      node._card = d.card;
      grid.appendChild(node);
      zoomable(grid);
      s.body.appendChild(grid);
    }
    (d.options || []).forEach((label, i) => {
      const b = button(label, i === d.default ? 'gold' : '');
      b.addEventListener('click', () => done(i));
      s.footer.appendChild(b);
    });
  },

  input(d, s, done) {
    const input = el(`<input type="${d.numeric ? 'number' : 'text'}" style="width:100%" list="dlg-opts">`);
    input.value = d.initial || '';
    s.body.appendChild(input);
    if (d.options) {
      const list = el('<datalist id="dlg-opts"></datalist>');
      d.options.forEach(o => list.appendChild(el(`<option value="${esc(o)}">`)));
      s.body.appendChild(list);
    }
    const ok = button('Valider', 'gold');
    const cancel = button('Annuler');
    ok.addEventListener('click', () => done(input.value));
    cancel.addEventListener('click', () => done(null));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && done(input.value));
    s.footer.append(cancel, ok);
    setTimeout(() => input.focus(), 50);
  },

  integer(d, s, done) {
    const min = d.min;
    const max = d.max;
    let value = Math.max(min, 0 >= min && 0 <= max ? 0 : min);
    const wrap = el('<div style="display:flex;flex-direction:column;align-items:center;gap:14px"></div>');
    const stepper = el(`<div class="stepper">
      <button class="btn icon" data-d="-1">−</button>
      <input type="number" min="${min}" ${max < 2147483647 ? `max="${max}"` : ''}>
      <button class="btn icon" data-d="1">+</button></div>`);
    const input = stepper.querySelector('input');
    const set = (v) => {
      value = Math.max(min, Math.min(max, v));
      input.value = value;
    };
    set(value);
    stepper.addEventListener('click', (e) => {
      const b = e.target.closest('[data-d]');
      if (b) {
        set(value + Number(b.dataset.d));
      }
    });
    input.addEventListener('input', () => set(Number(input.value) || min));
    wrap.appendChild(stepper);
    if (max - min <= 12) {
      const quick = el('<div class="chips"></div>');
      for (let v = min; v <= max; v++) {
        const c = el(`<span class="chip">${v}</span>`);
        c.addEventListener('click', () => done(v));
        quick.appendChild(c);
      }
      wrap.appendChild(quick);
    }
    s.body.appendChild(wrap);
    const ok = button('Valider', 'gold');
    const cancel = button('Annuler');
    ok.addEventListener('click', () => done(value));
    cancel.addEventListener('click', () => done(null));
    s.footer.append(cancel, ok);
  },

  order(d, s, done) {
    const items = d.items || [];
    const chosen = [];
    for (let i = d.sourceCount; i < items.length; i++) {
      chosen.push(i);
    }
    const withCards = items.some(i => i.card || i.paper);
    const info = el('<div class="muted small" style="margin-bottom:8px">Touchez les éléments dans l\'ordre voulu. Le premier choisi sera le premier de la liste.</div>');
    const grid = el(`<div class="${withCards ? 'choice-grid' : 'choice-list'}"></div>`);
    const ok = button('Valider', 'gold');
    const valid = () => {
      const remaining = items.length - chosen.length;
      return (d.remainingMin < 0 || remaining >= d.remainingMin) && (d.remainingMax < 0 || remaining <= d.remainingMax);
    };
    const render = () => {
      grid.innerHTML = '';
      items.forEach((item, i) => {
        const pos = chosen.indexOf(i);
        let node;
        if (withCards) {
          node = el('<div class="pick"></div>');
          const card = cardElement(item.card || item.paper);
          card._card = item.card || item.paper;
          node.appendChild(card);
          if (pos >= 0) {
            node.appendChild(el(`<div class="order-badge">${pos + 1}</div>`));
          }
        } else {
          node = el(`<button>${pos >= 0 ? `<b>${pos + 1}.</b> ` : ''}${rulesHtml(item.label)}</button>`);
        }
        node.classList.toggle('on', pos >= 0);
        node.addEventListener('click', () => {
          if (pos >= 0) {
            chosen.splice(pos, 1);
          } else {
            chosen.push(i);
          }
          render();
        });
        grid.appendChild(node);
      });
      ok.disabled = !valid();
    };
    zoomable(grid);
    s.body.append(info, grid);
    const all = button('Tout, dans l\'ordre affiché');
    all.addEventListener('click', () => {
      chosen.length = 0;
      items.forEach((_, i) => chosen.push(i));
      render();
    });
    const reset = button('Effacer');
    reset.addEventListener('click', () => {
      chosen.length = 0;
      render();
    });
    ok.addEventListener('click', () => done([...chosen]));
    s.footer.append(reset, all, ok);
    render();
  },

  reveal(d, s, done) {
    const items = d.items || [];
    const withCards = items.some(i => i.card || i.paper);
    if (withCards) {
      const grid = el('<div class="choice-grid"></div>');
      items.forEach(item => {
        const card = item.card || item.paper;
        const node = cardElement(card);
        node._card = card;
        grid.appendChild(node);
      });
      zoomable(grid);
      s.body.appendChild(grid);
    } else if (items.length) {
      s.body.appendChild(el(`<div class="message">${items.map(i => esc(i.label)).join('\n')}</div>`));
    }
    const ok = button('OK', 'gold');
    ok.addEventListener('click', () => done(null));
    s.footer.appendChild(ok);
  },

  assignDamage(d, s, done) {
    const blockers = d.blockers || [];
    const values = blockers.map(() => 0);
    let toDefender = 0;
    const total = el('<span class="muted" style="margin-right:auto"></span>');
    const ok = button('Valider', 'gold');
    const head = el(`<div class="message">${esc(d.attacker.name)} inflige ${d.damage} blessure(s).</div>`);
    s.body.appendChild(head);
    const rows = [];
    const refresh = () => {
      const sum = values.reduce((a, b) => a + b, 0) + toDefender;
      total.textContent = `${sum} / ${d.damage} réparties`;
      ok.disabled = sum !== d.damage;
      rows.forEach(r => r());
    };
    const row = (label, card, get, set) => {
      const line = el(`<div class="assign-row"><div class="grow">${esc(label)}</div>
        <div class="stepper"><button class="btn icon small" data-d="-1">−</button><b class="v"></b><button class="btn icon small" data-d="1">+</button></div></div>`);
      if (card) {
        const node = cardElement(card);
        node._card = card;
        line.insertBefore(node, line.firstChild);
      }
      line.addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]');
        if (b) {
          set(Math.max(0, get() + Number(b.dataset.d)));
          refresh();
        }
      });
      rows.push(() => {
        line.querySelector('.v').textContent = get();
      });
      s.body.appendChild(line);
    };
    blockers.forEach((b, i) => row(`${b.name} (mortel : ${b.lethal})`, b, () => values[i], v => {
      values[i] = v;
    }));
    if (d.defender !== undefined) {
      row(`Joueur défenseur : ${d.defenderName || ''}`, null, () => toDefender, v => {
        toDefender = v;
      });
    }
    const auto = button('Répartition automatique');
    auto.addEventListener('click', () => {
      let left = d.damage;
      blockers.forEach((b, i) => {
        values[i] = Math.min(left, Math.max(0, b.lethal));
        left -= values[i];
      });
      if (d.defender !== undefined) {
        toDefender = left;
      } else if (blockers.length) {
        values[blockers.length - 1] += left;
      }
      refresh();
    });
    ok.addEventListener('click', () => {
      const out = {};
      blockers.forEach((b, i) => {
        out[b.id] = values[i];
      });
      if (d.defender !== undefined) {
        out.defender = toDefender;
      }
      done(out);
    });
    s.footer.append(total, auto, ok);
    auto.click();
  },

  assignGeneric(d, s, done) {
    const items = d.items || [];
    const values = items.map(() => (d.atLeastOne ? 1 : 0));
    const total = el('<span class="muted" style="margin-right:auto"></span>');
    const ok = button('Valider', 'gold');
    const lines = [];
    const refresh = () => {
      const sum = values.reduce((a, b) => a + b, 0);
      total.textContent = `${sum} / ${d.amount}`;
      ok.disabled = sum !== d.amount;
      lines.forEach((l, i) => {
        l.querySelector('.v').textContent = values[i];
      });
    };
    items.forEach((item, i) => {
      const line = el(`<div class="assign-row"><div class="grow">${esc(item.label)}</div>
        <div class="stepper"><button class="btn icon small" data-d="-1">−</button><b class="v"></b><button class="btn icon small" data-d="1">+</button></div></div>`);
      if (item.card) {
        line.insertBefore(cardElement(item.card), line.firstChild);
      }
      line.addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]');
        if (b) {
          const lowest = d.atLeastOne ? 1 : 0;
          values[i] = Math.max(lowest, Math.min((d.max || [])[i] ?? d.amount, values[i] + Number(b.dataset.d)));
          refresh();
        }
      });
      lines.push(line);
      s.body.appendChild(line);
    });
    ok.addEventListener('click', () => done(values));
    s.footer.append(total, ok);
    refresh();
  },
};

export function handleForgeDialog(d) {
  const handler = handlers[d.kind];
  if (!handler) {
    console.warn('Dialogue inconnu', d);
    bridge.answer(d.id, null);
    return;
  }
  if (open.has(d.id)) {
    return;
  }
  const s = shell({title: d.title || defaultTitle(d.kind), message: d.message, narrow: ['option', 'input', 'integer'].includes(d.kind) && !d.card});
  open.set(d.id, s);
  handler(d, s, (value) => {
    s.close();
    open.delete(d.id);
    bridge.answer(d.id, value);
  });
}

export function closeForgeDialog(id) {
  const s = open.get(id);
  if (s) {
    s.close();
    open.delete(id);
  }
}

export function closeAllForgeDialogs() {
  for (const s of open.values()) {
    s.close();
  }
  open.clear();
}

function defaultTitle(kind) {
  return {choose: 'Faire un choix', option: 'Question', input: 'Saisie', integer: 'Choisir un nombre',
    order: 'Choisir l\'ordre', reveal: 'Cartes révélées', assignDamage: 'Répartir les blessures', assignGeneric: 'Répartir'}[kind] || 'Choix';
}

// ------------------------------------------------------------------ boîtes de l'interface

export function confirmBox(title, message, {yes = 'Oui', no = 'Annuler', danger = false} = {}) {
  return new Promise(resolve => {
    const s = shell({title, message, narrow: true, peekable: false});
    const n = button(no);
    const y = button(yes, danger ? 'danger' : 'gold');
    n.addEventListener('click', () => {
      s.close();
      resolve(false);
    });
    y.addEventListener('click', () => {
      s.close();
      resolve(true);
    });
    s.footer.append(n, y);
  });
}

/** Boîte libre : build(body, footer, close) remplit le contenu. */
export function customBox(title, build, {narrow = false} = {}) {
  const s = shell({title, narrow, peekable: false});
  s.back.addEventListener('click', (e) => {
    if (e.target === s.back) {
      s.close();
    }
  });
  build(s.body, s.footer, () => s.close());
  return s;
}

export function promptBox(title, message, initial = '') {
  return new Promise(resolve => {
    const s = shell({title, message, narrow: true, peekable: false});
    const input = el('<input type="text" style="width:100%">');
    input.value = initial;
    s.body.appendChild(input);
    const cancel = button('Annuler');
    const ok = button('Valider', 'gold');
    const finish = (v) => {
      s.close();
      resolve(v);
    };
    cancel.addEventListener('click', () => finish(null));
    ok.addEventListener('click', () => finish(input.value));
    input.addEventListener('keydown', (e) => e.key === 'Enter' && finish(input.value));
    s.footer.append(cancel, ok);
    setTimeout(() => input.focus(), 50);
  });
}
