// Apparences : palette et décor des menus, décor du plateau de jeu, dos des cartes.
// Certaines se débloquent en jouant : parties jouées ou gagnées (sans triche, comme les trophées de Forge),
// record de blessures infligées, trophées obtenus, et défis (exploits en partie, carrière Planeswalker).

import {bridge} from './bridge.js';
import {icon} from './icons.js';
import {loadGames} from './stats.js';
import {esc, prefs, toast} from './util.js';

export const MENU_THEMES = [
  {key: 'arcane', name: 'Arcane', desc: 'L\'apparence d\'origine : nuit violette et or.', colors: ['#0d0f1a', '#7c6cf2', '#e2b65c']},
  {key: 'citadel', name: 'Citadelle', desc: 'Remparts au clair de lune, bleu ardoise.', art: 'menu-citadel', colors: ['#0b1019', '#5c8fd6', '#d8b66a']},
  {key: 'sylvan', name: 'Sylve', desc: 'Forêt de sapins et lucioles, vert profond.', art: 'menu-sylvan', colors: ['#08110d', '#4fae78', '#d9b45e'], unlock: {kind: 'games', n: 5}},
  {key: 'ember', name: 'Braises', desc: 'Volcan en éruption, rouge sombre et cuivre.', art: 'menu-ember', colors: ['#130a08', '#e0683a', '#f0b85a'], unlock: {kind: 'wins', n: 10}},
  {key: 'frost', name: 'Givre', desc: 'Sommets enneigés sous l\'aurore, bleu glacier et argent.', art: 'menu-frost', colors: ['#0a1016', '#6fbfe6', '#cfe0ee'], unlock: {kind: 'trophies', n: 5}},
  {key: 'royal', name: 'Cour royale', desc: 'Tentures de pourpre et fleurs de lys dorées.', art: 'menu-royal', colors: ['#12080c', '#c23a52', '#e8c26a'], unlock: {kind: 'win4', n: 1}},
  {key: 'astral', name: 'Astral', desc: 'Nébuleuses, planète et étoiles filantes.', art: 'menu-astral', colors: ['#070616', '#8f7cff', '#f0c674'], unlock: {kind: 'trophies', n: 15}},
  {key: 'abyss', name: 'Abysses', desc: 'Ruines englouties, méduses lumineuses et léviathan.', art: 'menu-abyss', colors: ['#04121a', '#3fc1c9', '#d8c07a'], unlock: {kind: 'streak', n: 3}},
  {key: 'desert', name: 'Dunes d\'or', desc: 'Pyramides et caravane sous le soleil couchant.', art: 'menu-desert', colors: ['#140b08', '#d8843a', '#e8b04a'], unlock: {kind: 'mythics', n: 1}},
  {key: 'necro', name: 'Nécropole', desc: 'Cathédrale gothique, corbeaux et lune verte.', art: 'menu-necro', colors: ['#060a08', '#7fc28a', '#c8d8a0'], unlock: {kind: 'lowLife', n: 1}},
];

export const BOARD_THEMES = [
  {key: 'classic', name: 'Classique', desc: 'Le tapis d\'origine, sobre et sombre.'},
  {key: 'battlefield', name: 'Champ de bataille', desc: 'Une plaine au couchant, l\'armée et le château adverses à l\'horizon.', art: 'board-battlefield'},
  {key: 'forest', name: 'Forêt ancienne', desc: 'Sapins sous la lune, lucioles et champignons lumineux.', art: 'board-forest', unlock: {kind: 'wins', n: 3}},
  {key: 'throne', name: 'Salle du trône', desc: 'Vitrail, piliers et torches, un tapis rouge jusqu\'au trône.', art: 'board-throne', unlock: {kind: 'games', n: 25}},
  {key: 'dragon', name: 'Antre du dragon', desc: 'Un dragon perché devant la caverne, une rivière de lave, son trésor.', art: 'board-dragon', unlock: {kind: 'dealt', n: 60}},
  {key: 'ether', name: 'Plan éthéré', desc: 'Îles flottantes et cercle arcanique entre les nébuleuses.', art: 'board-ether', unlock: {kind: 'trophies', n: 10}},
  {key: 'library', name: 'Bibliothèque arcanique', desc: 'Livres volants, runes et cercle magique au clair de lune.', art: 'board-library', unlock: {kind: 'opened', n: 10}},
  {key: 'arena', name: 'Colisée', desc: 'Le sable de l\'arène, les bannières et la foule des gradins.', art: 'board-arena', unlock: {kind: 'fastWin', n: 1}},
  {key: 'swamp', name: 'Marais des feux follets', desc: 'Mangroves tordues, nénuphars et lueurs sur l\'eau noire.', art: 'board-swamp', unlock: {kind: 'duelWins', n: 10}},
];

// Dos des cartes cachées et de la bibliothèque : celui de Magic par défaut, les autres gagnés avec les trophées.
export const BACK_THEMES = [
  {key: 'magic', name: 'Magic', desc: 'Le dos des cartes Magic (téléchargé une fois depuis Scryfall).'},
  {key: 'arcane', name: 'Arcane', desc: 'Étoile d\'or sur nuit violette, le dos d\'origine de l\'application.'},
  {key: 'grimoire', name: 'Grimoire', desc: 'Cuir patiné, sceau runique et fermoir doré.', unlock: {kind: 'trophies', n: 1}},
  {key: 'sylvan', name: 'Arbre-monde', desc: 'Arbre de vie cerclé d\'or, bordure de lierre.', unlock: {kind: 'trophies', n: 3}},
  {key: 'frost', name: 'Cristal de givre', desc: 'Flocon de glace sur fond de cristal.', unlock: {kind: 'trophies', n: 6}},
  {key: 'heraldic', name: 'Blason', desc: 'Écu couronné sur champ de fleurs de lys.', unlock: {kind: 'trophies', n: 10}},
  {key: 'dragon', name: 'Œil du dragon', desc: 'Un œil de braise au milieu des écailles.', unlock: {kind: 'trophies', n: 15}},
  {key: 'astral', name: 'Lune astrale', desc: 'Croissant de lune, constellations et cercle d\'or.', unlock: {kind: 'trophies', n: 25}},
  {key: 'kraken', name: 'Kraken', desc: 'Le monstre des abysses, cerclé d\'or.', unlock: {kind: 'streak', n: 5}},
  {key: 'phoenix', name: 'Phénix', desc: 'L\'oiseau de feu qui renaît de ses cendres.', unlock: {kind: 'rainbowWin', n: 1}},
  {key: 'compass', name: 'Rose des vents', desc: 'La boussole des voyageurs entre les plans.', unlock: {kind: 'unique', n: 500}},
  {key: 'skull', name: 'Memento mori', desc: 'Crâne, os croisés et sablier.', unlock: {kind: 'monoWin', n: 1}},
];

const KINDS = {
  menu: {list: MENU_THEMES, pref: 'menuTheme', attr: 'menuTheme'},
  board: {list: BOARD_THEMES, pref: 'boardTheme', attr: 'boardTheme'},
  back: {list: BACK_THEMES, pref: 'cardBack', attr: 'cardBack'},
};

const GOALS = {
  games: (n) => `Jouer ${n} partie${n > 1 ? 's' : ''}`,
  wins: (n) => `Gagner ${n} partie${n > 1 ? 's' : ''}`,
  win4: () => 'Gagner une partie à 4 joueurs',
  dealt: (n) => `Infliger ${n} blessures en une partie`,
  trophies: (n) => `Obtenir ${n} trophée${n > 1 ? 's' : ''}`,
  // Défis
  fastWin: (n) => `Gagner une partie en 7 tours ou moins${n > 1 ? ` (${n} fois)` : ''}`,
  lowLife: () => 'Gagner une partie avec 5 points de vie ou moins',
  monoWin: () => 'Gagner avec un deck d\'une seule couleur',
  rainbowWin: () => 'Gagner avec un deck de 4 ou 5 couleurs',
  duelWins: (n) => `Gagner ${n} duels Planeswalker`,
  streak: (n) => `Gagner ${n} duels Planeswalker d'affilée`,
  opened: (n) => `Ouvrir ${n} booster${n > 1 ? 's' : ''}`,
  mythics: () => 'Trouver une carte mythique dans un booster',
  unique: (n) => `Posséder ${n} cartes différentes (Planeswalker)`,
};

/** Conditions qui sont des défis (affichés dans Trophées), et non de simples paliers. */
const CHALLENGES = ['fastWin', 'lowLife', 'monoWin', 'rainbowWin', 'duelWins', 'streak', 'opened', 'mythics', 'unique'];

/** Où en est le joueur pour chaque condition (parties avec triche exclues). */
export async function progress() {
  const [games, trophies, career] = await Promise.all([loadGames().catch(() => []), bridge.request('trophies').catch(() => null),
    bridge.request('career').catch(() => null)]);
  const fair = games.filter(g => !g.cheated);
  const wins = fair.filter(g => g.result === 'win');
  const colors = (g) => ((g.deck && g.deck.identity) || '').length;
  const c = career || {};
  return {
    games: fair.length,
    wins: wins.length,
    win4: wins.filter(g => (g.players || 0) >= 4).length,
    dealt: fair.reduce((m, g) => Math.max(m, Number(g.dealt) || 0), 0),
    trophies: trophies ? trophies.earned || 0 : 0,
    fastWin: wins.filter(g => Number(g.myTurns) > 0 && Number(g.myTurns) <= 7).length,
    lowLife: wins.filter(g => g.life !== undefined && Number(g.life) <= 5).length,
    monoWin: wins.filter(g => colors(g) === 1).length,
    rainbowWin: wins.filter(g => colors(g) >= 4).length,
    duelWins: c.wins || 0,
    streak: c.bestStreak || 0,
    opened: c.opened || 0,
    mythics: c.mythics || 0,
    unique: c.started ? c.unique || 0 : 0,
  };
}

const KIND_LABELS = {menu: 'Menus', board: 'Plateau', back: 'Dos des cartes'};
const KIND_ICONS = {menu: 'palette', board: 'swords', back: 'cards'};

/** Liste des défis et de l'apparence que chacun débloque (écran Trophées). */
export async function challengesHtml() {
  const p = await progress();
  const items = [];
  for (const [kind, def] of Object.entries(KINDS)) {
    for (const t of def.list) {
      if (t.unlock && CHALLENGES.includes(t.unlock.kind)) {
        items.push({kind, t, done: isUnlocked(t, p), have: Math.min(p[t.unlock.kind] || 0, t.unlock.n)});
      }
    }
  }
  items.sort((a, b) => a.done - b.done);
  const done = items.filter(i => i.done).length;
  return `<div class="trophy-head"><h2 style="margin:0">Défis</h2><div class="trophy-count"><b>${done}</b> / ${items.length} réussis</div></div>
    <p class="muted small">Chaque défi débloque une apparence (Réglages › Apparence). Les parties avec triche ne comptent pas.</p>
    <div class="challenge-grid">${items.map(({kind, t, done: ok, have}) => `<div class="challenge panel${ok ? ' done' : ''}">
      <span class="ch-prev th-prev th-${kind}-${t.key}">${ok ? '' : `<span class="th-lock">${icon('lock')}</span>`}</span>
      <div class="ch-body"><b>${esc(GOALS[t.unlock.kind](t.unlock.n))}</b>
        <span class="muted small">${icon(KIND_ICONS[kind])} ${esc(KIND_LABELS[kind])} : « ${esc(t.name)} »</span>
        ${ok ? `<span class="th-goal small done">${icon('check')} Réussi</span>`
          : t.unlock.n > 1 ? `<span class="th-meter"><i style="width:${Math.round(100 * have / t.unlock.n)}%"></i></span><span class="muted small">${have} / ${t.unlock.n}</span>` : ''}
      </div></div>`).join('')}</div>`;
}

export function isUnlocked(theme, p) {
  return !theme.unlock || (p && (p[theme.unlock.kind] || 0) >= theme.unlock.n);
}

function find(list, key) {
  return list.find(t => t.key === key) || list[0];
}

/** Applique les apparences choisies (attributs lus par les feuilles de style). */
export function applyThemes() {
  const root = document.documentElement;
  for (const kind of Object.values(KINDS)) {
    root.dataset[kind.attr] = find(kind.list, prefs.get(kind.pref)).key;
  }
}

function cardHtml(kind, t, p, current) {
  const locked = !isUnlocked(t, p);
  const goal = t.unlock ? GOALS[t.unlock.kind](t.unlock.n) : '';
  const have = t.unlock && p ? Math.min(p[t.unlock.kind] || 0, t.unlock.n) : 0;
  const swatches = kind === 'menu' ? `<span class="th-sw">${t.colors.map(c => `<i style="background:${c}"></i>`).join('')}</span>` : '';
  return `<button class="theme-card${t.key === current ? ' on' : ''}${locked ? ' locked' : ''}" data-kind="${kind}" data-theme="${t.key}" aria-pressed="${t.key === current}">
    <span class="th-prev th-${kind}-${t.key}">${swatches}${locked ? `<span class="th-lock">${icon('lock')}</span>` : ''}${t.key === current ? '<span class="th-on">Choisie</span>' : ''}</span>
    <span class="th-body"><b>${esc(t.name)}</b>
      <span class="muted small">${esc(t.desc)}</span>
      ${t.unlock ? `<span class="th-goal small${locked ? '' : ' done'}">${locked ? icon('lock') : icon('chalice')}${esc(goal)}${locked && t.unlock.n > 1 ? ` · ${have}/${t.unlock.n}` : ''}</span>
        ${locked && t.unlock.n > 1 ? `<span class="th-meter"><i style="width:${Math.round(100 * have / t.unlock.n)}%"></i></span>` : ''}` : ''}
    </span>
  </button>`;
}

/** Section « Apparence » des réglages. */
export async function appearanceHtml() {
  const p = await progress();
  const grid = (kind) => {
    const current = find(KINDS[kind].list, prefs.get(KINDS[kind].pref)).key;
    return `<div class="theme-grid${kind === 'back' ? ' backs' : ''}">${KINDS[kind].list.map(t => cardHtml(kind, t, p, current)).join('')}</div>`;
  };
  return `<h2>Apparence</h2>
    <p class="muted small">Les apparences avec un cadenas se débloquent en jouant : parties jouées ou gagnées sans triche, records, trophées et défis (liste dans Trophées).</p>
    <h3 class="th-h">Menus et interface</h3>${grid('menu')}
    <h3 class="th-h">Plateau de jeu</h3>${grid('board')}
    <h3 class="th-h">Dos des cartes</h3>${grid('back')}`;
}

/** Clic sur une carte d'apparence : la choisit si elle est débloquée. Renvoie vrai si le clic la concernait. */
export async function themeClicked(target) {
  const card = target.closest('.theme-card');
  if (!card) {
    return false;
  }
  const kind = KINDS[card.dataset.kind];
  const theme = find(kind.list, card.dataset.theme);
  if (!isUnlocked(theme, await progress())) {
    toast(`${GOALS[theme.unlock.kind](theme.unlock.n)} pour débloquer « ${theme.name} » (parties sans triche).`, {title: 'Apparence verrouillée'});
    return true;
  }
  prefs.set(kind.pref, theme.key);
  applyThemes();
  const grid = card.parentElement;
  grid.querySelectorAll('.theme-card').forEach(c => {
    const on = c === card;
    c.classList.toggle('on', on);
    c.setAttribute('aria-pressed', String(on));
    const badge = c.querySelector('.th-on');
    if (on && !badge) {
      c.querySelector('.th-prev').insertAdjacentHTML('beforeend', '<span class="th-on">Choisie</span>');
    } else if (!on && badge) {
      badge.remove();
    }
  });
  return true;
}

/** Après une partie ou un trophée : annonce les apparences qui viennent de se débloquer. */
export async function announceUnlocks() {
  const p = await progress();
  const unlocked = [];
  const keys = [];
  for (const [name, kind] of Object.entries(KINDS)) {
    for (const t of kind.list) {
      if (t.unlock && isUnlocked(t, p)) {
        unlocked.push(t);
        keys.push(name + ':' + t.key);
      }
    }
  }
  const known = prefs.get('themesKnown');
  if (Array.isArray(known)) {
    const fresh = unlocked.filter((t, i) => !known.includes(keys[i]));
    if (fresh.length === 1) {
      toast(`« ${fresh[0].name} » est disponible dans Réglages › Apparence.`, {title: 'Nouvelle apparence débloquée'});
    } else if (fresh.length > 1) {
      toast(`${fresh.map(t => `« ${t.name} »`).join(', ')} : à choisir dans Réglages › Apparence.`, {title: 'Nouvelles apparences débloquées'});
    }
  }
  prefs.set('themesKnown', keys);
}
