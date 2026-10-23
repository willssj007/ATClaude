// Plateau de jeu : affiche l'état envoyé par Forge et renvoie les clics du joueur.
//
// Chaque carte affichée est un « emplacement » (.slot) gardé d'un rendu à l'autre et repéré par une clé :
// « c<id> » pour une carte à sa place normale, « s<id> » pour la source d'une capacité sur la pile.
// Quand une carte change de zone, son emplacement est déplacé dans le DOM et animé de l'ancienne
// position vers la nouvelle : la carte vole de la main à la pile, puis au champ de bataille.

import {bridge} from './bridge.js';
import {cardElement, showZoom, onLongPress} from './cards.js';
import {confirmBox} from './dialogs.js';
import {StackPanel} from './stackpanel.js';
import {esc, el, manaHtml, avatarHtml, cutoutRects, PHASES, prefs, toast, debounce, translatePrompt} from './util.js';

const COUNTER_LABELS = {P1P1: '+1/+1', M1M1: '−1/−1', LOYALTY: 'Loyauté', CHARGE: 'Charge', LORE: 'Histoire', DEFENSE: 'Défense', SHIELD: 'Bouclier', STUN: 'Étourdi', OIL: 'Huile', TIME: 'Temps'};
const MANA_ORDER = ['W', 'U', 'B', 'R', 'G', 'C'];
// Panneau de gauche : largeur réglable (px), et largeur du mode compact.
const RAIL_MIN = 78;
const RAIL_MAX = 300;
const RAIL_COMPACT = 86;

function counterLabel(name) {
  return COUNTER_LABELS[name] || name.charAt(0) + name.slice(1).toLowerCase();
}

/** Marqueurs sur une carte : « +6/+6 » plutôt que « +1/+1 ×6 » pour les marqueurs de force et d'endurance. */
function counterBadge(name, count) {
  // Forge les nomme « +1/+1 », « -1/-1 », « +1/+0 »... (ou P1P1 selon les versions).
  const pt = /^([+-]|[PM])(\d+)\/?([+-]|[PM])(\d+)$/.exec(name);
  if (pt) {
    const part = (sign, n) => `${sign === '+' || sign === 'P' ? '+' : '−'}${Number(n) * count}`;
    return `${part(pt[1], pt[2])}/${part(pt[3], pt[4])}`;
  }
  return counterLabel(name) + (count > 1 ? ' ×' + count : '');
}

function isFront(card) {
  return card.creature || card.planeswalker || card.battle;
}

/** Signature des caractéristiques visibles : si elle change, on redessine la carte. */
function faceSig(card) {
  return card.hidden ? 'hidden' : [card.name, card.cost, card.typeLine, card.text, card.image, card.power, card.toughness, card.loyalty, card.colors].join('|');
}

export class Game {
  constructor(root, {onExit, onRematch, onMenu}) {
    this.root = root;
    this.onExit = onExit;
    this.onRematch = onRematch;
    this.onMenu = onMenu || onExit;
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

  /** Reprise d'une sauvegarde : on n'affiche rien avant que Forge ait remis la partie en place. */
  pauseUntilResumed(text) {
    this.paused = true;
    this.showWaiting(text);
  }

  resumed() {
    this.paused = false;
    if (this.lastState) {
      this.setState(this.lastState);
    }
  }

  setState(state) {
    this.lastState = state;
    if (this.paused) {
      return;
    }
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

  // Disposition (paysage) : à gauche les adversaires puis mes infos et mes zones, au centre un plateau
  // commun (adversaire en haut, moi en bas, séparés par une ligne qu'on peut glisser pour agrandir un
  // côté), ma main qui dépasse en bas, et à droite les outils, l'invite et les boutons.
  build(state) {
    const me = state.players.find(p => p.me) || state.players[0];
    const opponents = this.opponentsOf(state, me);
    if (!opponents.some(p => p.id === this.focusPid)) {
      this.focusPid = opponents.length ? opponents[0].id : null;
    }
    this.root.innerHTML = '';
    const table = el(`<div class="table" data-opponents="${opponents.length}">
      <div class="side-l">
        <div class="rail-grip" title="Glisser pour élargir ou rétrécir ce panneau · toucher : compact ou normal"></div>
        <div class="opps">${opponents.length > 1 ? `<div class="opp-view seg" title="Plateaux adverses : un seul à la fois ou tous ensemble">
          <button data-set-view="focus">Un</button><button data-set-view="all">Tous</button></div>` : ''}</div>
        <div class="me-panel">
          <div class="line">
            <div class="player-hit" data-pid="${me.id}">${avatarHtml(me.name, 0, 34)}<div class="life"></div></div>
            <div class="mana-pool"></div>
          </div>
          <div class="stats"></div>
          <div class="zones">
            <div class="pile" data-zone="graveyard" data-pid="${me.id}"><div class="label">Cimet.</div></div>
            <div class="pile" data-zone="exile" data-pid="${me.id}"><div class="label">Exil</div></div>
            <div class="pile command" data-zone="command" data-pid="${me.id}"><div class="label">Cmdt</div></div>
          </div>
        </div>
      </div>
      <div class="board">
        <div class="half opp-half"></div>
        <div class="divider" title="Glisser pour agrandir un côté du plateau · double-touche : moitié-moitié">
          <div class="turn-label"></div><div class="phases"></div><div class="div-end"><span class="grip">⇕</span></div>
        </div>
        <div class="half me-half">
          <div class="row front"></div>
          <div class="row back"><div class="nonlands row"></div><div class="spacer"></div><div class="lands row"></div></div>
        </div>
        <div class="hand-band"><div class="hand"></div></div>
      </div>
      <div class="side-r">
        <div class="toolbar">
          <button class="btn small" data-open="cheat" title="Menu de triche">✨<span class="lbl"> Triche</span></button>
          <button class="btn small" data-open="log" title="Journal de la partie">📜</button>
          <button class="btn small" data-open="menu" title="Menu">☰</button>
        </div>
        <div class="hud-actions">
          <div class="prompt"></div>
          <div class="btn-row extra"></div>
          <div class="btn-row main">
            <button class="btn cancel-btn"></button>
            <button class="btn gold main-action ok-btn"></button>
          </div>
          <span class="toggle hold" title="Après avoir lancé un sort, garder la priorité pour pouvoir y répondre soi-même"><i></i>Garder la priorité</span>
        </div>
      </div>
      <div class="preview"></div>
      <svg class="arrows"><defs>
        <marker id="arrow-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ef5a5a"/></marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#4fb6ff"/></marker>
        <marker id="arrow-gold" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#ffd26e"/></marker>
      </defs><g></g></svg>
      <div class="drawer" data-drawer></div>
    </div>`);
    const opps = table.querySelector('.opps');
    const half = table.querySelector('.opp-half');
    opponents.forEach((p, i) => {
      opps.appendChild(el(`<div class="opp-card" data-pid="${p.id}">
        <div class="line">
          <div class="player-hit" data-pid="${p.id}">${avatarHtml(p.name, i + 1, 30)}<div class="who"><div class="player-name">${esc(p.name)}</div><div class="life"></div></div></div>
        </div>
        <div class="stats"></div>
        <div class="zones">
          <div class="pile" data-zone="graveyard" data-pid="${p.id}"><div class="label">Cimet.</div></div>
          <div class="pile" data-zone="exile" data-pid="${p.id}"><div class="label">Exil</div></div>
          <div class="pile command" data-zone="command" data-pid="${p.id}"><div class="label">Cmdt</div></div>
        </div>
      </div>`));
      half.appendChild(el(`<div class="opp-field" data-pid="${p.id}">
        <div class="field-tag">${esc(p.name)}</div>
        <div class="row back"><div class="lands row"></div><div class="spacer"></div><div class="nonlands row"></div></div>
        <div class="row front"></div>
      </div>`));
    });
    this.root.appendChild(table);
    this.table = table;
    this.board = table.querySelector('.board');
    this.applyRail(prefs.get('railWidth'));
    this.slots.clear();
    this.handOpen = false;
    this.applySplit(this.split());
    this.stackPanel = new StackPanel(table, {
      anchor: this.board,
      pillHost: table.querySelector('.div-end'),
    });
    this.bindEvents(table);
  }

  /** Part du plateau donnée à l'adversaire (0,5 = moitié-moitié), réglée en glissant la ligne du milieu. */
  split() {
    const s = Number(prefs.get('boardSplit'));
    return s >= 0.2 && s <= 0.8 ? s : 0.5;
  }

  applySplit(s) {
    this.board.style.gridTemplateRows = `minmax(0, ${s.toFixed(3)}fr) auto minmax(0, ${(1 - s).toFixed(3)}fr) var(--band)`;
  }

  /** Vue des plateaux adverses : « focus » (un seul, au choix) ou « all » (tous côte à côte). */
  oppView() {
    const saved = prefs.get('oppView');
    if (saved === 'focus' || saved === 'all') {
      return saved;
    }
    return this.board && this.board.clientWidth >= 900 ? 'all' : 'focus';
  }

  /** Montre le plateau de cet adversaire (vue « un seul ») et déplie sa fiche. */
  focus(pid) {
    if (this.focusPid === pid) {
      return;
    }
    this.focusPid = pid;
    if (this.state) {
      this.render(this.state, true);
    }
  }

  /** À chaque nouveau tour d'un adversaire, on suit son plateau ; un adversaire éliminé cède la place. */
  updateFocus(state, me) {
    const opponents = state.players.filter(p => p.id !== me.id);
    if (!opponents.length) {
      return;
    }
    const alive = opponents.filter(p => !p.lost);
    const turnKey = state.game.turn + ':' + state.game.activePlayer;
    if (turnKey !== this.focusTurnKey) {
      this.focusTurnKey = turnKey;
      const active = alive.find(p => p.id === state.game.activePlayer);
      if (active) {
        this.focusPid = active.id;
      }
    }
    const current = opponents.find(p => p.id === this.focusPid);
    if (!current || (current.lost && alive.length)) {
      this.focusPid = (alive[0] || opponents[0]).id;
    }
  }

  stackItemClicked(sid, row) {
    const item = this.state && this.state.stack.find(s => s.id === sid);
    if (item && item.selectable) {
      bridge.send('stackItem', {id: sid});
      return;
    }
    const card = this.cards.get(row.querySelector('.slot')?.dataset.key);
    if (card) {
      const text = item ? item.text : row.dataset.text || '';
      const detail = item && item.detail && item.detail !== item.text ? `<div class="muted small" style="margin-top:6px">${esc(item.detail)}</div>` : '';
      showZoom(card, `<div style="margin-top:10px">${esc(text)}</div>${detail}`);
    }
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

    // Type du dernier appui (doigt ou souris) : au doigt, la main se déplie avant qu'on choisisse une carte.
    this.pointerType = 'mouse';
    table.addEventListener('pointerdown', (e) => {
      this.pointerType = e.pointerType || 'mouse';
    }, true);
    this.bindHandSwipe(table.querySelector('.hand'));
    this.bindDivider(table.querySelector('.divider'));
    this.bindRailGrip(table);

    table.addEventListener('click', (e) => {
      if (consumed()) {
        return;
      }
      const toolbarBtn = e.target.closest('[data-open]');
      if (toolbarBtn) {
        this.openDrawer(toolbarBtn.dataset.open);
        return;
      }
      const stackItem = e.target.closest('.stack-item');
      if (stackItem) {
        this.stackItemClicked(Number(stackItem.dataset.sid), stackItem);
        return;
      }
      if (e.target.closest('.drawer, .stack-panel, .stack-pill')) {
        return;
      }
      const view = e.target.closest('[data-set-view]');
      if (view) {
        prefs.set('oppView', view.dataset.setView);
        this.render(this.state, true);
        return;
      }
      const inHand = e.target.closest('.hand-band');
      if (this.handOpen && !inHand) {
        // Main dépliée : toucher le plateau la replie, sans rien jouer.
        this.setHandOpen(false);
        return;
      }
      if (inHand && this.pointerType !== 'mouse' && !this.handOpen) {
        this.setHandOpen(true);
        return;
      }
      const handOf = e.target.closest('[data-hand-of]');
      if (handOf) {
        this.openZone(Number(handOf.dataset.handOf), 'hand');
        return;
      }
      if (e.target.closest('.me-panel .stat.lib')) {
        this.openZone(0, 'library');
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
        if (inHand && this.handOpen && !this.handNeeded) {
          this.setHandOpen(false);
        }
        return;
      }
      if (inHand) {
        this.setHandOpen(!this.handOpen);
        return;
      }
      const hit = e.target.closest('.player-hit');
      const oppCard = e.target.closest('.opp-card');
      if (hit) {
        const pid = Number(hit.dataset.pid);
        const player = this.state && this.state.players.find(p => p.id === pid);
        if (oppCard && player && !player.selectable && pid !== this.focusPid) {
          this.focus(pid);
        } else {
          bridge.send('player', {id: pid});
        }
        return;
      }
      if (oppCard) {
        this.focus(Number(oppCard.dataset.pid));
        return;
      }
      const mana = e.target.closest('[data-mana]');
      if (mana) {
        bridge.send('useMana', {color: mana.dataset.mana});
        return;
      }
      const promptCard = e.target.closest('.prompt-card');
      if (promptCard && promptCard._card) {
        showZoom(promptCard._card, this.cardDetails(promptCard._card));
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
    table.querySelector('.hud-actions .extra').addEventListener('click', (e) => {
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

    // Le plateau est reconstruit quand les joueurs changent : un seul exemplaire des écouteurs globaux.
    this.destroy();
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
    window.addEventListener('resize', this.onResize = debounce(() => {
      if (this.state) {
        this.render(this.state, true);
      }
      this.stackPanel && this.stackPanel.place();
    }, 120));
    window.addEventListener('cutout', this.onCutout = () => this.table && this.dodgeCutout());
  }

  setHandOpen(open) {
    this.handOpen = open;
    const hand = this.table && this.table.querySelector('.hand');
    if (hand) {
      hand.classList.toggle('open', open);
      this.fanHand(hand, hand.querySelectorAll(':scope > .slot').length);
    }
  }

  /** Glisser une carte de la main vers le haut la joue directement (comme dans Arena). */
  bindHandSwipe(hand) {
    let start = null;
    hand.addEventListener('pointerdown', (e) => {
      const slot = e.target.closest('.slot');
      start = slot && e.pointerType !== 'mouse' ? {x: e.clientX, y: e.clientY, slot, id: e.pointerId} : null;
    });
    hand.addEventListener('pointerup', (e) => {
      if (!start || e.pointerId !== start.id) {
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const slot = start.slot;
      start = null;
      if (dy < -45 && Math.abs(dx) < Math.abs(dy)) {
        this.swallowClick = true;
        setTimeout(() => {
          this.swallowClick = false;
        }, 400);
        bridge.send('card', {id: Number(slot.dataset.key.slice(1))});
        if (!this.handNeeded) {
          this.setHandOpen(false);
        }
      }
    });
    hand.addEventListener('pointercancel', () => {
      start = null;
    });
    hand.addEventListener('click', (e) => {
      if (this.swallowClick) {
        this.swallowClick = false;
        e.stopPropagation();
      }
    }, true);
  }

  /** La ligne du milieu se glisse pour donner plus de place à un côté ; double-touche pour revenir au milieu. */
  bindDivider(divider) {
    let drag = null;
    let lastTap = 0;
    divider.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, .stack-pill')) {
        return;
      }
      const now = e.timeStamp;
      if (now - lastTap < 320) {
        lastTap = 0;
        prefs.set('boardSplit', 0.5);
        this.applySplit(0.5);
        this.afterResize();
        return;
      }
      lastTap = now;
      drag = {id: e.pointerId, y: e.clientY, moved: false};
      divider.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    divider.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      if (!drag.moved && Math.abs(e.clientY - drag.y) < 4) {
        return;
      }
      drag.moved = true;
      divider.classList.add('dragging');
      const b = this.board.getBoundingClientRect();
      const band = this.board.querySelector('.hand-band').offsetHeight;
      const avail = b.height - band - divider.offsetHeight;
      const s = Math.max(0.2, Math.min(0.8, (e.clientY - b.top - divider.offsetHeight / 2) / avail));
      this.applySplit(s);
      drag.split = s;
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      divider.classList.remove('dragging');
      if (drag.moved && drag.split) {
        prefs.set('boardSplit', drag.split);
        lastTap = 0;
        this.afterResize();
      }
      drag = null;
    };
    divider.addEventListener('pointerup', end);
    divider.addEventListener('pointercancel', end);
  }

  /** Après un changement de taille du plateau : resserre les rangées et redessine les flèches. */
  afterResize() {
    this.fitRows();
    const hand = this.table.querySelector('.hand');
    this.fanHand(hand, hand.querySelectorAll(':scope > .slot').length);
    if (this.state) {
      requestAnimationFrame(() => this.drawArrows(this.state));
    }
    this.stackPanel && this.stackPanel.place();
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('cutout', this.onCutout);
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
        // Auras et équipements glissés sous leur hôte, décalés vers le haut : on lit leur nom au-dessus.
        const atts = attachments.get(card.id) || [];
        atts.forEach((a, k) => {
          const s = this.slot('c' + a.id, a, used);
          s.classList.add('attached');
          s.classList.remove('stacked', 'attacking', 'has-attach');
          s.style.setProperty('--att-level', String(atts.length - k));
          list.push(s);
        });
        const slot = this.slot('c' + card.id, card, used);
        slot.classList.toggle('attacking', combat.has(card.id));
        slot.classList.remove('attached');
        slot.classList.toggle('has-attach', atts.length > 0);
        const stack = opts.stackLands && card.land && prevLand && prevLand.name === card.name && prevLand.tapped === card.tapped
          && !card.counters && !atts.length && !card.selectable && !card.highlighted;
        slot.classList.toggle('stacked', !!stack);
        prevLand = card.land ? card : null;
        list.push(slot);
      }
      if (!opts.hand) {
        for (const slot of list) {
          slot.firstElementChild.style.removeProperty('--fan');
          slot.firstElementChild.style.removeProperty('--arc');
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
    place(table.querySelector('.me-half > .row.front'), mine.front);
    place(table.querySelector('.me-half .back .nonlands'), mine.nonlands);
    place(table.querySelector('.me-half .back .lands'), mine.lands, {stackLands: true});
    const hand = table.querySelector('.hand');
    place(hand, me.zones.hand, {hand: true});
    // Main dépliée d'office quand Forge demande d'y choisir des cartes (défausse, etc.).
    const needed = me.zones.hand.some(c => c.selectable);
    if (needed !== !!this.handNeeded) {
      this.handNeeded = needed;
      this.handOpen = needed;
    }
    hand.classList.toggle('open', !!this.handOpen);
    this.fanHand(hand, me.zones.hand.length);

    // Adversaires : plateau suivi (vue « un seul ») ou tous côte à côte.
    this.updateFocus(state, me);
    const view = state.players.length > 2 ? this.oppView() : 'all';
    table.dataset.oppview = view;
    table.querySelectorAll('[data-set-view]').forEach(b => b.classList.toggle('on', b.dataset.setView === view));
    this.cardController = new Map();
    for (const p of state.players) {
      for (const c of p.zones.battlefield) {
        this.cardController.set(c.id, p.id);
      }
      if (p.id === me.id) {
        continue;
      }
      const field = table.querySelector(`.opp-field[data-pid="${p.id}"]`);
      const card = table.querySelector(`.opp-card[data-pid="${p.id}"]`);
      if (!field || !card) {
        continue;
      }
      const f = splitField(p);
      place(field.querySelector('.row.front'), f.front);
      place(field.querySelector('.back .nonlands'), f.nonlands);
      place(field.querySelector('.back .lands'), f.lands, {stackLands: true});
      const focused = p.id === this.focusPid;
      field.classList.toggle('focused', focused);
      card.classList.toggle('focused', focused);
      for (const box of [field, card]) {
        box.classList.toggle('active', state.game.activePlayer === p.id);
        box.classList.toggle('lost', !!p.lost);
      }
      // Un plateau masqué où il y a quelque chose à choisir : sa fiche s'allume.
      card.classList.toggle('has-selectable', !focused && view === 'focus' && p.zones.battlefield.some(c => c.selectable));
      this.renderPlayerHead(card, p, false);
      this.renderPile(card.querySelector('[data-zone="graveyard"]'), p.zones.graveyard, used);
      this.renderPile(card.querySelector('[data-zone="exile"]'), p.zones.exile, used);
      const cmd = card.querySelector('[data-zone="command"]');
      this.renderPile(cmd, p.zones.command, used, null, true);
      cmd.classList.toggle('hidden', p.zones.command.length === 0);
    }

    // Mes zones.
    const panel = table.querySelector('.me-panel');
    this.renderPlayerHead(panel, me, true);
    this.renderPile(panel.querySelector('[data-zone="graveyard"]'), me.zones.graveyard, used);
    this.renderPile(panel.querySelector('[data-zone="exile"]'), me.zones.exile, used);
    const command = panel.querySelector('[data-zone="command"]');
    this.renderPile(command, me.zones.command, used, null, true);
    command.classList.toggle('hidden', me.zones.command.length === 0);

    const cardNames = new Map();
    for (const p of state.players) {
      for (const zone of Object.values(p.zones)) {
        for (const c of zone) {
          if (!c.hidden && c.name) {
            cardNames.set(c.id, c.name);
          }
        }
      }
    }
    this.stackPanel.update(state.stack, state.players, (item) => {
      // La carte elle-même est sur la pile pour un sort ; pour une capacité, on montre une copie de sa source.
      const key = item.source.zone === 'stack' && !item.ability ? 'c' + item.source.id : 's' + item.id;
      return this.slot(key, item.source, used);
    }, (item) => [
      ...(item.targetPlayers || []).map(id => (state.players.find(p => p.id === id) || {}).name),
      ...(item.targetCards || []).map(id => cardNames.get(id) || 'carte cachée'),
    ].filter(Boolean).join(', '));
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
        html += `<div class="b-counters">${entries.map(([k, v]) => `<div class="b-counter">${esc(counterBadge(k, v))}</div>`).join('')}</div>`;
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

  renderPlayerHead(box, p, isMe) {
    const hit = box.querySelector('.player-hit');
    hit.classList.toggle('selectable', !!p.selectable);
    hit.classList.toggle('highlighted', !!p.highlighted);
    hit.classList.toggle('priority', !!p.priority);
    const life = hit.querySelector('.life');
    life.textContent = p.life;
    life.classList.toggle('low', p.life <= 10);
    const stats = box.querySelector('.stats');
    let html = '';
    if (!isMe && p.controlledByMe) {
      html += `<span class="stat ctrl" title="Tu contrôles ce joueur">🎮</span><span class="stat hand-of" data-hand-of="${p.id}" title="Ouvrir sa main">✋ <b>${p.handSize}</b> ▸</span>`;
    } else if (!isMe) {
      html += `<span class="stat" title="Cartes en main">✋ <b>${p.handSize}</b></span>`;
    }
    html += `<span class="stat lib" data-zone="library" title="Bibliothèque">📚 <b>${p.library}</b></span>`;
    if (p.poison) {
      html += `<span class="stat poison" title="Poison">☠ <b>${p.poison}</b></span>`;
    }
    if (p.energy) {
      html += `<span class="stat" title="Énergie">⚡ <b>${p.energy}</b></span>`;
    }
    for (const d of p.commanderDamage || []) {
      html += `<span class="stat cmd" title="Blessures de commandant : ${esc(d.name)}">⚔ <b>${d.damage}</b>/21</span>`;
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
    const html = PHASES.filter(([k]) => k !== 'UNTAP' && k !== 'CLEANUP').map(([k, label, short]) =>
      `<span class="ph${state.game.phase === k ? ' now' : ''}${stops.has(k) ? ' stop' : ''}" title="${esc(label)}"><span class="s">${esc(short)}</span><span class="l">${esc(label)}</span></span>`).join('');
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
    if (p.input === 'InputPassPriority' && /^Priorit/.test(message)) {
      // Forge répète tour, phase et pile, déjà affichés sur la ligne du milieu : on dit plutôt quoi faire.
      const active = state.players.find(pl => pl.id === state.game.activePlayer);
      const ruled = state.players.find(pl => pl.controlledByMe && pl.priority);
      message = ruled ? `Tu joues pour ${ruled.name} : ${state.stack.length ? 'réponds avec ses cartes ou laisse résoudre.' : 'joue une de ses cartes (✋ sur sa fiche) ou passe.'}`
        : state.stack.length ? 'Un sort est sur la pile : réponds ou laisse-le se résoudre.'
        : state.game.activePlayer === me.id ? 'À toi : joue une carte ou passe.'
          : `Tour de ${active ? active.name : 'l\'adversaire'} : tu peux répondre ou passer.`;
    }
    if (!message && waiting) {
      message = state.game.activePlayer === me.id ? '' : 'L\'adversaire joue…';
    }
    promptBox.textContent = message;
    promptBox.classList.toggle('waiting', waiting);
    // Carte dont parle l'invite, quand elle n'est pas visible sur le plateau (regard d'une carte, etc.).
    const info = p.cardInfo && !p.cardInfo.hidden && !['battlefield', 'hand'].includes(p.cardInfo.zone) ? p.cardInfo : null;
    let thumb = this.table.querySelector('.prompt-card');
    if (info) {
      if (!thumb) {
        thumb = el('<div class="prompt-card" title="Toucher pour agrandir"></div>');
        promptBox.before(thumb);
      }
      if (thumb._sig !== faceSig(info)) {
        thumb.replaceChildren(cardElement(info));
        thumb._sig = faceSig(info);
        thumb._card = info;
      }
    } else if (thumb) {
      thumb.remove();
    }

    const ok = this.table.querySelector('.ok-btn');
    const cancel = this.table.querySelector('.cancel-btn');
    let okLabel = p.okLabel || 'OK';
    if (p.input === 'InputPassPriority' && /^ok$/i.test(okLabel)) {
      okLabel = state.stack.length ? 'Résoudre' : 'Passer';
    }
    ok.textContent = okLabel;
    ok.disabled = !p.okEnabled;
    ok.classList.toggle('hidden', !p.okEnabled && waiting);
    let cancelLabel = p.cancelLabel || 'Annuler';
    if (p.input === 'InputAttack') {
      // Forge propose « Frappe Alpha » (tout le monde attaque) ou « Rappeler » (plus personne n'attaque).
      cancelLabel = /rappel/i.test(cancelLabel) ? '↺ Personne n\'attaque' : '⚔ Tout attaquer';
    }
    cancel.textContent = cancelLabel;
    cancel.classList.toggle('hidden', !p.cancelEnabled);

    const extra = this.table.querySelector('.extra');
    let html = '';
    if (p.input === 'InputPassPriority' || p.input === 'InputPayMana') {
      html += '<button class="btn small ghost" data-act="undo" title="Défaire la dernière action (engagement de mana...)">↶ Défaire</button>';
    }
    if (extra._html !== html) {
      extra.innerHTML = html;
      extra._html = html;
    }
    this.table.querySelector('.hold').classList.toggle('on', !!(state.settings && state.settings.holdPriority));
  }

  fanHand(hand, n) {
    if (!n) {
      return;
    }
    const slots = [...hand.querySelectorAll(':scope > .slot')];
    const width = slots[0] ? slots[0].offsetWidth || 80 : 80;
    const avail = hand.clientWidth || 600;
    const natural = width * n;
    let overlap = -width * 0.06;
    if (natural + overlap * (n - 1) > avail) {
      overlap = Math.max(-width * 0.8, (avail - natural) / (n - 1));
    }
    hand.style.setProperty('--hand-overlap', overlap + 'px');
    const spread = Math.min(3, 30 / n);
    slots.forEach((slot, i) => {
      const offset = i - (n - 1) / 2;
      const card = slot.firstElementChild;
      card.style.setProperty('--fan', `${offset * spread}deg`);
      card.style.setProperty('--arc', `${Math.abs(offset) * Math.min(3, 18 / n)}px`);
    });
  }

  /**
   * Plateau trop plein : les cartes de chaque moitié rétrécissent ensemble (jusqu'à la moitié de leur taille)
   * pour que chaque rangée tienne dans sa largeur ; au-delà seulement, elles se chevauchent.
   * Les mesures se font sans transition, sinon on lirait des largeurs en cours d'animation.
   */
  fitRows() {
    const table = this.table;
    table.classList.add('measuring');
    const slotsOf = (row) => row ? [...row.querySelectorAll(':scope > .slot')] : [];
    // Largeur occupée par les cartes d'une rangée, d'un bord à l'autre (marges négatives comprises).
    const extent = (row) => {
      const s = slotsOf(row);
      return s.length ? s[s.length - 1].offsetLeft + s[s.length - 1].offsetWidth - s[0].offsetLeft : 0;
    };
    const ROW_GAP = 6;
    const ROW_PAD = 8;
    table.querySelectorAll('.row').forEach(r => r.style.setProperty('--squeeze', '0px'));
    for (const half of table.querySelectorAll('.me-half, .opp-field')) {
      if (!half.offsetWidth) {
        continue; // plateau adverse masqué
      }
      half.style.setProperty('--fit', '1');
      const front = half.querySelector(':scope > .row.front');
      const back = half.querySelector(':scope > .row.back');
      front && front.classList.remove('wrap');
      let fit = 1;
      let frontFit = 1;
      // Rangée de devant : ses cartes seules. Rangée du fond : non-terrains + terrains, séparés par un vide.
      const lines = [
        {avail: front ? front.clientWidth : 0, parts: [front]},
        {avail: back ? back.clientWidth : 0, parts: back ? [back.querySelector('.nonlands'), back.querySelector('.lands')] : [], extra: 4 + 2 * ROW_GAP},
      ];
      for (const line of lines) {
        const n = line.parts.reduce((a, r) => a + slotsOf(r).length, 0);
        if (!n || !line.avail) {
          continue;
        }
        const fixed = ROW_PAD + (line.extra || 0) + line.parts.reduce((a, r) => a + Math.max(0, slotsOf(r).length - 1) * ROW_GAP, 0);
        const scalable = line.parts.reduce((a, r) => a + extent(r), 0) - line.parts.reduce((a, r) => a + Math.max(0, slotsOf(r).length - 1) * ROW_GAP, 0);
        if (scalable + fixed > line.avail && scalable > 0) {
          const f = (line.avail - fixed) / scalable;
          if (line.parts[0] === front) {
            frontFit = f;
          } else {
            fit = Math.min(fit, f);
          }
        }
      }
      // Créatures trop nombreuses pour une ligne, même réduites de moitié : deux lignes, dans la hauteur que
      // la réduction a libérée (plus lisible que des cartes qui se chevauchent).
      const slotH = front && slotsOf(front).length ? Math.max(...slotsOf(front).map(x => x.offsetHeight)) : 0;
      if (frontFit < 0.5 && slotH) {
        const byHeight = (front.clientHeight - 8) / (2 * slotH);
        const twoLines = Math.min(1, byHeight, frontFit * 2 * 0.95);
        if (twoLines > frontFit) {
          front.classList.add('wrap');
          frontFit = twoLines;
        }
      }
      fit = Math.min(fit, frontFit);
      fit = Math.max(front && front.classList.contains('wrap') ? 0.3 : 0.5, Math.min(1, fit));
      if (fit < 1) {
        half.style.setProperty('--fit', fit.toFixed(3));
      }
    }
    // Toujours trop large à la taille minimale : les cartes se chevauchent.
    for (const row of table.querySelectorAll('.board .row')) {
      const slots = slotsOf(row);
      if (slots.length < 2 || row.classList.contains('back') || row.classList.contains('wrap')) {
        continue;
      }
      const over = extent(row) + (row.parentElement.classList.contains('back') ? 0 : ROW_PAD) - row.clientWidth;
      if (over > 0) {
        const w = slots[0].offsetWidth;
        row.style.setProperty('--squeeze', `${-Math.min(w * 0.82, over / (slots.length - 1) + 2)}px`);
      }
    }
    void table.offsetWidth;
    table.classList.remove('measuring');
    this.dodgeCutout();
  }

  /**
   * Encoche de la caméra (Android) : le plateau va jusqu'au bord de l'écran ; seuls les blocs des colonnes
   * qui passeraient dessous s'en écartent.
   */
  dodgeCutout() {
    const holes = cutoutRects();
    if (!holes.length && !this.dodged) {
      return;
    }
    const blocks = this.table.querySelectorAll('.side-l .opps > *, .side-l .me-panel, .side-r .toolbar, .side-r .hud-actions > *');
    blocks.forEach(b => {
      b.style.marginLeft = '';
      b.style.marginRight = '';
    });
    this.dodged = holes.length > 0;
    const middle = window.innerWidth / 2;
    blocks.forEach(b => {
      const r = b.getBoundingClientRect();
      for (const h of holes) {
        if (h.t < r.bottom && h.b > r.top && h.l < r.right && h.r > r.left) {
          if (h.l < middle) {
            b.style.marginLeft = Math.ceil(h.r - r.left + 4) + 'px';
          } else {
            b.style.marginRight = Math.ceil(r.right - h.l + 4) + 'px';
          }
        }
      }
    });
  }

  /** Largeur du panneau de gauche (null : largeur normale, selon l'écran). */
  applyRail(width) {
    if (width) {
      this.table.style.setProperty('--rail-l', Math.round(width) + 'px');
    } else {
      this.table.style.removeProperty('--rail-l');
    }
  }

  /** Poignée du panneau de gauche : on la glisse pour régler sa largeur ; un toucher passe en compact ou revient. */
  bindRailGrip(table) {
    const grip = table.querySelector('.rail-grip');
    const side = table.querySelector('.side-l');
    if (!grip || !side) {
      return;
    }
    let drag = null;
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      grip.setPointerCapture(e.pointerId);
      drag = {id: e.pointerId, x: e.clientX, left: side.getBoundingClientRect().left, moved: false, width: null};
      grip.classList.add('dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      if (Math.abs(e.clientX - drag.x) > 6) {
        drag.moved = true;
      }
      if (drag.moved) {
        drag.width = Math.max(RAIL_MIN, Math.min(RAIL_MAX, e.clientX - drag.left + 6));
        this.applyRail(drag.width);
        this.afterResize();
      }
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      grip.classList.remove('dragging');
      if (drag.moved && drag.width) {
        prefs.set('railWidth', Math.round(drag.width));
      } else {
        // Toucher : compact, ou retour à la largeur normale.
        const compact = side.getBoundingClientRect().width > RAIL_COMPACT + 8;
        prefs.set('railWidth', compact ? RAIL_COMPACT : null);
        this.applyRail(compact ? RAIL_COMPACT : null);
      }
      drag = null;
      this.afterResize();
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('click', (e) => e.stopPropagation());
  }

  // ------------------------------------------------------------------ animations

  flip(before, me, prev) {
    const libraryPile = this.table.querySelector('.me-panel .stat.lib');
    const libRect = libraryPile ? libraryPile.getBoundingClientRect() : null;
    for (const [k, slot] of this.slots) {
      if (!slot.isConnected) {
        continue;
      }
      const now = slot.getBoundingClientRect();
      if (!now.width) {
        // Plateau adverse masqué (vue « un seul ») : rien à animer.
        continue;
      }
      // Une carte qui sort d'un plateau masqué apparaît simplement à sa nouvelle place.
      const seen = before.get(k);
      const old = seen && seen.width ? seen : null;
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
    if (key === this.prevTurnKey || state.game.turn < 1 || state.game.gameOver) {
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
    const shown = (node) => node && node.isConnected && node.getClientRects().length > 0 ? node : null;
    const playerNode = (id) => this.table.querySelector(`.player-hit[data-pid="${id}"]`);
    // Carte d'un plateau adverse masqué : la flèche va à la fiche de son joueur.
    const cardNode = (id) => shown(this.slots.get('c' + id))
      || (this.cardController && this.cardController.has(id) ? playerNode(this.cardController.get(id)) : null);
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
      const from = center(shown(this.stackPanel.itemNode(top.id)));
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
      bits.push('Marqueurs : ' + Object.entries(card.counters).map(([k, v]) => counterBadge(k, v)).join(', '));
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
    // Adversaire contrôlé qui a la priorité pendant son tour, avec des cartes jouables : sa main s'ouvre (une fois par
    // phase). Sur les autres tours, l'invite suffit : on ouvre sa main soi-même pour lui faire répondre.
    const ruled = state.players.find(pl => pl.controlledByMe && pl.priority && pl.id === state.game.activePlayer
      && pl.zones.hand.some(c => c.playable || c.selectable));
    if (!this.trayZone && ruled) {
      const k = `${ruled.id}hand${state.game.turn}${state.game.phase}`;
      if (this.autoTrayKey !== k) {
        this.autoTrayKey = k;
        this.trayZone = {pid: ruled.id, zone: 'hand', auto: true};
      }
    }
    if (!this.trayZone && p.selectMax > 0) {
      for (const pl of state.players) {
        for (const zone of pl.controlledByMe ? ['graveyard', 'exile', 'command', 'hand'] : ['graveyard', 'exile', 'command']) {
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
    if (this.trayZone.auto && !cards.some(c => c.selectable || (this.trayZone.zone === 'hand' && c.playable)) && !force) {
      this.trayZone = null;
      tray && tray.remove();
      return;
    }
    const names = {graveyard: 'Cimetière', exile: 'Exil', command: 'Zone de commandement', hand: 'Main'};
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
            if (!card.selectable) {
              // Carte jouée depuis la zone (commandant, flashback...) : la fenêtre se ferme.
              this.trayZone = null;
              tray.remove();
            }
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
    if (this.handOpen) {
      this.setHandOpen(false);
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
            <button class="btn" data-menu="leave">Retour au menu (la partie est gardée)</button>
            <button class="btn danger" data-menu="concede">Abandonner la partie</button>
            <p class="muted small">La partie est sauvegardée à chaque phase calme : si l'application se ferme, elle se reprend depuis l'accueil.</p>
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
    drawer.querySelector('[data-menu="leave"]').addEventListener('click', () => {
      this.closeDrawer();
      if (this.state.game.gameOver) {
        this.onExit();
      } else {
        this.onMenu();
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
        <section><h3>Contrôler un adversaire</h3>
          <p class="muted small">Tu prends toutes ses décisions (sorts, attaques, choix) comme avec Mindslaver, jusqu'à ce que tu le rendes. Sa main s'ouvre depuis sa fiche (✋).</p>
          <div style="display:flex;flex-direction:column;gap:6px">${state.players.filter(p => !p.me && !p.lost).map(p => `<label class="check"><input type="checkbox" data-control="${p.id}" ${p.controlledByMe ? 'checked' : ''}> Contrôler ${esc(p.name)}</label>`).join('') || '<span class="muted small">Aucun adversaire en jeu.</span>'}</div>
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
    drawer.querySelectorAll('[data-control]').forEach(i => i.addEventListener('change', () => {
      bridge.send('cheat', {op: 'control', player: Number(i.dataset.control), value: i.checked});
    }));
  }

  // ------------------------------------------------------------------ fin de partie

  gameOver(info) {
    if (!this.table || this.over) {
      return;
    }
    this.table.querySelectorAll('.banner').forEach(b => b.remove());
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
