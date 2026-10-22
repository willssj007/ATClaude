// Plateau de jeu : affiche l'état envoyé par Forge et renvoie les clics du joueur.
//
// Chaque carte affichée est un « emplacement » (.slot) gardé d'un rendu à l'autre et repéré par une clé :
// « c<id> » pour une carte à sa place normale, « s<id> » pour la source d'une capacité sur la pile.
// Quand une carte change de zone, son emplacement est déplacé dans le DOM et animé de l'ancienne
// position vers la nouvelle : la carte vole de la main à la pile, puis au champ de bataille.

import {bridge} from './bridge.js';
import {cardElement, showZoom, onLongPress} from './cards.js';
import {confirmBox} from './dialogs.js';
import {esc, el, manaHtml, avatarHtml, PHASES, prefs, toast, debounce, translatePrompt} from './util.js';

const COUNTER_LABELS = {P1P1: '+1/+1', M1M1: '−1/−1', LOYALTY: 'Loyauté', CHARGE: 'Charge', LORE: 'Histoire', DEFENSE: 'Défense', SHIELD: 'Bouclier', STUN: 'Étourdi', OIL: 'Huile', TIME: 'Temps'};
const MANA_ORDER = ['W', 'U', 'B', 'R', 'G', 'C'];

function counterLabel(name) {
  return COUNTER_LABELS[name] || name.charAt(0) + name.slice(1).toLowerCase();
}

function isFront(card) {
  return card.creature || card.planeswalker || card.battle;
}

/** Signature des caractéristiques visibles : si elle change, on redessine la carte. */
function faceSig(card) {
  return card.hidden ? 'hidden' : [card.name, card.cost, card.typeLine, card.text, card.image, card.power, card.toughness, card.loyalty, card.colors].join('|');
}

export class Game {
  constructor(root, {onExit, onRematch}) {
    this.root = root;
    this.onExit = onExit;
    this.onRematch = onRematch;
    this.state = null;
    this.pendingState = null;
    this.slots = new Map();
    this.cards = new Map();
    this.prevLife = new Map();
    this.prevTurnKey = '';
    this.layoutKey = '';
    this.frame = 0;
    this.drawer = null;
    this.trayZone = null;
    this.autoTrayKey = '';
    this.cheatTarget = null;
    this.over = null;
    this.showWaiting();
  }

  showWaiting(text = 'Préparation de la partie…') {
    this.root.innerHTML = `<div class="waiting-start"><div class="spinner"></div><div>${esc(text)}</div></div>`;
    this.layoutKey = '';
    this.slots.clear();
  }

  setState(state) {
    this.pendingState = state;
    if (!this.frame) {
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        const s = this.pendingState;
        this.pendingState = null;
        if (s) {
          this.render(s);
        }
      });
    }
  }

  // ------------------------------------------------------------------ squelette

  build(state) {
    const me = state.players.find(p => p.me) || state.players[0];
    const opponents = this.opponentsOf(state, me);
    this.root.innerHTML = '';
    const table = el(`<div class="table" data-opponents="${opponents.length}">
      <div class="opponents"></div>
      <div class="midline"><div class="turn-label"></div><div class="phases"></div>
        <div class="toolbar">
          <button class="btn small" data-open="cheat" title="Menu de triche">✨ Triche</button>
          <button class="btn small" data-open="log" title="Journal de la partie">📜</button>
          <button class="btn small" data-open="menu" title="Menu">☰</button>
        </div>
      </div>
      <div class="me">
        <div class="field">
          <div class="row front" data-row="front"></div>
          <div class="row back" data-row="back"><div class="nonlands row" style="padding:0"></div><div class="spacer"></div><div class="lands row" style="padding:0"></div></div>
        </div>
      </div>
      <div class="hud">
        <div class="me-info">
          <div class="line">
            <div class="player-hit" data-pid="${me.id}">${avatarHtml(me.name, 0, 40)}<div class="life"></div></div>
            <div class="me-stats" style="display:flex;gap:4px;flex-wrap:wrap"></div>
          </div>
          <div class="mana-pool"></div>
          <div class="zones">
            <div class="pile" data-zone="library" data-pid="${me.id}"><div class="label">Biblio.</div></div>
            <div class="pile" data-zone="graveyard" data-pid="${me.id}"><div class="label">Cimetière</div></div>
            <div class="pile" data-zone="exile" data-pid="${me.id}"><div class="label">Exil</div></div>
            <div class="pile command" data-zone="command" data-pid="${me.id}"><div class="label">Commandement</div></div>
          </div>
        </div>
        <div class="hand"></div>
        <div class="hud-actions">
          <div class="prompt"></div>
          <div class="btn-row main">
            <button class="btn cancel-btn"></button>
            <button class="btn gold main-action ok-btn"></button>
          </div>
          <div class="btn-row">
            <span class="btn-row extra"></span>
            <span class="toggle hold" title="Après avoir lancé un sort, garder la priorité pour pouvoir y répondre soi-même"><i></i>Garder la priorité</span>
          </div>
        </div>
      </div>
      <div class="stack-panel hidden"></div>
      <div class="preview"></div>
      <svg class="arrows"><defs>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ef5a5a"/></marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#4fb6ff"/></marker>
        <marker id="arrow-gold" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ffd26e"/></marker>
      </defs><g></g></svg>
      <div class="drawer" data-drawer></div>
    </div>`);
    const opps = table.querySelector('.opponents');
    opponents.forEach((p, i) => {
      opps.appendChild(el(`<div class="opp" data-pid="${p.id}">
        <div class="player-head">
          <div class="player-hit" data-pid="${p.id}">${avatarHtml(p.name, i + 1, 34)}<div><div class="player-name">${esc(p.name)}</div></div><div class="life"></div></div>
          <div class="opp-stats" style="display:flex;gap:4px;flex-wrap:wrap"></div>
          <div class="opp-hand"></div>
          <div class="head-commanders"></div>
          <div class="pile" data-zone="graveyard" data-pid="${p.id}" style="--zone-w:calc(var(--opp-w)*0.62)"></div>
          <div class="pile" data-zone="exile" data-pid="${p.id}" style="--zone-w:calc(var(--opp-w)*0.62)"></div>
        </div>
        <div class="field">
          <div class="row back"><div class="lands row" style="padding:0"></div><div class="spacer" style="flex:1"></div><div class="nonlands row" style="padding:0"></div></div>
          <div class="row front center"></div>
        </div>
      </div>`));
    });
    this.root.appendChild(table);
    this.table = table;
    this.slots.clear();
    this.bindEvents(table);
  }

  opponentsOf(state, me) {
    const idx = state.players.findIndex(p => p.id === me.id);
    const ordered = [...state.players.slice(idx + 1), ...state.players.slice(0, idx)];
    return ordered;
  }

  bindEvents(table) {
    const consumed = onLongPress(table, '.slot, .stack-item', (node) => {
      const slot = node.classList.contains('slot') ? node : node.querySelector('.slot');
      const card = slot && this.cards.get(slot.dataset.key);
      if (card && !card.hidden) {
        showZoom(card, this.cardDetails(card));
      }
    });

    table.addEventListener('click', (e) => {
      if (consumed()) {
        return;
      }
      const toolbarBtn = e.target.closest('[data-open]');
      if (toolbarBtn) {
        this.openDrawer(toolbarBtn.dataset.open);
        return;
      }
      if (e.target.closest('.drawer')) {
        return;
      }
      const stackItem = e.target.closest('.stack-item');
      if (stackItem) {
        if (stackItem.classList.contains('selectable')) {
          bridge.send('stackItem', {id: Number(stackItem.dataset.sid)});
        } else {
          const card = this.cards.get(stackItem.querySelector('.slot')?.dataset.key);
          if (card) {
            showZoom(card, `<div class="muted" style="margin-top:10px">${esc(stackItem.dataset.text || '')}</div>`);
          }
        }
        return;
      }
      const pile = e.target.closest('.pile');
      if (pile) {
        this.openZone(Number(pile.dataset.pid), pile.dataset.zone);
        return;
      }
      const slot = e.target.closest('.slot');
      if (slot && slot.dataset.key && slot.dataset.key.startsWith('c')) {
        bridge.send('card', {id: Number(slot.dataset.key.slice(1))});
        return;
      }
      const hit = e.target.closest('.player-hit');
      if (hit) {
        bridge.send('player', {id: Number(hit.dataset.pid)});
        return;
      }
      const mana = e.target.closest('[data-mana]');
      if (mana) {
        bridge.send('useMana', {color: mana.dataset.mana});
        return;
      }
    });

    table.querySelector('.ok-btn').addEventListener('click', () => this.primary());
    table.querySelector('.cancel-btn').addEventListener('click', () => this.secondary());
    table.querySelector('.hold').addEventListener('click', () => {
      const value = !(this.state && this.state.settings && this.state.settings.holdPriority);
      prefs.set('holdPriority', value);
      bridge.send('settings', {settings: {holdPriority: value}});
      toast(value ? 'Tu gardes la priorité après tes sorts : tu pourras y répondre.' : 'Tes sorts se résolvent sans s\'arrêter (sauf réponse adverse).');
    });
    table.querySelector('.extra').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        bridge.send(b.dataset.act);
      }
    });

    const preview = table.querySelector('.preview');
    table.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') {
        return;
      }
      const slot = e.target.closest('.slot');
      const card = slot && this.cards.get(slot.dataset.key);
      if (!card || card.hidden) {
        preview.classList.remove('show');
        return;
      }
      preview.innerHTML = '';
      preview.appendChild(cardElement(card));
      preview.classList.add('show');
    });
    table.addEventListener('pointerout', (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.slot')) {
        preview.classList.remove('show');
      }
    });

    this.keyHandler = (e) => {
      if (!document.body.classList.contains('in-game') || e.target.matches('input, textarea, select')) {
        return;
      }
      if (document.querySelector('#dialogs .modal-back')) {
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.primary();
      } else if (e.code === 'Escape') {
        if (this.drawer) {
          this.closeDrawer();
        } else {
          this.secondary();
        }
      }
    };
    document.addEventListener('keydown', this.keyHandler);
    window.addEventListener('resize', this.onResize = debounce(() => this.state && this.render(this.state, true), 120));
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.onResize);
  }

  primary() {
    const p = this.state && this.state.prompt;
    if (p && p.okEnabled) {
      bridge.send('ok');
    }
  }

  secondary() {
    const p = this.state && this.state.prompt;
    if (p && p.cancelEnabled) {
      bridge.send('cancel');
    }
  }

  // ------------------------------------------------------------------ rendu

  render(state, force = false) {
    const prev = this.state;
    this.state = state;
    if (!state.players || !state.players.length) {
      return;
    }
    const key = state.players.map(p => p.id).join(',');
    if (key !== this.layoutKey) {
      this.build(state);
      this.layoutKey = key;
    }
    const table = this.table;
    const animate = prefs.get('animations') && !force;
    const before = new Map();
    if (animate) {
      for (const [k, slot] of this.slots) {
        if (slot.isConnected) {
          before.set(k, slot.getBoundingClientRect());
        }
      }
    }

    const me = state.players.find(p => p.me) || state.players[0];
    const used = new Set();
    this.cards.clear();

    // Pièces jointes (Auras, Équipements) : affichées juste après leur hôte, quel que soit leur contrôleur.
    const attachments = new Map();
    const onBattlefield = new Set();
    for (const p of state.players) {
      for (const c of p.zones.battlefield) {
        onBattlefield.add(c.id);
      }
    }
    for (const p of state.players) {
      for (const c of p.zones.battlefield) {
        if (c.attachedTo && !c.attachedToPlayer && onBattlefield.has(c.attachedTo)) {
          if (!attachments.has(c.attachedTo)) {
            attachments.set(c.attachedTo, []);
          }
          attachments.get(c.attachedTo).push(c);
        }
      }
    }
    const combat = new Map((state.combat || []).map(c => [c.attacker, c]));

    const place = (container, cards, opts = {}) => {
      const list = [];
      let prevLand = null;
      for (const card of cards) {
        const slot = this.slot('c' + card.id, card, used);
        slot.classList.toggle('attacking', combat.has(card.id));
        slot.classList.remove('attached');
        const stack = opts.stackLands && card.land && prevLand && prevLand.name === card.name && prevLand.tapped === card.tapped
          && !card.counters && !attachments.has(card.id) && !card.selectable && !card.highlighted;
        slot.classList.toggle('stacked', !!stack);
        prevLand = card.land ? card : null;
        list.push(slot);
        for (const a of attachments.get(card.id) || []) {
          const s = this.slot('c' + a.id, a, used);
          s.classList.add('attached');
          s.classList.remove('stacked', 'attacking');
          list.push(s);
        }
      }
      if (!opts.hand) {
        for (const slot of list) {
          slot.firstElementChild.style.removeProperty('--fan');
          slot.firstElementChild.style.removeProperty('--lift');
        }
      }
      this.reconcile(container, list);
    };

    const splitField = (p) => {
      const cards = p.zones.battlefield.filter(c => !(c.attachedTo && !c.attachedToPlayer && onBattlefield.has(c.attachedTo)));
      const front = cards.filter(isFront).sort((a, b) => a.id - b.id);
      const others = cards.filter(c => !isFront(c));
      const nonlands = others.filter(c => !c.land).sort((a, b) => a.id - b.id);
      const lands = others.filter(c => c.land).sort((a, b) => (a.name || '').localeCompare(b.name || '') || Number(a.tapped) - Number(b.tapped) || a.id - b.id);
      return {front, nonlands, lands};
    };

    // Mon champ de bataille et ma main.
    const mine = splitField(me);
    place(table.querySelector('.me .row.front'), mine.front);
    place(table.querySelector('.me .back .nonlands'), mine.nonlands);
    place(table.querySelector('.me .back .lands'), mine.lands, {stackLands: true});
    const hand = table.querySelector('.hand');
    place(hand, me.zones.hand, {hand: true});
    this.fanHand(hand, me.zones.hand.length);

    // Adversaires.
    for (const p of state.players) {
      if (p.id === me.id) {
        continue;
      }
      const box = table.querySelector(`.opp[data-pid="${p.id}"]`);
      if (!box) {
        continue;
      }
      const f = splitField(p);
      place(box.querySelector('.row.front'), f.front);
      place(box.querySelector('.back .nonlands'), f.nonlands);
      place(box.querySelector('.back .lands'), f.lands, {stackLands: true});
      place(box.querySelector('.head-commanders'), p.zones.command.filter(c => c.commander));
      box.classList.toggle('active', state.game.activePlayer === p.id);
      box.classList.toggle('lost', p.lost);
      const backs = Math.min(p.handSize, 10);
      box.querySelector('.opp-hand').innerHTML = `${'<div class="mini-back"></div>'.repeat(backs)}<span title="Cartes en main">✋ ${p.handSize}</span>`;
      this.renderPlayerHead(box, p, false);
      this.renderPile(box.querySelector('[data-zone="graveyard"]'), p.zones.graveyard, used, 'Cim.');
      this.renderPile(box.querySelector('[data-zone="exile"]'), p.zones.exile, used, 'Exil');
    }

    // Mes zones.
    this.renderPlayerHead(table.querySelector('.me-info'), me, true);
    this.renderPile(table.querySelector('.me-info [data-zone="graveyard"]'), me.zones.graveyard, used);
    this.renderPile(table.querySelector('.me-info [data-zone="exile"]'), me.zones.exile, used);
    this.renderLibrary(table.querySelector('.me-info [data-zone="library"]'), me.library);
    const command = table.querySelector('.me-info [data-zone="command"]');
    this.renderPile(command, me.zones.command, used, null, true);
    command.classList.toggle('hidden', me.zones.command.length === 0);

    this.renderStack(state, used);
    this.renderMana(me);
    this.renderPhases(state, me);
    this.renderPrompt(state, me);

    // Emplacements disparus : la carte a quitté les zones visibles (bibliothèque, main adverse...).
    for (const [k, slot] of this.slots) {
      if (!used.has(k)) {
        this.slots.delete(k);
        if (animate && slot.isConnected) {
          this.fadeOut(slot);
        } else {
          slot.remove();
        }
      }
    }

    this.fitRows();
    if (animate) {
      this.flip(before, me, prev);
    }
    this.lifeEffects(state, prev);
    this.turnBanner(state, me);
    requestAnimationFrame(() => this.drawArrows(state));
    this.refreshTray();
    if (this.drawer === 'log') {
      this.renderLog();
    }
  }

  /** Emplacement de la carte pour la clé donnée, créé ou mis à jour. */
  slot(key, card, used) {
    used.add(key);
    this.cards.set(key, card);
    let slot = this.slots.get(key);
    const sig = faceSig(card);
    if (!slot) {
      slot = el(`<div class="slot" data-key="${key}"></div>`);
      this.slots.set(key, slot);
      slot._sig = null;
    }
    if (slot._sig !== sig) {
      const inner = cardElement(card);
      inner.appendChild(el('<div class="badges"></div>'));
      slot.replaceChildren(inner);
      slot._sig = sig;
    }
    const mcard = slot.firstElementChild;
    slot.classList.toggle('tapped', !!card.tapped);
    slot.classList.toggle('blocking', !!card.blocking);
    mcard.classList.toggle('sick', !!card.sick && card.zone === 'battlefield' && card.creature);
    mcard.classList.toggle('playable', !!card.playable && !card.selectable);
    mcard.classList.toggle('selectable', !!card.selectable);
    mcard.classList.toggle('highlighted', !!card.highlighted);
    const badges = mcard.querySelector('.badges');
    const html = this.badgesHtml(card);
    if (badges && badges._html !== html) {
      badges.innerHTML = html;
      badges._html = html;
    }
    return slot;
  }

  badgesHtml(card) {
    if (card.hidden) {
      return '';
    }
    let html = '';
    const onField = card.zone === 'battlefield';
    if (onField && card.creature && card.power !== undefined) {
      html += `<div class="b-pt${card.damage ? ' hurt' : ''}">${card.power}/${card.toughness}</div>`;
    } else if (onField && card.planeswalker) {
      const loyalty = card.counters && card.counters.LOYALTY !== undefined ? card.counters.LOYALTY : card.loyalty;
      html += `<div class="b-loyalty">${esc(loyalty ?? '')}</div>`;
    }
    if (card.counters) {
      const entries = Object.entries(card.counters).filter(([k]) => !(card.planeswalker && k === 'LOYALTY'));
      if (entries.length) {
        html += `<div class="b-counters">${entries.map(([k, v]) => `<div class="b-counter">${esc(counterLabel(k))}${v > 1 ? ' ×' + v : ''}</div>`).join('')}</div>`;
      }
    }
    if (onField && card.damage) {
      html += `<div class="b-damage">${card.damage}</div>`;
    }
    if (card.commander) {
      html += '<div class="b-crown">👑</div>';
    }
    if (card.token && onField) {
      html += '<div class="b-token">Jeton</div>';
    }
    return html;
  }

  /** Met les emplacements dans le conteneur, dans l'ordre, sans toucher aux autres enfants. */
  reconcile(container, slots) {
    let ref = container.firstElementChild;
    for (const slot of slots) {
      while (ref && !ref.classList.contains('slot')) {
        ref = ref.nextElementSibling;
      }
      if (ref === slot) {
        ref = ref.nextElementSibling;
        continue;
      }
      container.insertBefore(slot, ref);
    }
    // Les emplacements restants n'ont plus leur place ici (déplacés ailleurs ou partis).
    while (ref) {
      const next = ref.nextElementSibling;
      if (ref.classList.contains('slot') && !slots.includes(ref)) {
        ref.remove();
      }
      ref = next;
    }
  }

  renderPile(pile, cards, used, label, all = false) {
    if (!pile) {
      return;
    }
    const shown = all ? cards.slice(0, 2) : cards.slice(-1);
    let holder = pile.querySelector('.holder');
    if (!holder) {
      holder = el('<div class="holder" style="position:absolute;inset:0"></div>');
      pile.appendChild(holder);
    }
    this.reconcile(holder, shown.map(c => this.slot('c' + c.id, c, used)));
    let count = pile.querySelector('.count');
    if (!count) {
      count = el('<div class="count"></div>');
      pile.appendChild(count);
    }
    count.textContent = cards.length;
    count.classList.toggle('hidden', cards.length === 0);
    pile.classList.toggle('has-selectable', cards.some(c => c.selectable || c.playable));
    if (label && !pile.querySelector('.label')) {
      pile.appendChild(el(`<div class="label">${esc(label)}</div>`));
    }
  }

  renderLibrary(pile, count) {
    let back = pile.querySelector('.mcard');
    if (!back && count > 0) {
      back = el('<div class="slot" style="position:absolute;inset:0;--w:var(--zone-w)"><div class="mcard back"><div class="face"></div></div></div>');
      pile.appendChild(back);
    }
    if (back) {
      back.classList.toggle('hidden', count === 0);
    }
    let c = pile.querySelector('.count');
    if (!c) {
      c = el('<div class="count"></div>');
      pile.appendChild(c);
    }
    c.textContent = count;
  }

  renderPlayerHead(box, p, isMe) {
    const hit = box.querySelector('.player-hit');
    hit.classList.toggle('selectable', !!p.selectable);
    hit.classList.toggle('highlighted', !!p.highlighted);
    hit.classList.toggle('priority', !!p.priority);
    const life = hit.querySelector('.life');
    life.textContent = p.life;
    life.classList.toggle('low', p.life <= 10);
    const stats = box.querySelector(isMe ? '.me-stats' : '.opp-stats');
    let html = '';
    if (p.poison) {
      html += `<span class="stat poison" title="Poison">☠ <b>${p.poison}</b></span>`;
    }
    if (p.energy) {
      html += `<span class="stat" title="Énergie">⚡ <b>${p.energy}</b></span>`;
    }
    for (const d of p.commanderDamage || []) {
      html += `<span class="stat cmd" title="Blessures de commandant : ${esc(d.name)}">⚔ <b>${d.damage}</b>/21</span>`;
    }
    if (!isMe) {
      html += `<span class="stat" title="Bibliothèque">📚 <b>${p.library}</b></span>`;
    }
    for (const c of p.commanders || []) {
      if (c.casts > 0) {
        html += `<span class="stat" title="Taxe de commandant">Taxe <b>+${c.casts * 2}</b></span>`;
      }
    }
    if (stats._html !== html) {
      stats.innerHTML = html;
      stats._html = html;
    }
  }

  renderMana(me) {
    const pool = this.table.querySelector('.mana-pool');
    const html = MANA_ORDER.filter(c => me.mana[c] > 0)
      .map(c => `<span class="ms ${c === 'C' ? '' : 'ms-' + c}" data-mana="${c}" title="Utiliser ce mana">${c === 'C' ? '◇' : ''}<b>${me.mana[c]}</b></span>`).join('');
    if (pool._html !== html) {
      pool.innerHTML = html;
      pool._html = html;
    }
  }

  renderPhases(state, me) {
    const myTurn = state.game.activePlayer === me.id;
    const stops = new Set((state.settings && (myTurn ? state.settings.myStops : state.settings.theirStops)) || []);
    const html = PHASES.filter(([k]) => k !== 'UNTAP' && k !== 'CLEANUP').map(([k, , short]) =>
      `<span class="ph${state.game.phase === k ? ' now' : ''}${stops.has(k) ? ' stop' : ''}" title="${esc(PHASES.find(p => p[0] === k)[1])}">${esc(short)}</span>`).join('');
    const phases = this.table.querySelector('.phases');
    if (phases._html !== html) {
      phases.innerHTML = html;
      phases._html = html;
    }
    const active = state.players.find(p => p.id === state.game.activePlayer);
    this.table.querySelector('.turn-label').innerHTML = `Tour <b>${state.game.turn}</b> · ${myTurn ? 'à vous' : esc(active ? active.name : '')}`;
  }

  renderPrompt(state, me) {
    const p = state.prompt || {};
    const promptBox = this.table.querySelector('.prompt');
    let message = (p.message || '').trim();
    const waiting = !p.okEnabled && !p.cancelEnabled && (!p.input || /^Waiting for/i.test(message));
    message = translatePrompt(message);
    if (!message && waiting) {
      message = state.game.activePlayer === me.id ? '' : 'L\'adversaire joue…';
    }
    promptBox.textContent = message;
    promptBox.classList.toggle('waiting', waiting);

    const ok = this.table.querySelector('.ok-btn');
    const cancel = this.table.querySelector('.cancel-btn');
    let okLabel = p.okLabel || 'OK';
    if (p.input === 'InputPassPriority' && /^ok$/i.test(okLabel)) {
      okLabel = state.stack.length ? 'Résoudre' : 'Passer';
    }
    ok.textContent = okLabel;
    ok.disabled = !p.okEnabled;
    ok.classList.toggle('hidden', !p.okEnabled && waiting);
    cancel.textContent = p.cancelLabel || 'Annuler';
    cancel.classList.toggle('hidden', !p.cancelEnabled);

    const extra = this.table.querySelector('.extra');
    let html = '';
    if (p.input === 'InputAttack') {
      html += '<button class="btn small" data-act="alphaStrike">⚔ Tout attaquer</button>';
    }
    if (p.input === 'InputPassPriority' || p.input === 'InputPayMana') {
      html += '<button class="btn small ghost" data-act="undo" title="Annuler la dernière action (engagement de mana...)">↶ Annuler</button>';
    }
    if (extra._html !== html) {
      extra.innerHTML = html;
      extra._html = html;
    }
    this.table.querySelector('.hold').classList.toggle('on', !!(state.settings && state.settings.holdPriority));
  }

  renderStack(state, used) {
    const panel = this.table.querySelector('.stack-panel');
    if (!state.stack.length) {
      panel.classList.add('hidden');
      panel.replaceChildren();
      return;
    }
    panel.classList.remove('hidden');
    const items = state.stack.map((item, i) => {
      let row = panel.querySelector(`.stack-item[data-sid="${item.id}"]`);
      if (!row) {
        row = el(`<div class="stack-item" data-sid="${item.id}"><div class="holder"></div><div><div class="who"></div><div class="txt"></div></div></div>`);
      }
      const owner = state.players.find(p => p.id === item.controller);
      row.querySelector('.who').textContent = (owner ? owner.name : '') + (item.trigger ? ' · déclenchée' : item.ability ? ' · capacité' : ' · sort');
      row.querySelector('.txt').textContent = item.text;
      row.dataset.text = item.text;
      row.classList.toggle('top', i === 0);
      row.classList.toggle('selectable', !!item.selectable);
      if (item.source) {
        // La carte elle-même est sur la pile pour un sort ; pour une capacité, on montre une copie de sa source.
        const key = item.source.zone === 'stack' && !item.ability ? 'c' + item.source.id : 's' + item.id;
        this.reconcile(row.querySelector('.holder'), [this.slot(key, item.source, used)]);
      }
      return row;
    });
    let title = panel.querySelector('h3');
    if (!title) {
      title = el('<h3></h3>');
    }
    title.textContent = `Pile (${state.stack.length})`;
    panel.replaceChildren(title, ...items);
  }

  fanHand(hand, n) {
    if (!n) {
      return;
    }
    const slots = [...hand.querySelectorAll(':scope > .slot')];
    const width = slots[0] ? slots[0].offsetWidth || 100 : 100;
    const avail = hand.clientWidth || 600;
    const natural = width * n;
    let overlap = -width * 0.12;
    if (natural + overlap * (n - 1) > avail) {
      overlap = Math.max(-width * 0.78, (avail - natural) / (n - 1));
    }
    hand.style.setProperty('--hand-overlap', overlap + 'px');
    const spread = Math.min(4, 36 / n);
    slots.forEach((slot, i) => {
      const offset = i - (n - 1) / 2;
      const card = slot.firstElementChild;
      card.style.setProperty('--fan', `${offset * spread}deg`);
      card.style.setProperty('--lift', `${18 + Math.abs(offset) * Math.min(3, 18 / n)}%`);
    });
  }

  /** Resserre les cartes d'une rangée trop pleine. */
  fitRows() {
    for (const row of this.table.querySelectorAll('.row')) {
      const slots = row.querySelectorAll(':scope > .slot');
      row.style.setProperty('--squeeze', '0px');
      if (slots.length < 2) {
        continue;
      }
      const over = row.scrollWidth - row.clientWidth;
      if (over > 0) {
        const w = slots[0].offsetWidth;
        row.style.setProperty('--squeeze', `${-Math.min(w * 0.82, over / (slots.length - 1) + 6)}px`);
      }
    }
  }

  // ------------------------------------------------------------------ animations

  flip(before, me, prev) {
    const libraryPile = this.table.querySelector('.me-info [data-zone="library"]');
    const libRect = libraryPile ? libraryPile.getBoundingClientRect() : null;
    for (const [k, slot] of this.slots) {
      if (!slot.isConnected) {
        continue;
      }
      const old = before.get(k);
      const now = slot.getBoundingClientRect();
      if (old) {
        const dx = old.left + old.width / 2 - (now.left + now.width / 2);
        const dy = old.top + old.height / 2 - (now.top + now.height / 2);
        const scale = old.width && now.width ? old.width / now.width : 1;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2 || Math.abs(scale - 1) > 0.05) {
          slot.animate([{transform: `translate(${dx}px, ${dy}px) scale(${scale})`, zIndex: 30}, {transform: 'none', zIndex: 30}],
            {duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)'});
        }
      } else if (prev) {
        // Nouvelle carte : depuis la bibliothèque pour ma main, sinon apparition.
        const card = this.cards.get(k);
        if (card && card.zone === 'hand' && card.owner === me.id && libRect) {
          const dx = libRect.left + libRect.width / 2 - (now.left + now.width / 2);
          const dy = libRect.top + libRect.height / 2 - (now.top + now.height / 2);
          slot.animate([{transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.4}, {transform: 'none', opacity: 1}],
            {duration: 480, easing: 'cubic-bezier(.2,.75,.25,1)'});
        } else {
          slot.animate([{transform: 'scale(0.6)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 320, easing: 'ease-out'});
        }
      }
    }
  }

  fadeOut(slot) {
    const r = slot.getBoundingClientRect();
    const ghost = slot.cloneNode(true);
    ghost.classList.add('fly-ghost');
    Object.assign(ghost.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0});
    document.body.appendChild(ghost);
    slot.remove();
    requestAnimationFrame(() => {
      ghost.style.transform = 'scale(0.7) translateY(-10px)';
      ghost.style.opacity = '0';
    });
    setTimeout(() => ghost.remove(), 500);
  }

  lifeEffects(state, prev) {
    for (const p of state.players) {
      const before = this.prevLife.get(p.id);
      this.prevLife.set(p.id, p.life);
      if (before === undefined || before === p.life || !prev) {
        continue;
      }
      const hit = this.table.querySelector(`.player-hit[data-pid="${p.id}"]`);
      if (!hit) {
        continue;
      }
      const r = hit.getBoundingClientRect();
      const t = this.table.getBoundingClientRect();
      const delta = p.life - before;
      const f = el(`<div class="float-num ${delta < 0 ? 'down' : 'up'}">${delta > 0 ? '+' : ''}${delta}</div>`);
      f.style.left = (r.left - t.left + r.width / 2) + 'px';
      f.style.top = (r.top - t.top - 6) + 'px';
      this.table.appendChild(f);
      setTimeout(() => f.remove(), 1400);
      if (delta < 0) {
        hit.classList.remove('shake');
        void hit.offsetWidth;
        hit.classList.add('shake');
      }
    }
  }

  turnBanner(state, me) {
    const key = state.game.turn + ':' + state.game.activePlayer;
    if (key === this.prevTurnKey || state.game.turn < 1) {
      this.prevTurnKey = key;
      return;
    }
    const first = !this.prevTurnKey;
    this.prevTurnKey = key;
    if (first && state.game.mulligan) {
      return;
    }
    const active = state.players.find(p => p.id === state.game.activePlayer);
    const mine = active && active.id === me.id;
    this.table.querySelectorAll('.banner').forEach(old => old.remove());
    const b = el(`<div class="banner">${mine ? 'Votre tour' : 'Tour de ' + esc(active ? active.name : '')}<small>Tour ${state.game.turn}</small></div>`);
    this.table.appendChild(b);
    setTimeout(() => b.remove(), 1700);
  }

  drawArrows(state) {
    const svg = this.table && this.table.querySelector('svg.arrows g');
    if (!svg) {
      return;
    }
    const t = this.table.getBoundingClientRect();
    const center = (node) => {
      if (!node) {
        return null;
      }
      const r = node.getBoundingClientRect();
      return {x: r.left - t.left + r.width / 2, y: r.top - t.top + r.height / 2};
    };
    const cardNode = (id) => this.slots.get('c' + id);
    const playerNode = (id) => this.table.querySelector(`.player-hit[data-pid="${id}"]`);
    const curve = (a, b, cls) => {
      if (!a || !b) {
        return '';
      }
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - Math.min(80, Math.abs(a.x - b.x) * 0.15 + 20);
      return `<path class="${cls}" d="M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}"/>`;
    };
    let html = '';
    for (const c of state.combat || []) {
      const from = center(cardNode(c.attacker));
      if (!c.blockers.length && c.defender !== undefined) {
        html += curve(from, center(c.defenderIsPlayer ? playerNode(c.defender) : cardNode(c.defender)), 'atk');
      }
      for (const b of c.blockers) {
        html += curve(center(cardNode(b)), from, 'blk');
      }
    }
    const top = state.stack[0];
    if (top) {
      const from = center(this.table.querySelector(`.stack-item[data-sid="${top.id}"]`));
      for (const id of top.targetCards || []) {
        html += curve(from, center(cardNode(id)), 'tgt');
      }
      for (const id of top.targetPlayers || []) {
        html += curve(from, center(playerNode(id)), 'tgt');
      }
    }
    svg.innerHTML = html;
  }

  // ------------------------------------------------------------------ zones et détails

  cardDetails(card) {
    const bits = [];
    if (card.damage) {
      bits.push(`Blessures marquées : ${card.damage}`);
    }
    if (card.counters) {
      bits.push('Marqueurs : ' + Object.entries(card.counters).map(([k, v]) => `${counterLabel(k)} ×${v}`).join(', '));
    }
    if (card.sick && card.creature && card.zone === 'battlefield') {
      bits.push('Mal d\'invocation');
    }
    if (card.tapped) {
      bits.push('Engagée');
    }
    return bits.length ? `<div class="muted" style="margin-top:10px">${bits.map(esc).join('<br>')}</div>` : '';
  }

  openZone(pid, zone) {
    if (zone === 'library') {
      toast('Ta bibliothèque est cachée. Le menu de triche permet d\'y chercher une carte.');
      return;
    }
    this.trayZone = {pid, zone};
    this.refreshTray(true);
  }

  refreshTray(force = false) {
    const state = this.state;
    if (!state || !this.table) {
      return;
    }
    // Ouverture automatique quand Forge demande de choisir une carte dans une zone cachée.
    const p = state.prompt || {};
    if (!this.trayZone && p.selectMax > 0) {
      for (const pl of state.players) {
        for (const zone of ['graveyard', 'exile', 'command']) {
          if (pl.zones[zone].some(c => c.selectable)) {
            const k = pl.id + zone + p.message;
            if (this.autoTrayKey !== k) {
              this.autoTrayKey = k;
              this.trayZone = {pid: pl.id, zone, auto: true};
            }
          }
        }
      }
    }
    let tray = this.table.querySelector('.zone-tray');
    if (!this.trayZone) {
      tray && tray.remove();
      return;
    }
    const player = state.players.find(pl => pl.id === this.trayZone.pid);
    const cards = player ? player.zones[this.trayZone.zone] : [];
    if (this.trayZone.auto && !cards.some(c => c.selectable) && !force) {
      this.trayZone = null;
      tray && tray.remove();
      return;
    }
    const names = {graveyard: 'Cimetière', exile: 'Exil', command: 'Zone de commandement'};
    if (!tray) {
      tray = el('<div class="zone-tray"><header><h2></h2><button class="btn small">Fermer</button></header><div class="cards"></div></div>');
      tray.querySelector('header .btn').addEventListener('click', () => {
        this.trayZone = null;
        tray.remove();
      });
      tray.addEventListener('click', (e) => {
        const slot = e.target.closest('.slot');
        if (slot) {
          e.stopPropagation();
          const card = this.cards.get(slot.dataset.key) || slot._card;
          if (card && (card.selectable || card.playable)) {
            bridge.send('card', {id: card.id});
          } else if (card) {
            showZoom(card, this.cardDetails(card));
          }
        }
      });
      this.table.appendChild(tray);
    }
    tray.querySelector('h2').textContent = `${names[this.trayZone.zone] || ''} — ${player ? player.name : ''} (${cards.length})`;
    const box = tray.querySelector('.cards');
    box.replaceChildren(...[...cards].reverse().map(c => {
      const s = el('<div class="slot"></div>');
      const inner = cardElement(c);
      inner.classList.toggle('selectable', !!c.selectable);
      inner.classList.toggle('playable', !!c.playable && !c.selectable);
      inner.classList.toggle('highlighted', !!c.highlighted);
      s.appendChild(inner);
      s._card = c;
      return s;
    }));
    if (!cards.length) {
      box.appendChild(el('<div class="muted">Vide.</div>'));
    }
  }

  // ------------------------------------------------------------------ tiroirs : journal, triche, menu

  openDrawer(kind) {
    const drawer = this.table.querySelector('[data-drawer]');
    if (this.drawer === kind) {
      this.closeDrawer();
      return;
    }
    this.drawer = kind;
    drawer.classList.add('open');
    if (kind === 'log') {
      drawer.innerHTML = '<header><h2>Journal</h2><button class="btn small close">✕</button></header><div class="content log"></div>';
      this.renderLog();
    } else if (kind === 'cheat') {
      this.renderCheat(drawer);
    } else {
      this.renderMenu(drawer);
    }
    drawer.querySelector('.close').addEventListener('click', () => this.closeDrawer());
  }

  /** Ferme le tiroir ou la zone ouverte ; renvoie vrai s'il y avait quelque chose à fermer. */
  closeOverlays() {
    if (this.drawer) {
      this.closeDrawer();
      return true;
    }
    if (this.trayZone) {
      this.trayZone = null;
      this.refreshTray();
      return true;
    }
    return false;
  }

  closeDrawer() {
    this.drawer = null;
    this.table && this.table.querySelector('[data-drawer]').classList.remove('open');
  }

  renderLog() {
    const box = this.table.querySelector('[data-drawer] .log');
    if (!box || !this.state) {
      return;
    }
    box.innerHTML = this.state.log.map(e => `<div class="log-entry k-${esc(e.kind)}">${esc(e.text)}</div>`).join('') || '<div class="muted">Rien pour l\'instant.</div>';
  }

  renderMenu(drawer) {
    const s = this.state.settings || {};
    const myStops = new Set(s.myStops || []);
    const theirStops = new Set(s.theirStops || []);
    const rows = PHASES.filter(([k]) => k !== 'UNTAP' && k !== 'CLEANUP').map(([k, label]) => `<tr>
      <td>${esc(label)}</td>
      <td style="text-align:center"><input type="checkbox" data-stop="my" value="${k}" ${myStops.has(k) ? 'checked' : ''}></td>
      <td style="text-align:center"><input type="checkbox" data-stop="their" value="${k}" ${theirStops.has(k) ? 'checked' : ''}></td></tr>`).join('');
    drawer.innerHTML = `<header><h2>Menu</h2><button class="btn small close">✕</button></header>
      <div class="content">
        <section>
          <h3>Priorité</h3>
          <label class="check"><input type="checkbox" data-set="autoPass" ${s.autoPass ? 'checked' : ''}> Passer automatiquement quand je ne peux rien faire</label>
          <p class="muted small">Les arrêts cochés donnent la main même sans action possible sur mon propre tour.</p>
        </section>
        <section>
          <h3>Arrêts de phase</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr class="muted"><th style="text-align:left">Étape</th><th>Mon tour</th><th>Adversaires</th></tr>${rows}
          </table>
        </section>
        <section>
          <h3>Partie</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn" data-menu="passTurn">Passer jusqu'à la fin du tour</button>
            <button class="btn danger" data-menu="concede">Abandonner la partie</button>
            <button class="btn" data-menu="leave">Quitter vers le menu</button>
          </div>
        </section>
      </div>`;
    const send = () => {
      bridge.send('settings', {settings: {
        autoPass: drawer.querySelector('[data-set="autoPass"]').checked,
        myStops: [...drawer.querySelectorAll('[data-stop="my"]:checked')].map(i => i.value),
        theirStops: [...drawer.querySelectorAll('[data-stop="their"]:checked')].map(i => i.value),
      }});
    };
    drawer.querySelectorAll('input').forEach(i => i.addEventListener('change', send));
    drawer.querySelector('[data-menu="passTurn"]').addEventListener('click', () => {
      bridge.send('passTurn');
      this.closeDrawer();
    });
    drawer.querySelector('[data-menu="concede"]').addEventListener('click', async () => {
      if (await confirmBox('Abandonner ?', 'La partie sera perdue.', {yes: 'Abandonner', danger: true})) {
        bridge.send('concede');
        this.closeDrawer();
      }
    });
    drawer.querySelector('[data-menu="leave"]').addEventListener('click', async () => {
      if (this.state.game.gameOver || await confirmBox('Quitter la partie ?', 'La partie en cours sera abandonnée.', {yes: 'Quitter', danger: true})) {
        this.closeDrawer();
        this.onExit();
      }
    });
  }

  renderCheat(drawer) {
    const state = this.state;
    const me = state.players.find(p => p.me);
    if (this.cheatTarget === null || !state.players.some(p => p.id === this.cheatTarget)) {
      this.cheatTarget = me.id;
    }
    const players = state.players.map(p => `<span class="chip${p.id === this.cheatTarget ? ' on' : ''}" data-target="${p.id}">${esc(p.name)}</span>`).join('');
    const opponent = state.players.find(p => !p.me && !p.lost);
    drawer.innerHTML = `<header><h2>✨ Triche</h2><button class="btn small close">✕</button></header>
      <div class="content">
        <p class="muted small">Disponible quand tu as la main (priorité ou choix). Agit sur le joueur choisi.</p>
        <section><h3>Joueur</h3><div class="chips targets">${players}</div></section>
        <section><h3>Mana</h3>
          <div class="grid-btns">${MANA_ORDER.map(c => `<button class="btn" data-mana-add="${c}">${c === 'C' ? '<span class="ms">◇</span>' : `<span class="ms ms-${c}"></span>`} +1</button>`).join('')}</div>
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn small" data-mana-add="WWWWWUUUUUBBBBBRRRRRGGGGGCCCCC">+5 de chaque</button><input type="text" placeholder="ex. WWUG" class="mana-custom" style="flex:1"><button class="btn small" data-mana-custom>Ajouter</button></div>
        </section>
        <section><h3>Ajouter une carte</h3>
          <div class="cheat-search"><input type="search" class="card-q" placeholder="Nom en français ou en anglais" style="width:100%"><div class="cheat-results"></div></div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <select class="card-zone"><option value="hand">Main</option><option value="battlefield">Champ de bataille</option><option value="library">Dessus de la bibliothèque</option><option value="graveyard">Cimetière</option><option value="exile">Exil</option></select>
            <input type="number" class="card-count" value="1" min="1" max="20" style="width:64px">
            <button class="btn gold small" data-add-card>Ajouter</button>
          </div>
        </section>
        <section><h3>Piocher</h3><div class="grid-btns"><button class="btn" data-draw="1">1 carte</button><button class="btn" data-draw="3">3 cartes</button><button class="btn" data-draw="7">7 cartes</button></div></section>
        <section><h3>Points de vie</h3>
          <div class="grid-btns"><button class="btn" data-life="-5">−5</button><button class="btn" data-life="-1">−1</button><button class="btn" data-life="1">+1</button><button class="btn" data-life="5">+5</button><button class="btn" data-life="10">+10</button><button class="btn" data-life="20">+20</button></div>
          <div style="display:flex;gap:6px;margin-top:6px"><input type="number" class="life-set" placeholder="Fixer à…" style="flex:1"><button class="btn small" data-life-set>Fixer</button></div>
        </section>
        <section><h3>Tour</h3>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn" data-cheat="endTurn">Terminer le tour en cours</button>
            <button class="btn" data-skip>${opponent ? `Faire passer le prochain tour de ${esc(opponent.name)}` : 'Faire passer le prochain tour'}</button>
            <button class="btn" data-cheat="untapAll">Dégager tous les permanents du joueur</button>
          </div>
        </section>
        <section><h3>Divers</h3>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="check"><input type="checkbox" data-toggle="viewAll"> Voir toutes les cartes cachées</label>
            <label class="check"><input type="checkbox" data-toggle="unlimitedLands"> Terrains illimités par tour</label>
            <div class="grid-btns" style="grid-template-columns:1fr 1fr">
              <button class="btn small" data-cheat="tutor">Chercher dans la bibliothèque</button>
              <button class="btn small" data-cheat="addCounters">Ajouter des marqueurs</button>
              <button class="btn small" data-cheat="removeCounters">Retirer des marqueurs</button>
              <button class="btn small" data-cheat="addToken">Créer un jeton</button>
              <button class="btn small" data-cheat="tapPermanents">Engager des permanents</button>
              <button class="btn small" data-cheat="untapPermanents">Dégager des permanents</button>
            </div>
            <button class="btn danger" data-cheat="win">Gagner la partie</button>
          </div>
        </section>
      </div>`;
    const target = () => this.cheatTarget;
    const cheat = (op, extra = {}) => bridge.send('cheat', {op, player: target(), ...extra});
    drawer.querySelector('.targets').addEventListener('click', (e) => {
      const c = e.target.closest('[data-target]');
      if (c) {
        this.cheatTarget = Number(c.dataset.target);
        drawer.querySelectorAll('[data-target]').forEach(x => x.classList.toggle('on', x === c));
      }
    });
    let picked = null;
    const results = drawer.querySelector('.cheat-results');
    const q = drawer.querySelector('.card-q');
    q.addEventListener('input', debounce(async () => {
      const text = q.value.trim();
      if (text.length < 2) {
        results.innerHTML = '';
        return;
      }
      const r = await bridge.request('searchCards', {query: {text, limit: 25}});
      results.innerHTML = '';
      for (const c of r.cards) {
        const b = el(`<button>${esc(c.nameFr)}${c.nameFr !== c.name ? ` <span class="muted small">${esc(c.name)}</span>` : ''} ${manaHtml(c.cost)}</button>`);
        b.addEventListener('click', () => {
          picked = c.name;
          results.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        });
        results.appendChild(b);
      }
    }, 200));
    drawer.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) {
        return;
      }
      if (b.dataset.manaAdd) {
        cheat('mana', {mana: b.dataset.manaAdd});
      } else if (b.hasAttribute('data-mana-custom')) {
        cheat('mana', {mana: drawer.querySelector('.mana-custom').value});
      } else if (b.hasAttribute('data-add-card')) {
        if (!picked) {
          toast('Choisis d\'abord une carte dans la liste.');
          return;
        }
        cheat('addCard', {name: picked, zone: drawer.querySelector('.card-zone').value, count: Number(drawer.querySelector('.card-count').value) || 1});
        toast(`Ajout de ${picked}.`);
      } else if (b.dataset.draw) {
        cheat('draw', {count: Number(b.dataset.draw)});
      } else if (b.dataset.life) {
        cheat('life', {delta: Number(b.dataset.life)});
      } else if (b.hasAttribute('data-life-set')) {
        const v = Number(drawer.querySelector('.life-set').value);
        if (!Number.isNaN(v)) {
          cheat('life', {value: v});
        }
      } else if (b.hasAttribute('data-skip')) {
        const opp = this.cheatTarget === me.id ? opponent : state.players.find(p => p.id === this.cheatTarget);
        if (opp) {
          bridge.send('cheat', {op: 'skipTurn', player: opp.id});
        }
      } else if (b.dataset.cheat) {
        cheat(b.dataset.cheat);
        if (['tutor', 'addCounters', 'removeCounters', 'addToken', 'tapPermanents', 'untapPermanents', 'win'].includes(b.dataset.cheat)) {
          this.closeDrawer();
        }
      }
    });
    drawer.querySelectorAll('[data-toggle]').forEach(i => i.addEventListener('change', () => cheat(i.dataset.toggle, {value: i.checked})));
  }

  // ------------------------------------------------------------------ fin de partie

  gameOver(info) {
    if (!this.table || this.over) {
      return;
    }
    const me = this.state && this.state.players.find(p => p.me);
    const won = me && info.winner && info.winner === me.name;
    const title = info.draw ? 'Égalité' : won ? 'Victoire !' : 'Défaite';
    const box = el(`<div class="game-over${won ? '' : ' defeat'}"><div class="box panel">
      <h1>${title}</h1>
      <div class="details">${esc((info.details || []).join('\n'))}${info.turns ? `\nPartie terminée au tour ${info.turns}.` : ''}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn" data-go="board">Voir le plateau</button>
        <button class="btn" data-go="menu">Retour au menu</button>
        <button class="btn gold" data-go="again">Revanche</button>
      </div></div></div>`);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (!b) {
        return;
      }
      if (b.dataset.go === 'board') {
        box.remove();
        this.over = null;
        return;
      }
      box.remove();
      this.over = null;
      if (b.dataset.go === 'again') {
        this.onRematch();
      } else {
        this.onExit();
      }
    });
    this.over = box;
    this.table.appendChild(box);
  }
}
