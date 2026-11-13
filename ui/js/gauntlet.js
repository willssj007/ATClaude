// Gauntlet (Sandbox) : un deck, cinq manches d'affilée contre des IA de plus en plus fortes. Une défaite arrête la
// série ; une égalité se rejoue. La progression est gardée sur l'appareil.

import {prefs} from './util.js';

/** Les cinq manches : titre, adversaire, niveau de l'IA (voir le salon). */
export const ROUNDS = [
  {title: 'Manche 1', foe: 'Aldric l\'Apprenti', level: 'facile'},
  {title: 'Manche 2', foe: 'Mira la Duelliste', level: 'normal'},
  {title: 'Manche 3', foe: 'Corvin le Champion', level: 'normal'},
  {title: 'Manche 4', foe: 'Ysolde la Mage', level: 'difficile'},
  {title: 'Manche 5', foe: 'Malgor le Tyran', level: 'expert'},
];

export function current() {
  const g = prefs.get('gauntlet');
  return g && g.deckKey ? g : null;
}

export function best() {
  return Number(prefs.get('gauntletBest')) || 0;
}

/**
 * Une nouvelle Gauntlet avec ce deck. Adversaires : des préconstruits Commander tirés au hasard (tous différents) pour
 * un deck Commander, des decks construits générés par Forge sinon.
 */
export function start(deck, precons) {
  const pool = [...(precons || [])].filter(p => p.key !== deck.key);
  const pickPrecon = () => (pool.length ? pool.splice(Math.floor(Math.random() * pool.length), 1)[0].key : 'random');
  const g = {
    deckKey: deck.key,
    deckName: deck.name,
    format: deck.format === 'constructed' ? 'constructed' : 'commander',
    round: 0,
    results: [],
    opponents: ROUNDS.map(() => (deck.format === 'constructed' ? 'randomConstructed' : pickPrecon())),
    over: false,
    champion: false,
  };
  prefs.set('gauntlet', g);
  return g;
}

export function abandon() {
  prefs.set('gauntlet', null);
}

/** Le salon de la manche en cours. */
export function setupFor(g, playerName) {
  const r = ROUNDS[g.round];
  return {
    format: g.format,
    gauntlet: g.round + 1,
    players: [
      {name: playerName || 'Moi', ai: false, deckKey: g.deckKey},
      {name: r.foe, ai: true, deckKey: g.opponents[g.round] || (g.format === 'commander' ? 'random' : 'randomConstructed'), profile: '', level: r.level},
    ],
  };
}

/**
 * Fin d'une partie de Gauntlet (setup.gauntlet = numéro de la manche) : la manche est gagnée, perdue ou à rejouer.
 * Renvoie le résumé affiché sur l'écran de fin, ou null si la partie n'était pas la manche en cours.
 */
export function record(setup, info) {
  const g = current();
  if (!g || g.over || !setup || setup.gauntlet !== g.round + 1) {
    return null;
  }
  const result = info.draw ? 'draw' : info.won ? 'win' : 'loss';
  const round = g.round;
  if (result === 'win') {
    g.results[round] = 'win';
    g.round++;
    if (g.round >= ROUNDS.length) {
      g.over = true;
      g.champion = true;
    }
  } else if (result === 'loss') {
    g.results[round] = 'loss';
    g.over = true;
  }
  const wins = g.results.filter(x => x === 'win').length;
  if (wins > best()) {
    prefs.set('gauntletBest', wins);
  }
  prefs.set('gauntlet', g);
  return {round: round + 1, total: ROUNDS.length, result, over: g.over, champion: g.champion, wins};
}
