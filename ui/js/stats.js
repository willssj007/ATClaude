// Statistiques : historique des parties (enregistré par le moteur à chaque fin de partie), totaux,
// records, et détail par deck. Tout est calculé ici à partir de la liste des parties.

import {bridge} from './bridge.js';
import {isPlaneswalker} from './career.js';
import {confirmBox} from './dialogs.js';
import {fillReplayArt, loadReplays, replayListHtml} from './replay.js';
import {esc, prefs, toast} from './util.js';

const RESULT_LABEL = {win: 'Victoire', loss: 'Défaite', draw: 'Nulle'};
const RESULT_SHORT = {win: 'V', loss: 'D', draw: 'N'};

export async function loadGames() {
  const data = await bridge.request('stats');
  return (data && data.games) || [];
}

function pct(n, d) {
  return d ? Math.round((100 * n) / d) : 0;
}

function deckLabel(deck) {
  if (!deck) {
    return 'Deck inconnu';
  }
  if (deck.key === 'random' || deck.key === 'randomConstructed') {
    return 'Deck aléatoire';
  }
  return (deck.name || '').replace(/\s*\[.*$/, '') || 'Deck sans nom';
}

/** Totaux et records d'une liste de parties. */
export function summarize(games) {
  const s = {
    total: games.length, wins: 0, losses: 0, draws: 0, turns: 0, lands: 0, dealt: 0, taken: 0, mulligans: 0,
    longest: null, maxDealt: null, maxTaken: null, maxLands: null, fastestWin: null,
    decks: new Map(), commanders: new Map(), nemesis: new Map(), byPlayers: new Map(),
    streak: 0, streakKind: null, bestStreak: 0,
  };
  let run = 0;
  for (const g of games) {
    s[g.result === 'win' ? 'wins' : g.result === 'loss' ? 'losses' : 'draws']++;
    s.turns += g.turns || 0;
    s.lands += g.lands || 0;
    s.dealt += g.dealt || 0;
    s.taken += g.taken || 0;
    s.mulligans += g.mulligans || 0;
    if (!s.longest || g.turns > s.longest.turns) s.longest = g;
    if (!s.maxDealt || g.dealt > s.maxDealt.dealt) s.maxDealt = g;
    if (!s.maxTaken || g.taken > s.maxTaken.taken) s.maxTaken = g;
    if (!s.maxLands || g.lands > s.maxLands.lands) s.maxLands = g;
    if (g.result === 'win' && (!s.fastestWin || g.turns < s.fastestWin.turns)) s.fastestWin = g;
    run = g.result === 'win' ? run + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak, run);

    const key = (g.deck && g.deck.key) || '?';
    const d = s.decks.get(key) || {key, deck: g.deck, games: 0, wins: 0, losses: 0, draws: 0, maxTurns: 0, lands: 0, maxDealt: 0, maxTaken: 0, last: 0, list: []};
    d.deck = g.deck || d.deck; // nom le plus récent
    d.games++;
    d[g.result === 'win' ? 'wins' : g.result === 'loss' ? 'losses' : 'draws']++;
    d.maxTurns = Math.max(d.maxTurns, g.turns || 0);
    d.lands += g.lands || 0;
    d.maxDealt = Math.max(d.maxDealt, g.dealt || 0);
    d.maxTaken = Math.max(d.maxTaken, g.taken || 0);
    d.last = Math.max(d.last, g.at || 0);
    d.list.push(g);
    s.decks.set(key, d);

    for (const name of (g.deck && (g.deck.commandersFr || g.deck.commanders)) || []) {
      const c = s.commanders.get(name) || {name, games: 0, wins: 0, image: g.deck.image};
      c.games++;
      c.wins += g.result === 'win' ? 1 : 0;
      s.commanders.set(name, c);
    }
    if (g.result === 'loss') {
      // Bête noire : le commandant (ou le deck) adverse qui a gagné la partie.
      const winner = (g.opponents || []).find(o => o.won);
      if (winner) {
        const name = (winner.commandersFr && winner.commandersFr.join(' & ')) || deckLabel(winner);
        const n = s.nemesis.get(name) || {name, count: 0, image: winner.image};
        n.count++;
        s.nemesis.set(name, n);
      }
    }
    const p = s.byPlayers.get(g.players) || {players: g.players, games: 0, wins: 0};
    p.games++;
    p.wins += g.result === 'win' ? 1 : 0;
    s.byPlayers.set(g.players, p);
  }
  // Série en cours, depuis la dernière partie.
  for (let i = games.length - 1; i >= 0; i--) {
    const r = games[i].result;
    if (s.streakKind === null) {
      s.streakKind = r;
    }
    if (r !== s.streakKind) {
      break;
    }
    s.streak++;
  }
  const decks = [...s.decks.values()];
  s.mostPlayed = [...decks].sort((a, b) => b.games - a.games || b.last - a.last)[0] || null;
  s.mostWinning = [...decks].filter(d => d.wins).sort((a, b) => b.wins - a.wins || pct(b.wins, b.games) - pct(a.wins, a.games))[0] || null;
  s.mostLosing = [...decks].filter(d => d.losses).sort((a, b) => b.losses - a.losses || pct(b.losses, b.games) - pct(a.losses, a.games))[0] || null;
  s.favorite = [...s.commanders.values()].sort((a, b) => b.games - a.games || b.wins - a.wins)[0] || null;
  s.topNemesis = [...s.nemesis.values()].sort((a, b) => b.count - a.count)[0] || null;
  return s;
}

/** Statistiques d'un deck (écran du deck et écran Statistiques). */
export function deckStatsHtml(games, key) {
  const list = games.filter(g => g.deck && g.deck.key === key);
  if (!list.length) {
    return '<p class="muted">Pas encore de partie avec ce deck. Les statistiques apparaissent après la première partie terminée.</p>';
  }
  const s = summarize(list);
  const d = s.decks.get(key);
  return `<div class="kpis">
      ${kpi('Parties', d.games)}
      ${kpi('Victoires', d.wins, `${pct(d.wins, d.games)} %`)}
      ${kpi('Défaites', d.losses)}
      ${d.draws ? kpi('Nulles', d.draws) : ''}
      ${kpi('Tours (record)', d.maxTurns, 'partie la plus longue')}
      ${kpi('Terrains posés', (d.lands / d.games).toFixed(1).replace('.', ','), 'en moyenne par partie')}
      ${kpi('Blessures infligées', d.maxDealt, 'record sur une partie')}
      ${kpi('Blessures reçues', d.maxTaken, 'record sur une partie')}
    </div>
    ${meterHtml(d.wins, d.losses, d.draws)}
    <h4 class="st-h">Dernières parties</h4>
    ${recentHtml(list.slice(-10).reverse())}`;
}

function kpi(label, value, sub = '') {
  return `<div class="kpi panel"><span class="k-label">${esc(label)}</span><b class="k-value">${esc(String(value))}</b>${sub ? `<span class="k-sub muted small">${esc(sub)}</span>` : ''}</div>`;
}

/** Part des victoires, défaites et nulles, avec les nombres écrits. */
function meterHtml(wins, losses, draws) {
  const total = wins + losses + draws;
  if (!total) {
    return '';
  }
  const seg = (n, cls, label) => n ? `<i class="${cls}" style="flex:${n}" title="${label} : ${n} (${pct(n, total)} %)"></i>` : '';
  return `<div class="wl-meter" role="img" aria-label="${wins} victoires, ${losses} défaites, ${draws} nulles">
      <div class="wl-bar">${seg(wins, 'w', 'Victoires')}${seg(draws, 'n', 'Nulles')}${seg(losses, 'l', 'Défaites')}</div>
      <div class="wl-legend small"><span><i class="w"></i>Victoires ${wins} (${pct(wins, total)} %)</span>${draws ? `<span><i class="n"></i>Nulles ${draws}</span>` : ''}<span><i class="l"></i>Défaites ${losses} (${pct(losses, total)} %)</span></div>
    </div>`;
}

function recentHtml(list) {
  return `<div class="recent">${list.map(g => {
    const when = new Date(g.at || 0);
    const opp = (g.opponents || []).map(o => (o.commandersFr && o.commandersFr.length ? o.commandersFr.join(' & ') : deckLabel(o))).join(', ');
    return `<div class="rg">
      <span class="res ${esc(g.result)}" title="${RESULT_LABEL[g.result] || ''}">${RESULT_SHORT[g.result] || '?'}</span>
      <div class="rg-body"><b>${esc(deckLabel(g.deck))}</b> <span class="muted">contre ${esc(opp || '?')}</span>
        <div class="muted small">${when.toLocaleDateString('fr-FR')} · ${g.players} joueurs · ${g.turns} tours · ${g.dealt} infligées / ${g.taken} reçues · ${g.lands} terrains${g.conceded ? ' · abandon' : ''}${g.cheated ? ' · triche' : ''}</div></div>
    </div>`;
  }).join('')}</div>`;
}

export class StatsScreen {
  constructor(root, {onWatch} = {}) {
    this.root = root;
    this.onWatch = onWatch || (() => {});
    this.format = 'all';
    this.withCheats = prefs.get('statsWithCheats') !== false;
    this.open = null;
  }

  async show() {
    this.root.innerHTML = '<div class="page"><h1>Statistiques</h1><p class="muted">Chargement…</p></div>';
    try {
      [this.games, this.replays] = await Promise.all([loadGames(), loadReplays().catch(() => [])]);
    } catch (e) {
      this.root.innerHTML = `<div class="page"><h1>Statistiques</h1><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    this.render();
  }

  render() {
    // Chaque mode a ses statistiques : les duels de la carrière d'un côté, les parties libres de l'autre.
    const pw = isPlaneswalker();
    const all = (this.games || []).filter(g => !!g.career === pw);
    const games = all.filter(g => pw || ((this.format === 'all' || g.format === this.format) && (this.withCheats || !g.cheated)));
    const cheated = all.filter(g => g.cheated).length;
    const title = pw ? 'Statistiques Planeswalker' : 'Statistiques Sandbox';
    const s = summarize(games);
    const highlight = (title, d, value, image) => `<div class="hl panel">${image ? `<div class="hl-art" data-img="${esc(image)}"></div>` : ''}
        <div class="hl-body"><span class="k-label">${esc(title)}</span><b>${d ? esc(d) : '—'}</b><span class="muted small">${value ? esc(value) : ''}</span></div></div>`;
    const deckRows = [...s.decks.values()].sort((a, b) => b.games - a.games || b.last - a.last);
    this.root.innerHTML = `<div class="page stats-page">
      <div class="st-head">
        <h1 style="margin:0;flex:1">${title}</h1>
        ${pw ? '' : `<div class="seg" data-seg="format">
          ${[['all', 'Tout'], ['commander', 'Commander'], ['constructed', 'Construit']].map(([v, l]) => `<button data-v="${v}" class="${this.format === v ? 'on' : ''}">${l}</button>`).join('')}
        </div>
        <label class="check small"><input type="checkbox" data-cheats ${this.withCheats ? 'checked' : ''}> Avec triche${cheated ? ` (${cheated})` : ''}</label>`}
      </div>
      <h2>Replays <span class="muted small">(les 5 dernières parties, tous modes)</span></h2>
      ${replayListHtml(this.replays || [])}
      ${!games.length ? `<div class="panel" style="padding:18px;margin-top:12px"><p>Aucune partie terminée${all.length ? ' pour ce filtre' : ''}.</p>
        <p class="muted">${pw ? 'Chaque duel de ta carrière de Planeswalker' : 'Chaque partie finie du mode Sandbox'} (victoire, défaite ou abandon) est ajouté${pw ? '' : 'e'} ici, avec son deck, sa durée, les terrains posés et les blessures infligées et reçues. ${pw ? 'Les parties du mode Sandbox ont leurs propres statistiques.' : 'Les duels du mode Planeswalker ont leurs propres statistiques.'} Avec un compte relié, l'historique suit sur tous tes appareils.</p></div>` : `
      <div class="kpis">
        <div class="kpi panel hero"><span class="k-label">Taux de victoire</span><b class="k-value">${pct(s.wins, s.total)} %</b><span class="k-sub muted small">${s.wins} sur ${s.total} parties</span></div>
        ${kpi('Parties jouées', s.total)}
        ${kpi('Victoires', s.wins)}
        ${kpi('Défaites', s.losses)}
        ${s.draws ? kpi('Nulles', s.draws) : ''}
        ${kpi('Série en cours', s.streak, s.streakKind === 'win' ? 'victoire(s) d\'affilée' : s.streakKind === 'loss' ? 'défaite(s) d\'affilée' : 'nulle(s)')}
        ${kpi('Meilleure série', s.bestStreak, 'victoires d\'affilée')}
      </div>
      ${meterHtml(s.wins, s.losses, s.draws)}
      <h2>Faits marquants</h2>
      <div class="hls">
        ${highlight('Deck le plus joué', s.mostPlayed && deckLabel(s.mostPlayed.deck), s.mostPlayed && `${s.mostPlayed.games} partie(s)`, s.mostPlayed && s.mostPlayed.deck && s.mostPlayed.deck.image)}
        ${highlight('Deck le plus gagnant', s.mostWinning && deckLabel(s.mostWinning.deck), s.mostWinning && `${s.mostWinning.wins} victoire(s) · ${pct(s.mostWinning.wins, s.mostWinning.games)} %`, s.mostWinning && s.mostWinning.deck && s.mostWinning.deck.image)}
        ${highlight('Deck le plus perdant', s.mostLosing && deckLabel(s.mostLosing.deck), s.mostLosing && `${s.mostLosing.losses} défaite(s) · ${pct(s.mostLosing.losses, s.mostLosing.games)} %`, s.mostLosing && s.mostLosing.deck && s.mostLosing.deck.image)}
        ${highlight('Commandant préféré', s.favorite && s.favorite.name, s.favorite && `${s.favorite.games} partie(s) · ${s.favorite.wins} victoire(s)`, s.favorite && s.favorite.image)}
        ${highlight('Bête noire', s.topNemesis && s.topNemesis.name, s.topNemesis && `vous a battu ${s.topNemesis.count} fois`, s.topNemesis && s.topNemesis.image)}
        ${highlight('Victoire la plus rapide', s.fastestWin && `${s.fastestWin.turns} tours`, s.fastestWin && deckLabel(s.fastestWin.deck), null)}
      </div>
      <h2>Records et moyennes</h2>
      <div class="kpis">
        ${kpi('Partie la plus longue', s.longest ? `${s.longest.turns} tours` : '—', s.longest ? deckLabel(s.longest.deck) : '')}
        ${kpi('Durée moyenne', `${(s.turns / s.total).toFixed(1).replace('.', ',')} tours`)}
        ${kpi('Blessures infligées (record)', s.maxDealt ? s.maxDealt.dealt : 0, `moyenne ${(s.dealt / s.total).toFixed(1).replace('.', ',')} par partie`)}
        ${kpi('Blessures reçues (record)', s.maxTaken ? s.maxTaken.taken : 0, `moyenne ${(s.taken / s.total).toFixed(1).replace('.', ',')} par partie`)}
        ${kpi('Terrains posés', (s.lands / s.total).toFixed(1).replace('.', ','), `en moyenne · record ${s.maxLands ? s.maxLands.lands : 0}`)}
        ${kpi('Mulligans', (s.mulligans / s.total).toFixed(2).replace('.', ','), 'en moyenne par partie')}
      </div>
      <h2>Par nombre de joueurs</h2>
      <table class="st-table"><thead><tr><th>Table</th><th>Parties</th><th>Victoires</th><th>Taux</th></tr></thead><tbody>
        ${[...s.byPlayers.values()].sort((a, b) => a.players - b.players).map(p => `<tr><td>${p.players === 2 ? 'Duel (2)' : p.players + ' joueurs'}</td><td>${p.games}</td><td>${p.wins}</td><td>${pct(p.wins, p.games)} %</td></tr>`).join('')}
      </tbody></table>
      <h2>Par deck <span class="muted small">(touche un deck pour son détail)</span></h2>
      <table class="st-table decks"><thead><tr><th>Deck</th><th>Parties</th><th>V</th><th>D</th><th>Taux</th><th class="opt">Tours max</th><th class="opt">Terrains moy.</th><th class="opt">Infligées max</th><th class="opt">Reçues max</th></tr></thead><tbody>
        ${deckRows.map(d => `<tr data-deck="${esc(d.key)}" class="${this.open === d.key ? 'open' : ''}"><td><b>${esc(deckLabel(d.deck))}</b>${d.deck && d.deck.commandersFr && d.deck.commandersFr.length ? `<div class="muted small">${esc(d.deck.commandersFr.join(' & '))}</div>` : ''}</td>
          <td>${d.games}</td><td>${d.wins}</td><td>${d.losses}</td><td>${pct(d.wins, d.games)} %</td><td class="opt">${d.maxTurns}</td><td class="opt">${(d.lands / d.games).toFixed(1).replace('.', ',')}</td><td class="opt">${d.maxDealt}</td><td class="opt">${d.maxTaken}</td></tr>
          ${this.open === d.key ? `<tr class="detail"><td colspan="9">${deckStatsHtml(games, d.key)}</td></tr>` : ''}`).join('')}
      </tbody></table>
      <h2>Dernières parties</h2>
      ${recentHtml(games.slice(-15).reverse())}`}
      <div style="margin-top:24px"><button class="btn small danger" data-clear>Effacer les statistiques</button></div>
    </div>`;
    this.root.querySelectorAll('[data-img]').forEach(node => {
      if (!prefs.get('images')) {
        return;
      }
      const url = bridge.imageUrl(node.dataset.img, prefs.get('imageLang'));
      const img = new Image();
      img.onload = () => {
        node.style.backgroundImage = `url("${url}")`;
        node.classList.add('on');
      };
      img.src = url;
    });
    fillReplayArt(this.root);
    this.root.onclick = async (e) => {
      const watch = e.target.closest('[data-watch], .replay-tile');
      if (watch) {
        this.onWatch(watch.dataset.watch || watch.dataset.replay);
        return;
      }
      const seg = e.target.closest('[data-seg] button');
      if (seg) {
        this.format = seg.dataset.v;
        this.render();
        return;
      }
      const row = e.target.closest('tr[data-deck]');
      if (row) {
        this.open = this.open === row.dataset.deck ? null : row.dataset.deck;
        this.render();
        return;
      }
      if (e.target.closest('[data-clear]')) {
        if (await confirmBox(`Effacer les ${pw ? 'statistiques Planeswalker' : 'statistiques Sandbox'} ?`, `L'historique des parties du mode ${pw ? 'Planeswalker' : 'Sandbox'} sera supprimé, sur cet appareil et (après synchronisation) sur les autres. Celles de l'autre mode sont gardées.`, {yes: 'Effacer', danger: true})) {
          await bridge.request('clearStats', {career: pw});
          toast('Statistiques effacées.');
          this.show();
        }
      }
    };
    const cheats = this.root.querySelector('[data-cheats]');
    cheats && cheats.addEventListener('change', () => {
      this.withCheats = cheats.checked;
      prefs.set('statsWithCheats', this.withCheats);
      this.render();
    });
  }
}
