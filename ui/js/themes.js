// Apparences : palette et décor des menus, décor du plateau de jeu, dos des cartes.
// Certaines se débloquent en jouant : parties jouées ou gagnées (sans triche, comme les trophées de Forge),
// record de blessures infligées, trophées obtenus, et défis (exploits en partie, carrière Planeswalker).

import {bridge} from './bridge.js';
import {confirmBox} from './dialogs.js';
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
  // Mythiques : animées, et bien plus dures à obtenir.
  {key: 'aurora', name: 'Aurore mythique', desc: 'Une aurore boréale qui ondule au-dessus du lac, sous les étoiles qui scintillent.', art: 'menu-aurora', colors: ['#03060f', '#59f5b0', '#bfe8ff'], unlock: {kind: 'streak', n: 10}, mythic: true},
  {key: 'godforge', name: 'Forge des dieux', desc: 'L\'enclume des dieux au cœur du volcan : la lave luit et les braises s\'envolent.', art: 'menu-godforge', colors: ['#0a0504', '#ff8a2a', '#ffd27a'], unlock: {kind: 'wins', n: 100}, mythic: true},
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
  {key: 'vortex', name: 'Vortex du Néant', desc: 'Les bras d\'une galaxie tournent lentement autour d\'un trou noir.', art: 'board-vortex', unlock: {kind: 'mythics', n: 10}, mythic: true},
  {key: 'celestial', name: 'Sanctuaire céleste', desc: 'Un temple au-dessus des nuages : un cercle de runes tourne sous les rayons du ciel.', art: 'board-celestial', unlock: {kind: 'duelWins', n: 50}, mythic: true},
];

// Fonds mythiques animés, pour les menus comme pour le plateau (une fois gagné ou acheté, le fond sert aux deux).
// Les uns derrière un défi difficile, les autres à acheter avec le mana du mode Planeswalker.
const MYTHIC_BACKGROUNDS = [
  {key: 'nebula', name: 'Nébuleuse éternelle', desc: 'Des nuées d\'étoiles qui dérivent autour d\'une planète à anneaux, traversées d\'étoiles filantes.', colors: ['#06030f', '#b05cff', '#ffb8e8'], price: 3000},
  {key: 'tempest', name: 'Tempête du Kraken', desc: 'L\'orage gronde sur la mer : éclairs, pluie battante et faisceau du phare sur les tentacules.', colors: ['#03070b', '#4fb8d8', '#d8ecf4'], unlock: {kind: 'streak', n: 15}},
  {key: 'spirits', name: 'Bois des esprits', desc: 'Des feux follets montent entre les arbres millénaires, sous les rais de lune.', colors: ['#020806', '#5af0b0', '#d8ffb0'], price: 3000},
  {key: 'crystal', name: 'Caverne de cristal', desc: 'Les cristaux luisent et des éclats flottent au-dessus du lac souterrain.', colors: ['#06040f', '#9a7cff', '#e8d8ff'], price: 3000},
  {key: 'inferno', name: 'Abîme infernal', desc: 'Devant la porte des enfers, les flammes dansent et les braises montent de la lave.', colors: ['#080202', '#ff5a1a', '#ffc870'], unlock: {kind: 'dealt', n: 100}, challenge: true},
  {key: 'chrono', name: 'Horlogerie du temps', desc: 'Les rouages de laiton tournent autour de la grande horloge, dont les aiguilles filent.', colors: ['#020809', '#4ad8c8', '#f0c878'], unlock: {kind: 'fast5', n: 1}},
  {key: 'leyline', name: 'Nexus tellurique', desc: 'Des cercles de runes tournent au-dessus du menhir où convergent les lignes de force.', colors: ['#05030e', '#5affe8', '#c8fff4'], unlock: {kind: 'duelWins', n: 100}},
  {key: 'reef', name: 'Récif lumineux', desc: 'Méduses, bulles et reflets du soleil au-dessus des coraux qui brillent.', colors: ['#03101a', '#4ad8ff', '#ffb8e8'], price: 3000},
  {key: 'eclipse', name: 'Éclipse', desc: 'La couronne du soleil éclipsé tourne lentement au-dessus du temple.', colors: ['#050204', '#ff9a3a', '#ffe2a0'], unlock: {kind: 'win4', n: 25}, challenge: true},
  {key: 'blizzard', name: 'Blizzard éternel', desc: 'La neige tourbillonne autour de la forteresse de glace, sous une aurore pâle.', colors: ['#060a14', '#8ac8ff', '#e8f4ff'], price: 3000},
];
for (const b of MYTHIC_BACKGROUNDS) {
  const theme = {...b, art: 'bg-' + b.key, mythic: true, shared: true, buyId: 'bg:' + b.key};
  MENU_THEMES.push(theme);
  BOARD_THEMES.push({...theme});
}

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
  {key: 'spark', name: 'Étincelle mythique', desc: 'L\'étincelle des Planeswalkers, parcourue d\'un reflet doré.', unlock: {kind: 'unique', n: 1500}, mythic: true},
  {key: 'prism', name: 'Prisme', desc: 'Une gemme taillée aux reflets holographiques changeants.', unlock: {kind: 'win4', n: 10}, mythic: true},
  // Dos mythiques animés : défis difficiles ou achat avec le mana du mode Planeswalker.
  {key: 'rune', name: 'Sceau runique', desc: 'Un cercle de runes de jade tourne autour de l\'étoile.', price: 3000, mythic: true},
  {key: 'galaxy', name: 'Galaxie spirale', desc: 'Les bras d\'une galaxie tournent autour de son cœur lumineux.', price: 3000, mythic: true},
  {key: 'eye', name: 'Œil du Néant', desc: 'Un œil de braise dont la lueur palpite.', unlock: {kind: 'oneLife', n: 1}, mythic: true},
  {key: 'lava', name: 'Cœur de magma', desc: 'Des failles de lave qui rougeoient au rythme d\'un cœur.', unlock: {kind: 'trophies', n: 40}, challenge: true, mythic: true},
  {key: 'storm', name: 'Orage', desc: 'La foudre déchire les nuages et illumine la carte.', unlock: {kind: 'wins', n: 250}, challenge: true, mythic: true},
  {key: 'hourglass', name: 'Sablier du temps', desc: 'Le sable s\'écoule sans fin dans le sablier d\'or.', unlock: {kind: 'unique', n: 3000}, mythic: true},
  {key: 'bloodmoon', name: 'Lune de sang', desc: 'Des nuages passent devant la lune rouge.', price: 3000, mythic: true},
  {key: 'vitrail', name: 'Vitrail sacré', desc: 'Une rosace de vitrail traversée de lumière.', price: 3000, mythic: true},
  {key: 'ghostflame', name: 'Flamme spectrale', desc: 'Une flamme bleue qui vacille dans son brasier de fer.', unlock: {kind: 'mythics', n: 50}, mythic: true},
  {key: 'aurora', name: 'Voile boréal', desc: 'Une aurore ondule au-dessus des montagnes.', price: 3000, mythic: true},
];
for (const t of BACK_THEMES) {
  if (t.price) {
    t.buyId = 'back:' + t.key;
  }
}

const KINDS = {
  menu: {list: MENU_THEMES, pref: 'menuTheme', attr: 'menuTheme'},
  board: {list: BOARD_THEMES, pref: 'boardTheme', attr: 'boardTheme'},
  back: {list: BACK_THEMES, pref: 'cardBack', attr: 'cardBack'},
};

const GOALS = {
  games: (n) => `Jouer ${n} partie${n > 1 ? 's' : ''}`,
  wins: (n) => `Gagner ${n} partie${n > 1 ? 's' : ''}`,
  win4: (n) => n > 1 ? `Gagner ${n} parties à 4 joueurs` : 'Gagner une partie à 4 joueurs',
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
  mythics: (n) => n > 1 ? `Trouver ${n} cartes mythiques dans des boosters` : 'Trouver une carte mythique dans un booster',
  unique: (n) => `Posséder ${n} cartes différentes (Planeswalker)`,
  fast5: () => 'Gagner une partie en 5 tours ou moins',
  oneLife: () => 'Gagner une partie avec exactement 1 point de vie',
};

/** Conditions qui sont des défis (affichés dans Trophées), et non de simples paliers. */
const CHALLENGES = ['fastWin', 'lowLife', 'monoWin', 'rainbowWin', 'duelWins', 'streak', 'opened', 'mythics', 'unique', 'fast5', 'oneLife'];

const fmtMana = (n) => Number(n).toLocaleString('fr-FR');

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
    fast5: wins.filter(g => Number(g.myTurns) > 0 && Number(g.myTurns) <= 5).length,
    oneLife: wins.filter(g => g.life !== undefined && Number(g.life) === 1).length,
    // Mode Planeswalker : mana disponible et apparences achetées.
    careerStarted: !!c.started,
    mana: c.mana || 0,
    owned: c.cosmetics || [],
  };
}

const KIND_LABELS = {menu: 'Menus', board: 'Plateau', back: 'Dos des cartes', bg: 'Fond des menus et du plateau'};
const KIND_ICONS = {menu: 'palette', board: 'swords', back: 'cards', bg: 'palette'};

/** Liste des défis et de l'apparence que chacun débloque (écran Trophées). */
export async function challengesHtml() {
  const p = await progress();
  const items = [];
  for (const [kind, def] of Object.entries(KINDS)) {
    for (const t of def.list) {
      // Un fond mythique sert aux menus et au plateau : un seul défi pour les deux.
      if (t.unlock && (CHALLENGES.includes(t.unlock.kind) || t.challenge) && !(t.shared && kind === 'board')) {
        items.push({kind: t.shared ? 'bg' : kind, prev: kind, t, done: isUnlocked(t, p), have: Math.min(p[t.unlock.kind] || 0, t.unlock.n)});
      }
    }
  }
  items.sort((a, b) => a.done - b.done);
  const done = items.filter(i => i.done).length;
  return `<div class="trophy-head"><h2 style="margin:0">Défis</h2><div class="trophy-count"><b>${done}</b> / ${items.length} réussis</div></div>
    <p class="muted small">Chaque défi débloque une apparence (Réglages › Apparence). Les parties avec triche ne comptent pas.</p>
    <div class="challenge-grid">${items.map(({kind, prev, t, done: ok, have}) => `<div class="challenge panel${ok ? ' done' : ''}${t.mythic ? ' mythic' : ''}">
      <span class="ch-prev th-prev th-${prev}-${t.key}">${ok ? '' : `<span class="th-lock">${icon('lock')}</span>`}</span>
      <div class="ch-body"><b>${esc(GOALS[t.unlock.kind](t.unlock.n))}</b>
        <span class="muted small">${icon(KIND_ICONS[kind])} ${esc(KIND_LABELS[kind])} : « ${esc(t.name)} »</span>
        ${ok ? `<span class="th-goal small done">${icon('check')} Réussi</span>`
          : t.unlock.n > 1 ? `<span class="th-meter"><i style="width:${Math.round(100 * have / t.unlock.n)}%"></i></span><span class="muted small">${have} / ${t.unlock.n}</span>` : ''}
      </div></div>`).join('')}</div>`;
}

export function isUnlocked(theme, p) {
  if (prefs.get('themePreview') === true) {
    return true;
  }
  if (theme.price) {
    return !!(p && (p.owned || []).includes(theme.buyId));
  }
  return !theme.unlock || !!(p && (p[theme.unlock.kind] || 0) >= theme.unlock.n);
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
  root.dataset.motion = prefs.get('animations') ? 'on' : 'off';
  menuEffects(root.dataset.menuTheme);
}

/** Élément animé posé sur un point de l'illustration (coordonnées de l'image 1600×900, voir .fx-at dans app.css). */
const at = (cls, x, y, w, ar = 1) => `<i class="fx-at ${cls}" style="--x:${x};--y:${y};--w:${w};--ar:${ar}"></i>`;

/** Calques animés des fonds mythiques (voir app.css) : derrière les menus, et derrière le plateau pour les nouveaux. */
const MENU_FX = {
  aurora: '<i class="mf-band b1"></i><i class="mf-band b2"></i><i class="mf-band b3"></i><i class="mf-stars s1"></i><i class="mf-stars s2"></i>',
  godforge: '<i class="mf-glow"></i><i class="mf-embers e1"></i><i class="mf-embers e2"></i><i class="mf-embers e3"></i>',
  nebula: '<i class="nb-cloud c1"></i><i class="nb-cloud c2"></i><i class="mf-stars s1"></i><i class="mf-stars s2"></i><i class="nb-meteor m1"></i><i class="nb-meteor m2"></i><i class="nb-meteor m3"></i>',
  tempest: `<i class="tp-rain r1"></i><i class="tp-rain r2"></i>${at('tp-beam', 1415, 422, 900, 5)}<i class="tp-flash"></i><i class="tp-bolt"></i>`,
  spirits: '<i class="sp-shafts"></i><i class="sp-wisps w1"></i><i class="sp-wisps w2"></i><i class="sp-flies f1"></i><i class="sp-flies f2"></i>',
  crystal: `${at('cr-glow', 800, 620, 1100, 1.8)}${at('cr-glow g2', 300, 650, 600, 1.4)}${at('cr-glow g3', 1320, 650, 600, 1.4)}<i class="cr-shards s1"></i><i class="cr-shards s2"></i><i class="mf-stars s2"></i>`,
  inferno: `<i class="mf-glow"></i><i class="mf-embers e1"></i><i class="mf-embers e2"></i><i class="mf-embers e3"></i>${at('in-eyes', 800, 300, 240, 3)}<i class="in-flames f1"></i><i class="in-flames f2"></i>`,
  chrono: [[220, 220, 140, ''], [1380, 260, 170, ' rev'], [260, 700, 120, ' rev'], [1360, 720, 150, ''], [520, 120, 70, ' fast'], [1100, 110, 80, ' rev fast']]
    .map(([x, y, r, c]) => at('ch-gear' + c, x, y, Math.round(r * 2.1))).join('') + at('ch-hand mn', 800, 450, 900) + at('ch-hand hr', 800, 450, 900) + '<i class="mf-stars s1 ch-dust"></i>',
  leyline: `${at('ll-ring', 800, 470, 560)}${at('ll-ring r2', 800, 470, 360)}${at('ll-pulse', 800, 640, 900, 4)}${at('ll-pulse p2', 800, 640, 900, 4)}<i class="sp-wisps w1 ll-motes"></i>`,
  reef: `<i class="rf-caustics"></i><i class="rf-bubbles b1"></i><i class="rf-bubbles b2"></i>${at('rf-jelly j1', 420, 300, 110, 0.833)}${at('rf-jelly j2', 1150, 240, 80, 0.833)}${at('rf-jelly j3', 900, 430, 60, 0.833)}`,
  eclipse: `<i class="mf-stars s1"></i><i class="mf-stars s2"></i>${at('ec-corona', 800, 330, 760)}${at('ec-corona c2', 800, 330, 620)}${at('ec-flare', 800, 330, 720)}`,
  blizzard: '<i class="mf-band b3 bz-aurora"></i><i class="bz-fog"></i><i class="bz-snow s1"></i><i class="bz-snow s2"></i><i class="bz-snow s3"></i>',
};

/** Calque animé du plateau pour un fond mythique (null s'il n'en a pas) : à poser au fond de la table de jeu. */
export function boardFx(key) {
  if (!MENU_FX[key] || !MYTHIC_BACKGROUNDS.some(b => b.key === key)) {
    return null;
  }
  const layer = document.createElement('div');
  layer.className = 'fx-layer table-fx';
  layer.dataset.fx = key;
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = MENU_FX[key];
  return layer;
}

function menuEffects(key) {
  let layer = document.getElementById('menu-fx');
  if (!MENU_FX[key]) {
    layer && layer.remove();
    return;
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'menu-fx';
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.prepend(layer);
  }
  if (layer.dataset.fx !== key) {
    layer.dataset.fx = key;
    layer.innerHTML = MENU_FX[key];
  }
}

function cardHtml(kind, t, p, current) {
  const locked = !isUnlocked(t, p);
  const goal = t.unlock ? GOALS[t.unlock.kind](t.unlock.n) : '';
  const have = t.unlock && p ? Math.min(p[t.unlock.kind] || 0, t.unlock.n) : 0;
  const swatches = kind === 'menu' ? `<span class="th-sw">${t.colors.map(c => `<i style="background:${c}"></i>`).join('')}</span>` : '';
  const price = t.price ? (locked ? `<span class="th-goal th-price small">${icon('mana')}${fmtMana(t.price)} mana · Acheter</span>`
    : `<span class="th-goal small done">${icon('check')}Achetée${t.shared ? ' (menus et plateau)' : ''}</span>`) : '';
  return `<button class="theme-card${t.key === current ? ' on' : ''}${locked ? ' locked' : ''}${t.mythic ? ' mythic' : ''}${t.price && locked ? ' for-sale' : ''}" data-kind="${kind}" data-theme="${t.key}"${t.buyId ? ` data-buy="${t.buyId}"` : ''} aria-pressed="${t.key === current}">
    <span class="th-prev th-${kind}-${t.key}">${swatches}${t.mythic ? '<span class="th-myth">Mythique</span>' : ''}${locked ? `<span class="th-lock">${icon(t.price ? 'mana' : 'lock')}</span>` : ''}${t.key === current ? '<span class="th-on">Choisie</span>' : ''}</span>
    <span class="th-body"><b>${esc(t.name)}</b>
      <span class="muted small">${esc(t.desc)}</span>
      ${price}${t.unlock ? `<span class="th-goal small${locked ? '' : ' done'}">${locked ? icon('lock') : icon('chalice')}${esc(goal)}${locked && t.unlock.n > 1 ? ` · ${fmtMana(have)}/${fmtMana(t.unlock.n)}` : ''}</span>
        ${locked && t.unlock.n > 1 ? `<span class="th-meter"><i style="width:${Math.round(100 * have / t.unlock.n)}%"></i></span>` : ''}` : ''}
    </span>
  </button>`;
}

// Aperçus animés : seulement ceux qui sont à l'écran (classe « live »), et rien pendant un défilement (classe
// « scrolling » sur la page) ; une trentaine d'animations à la fois faisait ramer la liste sur téléphone.
let previewObserver = null;
let scrollTimer = 0;

/** À appeler après avoir inséré des aperçus d'apparences (Réglages, boutique, défis). */
export function livePreviews(container) {
  if (!container) {
    return;
  }
  if (!previewObserver) {
    previewObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        e.target.classList.toggle('live', e.isIntersecting);
      }
    }, {rootMargin: '40px'});
    document.addEventListener('scroll', () => {
      document.documentElement.classList.add('scrolling');
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => document.documentElement.classList.remove('scrolling'), 160);
    }, {capture: true, passive: true});
  }
  container.querySelectorAll('.th-prev').forEach(n => previewObserver.observe(n));
}

/** Rayon « Apparences mythiques » de la boutique (mode Planeswalker) : fonds et dos à acheter, sans doublon. */
export async function shopHtml() {
  const p = await progress();
  const items = [...MENU_THEMES.filter(t => t.price).map(t => ['menu', t]), ...BACK_THEMES.filter(t => t.price).map(t => ['back', t])];
  const current = {menu: find(MENU_THEMES, prefs.get('menuTheme')).key, back: find(BACK_THEMES, prefs.get('cardBack')).key};
  const price = items.length ? items[0][1].price : 0;
  return `<div class="shelf-head"><h2 class="shelf-h">Apparences mythiques <span class="muted small">(${fmtMana(price)} mana pièce)</span></h2></div>
    <p class="muted small">Des fonds animés pour les menus et le plateau, et des dos de cartes animés. D'autres apparences mythiques se gagnent avec les défis (Trophées). Une apparence achetée se choisit ici ou dans Réglages › Apparence.</p>
    <div class="theme-grid shop-themes">${items.map(([kind, t]) => cardHtml(kind, t, p, current[kind])).join('')}</div>`;
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
  const p = await progress();
  if (!isUnlocked(theme, p)) {
    if (theme.price) {
      await buy(theme, p);
    } else {
      toast(`${GOALS[theme.unlock.kind](theme.unlock.n)} pour débloquer « ${theme.name} » (parties sans triche).`, {title: 'Apparence verrouillée'});
    }
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

/** Achat d'une apparence avec le mana du mode Planeswalker ; ses cartes (menus et plateau pour un fond) se déverrouillent. */
async function buy(theme, p) {
  if (!p.careerStarted) {
    toast(`« ${theme.name} » s'achète ${fmtMana(theme.price)} mana, la monnaie du mode Planeswalker : commence ta carrière pour en gagner.`, {title: 'Apparence à acheter'});
    return;
  }
  if (p.mana < theme.price) {
    toast(`Il te faut ${fmtMana(theme.price)} mana (tu en as ${fmtMana(p.mana)}). Chaque duel Planeswalker gagné en rapporte.`, {title: 'Pas assez de mana'});
    return;
  }
  const ok = await confirmBox(`Acheter « ${theme.name} » ?`,
    `${fmtMana(theme.price)} mana : il t'en restera ${fmtMana(p.mana - theme.price)}.${theme.shared ? ' Le fond servira aux menus comme au plateau.' : ''}`, {yes: 'Acheter'});
  if (!ok) {
    return;
  }
  try {
    await bridge.request('careerBuyCosmetic', {id: theme.buyId});
  } catch (e) {
    toast(e.message || String(e), {title: 'Achat impossible'});
    return;
  }
  toast(`« ${theme.name} » est à toi${theme.shared ? ' : choisis-le pour les menus ou pour le plateau' : ''}.`, {title: 'Apparence achetée'});
  for (const c of document.querySelectorAll(`.theme-card[data-buy="${theme.buyId}"]`)) {
    c.classList.remove('locked', 'for-sale');
    c.querySelector('.th-lock')?.remove();
    const goal = c.querySelector('.th-price');
    if (goal) {
      goal.classList.remove('th-price');
      goal.classList.add('done');
      goal.innerHTML = `${icon('check')}Achetée${theme.shared ? ' (menus et plateau)' : ''}`;
    }
  }
  prefs.set('themesKnown', [...(prefs.get('themesKnown') || []), ...Object.entries(KINDS).flatMap(([name, k]) => k.list.filter(t => t.buyId === theme.buyId).map(t => name + ':' + t.key))]);
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
