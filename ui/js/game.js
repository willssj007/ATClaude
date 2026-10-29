// Plateau de jeu : affiche l'état envoyé par Forge et renvoie les clics du joueur.
//
// Chaque carte affichée est un « emplacement » (.slot) gardé d'un rendu à l'autre et repéré par une clé :
// « c<id> » pour une carte à sa place normale, « s<id> » pour la source d'une capacité sur la pile.
// Quand une carte change de zone, son emplacement est déplacé dans le DOM et animé de l'ancienne
// position vers la nouvelle : la carte vole de la main à la pile, puis au champ de bataille.

import {bridge} from './bridge.js';
import {cardElement, hoverCard, onLongPress, showZoom} from './cards.js';
import {fillRewardCards, rewardHtml} from './career.js';
import {confirmBox} from './dialogs.js';
import {StackPanel} from './stackpanel.js';
import {boardFx} from './themes.js';
import {icon} from './icons.js';
import {esc, el, manaHtml, avatarHtml, ownPhotoUrl, cutoutRects, PHASES, prefs, rulesHtml, toast, debounce, translatePrompt} from './util.js';

const COUNTER_LABELS = {P1P1: '+1/+1', M1M1: '−1/−1', LOYALTY: 'Loyauté', CHARGE: 'Charge', LORE: 'Histoire', DEFENSE: 'Défense', SHIELD: 'Bouclier', STUN: 'Étourdi', OIL: 'Huile', TIME: 'Temps'};
const MANA_ORDER = ['W', 'U', 'B', 'R', 'G', 'C'];
// Marqueurs que peut avoir un joueur (noms de Forge) : icône, libellé, seuil de défaite éventuel.
const PLAYER_COUNTERS = {
  POISON: {icon: 'poison', label: 'Poison', cls: 'poison', max: 10},
  ENERGY: {icon: 'energy', label: 'Énergie', cls: 'energy'},
  EXPERIENCE: {icon: 'experience', label: 'Expérience', cls: 'exp'},
  RAD: {icon: 'rad', label: 'Radiation', cls: 'rad'},
  TICKET: {icon: 'ticket', label: 'Tickets', cls: 'ticket'},
};
// Journal : icône et teinte de chaque sorte d'entrée de Forge.
const LOG_KINDS = {
  TURN: {icon: 'banner', cls: 'turn', label: 'Tour'},
  PHASE: {icon: 'hourglass', cls: 'phase', label: 'Étape'},
  MULLIGAN: {icon: 'cards', cls: 'info', label: 'Mulligan'},
  ZONE_CHANGE: {icon: 'cards', cls: 'zone', label: 'Déplacement de carte'},
  DISCARD: {icon: 'graveyard', cls: 'zone', label: 'Défausse'},
  PLAYER_CONTROL: {icon: 'puppet', cls: 'info', label: 'Contrôle'},
  DAMAGE: {icon: 'swords', cls: 'damage', label: 'Blessures'},
  LIFE: {icon: 'heart', cls: 'life', label: 'Points de vie'},
  LAND: {icon: 'mountain', cls: 'land', label: 'Terrain joué'},
  COMBAT: {icon: 'shield', cls: 'combat', label: 'Combat'},
  STACK_ADD: {icon: 'wand', cls: 'cast', label: 'Sort ou capacité lancé'},
  STACK_RESOLVE: {icon: 'scroll', cls: 'resolve', label: 'Résolution'},
  EFFECT_REPLACED: {icon: 'shield', cls: 'info', label: 'Effet de remplacement'},
  MANA: {icon: 'gem', cls: 'mana', label: 'Mana'},
  INFORMATION: {icon: 'eye', cls: 'info', label: 'Information'},
  GAME_OUTCOME: {icon: 'crown', cls: 'outcome', label: 'Fin de partie'},
  MATCH_RESULTS: {icon: 'chalice', cls: 'outcome', label: 'Résultat'},
  ANTE: {icon: 'purse', cls: 'info', label: 'Ante'},
  DRAFT: {icon: 'cards', cls: 'info', label: 'Draft'},
};
const ZONE_WORDS = [[/cimeti[eè]re|graveyard/i, 'graveyard'], [/exil/i, 'exile'], [/biblioth[eè]que|library/i, 'library'],
  [/\bmain\b|hand/i, 'hand'], [/champ de bataille|battlefield/i, 'castle'], [/commandement|command/i, 'crown']];
const LOG_FILTER_LABELS = {all: 'Tout', spells: 'Sorts', combat: 'Combat', life: 'Vie', cards: 'Cartes'};
const LOG_FILTERS = {
  spells: ['STACK_ADD', 'STACK_RESOLVE', 'LAND', 'EFFECT_REPLACED'],
  combat: ['COMBAT', 'DAMAGE'],
  life: ['LIFE', 'DAMAGE'],
  cards: ['ZONE_CHANGE', 'DISCARD', 'LAND', 'MULLIGAN'],
};
// Statuts posés par Forge dans la zone de commandement sous forme d'« effets ».
const PLAYER_STATUSES = {
  'The Monarch': {icon: 'crown', label: 'Monarque : pioche une carte de plus à sa fin de tour'},
  'The Initiative': {icon: 'torch', label: 'Initiative : s\'aventure dans la Ville souterraine'},
  'City\'s Blessing': {icon: 'sun', label: 'Bénédiction de la cité'},
  'The Ring': {icon: 'ring', label: 'L\'Anneau l\'a tenté'},
};
// Petites icônes sur les cartes en jeu : mal d'invocation, capacités (y compris celles données par d'autres cartes).
const CARD_STATUS = {
  SICK: {icon: 'sleep', label: 'Mal d\'invocation : ne peut ni attaquer ni s\'engager ce tour'},
  FLYING: {icon: 'wing', label: 'Vol'},
  FIRST_STRIKE: {icon: 'sword', label: 'Initiative'},
  DOUBLE_STRIKE: {icon: 'sword2', label: 'Double initiative'},
  DEATHTOUCH: {icon: 'skull', label: 'Contact mortel'},
  LIFELINK: {icon: 'heart', label: 'Lien de vie'},
  VIGILANCE: {icon: 'eye', label: 'Vigilance'},
  TRAMPLE: {icon: 'hoof', label: 'Piétinement'},
  HASTE: {icon: 'bolt', label: 'Célérité'},
  MENACE: {icon: 'horns', label: 'Menace'},
  REACH: {icon: 'net', label: 'Portée'},
  DEFENDER: {icon: 'wall', label: 'Défenseur'},
  HEXPROOF: {icon: 'shield', label: 'Défense talismanique'},
  SHROUD: {icon: 'shield', label: 'Linceul'},
  WARD: {icon: 'ward', label: 'Garde'},
  INDESTRUCTIBLE: {icon: 'gem2', label: 'Indestructible'},
  INFECT: {icon: 'poison', label: 'Infection'},
  PHASED_OUT: {icon: 'ghost', label: 'Hors phase'},
  RING: {icon: 'ring', label: 'Porteur de l\'Anneau'},
};
const PLAYER_KEYWORDS = {Hexproof: 'Défense talismanique', Shroud: 'Linceul', 'Protection from everything': 'Protection contre tout'};

/** Pose une propriété CSS seulement si elle change (chaque écriture fait recalculer le style de ce qu'il y a dessous). */
function setProp(node, prop, value) {
  node._props = node._props || {};
  if (node._props[prop] !== value) {
    node._props[prop] = value;
    node.style.setProperty(prop, value);
  }
}

function counterLabel(name) {
  // Forge nomme ses marqueurs « Loyalty », « Charge »... (majuscule puis minuscules).
  return COUNTER_LABELS[name.toUpperCase()] || name.charAt(0) + name.slice(1).toLowerCase();
}

/** Nombre de marqueurs d'un type sur une carte (« LOYALTY » trouve « Loyalty »), undefined s'il n'y en a pas. */
function counterCount(card, type) {
  if (!card.counters) {
    return undefined;
  }
  const key = Object.keys(card.counters).find(k => k.toUpperCase() === type);
  return key === undefined ? undefined : card.counters[key];
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

/**
 * Clé d'empilement d'un permanent : des cartes en jeu identiques (même carte, même état, mêmes marqueurs, mêmes
 * blessures, même rôle dans le combat, même possibilité d'action) se rangent en une pile, comme sur Arena. Null :
 * jamais empilée (carte avec une aura ou un équipement, ou attachée elle-même).
 */
function stackKey(card, hasAttachments) {
  if (hasAttachments || card.attachedTo || card.hidden) {
    return null;
  }
  return [card.name, card.image, card.tapped ? 1 : 0, card.sick ? 1 : 0, card.power, card.toughness, card.loyalty,
    card.damage || 0, card.counters ? JSON.stringify(card.counters) : '', card.token ? 1 : 0, card.commander ? 1 : 0,
    card.attacking ? 1 : 0, card.blocking ? 1 : 0, card.selectable ? 1 : 0, card.highlighted ? 1 : 0, card.playable ? 1 : 0,
    (card.status || []).join(',')].join('|');
}

/** Rangée triée par arrivée, les cartes identiques regroupées à la place de la première d'entre elles. */
function groupIdentical(cards, attached) {
  const groups = new Map();
  for (const c of [...cards].sort((a, b) => a.id - b.id)) {
    const key = stackKey(c, attached.has(c.id)) ?? 'seul:' + c.id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(c);
  }
  return [...groups.values()].flat();
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

  // Disposition façon Arena : le plateau prend tout l'écran, sans panneau de côté. L'adversaire en haut, moi en bas,
  // séparés par une ligne (tour, phases, outils) qu'on peut glisser pour agrandir un côté. Chaque joueur a une petite
  // plaque posée sur son plateau, entre ses terrains et ses autres permanents (la place lui est réservée : elle ne
  // cache jamais de carte). En bas : mes piles à gauche, ma main au milieu, l'invite et les boutons à droite.
  build(state) {
    const me = state.players.find(p => p.me) || state.players[0];
    const opponents = this.opponentsOf(state, me);
    if (!opponents.some(p => p.id === this.focusPid)) {
      this.focusPid = opponents.length ? opponents[0].id : null;
    }
    this.root.innerHTML = '';
    const pile = (zone, ic, title, cls = '') => `<div class="pile ${cls}" data-zone="${zone}" data-pid="${me.id}" title="${title}"><div class="label">${icon(ic)}</div></div>`;
    const table = el(`<div class="table" data-opponents="${opponents.length}">
      <div class="board">
        <div class="half opp-half"></div>
        <div class="divider" title="Glisser pour agrandir un côté du plateau · double-touche : moitié-moitié">
          <div class="div-start"><div class="turn-label"></div></div>
          <div class="phases"></div>
          <div class="div-end">
            <span class="pill-host"></span>
            ${opponents.length > 1 ? `<button class="tool" data-set-view="all">${icon('cards')}</button>` : ''}
            <button class="tool" data-open="cheat" title="Menu de triche">${icon('wand')}</button>
            <button class="tool" data-open="log" title="Journal de la partie">${icon('scroll')}</button>
            <button class="tool" data-open="menu" title="Menu">${icon('menu')}</button>
          </div>
        </div>
        <div class="half me-half">
          <div class="row front"></div>
          <div class="row back"><div class="nonlands row"></div><div class="spacer"><div class="plates">
            <div class="plate me" data-pid="${me.id}">
              <div class="player-hit" data-pid="${me.id}">${avatarHtml(me.name, 0, 34, ownPhotoUrl())}<div class="life"></div></div>
              <div class="info"><div class="mana-pool"></div><div class="stats"></div></div>
            </div>
          </div></div><div class="lands row"></div></div>
        </div>
        <div class="hand-band">
          <div class="my-piles">
            <div class="pile lib" data-zone="library" data-pid="${me.id}" title="Bibliothèque (touche pour la voir)"><div class="mcard back"><div class="face"></div></div><div class="seen">${icon('eye')}</div></div>
            ${pile('graveyard', 'graveyard', 'Cimetière')}
            ${pile('exile', 'exile', 'Exil')}
            ${pile('command', 'crown', 'Zone de commandement', 'command')}
          </div>
          <div class="hand"></div>
          <div class="hand-scroller"><button class="btn small ghost" data-hs="-1" title="Cartes précédentes">${icon('chevronLeft')}</button><input type="range" min="0" max="1000" value="0" aria-label="Faire défiler la main"><button class="btn small ghost" data-hs="1" title="Cartes suivantes">${icon('chevronRight')}</button></div>
        </div>
      </div>
      <div class="actions">
        <div class="prompt-row"><div class="prompt"></div></div>
        <div class="btn-row extra"></div>
        <div class="btn-row main">
          <button class="btn cancel-btn"></button>
          <button class="btn gold main-action ok-btn"></button>
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
    // Fond mythique animé : son calque passe derrière tout le plateau.
    const fx = boardFx(document.documentElement.dataset.boardTheme);
    if (fx) {
      table.prepend(fx);
    }
    const half = table.querySelector('.opp-half');
    this.plates = new Map();
    opponents.forEach((p, i) => {
      const field = el(`<div class="opp-field" data-pid="${p.id}">
        <div class="row back"><div class="lands row"></div><div class="spacer"><div class="plates"></div></div><div class="nonlands row"></div></div>
        <div class="row front"></div>
      </div>`);
      const plate = el(`<div class="plate opp" data-pid="${p.id}">
        <div class="player-hit" data-pid="${p.id}">${avatarHtml(p.name, i + 1, 34)}<div class="life"></div></div>
        <div class="info"><div class="player-name">${esc(p.name)}</div><div class="stats"></div></div>
      </div>`);
      field.querySelector('.plates').appendChild(plate);
      this.plates.set(p.id, plate);
      half.appendChild(field);
    });
    this.root.appendChild(table);
    this.table = table;
    this.board = table.querySelector('.board');
    this.slots.clear();
    this.handOpen = false;
    this.applySplit(this.split());
    // Taille des moitiés du plateau et des plaques des joueurs, suivie sans forcer de calcul de mise en page : la
    // taille de base des cartes et la place laissée aux plaques en dépendent (voir fitRows).
    this.halfObserver && this.halfObserver.disconnect();
    this.halfObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        e.target._size = {w: e.contentRect.width, h: e.contentRect.height};
      }
      if (this.state) {
        this.fitRows();
      }
    });
    table.querySelectorAll('.me-half, .opp-field, .plates').forEach(h => this.halfObserver.observe(h));
    this.cardMax = 0;
    this.stackPanel = new StackPanel(table, {
      anchor: this.board,
      pillHost: table.querySelector('.pill-host'),
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
    const opponents = this.opponentsOf(state, me);
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

  /** Adversaires dans l'ordre du tour, sans les éliminés (leur place disparaît), sauf s'ils le sont tous (fin). */
  opponentsOf(state, me) {
    const idx = state.players.findIndex(p => p.id === me.id);
    const ordered = [...state.players.slice(idx + 1), ...state.players.slice(0, idx)];
    const alive = ordered.filter(p => !p.lost);
    return alive.length ? alive : ordered;
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
    this.bindHandScroller(table.querySelector('.hand'), table.querySelector('.hand-scroller'));
    this.bindDivider(table.querySelector('.divider'));

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
      if (e.target.closest('.drawer, .stack-panel, .stack-pill, .hand-scroller')) {
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
      const zone = e.target.closest('.pile, .stat[data-zone]');
      if (zone) {
        this.openZone(Number(zone.dataset.pid), zone.dataset.zone);
        return;
      }
      const slot = e.target.closest('.slot');
      // Créature équipée ou enchantée : ses pièces jointes s'écartent (ou se rangent), en plus de l'action habituelle.
      this.toggleSpread(slot && slot.classList.contains('has-attach') ? Number(slot.dataset.key.slice(1)) : null);
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
      // Plaque d'un adversaire dont le plateau est masqué (vue « un seul ») : on montre son plateau, sauf s'il faut
      // le choisir (cible...).
      const hit = e.target.closest('.player-hit');
      const plate = e.target.closest('.plate.opp');
      if (hit || plate) {
        const pid = Number((hit || plate).dataset.pid);
        const player = this.state && this.state.players.find(p => p.id === pid);
        if (plate && table.dataset.oppview === 'focus' && pid !== this.focusPid && !(player && player.selectable)) {
          this.focus(pid);
        } else if (hit) {
          bridge.send('player', {id: pid});
        }
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
    table.querySelector('.actions .extra').addEventListener('click', (e) => {
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
      this.cardMax = 0;
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

  /** Main en défilement : curseur et flèches au-dessus des cartes, molette de la souris à l'horizontale. */
  bindHandScroller(hand, scroller) {
    const range = scroller.querySelector('input');
    const max = () => Math.max(0, hand.scrollWidth - hand.clientWidth);
    hand.addEventListener('scroll', () => {
      range.value = max() ? Math.round(hand.scrollLeft / max() * 1000) : 0;
    }, {passive: true});
    range.addEventListener('input', () => {
      hand.scrollLeft = Number(range.value) / 1000 * max();
    });
    scroller.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hs]');
      const slot = hand.querySelector(':scope > .slot');
      if (b && slot) {
        hand.scrollBy({left: Number(b.dataset.hs) * slot.offsetWidth * 2.5, behavior: 'smooth'});
      }
    });
    hand.addEventListener('wheel', (e) => {
      if (hand.classList.contains('scroll') && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        hand.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, {passive: false});
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
    this.cardMax = 0;
    this.fitRows();
    const hand = this.table.querySelector('.hand');
    this.fanHand(hand, hand.querySelectorAll(':scope > .slot').length);
    if (this.state) {
      requestAnimationFrame(() => this.drawArrows(this.state));
    }
    this.stackPanel && this.stackPanel.place();
  }

  destroy() {
    this.halfObserver && this.halfObserver.disconnect();
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

  /** Duel du mode Planeswalker : pas de triche, récompenses à la fin. */
  get career() {
    return !!(this.state && this.state.game && this.state.game.career);
  }

  render(state, force = false) {
    const prev = this.state;
    this.state = state;
    if (!state.players || !state.players.length) {
      return;
    }
    const me0 = state.players.find(p => p.me) || state.players[0];
    const key = [me0.id, ...this.opponentsOf(state, me0).map(p => p.id)].join(',');
    if (key !== this.layoutKey) {
      this.build(state);
      this.layoutKey = key;
    }
    this.table.querySelector('[data-open="cheat"]').classList.toggle('hidden', this.career);
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
      let prevKey = null;
      for (const card of cards) {
        // Auras et équipements derrière leur hôte, parfaitement alignés, le haut dépassant (comme sur Arena) ;
        // toucher l'hôte les écarte de part et d'autre pour voir ce qui est attaché.
        const atts = attachments.get(card.id) || [];
        const spread = this.spreadHost === card.id;
        atts.forEach((a, k) => {
          const s = this.slot('c' + a.id, a, used);
          const level = atts.length - k;
          s.classList.add('attached');
          s.classList.remove('stacked', 'attacking', 'has-attach');
          s.classList.toggle('host-tapped', !!card.tapped);
          s.classList.toggle('host-attacking', combat.has(card.id));
          s.classList.toggle('spread', spread);
          s.dataset.host = String(card.id);
          s.style.setProperty('--att-level', String(level));
          // Écartées en alternance à gauche et à droite de l'hôte.
          s.style.setProperty('--spread-x', String((level % 2 ? -1 : 1) * Math.ceil(level / 2)));
          list.push(s);
        });
        const slot = this.slot('c' + card.id, card, used);
        slot.classList.toggle('attacking', combat.has(card.id));
        slot.classList.remove('attached', 'spread', 'host-tapped');
        delete slot.dataset.host;
        slot.classList.toggle('has-attach', atts.length > 0);
        // Même carte, même état que la précédente : posée par-dessus, décalée (pile, avec un compteur sur la dernière).
        const key = opts.hand ? null : stackKey(card, atts.length > 0);
        const stack = key !== null && key === prevKey;
        slot.classList.toggle('stacked', stack);
        prevKey = key;
        list.push(slot);
      }
      if (!opts.hand) {
        for (const slot of list) {
          slot.firstElementChild.style.removeProperty('--fan');
          slot.firstElementChild.style.removeProperty('--arc');
        }
      }
      // Nombre de cartes de chaque pile, sur celle du dessus (la dernière, entièrement visible).
      for (let i = 0; i < list.length; i++) {
        let n = 1;
        while (list[i + n] && list[i + n].classList.contains('stacked')) {
          n++;
        }
        for (let k = 0; k < n; k++) {
          const slot = list[i + k];
          // Cartes recouvertes : leurs pastilles (force, marqueurs) dépasseraient sur la tranche ; celles du dessus suffisent.
          slot.classList.toggle('under', k < n - 1);
          if (k === n - 1 && n > 1) {
            if (slot.dataset.stack !== String(n)) {
              slot.dataset.stack = String(n);
            }
          } else if (slot.dataset.stack) {
            delete slot.dataset.stack;
          }
        }
        i += n - 1;
      }
      this.reconcile(container, list);
    };

    const splitField = (p) => {
      const cards = p.zones.battlefield.filter(c => !(c.attachedTo && !c.attachedToPlayer && onBattlefield.has(c.attachedTo)));
      const hosts = new Set(attachments.keys());
      const front = groupIdentical(cards.filter(isFront), hosts);
      const others = cards.filter(c => !isFront(c));
      const nonlands = groupIdentical(others.filter(c => !c.land), hosts);
      const lands = others.filter(c => c.land).sort((a, b) => (a.name || '').localeCompare(b.name || '') || Number(a.tapped) - Number(b.tapped) || a.id - b.id);
      return {front, nonlands, lands};
    };

    // Mon champ de bataille et ma main.
    const mine = splitField(me);
    place(table.querySelector('.me-half > .row.front'), mine.front);
    place(table.querySelector('.me-half .back .nonlands'), mine.nonlands);
    place(table.querySelector('.me-half .back .lands'), mine.lands);
    const hand = table.querySelector('.hand');
    place(hand, me.zones.hand, {hand: true});
    // Main dépliée d'office quand Forge demande d'y choisir des cartes (défausse, etc.), et pendant le choix
    // de garder sa main ou de faire un mulligan, et de choisir les cartes à remettre en dessous : on voit bien les
    // cartes ; elle se replie une fois décidé.
    const needed = me.zones.hand.some(c => c.selectable) || (state.prompt && ['InputConfirmMulligan', 'InputLondonMulligan'].includes(state.prompt.input));
    if (needed !== !!this.handNeeded) {
      this.handNeeded = needed;
      this.handOpen = needed;
    }
    hand.classList.toggle('open', !!this.handOpen);
    this.fanHand(hand, me.zones.hand.length);

    // Adversaires : plateau suivi (vue « un seul ») ou tous côte à côte.
    this.updateFocus(state, me);
    const view = this.opponentsOf(state, me).length > 1 ? this.oppView() : 'all';
    table.dataset.oppview = view;
    const toggleView = table.querySelector('[data-set-view]');
    if (toggleView) {
      // Un seul bouton : il passe à l'autre vue.
      toggleView.dataset.setView = view === 'all' ? 'focus' : 'all';
      toggleView.title = view === 'all' ? 'Un seul plateau adverse à la fois (toucher une plaque pour changer)' : 'Tous les plateaux adverses côte à côte';
      toggleView.classList.toggle('on', view === 'all');
    }
    const focusField = table.querySelector(`.opp-field[data-pid="${this.focusPid}"]`);
    this.cardController = new Map();
    for (const p of state.players) {
      for (const c of p.zones.battlefield) {
        this.cardController.set(c.id, p.id);
      }
      if (p.id === me.id) {
        continue;
      }
      const field = table.querySelector(`.opp-field[data-pid="${p.id}"]`);
      const plate = this.plates.get(p.id);
      if (!field || !plate) {
        continue;
      }
      const f = splitField(p);
      place(field.querySelector('.row.front'), f.front);
      place(field.querySelector('.back .nonlands'), f.nonlands);
      place(field.querySelector('.back .lands'), f.lands);
      const focused = p.id === this.focusPid;
      field.classList.toggle('focused', focused);
      plate.classList.toggle('focused', focused);
      // Vue « un seul » : toutes les plaques sur le plateau montré (réduites pour les autres) ; sinon chacune sur le sien.
      const host = ((view === 'focus' && focusField) || field).querySelector('.plates');
      if (plate.parentElement !== host) {
        host.appendChild(plate);
      }
      plate.classList.toggle('mini', view === 'focus' && !focused);
      for (const box of [field, plate]) {
        box.classList.toggle('active', state.game.activePlayer === p.id);
        box.classList.toggle('lost', !!p.lost);
      }
      // Un plateau masqué où il y a quelque chose à choisir : sa plaque s'allume.
      plate.classList.toggle('has-selectable', !focused && view === 'focus' && p.zones.battlefield.some(c => c.selectable));
      this.renderPlayerHead(plate, p, false);
    }
    if (focusField) {
      // Plaques dans l'ordre du tour, quel que soit l'ordre des changements de vue.
      const host = focusField.querySelector('.plates');
      const order = this.opponentsOf(state, me).map(p => this.plates.get(p.id)).filter(pl => pl && pl.parentElement === host);
      if (order.some((pl, i) => host.children[i] !== pl)) {
        host.append(...order);
      }
    }

    // Ma plaque et mes piles.
    const myPlate = table.querySelector('.plate.me');
    myPlate.classList.toggle('active', state.game.activePlayer === me.id);
    this.renderPlayerHead(myPlate, me, true);
    const piles = table.querySelector('.my-piles');
    this.renderLibraryPile(piles.querySelector('[data-zone="library"]'), me);
    this.renderPile(piles.querySelector('[data-zone="graveyard"]'), me.zones.graveyard, used);
    const exile = piles.querySelector('[data-zone="exile"]');
    this.renderPile(exile, me.zones.exile, used);
    exile.classList.toggle('hidden', me.zones.exile.length === 0);
    const command = piles.querySelector('[data-zone="command"]');
    this.renderPile(command, me.zones.command, used, null, true);
    command.classList.toggle('hidden', me.zones.command.length === 0);
    const shownPiles = 2 + (me.zones.exile.length > 0) + (me.zones.command.length > 0);
    setProp(table.querySelector('.hand-band'), '--piles', String(shownPiles));

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

  /** Écarte les pièces jointes de cette créature (ou les range si elles l'étaient) ; null : tout ranger. */
  toggleSpread(hostId) {
    const next = hostId !== null && this.spreadHost !== hostId ? hostId : null;
    if (next === this.spreadHost) {
      return;
    }
    this.spreadHost = next;
    for (const s of this.table.querySelectorAll('.slot.attached')) {
      s.classList.toggle('spread', next !== null && s.dataset.host === String(next));
    }
    clearTimeout(this.spreadTimer);
    if (next !== null) {
      this.spreadTimer = setTimeout(() => this.toggleSpread(null), 6000);
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
      const loyalty = counterCount(card, 'LOYALTY') ?? card.loyalty;
      html += `<div class="b-loyalty">${esc(loyalty ?? '')}</div>`;
    }
    if (card.counters) {
      const entries = Object.entries(card.counters).filter(([k]) => !(card.planeswalker && k.toUpperCase() === 'LOYALTY'));
      if (entries.length) {
        html += `<div class="b-counters">${entries.map(([k, v]) => `<div class="b-counter">${esc(counterBadge(k, v))}</div>`).join('')}</div>`;
      }
    }
    if (onField && card.damage) {
      html += `<div class="b-damage">${card.damage}</div>`;
    }
    if (card.commander) {
      html += `<div class="b-crown">${icon('crown')}</div>`;
    }
    if (card.token && onField) {
      html += '<div class="b-token">Jeton</div>';
    }
    if (onField) {
      const status = [...(card.sick && card.creature ? ['SICK'] : []), ...(card.status || [])].filter(k => CARD_STATUS[k]);
      if (status.length) {
        html += `<div class="b-status">${status.map(k => `<span class="st st-${k.toLowerCase()}" title="${esc(CARD_STATUS[k].label)}">${icon(CARD_STATUS[k].icon)}</span>`).join('')}</div>`;
      }
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
    const slots = shown.map(c => this.slot('c' + c.id, c, used));
    // Une carte arrive dans la pile avec l'allure de sa zone d'avant (éventail de la main, engagée, attachée) :
    // dans le cimetière, l'exil et la zone de commandement, elle est droite.
    for (const s of slots) {
      s.classList.remove('tapped', 'attached', 'attacking', 'blocking', 'stacked', 'has-attach', 'host-tapped', 'spread');
      s.style.removeProperty('--att-level');
      s.style.removeProperty('--spread-x');
      s.firstElementChild.style.removeProperty('--fan');
      s.firstElementChild.style.removeProperty('--arc');
    }
    this.reconcile(holder, slots);
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
    const chip = (cls, ic, value, title, extra = '') => `<span class="stat ${cls}" title="${esc(title)}"${extra}>${icon(ic)}${value === '' ? '' : `<b>${value}</b>`}</span>`;
    if (!isMe) {
      if (p.controlledByMe) {
        html += chip('ctrl', 'puppet', '', 'Tu contrôles ce joueur');
        html += chip('hnd hand-of', 'hand', p.handSize, 'Ouvrir sa main', ` data-hand-of="${p.id}"`);
      } else {
        html += chip('hnd', 'hand', p.handSize, 'Cartes en main');
      }
      // Bibliothèque : œil quand le dessus est visible, en surbrillance quand on peut le jouer (Futur aperçu...).
      const top = p.libraryTop || [];
      const libPlayable = top.some(c => c.playable || c.selectable);
      html += chip(`lib${top.length ? ' seen' : ''}${libPlayable ? ' playable' : ''}`, 'library', top.length ? `${p.library}${icon('eye')}` : p.library,
        top.length ? `Bibliothèque : le dessus est visible${libPlayable ? ' et jouable' : ''} (touche pour la voir)` : 'Bibliothèque (touche pour la voir)', ` data-zone="library" data-pid="${p.id}"`);
      // Cimetière, exil et zone de commandement : seulement s'il y a quelque chose dedans ; touche pour les voir.
      for (const [zone, ic, label] of [['graveyard', 'graveyard', 'Cimetière'], ['exile', 'exile', 'Exil'], ['command', 'crown', 'Zone de commandement']]) {
        const cards = p.zones[zone] || [];
        if (cards.length) {
          const pick = cards.some(c => c.selectable || c.playable);
          html += chip(`zone${pick ? ' playable' : ''}`, ic, cards.length, `${label} (touche pour voir)`, ` data-zone="${zone}" data-pid="${p.id}"`);
        }
      }
    }
    // Marqueurs du joueur, mis en valeur quand leur nombre change.
    const prev = (this.prevCounters || (this.prevCounters = new Map())).get(p.id) || {};
    const counters = p.counters || {};
    for (const [name, n] of Object.entries(counters)) {
      if (!n) {
        continue;
      }
      const def = PLAYER_COUNTERS[name.toUpperCase()] || {icon: 'token', label: name, cls: 'other'};
      const bump = prev[name] !== undefined && prev[name] !== n ? ' bump' : '';
      const near = def.max && n >= def.max - 3 ? ' danger' : '';
      html += chip(`pc ${def.cls}${bump}${near}`, def.icon, def.max ? `${n}<small>/${def.max}</small>` : n, `${def.label} : ${n}${def.max ? ' (défaite à ' + def.max + ')' : ''}`);
    }
    this.prevCounters.set(p.id, counters);
    for (const c of p.commanders || []) {
      if (c.casts > 0) {
        html += chip('tax', 'purse', `+${c.casts * 2}`, 'Taxe de commandant (mana en plus pour le relancer)');
      }
    }
    for (const c of p.zones.command || []) {
      const status = PLAYER_STATUSES[c.oracleName];
      if (status) {
        html += chip('status', status.icon, '', status.label);
      }
    }
    if ((p.keywords || []).length) {
      html += chip('status', 'shield', '', (p.keywords || []).map(k => PLAYER_KEYWORDS[k] || k).join(', '));
    }
    if (stats._html !== html) {
      stats.innerHTML = html;
      stats._html = html;
    }
  }

  /** Ma bibliothèque : un dos de carte et le nombre de cartes ; œil quand le dessus est visible, halo s'il est jouable. */
  renderLibraryPile(pile, p) {
    let count = pile.querySelector('.count');
    if (!count) {
      count = el('<div class="count"></div>');
      pile.appendChild(count);
    }
    count.textContent = p.library;
    const top = p.libraryTop || [];
    pile.classList.toggle('seen', top.length > 0);
    pile.classList.toggle('has-selectable', top.some(c => c.playable || c.selectable));
    pile.classList.toggle('empty', !p.library);
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
      // Forge répète tour, phase et pile, déjà affichés sur la ligne du milieu, et le bouton dit déjà « Passer » ou
      // « Résoudre » : pas d'invite, sauf quand on joue pour un autre joueur.
      const ruled = state.players.find(pl => pl.controlledByMe && pl.priority);
      message = ruled ? `Tu joues pour ${ruled.name} : ${state.stack.length ? 'réponds avec ses cartes ou laisse résoudre.' : 'joue une de ses cartes (main sur sa plaque) ou passe.'}` : '';
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
    let cancelHtml = esc(p.cancelLabel || 'Annuler');
    if (p.input === 'InputAttack') {
      // Forge propose « Frappe Alpha » (tout le monde attaque) ou « Rappeler » (plus personne n'attaque).
      cancelHtml = /rappel/i.test(p.cancelLabel || '') ? `${icon('undo')} Personne n'attaque` : `${icon('swords')} Tout attaquer`;
    }
    if (cancel._html !== cancelHtml) {
      cancel.innerHTML = cancelHtml;
      cancel._html = cancelHtml;
    }
    cancel.classList.toggle('hidden', !p.cancelEnabled);

    const extra = this.table.querySelector('.extra');
    let html = '';
    if (p.input === 'InputPassPriority' || p.input === 'InputPayMana') {
      html += `<button class="btn small ghost" data-act="undo" title="Défaire la dernière action (engagement de mana...)">${icon('undo')} Défaire</button>`;
    }
    if (extra._html !== html) {
      extra.innerHTML = html;
      extra._html = html;
    }
  }

  /**
   * Éventail de la main. Dépliée, si les cartes devaient trop se chevaucher (moins de 60 % visibles),
   * elles s'affichent en entier sur une rangée qu'on fait défiler (doigt, curseur, flèches).
   */
  fanHand(hand, n) {
    const slots = [...hand.querySelectorAll(':scope > .slot')];
    const width = slots[0] ? slots[0].offsetWidth || 80 : 80;
    const avail = hand.clientWidth || 600;
    const natural = width * n;
    const scroll = n > 1 && hand.classList.contains('open') && (avail - natural) / (n - 1) < -width * 0.45;
    if (scroll !== hand.classList.contains('scroll')) {
      hand.classList.toggle('scroll', scroll);
      hand.parentElement.classList.toggle('scrolling', scroll);
      hand.scrollLeft = 0;
    }
    if (!n) {
      return;
    }
    if (scroll) {
      hand.style.setProperty('--hand-overlap', '6px');
      for (const slot of slots) {
        slot.firstElementChild.style.removeProperty('--fan');
        slot.firstElementChild.style.removeProperty('--arc');
      }
      hand.dispatchEvent(new Event('scroll'));
      return;
    }
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
   * Taille des cartes du plateau, rangée par rangée (créatures devant ; autres permanents et terrains au fond).
   * Chaque rangée a sa taille de base, tirée de sa part de la hauteur de la moitié, et sa propre réduction : des
   * créatures nombreuses ne rapetissent plus les terrains, et inversement. Quand les créatures passent sur deux
   * lignes, leur rangée prend plus de hauteur si celle du fond peut en céder sans trop rétrécir.
   * Tout est calculé d'après les classes des cartes (droite, engagée, empilée, attachée), comme le fait le CSS, sans
   * aucune mesure : pas de calcul de mise en page forcé, même avec des centaines de cartes.
   * La rangée du fond laisse la place des plaques des joueurs et, chez moi, celle de l'invite et des boutons à droite :
   * rien ne passe dessous. La plaque se met entre terrains et autres permanents (elle prend de la largeur) ou au
   * bord du plateau, au-dessus d'eux (elle prend de la hauteur) : on garde la place qui laisse les plus grandes cartes.
   */
  fitRows() {
    const table = this.table;
    const GAP = 6;       // --gap des rangées
    const PAD = 8;       // marges intérieures gauche et droite d'une rangée
    const R = 88 / 63;   // hauteur / largeur d'une carte (et largeur d'une carte engagée)
    const halves = [...table.querySelectorAll('.me-half, .opp-field')];
    if (!this.cardMax) {
      const style = getComputedStyle(table);
      this.cardMax = parseFloat(style.getPropertyValue('--card-max')) || 124;
      this.actW = parseFloat(style.getPropertyValue('--act-w')) || 0;
    }
    const hiddenOpp = (h) => table.dataset.oppview === 'focus' && h.classList.contains('opp-field') && !h.classList.contains('focused');
    const slotsOf = (row) => row ? [...row.children].filter(x => x.classList.contains('slot')) : [];
    const sizeOf = (half) => half._size || {w: half.clientWidth, h: half.clientHeight};
    // Place prise par les plaques posées sur cette moitié (mesurée par l'observateur ; estimée avant la 1re mesure).
    const platesOf = (half) => {
      const box = half.querySelector('.plates');
      const n = box ? box.children.length : 0;
      return box && n ? (box._size ? {w: box._size.w, h: box._size.h} : {w: 150 * n, h: 40}) : {w: 0, h: 0};
    };
    // Rien n'a changé sur le plateau (vie, phase, invite, mana...) : les tailles en place restent bonnes.
    const sig = [this.cardMax, this.actW, ...halves.map(h => {
      let k = hiddenOpp(h) ? 'masqué' : JSON.stringify(sizeOf(h)) + JSON.stringify(platesOf(h));
      for (const row of h.querySelectorAll('.row.front, .nonlands, .lands')) {
        k += '|';
        for (const slot of slotsOf(row)) {
          const c = slot.classList;
          k += slot.dataset.key + (c.contains('tapped') ? 't' : '') + (c.contains('stacked') ? 's' : '')
            + (c.contains('attached') ? 'a' : '') + (c.contains('host-tapped') ? 'h' : '') + ',';
        }
      }
      return k;
    })].join(';');
    if (sig === this.fitSig) {
      this.dodgeCutout();
      return;
    }
    this.fitSig = sig;
    // Largeur d'une rangée à --fit = 1 : en largeurs de carte (u), plus des pixels fixes (espaces entre cartes) ;
    // j : nombre de jointures que le resserrement (--squeeze) peut rapprocher (pas dans une pile, pas après une pièce
    // jointe, comme dans le CSS).
    const natural = (slots, stackShift) => {
      let u = 0;
      let px = 0;
      let j = 0;
      slots.forEach((slot, i) => {
        const c = slot.classList;
        const attached = c.contains('attached');
        const width = (attached ? c.contains('host-tapped') : c.contains('tapped')) ? R : 1;
        u += width;
        if (i > 0) {
          px += GAP;
          if (c.contains('stacked')) {
            u -= stackShift * (c.contains('tapped') ? R : 1);
          } else if (!slots[i - 1].classList.contains('attached')) {
            j++;
          }
        }
        if (attached) {
          // Derrière son hôte : sa marge droite reprend sa largeur et l'espace qui suit.
          u -= width;
          px -= GAP;
        }
      });
      return {u, px, j, n: slots.length};
    };
    const write = setProp;
    for (const half of halves) {
      if (hiddenOpp(half)) {
        continue; // plateau adverse masqué
      }
      const {w: W, h: H} = sizeOf(half);
      if (!W || !H) {
        continue;
      }
      const front = half.querySelector(':scope > .row.front');
      const back = half.querySelector(':scope > .row.back');
      const nonlands = back && back.querySelector('.nonlands');
      const lands = back && back.querySelector('.lands');
      const F = natural(slotsOf(front), 0.74);
      const B1 = natural(slotsOf(nonlands), 0.74);
      const B2 = natural(slotsOf(lands), 0.8);
      const backU = B1.u + B2.u;
      const plates = platesOf(half);
      const plateH = Math.ceil(plates.h + 4);
      // Entre les deux groupes : la plaque et ses marges en mode « inline » (au moins 4 px) ; chez moi, la colonne
      // des boutons.
      const inset = half.classList.contains('me-half') ? this.actW + 8 : 0;
      const backFixedOf = (mode) => PAD + B1.px + B2.px + (mode === 'inline' ? Math.max(4, plates.w + 8) : 4) + 2 * GAP + inset;
      const frontFixed = PAD + F.px;
      // Taille de base d'une rangée qui a la part share de la hauteur, moins minus pixels (cartes droites, 90 %).
      const base = (share, minus = 0) => Math.max(20, Math.min(this.cardMax, ((H - 10) * share - minus) * 0.9 / R, W / 5));
      const fitFront = (share) => {
        const b = base(share);
        const one = F.u ? Math.min(1, (W - frontFixed) / (F.u * b)) : 1;
        let fit = one;
        let wrap = false;
        // Trop nombreuses pour une ligne, même réduites de moitié : deux lignes, dans la hauteur de la rangée.
        if (one < 0.5) {
          const two = Math.min(1, ((H - 10) * share - 8) / (2 * b * R), one * 2 * 0.95);
          if (two > one) {
            fit = two;
            wrap = true;
          }
        }
        fit = Math.max(wrap ? 0.3 : 0.5, fit);
        return {b, fit, wrap, size: b * fit};
      };
      // eff : taille qu'auraient les cartes pour tenir sans se chevaucher (sous la réduction minimale, elles se
      // chevauchent : c'est ce qui compte pour comparer deux dispositions).
      const fitBack = (share, mode) => {
        const b = base(share, mode === 'edge' ? plateH : 0);
        const raw = backU ? Math.min(1, (W - backFixedOf(mode)) / (backU * b)) : 1;
        const fit = Math.max(0.5, raw);
        return {b, fit, size: b * fit, eff: b * Math.max(0.05, raw)};
      };
      // Part de la hauteur pour les créatures : la moitié, ou plus quand elles sont sur deux lignes (en largeur, une
      // ligne ne gagne rien à être plus haute). On garde la part où la plus petite des deux tailles est la plus grande,
      // les terrains et autres permanents comptant un peu moins (0,8) que les créatures. Le fond garde la hauteur de
      // la plaque (et de quoi poser des cartes en dessous quand elle est au bord).
      const score = (f, b) => (backU ? Math.min(f.size, 0.8 * b.eff) : f.size);
      const layout = (mode) => {
        const room = (s) => (H - 10) * (1 - s) >= (mode === 'edge' ? plateH + 30 : plates.h + 2);
        let share = 0.5;
        let fr = fitFront(0.5);
        let best = score(fr, fitBack(0.5, mode));
        if (fr.wrap) {
          for (const s of [0.56, 0.62, 0.68, 0.75]) {
            const f = fitFront(s);
            const value = score(f, fitBack(1 - s, mode));
            if (value > best * 1.02 && room(s)) {
              best = value;
              share = s;
              fr = f;
            }
          }
        }
        return {mode, share, fr, bf: fitBack(1 - share, mode), score: best};
      };
      // Plaque au bord seulement si les cartes y gagnent nettement (pas d'aller-retour pour un pixel).
      const better = (a, b) => a.score > b.score * 1.03 || (a.score > b.score * 0.999 && a.bf.eff > b.bf.eff * 1.05);
      let lay = layout(half._plateMode || 'inline');
      if (plates.w) {
        const other = layout(lay.mode === 'inline' ? 'edge' : 'inline');
        if (better(other, lay)) {
          lay = other;
        }
      } else {
        lay = lay.mode === 'inline' ? lay : layout('inline');
      }
      half._plateMode = lay.mode;
      if (half.dataset.plate !== lay.mode) {
        half.dataset.plate = lay.mode;
      }
      write(half, '--plate-h', plateH + 'px');
      const {share, fr, bf} = lay;
      const backFixed = backFixedOf(lay.mode);
      const rows = `minmax(0, ${share.toFixed(3)}fr) minmax(0, ${(1 - share).toFixed(3)}fr)`;
      if (half._rows !== rows) {
        half._rows = rows;
        half.style.gridTemplateRows = rows;
      }
      // Toujours trop large à la taille minimale : les cartes se chevauchent.
      const squeezeOf = (over, gaps, w) => (over > 0 ? `${(-Math.min(w * 0.82, over / Math.max(1, gaps) + 2)).toFixed(2)}px` : '0px');
      if (front) {
        write(front, '--bf-base', fr.b.toFixed(2) + 'px');
        write(front, '--fit', fr.fit.toFixed(3));
        front.classList.toggle('wrap', fr.wrap);
        const over = F.u * fr.b * fr.fit + F.px + PAD - W;
        write(front, '--squeeze', fr.wrap || !F.j ? '0px' : squeezeOf(over, F.j, fr.b * fr.fit));
      }
      if (back) {
        write(back, '--bf-base', bf.b.toFixed(2) + 'px');
        write(back, '--fit', bf.fit.toFixed(3));
      }
      if (nonlands && lands) {
        // Le fond : les deux rangées se partagent la largeur ; chacune rattrape sa part du dépassement.
        const over = backU * bf.b * bf.fit + backFixed - W;
        for (const [row, nat] of [[nonlands, B1], [lands, B2]]) {
          const part = backU ? over * nat.u / backU : 0;
          write(row, '--squeeze', !nat.j ? '0px' : squeezeOf(part, nat.j, bf.b * bf.fit));
        }
      }
    }
    this.dodgeCutout();
  }

  /**
   * Encoche de la caméra (Android) : le plateau va jusqu'au bord de l'écran ; seules les bandes qui passent devant
   * l'encoche (moitiés du plateau, ligne du milieu, bas de l'écran, boutons) s'en écartent, de son côté seulement.
   * Les cartes des moitiés concernées se resserrent d'elles-mêmes (leur largeur utile diminue).
   */
  dodgeCutout() {
    const holes = cutoutRects();
    if (!holes.length && !this.dodged) {
      return;
    }
    this.dodged = holes.length > 0;
    const t = this.table;
    const middle = window.innerWidth / 2;
    for (const b of t.querySelectorAll('.opp-half, .me-half, .divider, .hand-band, .actions')) {
      // Décalages horizontaux seulement : la position verticale des bandes n'en dépend pas.
      const r = b.getBoundingClientRect();
      let left = 0;
      let right = 0;
      for (const h of holes) {
        if (h.t < r.bottom && h.b > r.top) {
          if (h.l < middle) {
            left = Math.max(left, Math.ceil(h.r + 4));
          } else {
            right = Math.max(right, Math.ceil(window.innerWidth - h.l + 4));
          }
        }
      }
      setProp(b, '--dodge-l', left + 'px');
      setProp(b, '--dodge-r', right + 'px');
    }
  }

  // ------------------------------------------------------------------ animations

  flip(before, me, prev) {
    const libraryPile = this.table.querySelector('.my-piles .pile.lib');
    const libRect = libraryPile ? libraryPile.getBoundingClientRect() : null;
    // Toutes les positions d'abord, les animations ensuite : lancer une animation entre deux lectures forçait
    // un calcul complet de la mise en page par carte (des centaines de millisecondes avec un plateau chargé).
    const placed = [];
    for (const [k, slot] of this.slots) {
      if (slot.isConnected) {
        placed.push([k, slot, slot.getBoundingClientRect()]);
      }
    }
    for (const [k, slot, now] of placed) {
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
          // Au-dessus des autres pendant le trajet (classe plutôt qu'un z-index animé, qui n'est pas composité).
          slot.classList.add('moving');
          slot.animate([{transform: `translate(${dx}px, ${dy}px) scale(${scale})`}, {transform: 'none'}],
            {duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)'}).onfinish = () => slot.classList.remove('moving');
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
    const cards = (player && player.zones[this.trayZone.zone]) || [];
    if (this.trayZone.auto && !cards.some(c => c.selectable || (this.trayZone.zone === 'hand' && c.playable)) && !force) {
      this.trayZone = null;
      tray && tray.remove();
      return;
    }
    const names = {graveyard: 'Cimetière', exile: 'Exil', command: 'Zone de commandement', hand: 'Main', library: 'Bibliothèque'};
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
    tray.classList.toggle('library', this.trayZone.zone === 'library');
    if (this.trayZone.zone === 'library') {
      tray.querySelector('h2').textContent = `${names.library} — ${player ? player.name : ''} (${player ? player.library : 0})`;
      this.renderLibrary(tray.querySelector('.cards'), player);
      return;
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

  /**
   * Bibliothèque en pile : une carte de dos par paquet de quelques cartes, légèrement décalées pour l'épaisseur.
   * Le dessus est retourné quand un effet permet de le regarder ; touché, il se joue s'il est jouable, sinon il s'agrandit.
   */
  renderLibrary(box, player) {
    const count = player ? player.library : 0;
    const top = (player && player.libraryTop) || [];
    const layers = Math.min(28, Math.ceil(count / 3));
    const sig = `${count}|${top.map(c => `${c.id}${c.playable ? 'p' : ''}${c.selectable ? 's' : ''}`).join(',')}|${prefs.get('cardBack')}`;
    if (box._sig === sig) {
      return;
    }
    box._sig = sig;
    const pile = el(`<div class="lib-pile" style="--layers:${layers}"></div>`);
    for (let i = 0; i < layers; i++) {
      const layer = cardElement(null, 'lib-layer');
      layer.style.setProperty('--i', String(i));
      pile.appendChild(layer);
    }
    const playable = top.length && (top[0].playable || top[0].selectable);
    if (top.length) {
      const s = el('<div class="slot lib-top"></div>');
      const inner = cardElement(top[0]);
      inner.classList.toggle('playable', !!playable);
      s.appendChild(inner);
      s._card = top[0];
      s.style.setProperty('--i', String(layers));
      pile.appendChild(s);
    }
    if (!count) {
      pile.appendChild(el('<div class="muted lib-empty">Bibliothèque vide.</div>'));
    }
    const mine = player && (player.me || player.controlledByMe);
    const info = el(`<div class="lib-info">
      <div class="lib-count"><b>${count}</b> carte${count > 1 ? 's' : ''}</div>
      <p class="muted small">${top.length
        ? `Le dessus est visible${top.length > 1 ? ` (${top.length} cartes, la première est sur le dessus)` : ''}${playable ? ' et tu peux le jouer : touche-le.' : ' : touche-le pour l\'agrandir.'}`
        : mine ? 'Les cartes sont cachées. Quand un effet te permet de regarder le dessus (Coursier de Kruphix, Futur aperçu, Vizir de la ménagerie...), il apparaît ici, retourné.'
          : 'Les cartes sont cachées.'}</p>
      ${top.length > 1 ? `<div class="lib-next">${top.slice(1).map((c, i) => `<span class="chip">${i + 2}. ${esc(c.name)}</span>`).join('')}</div>` : ''}
    </div>`);
    box.replaceChildren(el('<div class="lib-view"></div>'));
    box.firstChild.append(pile, info);
  }

  // ------------------------------------------------------------------ tiroirs : journal, triche, menu

  openDrawer(kind) {
    if (kind === 'cheat' && this.career) {
      toast('La triche est désactivée en mode Planeswalker.');
      return;
    }
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

  /**
   * Journal : regroupé par tour (le plus récent en haut), une icône et une couleur par sorte d'action,
   * les joueurs en gras, les cartes en lien (touche : agrandir), filtres en haut.
   */
  renderLog() {
    const box = this.table.querySelector('[data-drawer] .log');
    if (!box || !this.state) {
      return;
    }
    const log = this.state.log || [];
    const filter = this.logFilter || 'all';
    const sig = `${filter}|${log.length}|${log.length ? log[0].text : ''}`;
    if (box._sig === sig) {
      return;
    }
    box._sig = sig;
    const players = [...this.state.players].sort((a, b) => b.name.length - a.name.length);
    const format = (e, i) => {
      let html = rulesHtml(e.text);
      // Les noms des joueurs, puis la carte en cause, mis en valeur (une seule fois chacun).
      const marks = [];
      for (const p of players) {
        const n = esc(p.name);
        if (n && html.includes(n)) {
          html = html.split(n).join(`\u0001${marks.length}\u0002`);
          marks.push(`<b class="who${p.me ? ' me' : ''}">${n}</b>`);
        }
      }
      if (e.card && e.card.name) {
        const n = esc(e.card.name);
        const at = html.indexOf(n);
        if (at >= 0) {
          html = html.slice(0, at) + `\u0001${marks.length}\u0002` + html.slice(at + n.length);
          marks.push(`<button class="cn" data-log-card="${i}">${n}</button>`);
        }
      }
      return html.replace(/\u0001(\d+)\u0002/g, (_, k) => marks[Number(k)]);
    };
    const kindOf = (e) => {
      const k = LOG_KINDS[e.kind] || LOG_KINDS.INFORMATION;
      if (e.kind === 'ZONE_CHANGE' || e.kind === 'DISCARD') {
        const zone = ZONE_WORDS.find(([re]) => re.test(e.text));
        return zone ? {...k, icon: zone[1]} : k;
      }
      if (e.kind === 'LIFE') {
        return {...k, cls: /perd|loses/i.test(e.text) ? 'life loss' : 'life gain'};
      }
      return k;
    };
    // Du plus récent au plus ancien : chaque entrée « tour » ferme le groupe des actions de ce tour.
    const groups = [];
    let items = [];
    log.forEach((e, i) => {
      if (e.kind === 'TURN') {
        groups.push({head: e, items});
        items = [];
      } else {
        items.push([e, i]);
      }
    });
    if (items.length) {
      groups.push({head: null, items});
    }
    const shown = (e) => filter === 'all' || (LOG_FILTERS[filter] || []).includes(e.kind);
    const groupHtml = (g) => {
      const rows = g.items.filter(([e]) => shown(e)).map(([e, i]) => {
        const k = kindOf(e);
        return `<div class="log-entry k-${esc(e.kind)} ${k.cls}"><span class="log-ic" title="${esc(k.label)}">${icon(k.icon)}</span><span class="log-text">${format(e, i)}</span></div>`;
      }).join('');
      if (!rows && filter !== 'all') {
        return '';
      }
      const title = g.head ? format(g.head, -1) : 'Début de partie';
      return `<section class="log-turn"><h4>${icon(g.head ? 'banner' : 'cards')}<span>${title}</span></h4>${rows || '<div class="muted small log-none">Aucune action.</div>'}</section>`;
    };
    const chips = Object.entries(LOG_FILTER_LABELS).map(([k, label]) => `<button class="chip${k === filter ? ' on' : ''}" data-log-filter="${k}">${label}</button>`).join('');
    box.innerHTML = `<div class="log-filters">${chips}</div>${groups.map(groupHtml).join('') || '<div class="muted">Rien pour l\'instant.</div>'}`;
    if (!box._bound) {
      box._bound = true;
      box.addEventListener('click', (ev) => {
        const f = ev.target.closest('[data-log-filter]');
        if (f) {
          this.logFilter = f.dataset.logFilter;
          this.renderLog();
          return;
        }
        const c = ev.target.closest('[data-log-card]');
        const entry = c && (this.state.log || [])[Number(c.dataset.logCard)];
        if (entry && entry.card) {
          const known = this.cards.get('c' + entry.card.id);
          showZoom(known || {name: entry.card.name, nameFr: entry.card.name, image: entry.card.image});
        }
      });
    }
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
          <label class="check"><input type="checkbox" data-set="holdPriority" ${s.holdPriority ? 'checked' : ''}> Garder la priorité après mes sorts (pour y répondre moi-même)</label>
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
      const hold = drawer.querySelector('[data-set="holdPriority"]').checked;
      prefs.set('holdPriority', hold);
      bridge.send('settings', {settings: {
        autoPass: drawer.querySelector('[data-set="autoPass"]').checked,
        holdPriority: hold,
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
    drawer.innerHTML = `<header><h2>${icon('wand')} Triche</h2><button class="btn small close">✕</button></header>
      <div class="content">
        <p class="muted small">Disponible quand tu as la main (priorité ou choix). Agit sur le joueur choisi.</p>
        <section><h3>Joueur</h3><div class="chips targets">${players}</div></section>
        <section><h3>Mana</h3>
          <div class="grid-btns">${MANA_ORDER.map(c => `<button class="btn" data-mana-add="${c}">${c === 'C' ? '<span class="ms">◇</span>' : `<span class="ms ms-${c}"></span>`} +1</button>`).join('')}</div>
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn small" data-mana-add="WWWWWUUUUUBBBBBRRRRRGGGGGCCCCC">+5 de chaque</button><input type="text" placeholder="ex. WWUG" class="mana-custom" style="flex:1"><button class="btn small" data-mana-custom>Ajouter</button></div>
        </section>
        <section><h3>Ajouter une carte</h3>
          <div class="cheat-search"><input type="search" class="card-q" placeholder="Nom en français ou en anglais" style="width:100%"><div class="cheat-results"></div><div class="cheat-picked"></div></div>
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
        <section><h3>Marqueurs du joueur</h3>
          <div class="pc-cheat">${Object.entries(PLAYER_COUNTERS).map(([key, def]) => {
            return `<div class="pc-row ${def.cls}">${icon(def.icon)}<span>${def.label}</span><button class="btn small" data-pc="${key}" data-d="-1">−1</button><button class="btn small" data-pc="${key}" data-d="1">+1</button><button class="btn small" data-pc="${key}" data-d="${def.max ? 3 : 5}">+${def.max ? 3 : 5}</button></div>`;
          }).join('')}</div>
        </section>
        <section><h3>Contrôler un adversaire</h3>
          <p class="muted small">Tu prends toutes ses décisions (sorts, attaques, choix) comme avec Mindslaver, jusqu'à ce que tu le rendes. Sa main s'ouvre depuis sa fiche (icône de main).</p>
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
    const pickedView = drawer.querySelector('.cheat-picked');
    // La carte au survol de son nom (appui long sur mobile), et celle choisie sous la liste.
    hoverCard(results, 'button', (b) => b._card);
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
        b._card = c;
        b.addEventListener('click', () => {
          picked = c.name;
          results.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
          pickedView.replaceChildren(cardElement(c));
        });
        results.appendChild(b);
      }
    }, 200));
    // onclick et non addEventListener : le tiroir reste le même d'une ouverture à l'autre (un seul gestionnaire).
    drawer.onclick = (e) => {
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
      } else if (b.dataset.pc) {
        cheat('playerCounter', {counter: b.dataset.pc, delta: Number(b.dataset.d)});
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
        if (['tutor', 'addCounters', 'removeCounters', 'addToken', 'tapPermanents', 'untapPermanents', 'win', 'endTurn'].includes(b.dataset.cheat)) {
          this.closeDrawer();
        }
      }
    };
    drawer.querySelectorAll('[data-toggle]').forEach(i => i.addEventListener('change', () => cheat(i.dataset.toggle, {value: i.checked})));
    drawer.querySelectorAll('[data-control]').forEach(i => i.addEventListener('change', () => {
      bridge.send('cheat', {op: 'control', player: Number(i.dataset.control), value: i.checked});
    }));
  }

  // ------------------------------------------------------------------ fin de partie

  /** Récompenses du duel de carrière (elles arrivent juste avant la fin de partie). */
  setReward(reward) {
    this.reward = reward;
    const slot = this.over && this.over.querySelector('.reward-slot');
    if (slot) {
      slot.innerHTML = rewardHtml(reward);
      fillRewardCards(this.over, reward);
    }
  }

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
      <div class="reward-slot">${this.career ? rewardHtml(this.reward) : ''}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn" data-go="board">Voir le plateau</button>
        <button class="btn" data-go="menu">Retour au menu</button>
        <button class="btn gold" data-go="again">${this.career ? 'Duel suivant' : 'Revanche'}</button>
      </div></div></div>`);
    fillRewardCards(box, this.reward);
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
