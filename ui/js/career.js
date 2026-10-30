// Mode Planeswalker : la carrière (tenue par le moteur : collection, decks, mana, boosters) et l'écran Duel.
// Le mode Sandbox donne accès à tout ; le mode Planeswalker ne laisse jouer que des duels, avec ses propres cartes.

import {bridge} from './bridge.js';
import {cardElement, showZoom} from './cards.js';
import {deckTile, fillBadges} from './decks.js';
import {confirmBox, customBox} from './dialogs.js';
import {icon} from './icons.js';
import {el, esc, prefs, toast} from './util.js';

let cache = null;
const listeners = new Set();

export const isPlaneswalker = () => prefs.get('mode') === 'planeswalker';

/** État de la carrière (gardé en mémoire ; force : relu auprès du moteur). */
export async function loadCareer(force = false) {
  if (!cache || force) {
    setCareer(await bridge.request('career'));
  }
  return cache;
}

export function setCareer(c) {
  if (c && typeof c.started === 'boolean') {
    cache = c;
    listeners.forEach(fn => fn(c));
  }
}

export function onCareer(fn) {
  listeners.add(fn);
}

export function forgetCareer() {
  cache = null;
}

export function manaAmount(n, cls = '') {
  return `<span class="mana-amount ${cls}">${icon('mana')}<b>${Number(n || 0).toLocaleString('fr-FR')}</b></span>`;
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export const RARITY_FR = {common: 'commun', uncommon: 'peu commun', rare: 'rare', mythic: 'mythique'};

/** « 3 jetons communs », « 1 jeton peu commun ». */
export function wildcardCount(rarity, n) {
  const adj = RARITY_FR[rarity] || rarity;
  return n > 1 ? `${n} jetons ${adj.replace(/(\w+)$/, '$1s')}` : `${n} jeton ${adj}`;
}
/** Rareté d'une carte (celle de son impression) pour les jetons. */
export function rarityKey(card) {
  const r = card && card.rarity;
  return r === 'MythicRare' ? 'mythic' : r === 'Rare' || r === 'Special' ? 'rare' : r === 'Uncommon' ? 'uncommon' : 'common';
}

/** Un jeton de rareté (ou son nombre). */
export function wildcardHtml(rarity, n) {
  return `<span class="wildcard wc-${rarity}" title="Jetons ${RARITY_FR[rarity]}">${icon('gem')}${n === undefined ? '' : `<b>${Number(n) || 0}</b>`}</span>`;
}

/** Les quatre jetons, pour les en-têtes (Duel, Boosters, Collection, deck builder). */
export function wildcardsHtml(wc) {
  const w = wc || {};
  return `<span class="wildcards" title="Jetons de rareté : une carte en double en donne un ; un jeton achète une carte manquante de même rareté">${
    ['common', 'uncommon', 'rare', 'mythic'].map(r => wildcardHtml(r, w[r] || 0)).join('')}</span>`;
}

/** Récompenses d'un duel de carrière, pour l'écran de fin de partie. */
export function rewardHtml(r) {
  if (!r) {
    return '';
  }
  if (!r.won) {
    return `<div class="reward lost">${icon('hourglass')}<div><b>Duel perdu</b>
      <div class="muted small">${r.lostStreak ? `Ta série de ${plural(r.lostStreak, 'victoire', 'victoires')} s'arrête.` : 'Aucune récompense cette fois.'} Un nouvel adversaire t'attend.</div></div></div>`;
  }
  const boosters = [...(r.boosters || [])];
  return `<div class="reward">
    <div class="rw-line">${manaAmount(r.mana, 'big')}<span class="muted small">Total : ${Number(r.manaTotal || 0).toLocaleString('fr-FR')} mana</span></div>
    ${(r.cards || []).length ? `<div class="rw-h">${plural(r.cards.length, 'carte gagnée', 'cartes gagnées')} dans le deck adverse</div><div class="rw-cards"></div>`
      : '<div class="muted small">Tu possèdes déjà toutes les cartes de ce deck adverse.</div>'}
    <div class="rw-h">${icon('booster')} ${boosters.map(b => `Booster ${esc(b.name)}`).join(', ')}</div>
    ${r.bonus ? `<div class="rw-bonus">${icon('crown')} ${r.streak} victoires d'affilée : ${plural(r.bonus.length, 'booster', 'boosters')} en bonus${r.deckChoice ? ' et un nouveau deck à choisir dans Duel' : ''} !</div>` : ''}
    ${r.newBracket ? `<div class="rw-bonus">${icon('crown')} Préconstruits de bracket ${r.newBracket} débloqués : à choisir ou à acheter dans Duel.</div>` : ''}
    <div class="muted small">Série en cours : ${plural(r.streak || 0, 'victoire', 'victoires')}.</div>
  </div>`;
}

/** Les cartes gagnées, posées dans l'encadré des récompenses. */
export function fillRewardCards(root, r) {
  const box = root.querySelector('.rw-cards');
  if (!box || !r || !r.cards) {
    return;
  }
  for (const card of r.cards) {
    const c = cardElement(card, 'rw-card');
    c.addEventListener('click', (e) => {
      e.stopPropagation();
      showZoom(card);
    });
    box.appendChild(c);
  }
}

/** Le deck de départ, accueilli au début de la carrière. */
function starterReveal(c) {
  const deck = (c.decks || []).find(d => d.name === c.starter) || (c.decks || [])[0];
  customBox('Ta carrière commence', (body, footer, close) => {
    body.innerHTML = `<p>Ton premier deck : <b>${esc(deck ? deck.name : '')}</b>.</p>
      <div class="starter"></div>
      <p class="muted small">Ses ${c.cards} cartes forment ta collection. Gagne des duels pour prendre des cartes à tes adversaires
        et des boosters, et dépense ton mana dans la boutique de boosters.</p>`;
    if (deck) {
      body.querySelector('.starter').appendChild(deckTile(deck, '', 'Deck de départ'));
    }
    const go = el('<button class="btn gold">À l\'aventure !</button>');
    go.addEventListener('click', close);
    footer.appendChild(go);
  }, {narrow: true});
}

const ID_ORDER = 'WUBRG';

/** Pastilles bracket et puissance d'un préconstruit (déjà calculées par le moteur). */
function measureHtml(p) {
  return `<span class="bk-badge" title="Bracket ${p.bracket} · puissance ${String(p.power).replace('.', ',')}/10"><b class="bk bk-${p.bracket}">B${p.bracket}</b><span>${Number(p.power).toLocaleString('fr-FR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</span></span>`;
}

/**
 * Choix d'un préconstruit (début de carrière ou deck gagné) : grille filtrable par nom et par couleur,
 * avec le bracket et la puissance de chacun. Renvoie la clé choisie, ou null.
 */
function pickPrecon(title, intro, list, yes, opts = {}) {
  return new Promise((resolve) => {
    let done = false;
    const box = customBox(title, (body, footer, close) => {
      const brackets = [...new Set(list.map(p => p.bracket))].sort();
      body.innerHTML = `<p class="muted small">${intro} Touche un deck pour le choisir.</p>
        <div class="pp-bar"><input type="search" class="pp-q" placeholder="Nom du deck ou du commandant…">
          <span class="color-filter pp-colors">${ID_ORDER.split('').map(c => `<span class="ms ms-${c}" data-color="${c}" title="${c}"></span>`).join('')}</span>
          ${brackets.length > 1 ? `<span class="seg pp-brackets"><button class="on" data-b="">Tous</button>${brackets.map(b => `<button data-b="${b}">B${b}</button>`).join('')}</span>` : ''}</div>
        <div class="deck-list pp-list"></div>`;
      const listEl = body.querySelector('.pp-list');
      const q = body.querySelector('.pp-q');
      const colors = new Set();
      let bracket = '';
      // Brackets ouverts d'abord, puis ceux qui restent à débloquer.
      const ordered = [...list.filter(p => !p.locked), ...list.filter(p => p.locked)];
      const render = () => {
        const t = q.value.trim().toLowerCase();
        const shown = ordered.filter(p => (!t || p.name.toLowerCase().includes(t) || (p.commanders || []).some(c => c.toLowerCase().includes(t)))
          && [...colors].every(c => (p.identity || '').includes(c)) && (!bracket || String(p.bracket) === bracket));
        listEl.replaceChildren(...shown.slice(0, 300).map(p => {
          const sub = p.locked ? `Débloqué après ${plural(p.unlockSeries, 'série', 'séries')} de 5 victoires`
            : opts.buy ? `${Number(p.price).toLocaleString('fr-FR')} mana` : 'Préconstruit Commander';
          const tile = deckTile(p, '', sub);
          tile.querySelector('.deck-art').insertAdjacentHTML('beforeend', measureHtml(p));
          tile.classList.toggle('locked', !!p.locked);
          tile.classList.toggle('too-dear', !p.locked && !!opts.buy && p.price > opts.mana);
          return tile;
        }));
        if (!shown.length) {
          listEl.innerHTML = '<p class="muted">Aucun préconstruit ne correspond.</p>';
        }
      };
      render();
      q.addEventListener('input', render);
      const seg = body.querySelector('.pp-brackets');
      if (seg) {
        seg.addEventListener('click', (e) => {
          const b = e.target.closest('[data-b]');
          if (b) {
            seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
            bracket = b.dataset.b;
            render();
          }
        });
      }
      body.querySelector('.pp-colors').addEventListener('click', (e) => {
        const c = e.target.closest('[data-color]');
        if (c) {
          c.classList.toggle('on');
          colors[c.classList.contains('on') ? 'add' : 'delete'](c.dataset.color);
          render();
        }
      });
      listEl.addEventListener('click', async (e) => {
        const tile = e.target.closest('.deck-tile');
        if (!tile) {
          return;
        }
        const p = list.find(x => x.key === tile.dataset.key);
        if (p && p.locked) {
          toast(`Le bracket ${p.bracket} se débloque après ${plural(p.unlockSeries, 'série', 'séries')} de 5 victoires d'affilée.`, {title: 'Pas encore'});
          return;
        }
        if (p && opts.buy && p.price > opts.mana) {
          toast(`Il te faut ${Number(p.price).toLocaleString('fr-FR')} mana pour ce deck (tu en as ${Number(opts.mana).toLocaleString('fr-FR')}).`, {title: 'Pas assez de mana'});
          return;
        }
        const what = `${(p.commanders || []).join(' & ')} · bracket ${p.bracket} · puissance ${String(p.power).replace('.', ',')}/10.`;
        if (p && await confirmBox(opts.buy ? `Acheter ${p.name} ?` : `${p.name} ?`,
          opts.buy ? `${what} Prix : ${Number(p.price).toLocaleString('fr-FR')} mana.` : what, {yes})) {
          done = true;
          resolve(p.key);
          close();
        }
      });
      const cancel = el('<button class="btn">Plus tard</button>');
      cancel.addEventListener('click', close);
      footer.appendChild(cancel);
    }, {full: true});
    box.back.addEventListener('click', (e) => e.target === box.back && !done && resolve(null));
    const obs = new MutationObserver(() => {
      if (!box.back.isConnected) {
        obs.disconnect();
        if (!done) {
          resolve(null);
        }
      }
    });
    obs.observe(document.body, {childList: true, subtree: true});
  });
}

const RULES = `<ul class="pw-rules">
  <li>${icon('cards')} Tu choisis ton premier deck parmi les préconstruits Commander de bracket 2 : ses cartes sont ta collection.</li>
  <li>${icon('swords')} Des duels contre l'IA, un adversaire à la fois, de même bracket et de puissance proche de ton deck, sans triche ni réglages.</li>
  <li>${icon('undo')} Le premier mulligan est gratuit (tu gardes 7 cartes), pour toi comme pour l'IA ; les suivants coûtent une carte.</li>
  <li>${icon('mana')} Chaque victoire : 200 mana, quelques cartes du deck adverse que tu n'as pas, et un booster.</li>
  <li>${icon('crown')} 5 victoires d'affilée (une série) : 5 boosters d'extensions au hasard et un nouveau préconstruit au choix.</li>
  <li>${icon('cards')} D'autres préconstruits s'achètent avec du mana (bouton « Acheter un deck » de l'écran Duel), de 2 000 mana (bracket 1) à 7 000 (bracket 5).</li>
  <li>${icon('swords')} Au départ, les préconstruits vont jusqu'au bracket 2 ; chaque fois que tu termines 2 séries, le bracket suivant se débloque (3, puis 4, puis 5).</li>
  <li>${icon('booster')} La boutique vend des boosters de toutes les extensions, 750 mana pièce.</li>
  <li>${icon('gem')} Une carte en double devient un jeton de sa rareté ; un jeton achète une carte manquante de même rareté (Collection, deck builder).</li>
</ul>`;

/** Écran Duel du mode Planeswalker : ton deck contre le prochain adversaire. */
export class DuelScreen {
  constructor(root, {onStart, onBoosters, playerName, duelRunning, endDuel}) {
    this.root = root;
    this.onStart = onStart;
    this.onBoosters = onBoosters;
    this.playerName = playerName;
    this.duelRunning = duelRunning || (() => false);
    this.endDuel = endDuel || (async () => {});
    this.deckKey = null;
  }

  /** Jouer ce deck au prochain duel (bouton « Jouer » des decks). */
  useDeck(key) {
    this.deckKey = key;
  }

  async show() {
    this.root.innerHTML = '<div class="page"><p class="muted">Chargement de la carrière…</p></div>';
    let c;
    try {
      c = await loadCareer(true);
    } catch (e) {
      this.root.innerHTML = `<div class="page"><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    if (!c.started) {
      this.renderIntro();
    } else {
      this.render(c);
    }
  }

  renderIntro() {
    this.root.innerHTML = `<div class="page duel-page">
      <div class="pw-intro panel">
        <div class="pw-spark">${icon('spark')}</div>
        <h1>Carrière de Planeswalker</h1>
        <p class="muted">Pars de rien, ou presque : un seul deck, et toutes les cartes à gagner.</p>
        ${RULES}
        <button class="btn gold big" data-start>${icon('spark')} Choisir mon premier deck</button>
      </div></div>`;
    this.root.querySelector('[data-start]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        const list = await bridge.request('careerStartChoices');
        const key = await pickPrecon('Ton premier deck', `${list.length} préconstruits Commander de bracket 2, du moins puissant au plus puissant (puissance sur 10). Tes adversaires auront le même bracket et une puissance proche.`, list, 'Commencer avec ce deck');
        if (key) {
          const c = await bridge.request('careerStart', {key});
          setCareer(c);
          this.render(c);
          starterReveal(c);
          return;
        }
      } catch (err) {
        toast(err.message, {error: true});
      }
      btn.disabled = false;
    });
  }

  /** Un deck gagné (série de victoires) : le choisir parmi les préconstruits qu'on n'a pas. */
  async chooseNewDeck() {
    try {
      const list = await bridge.request('careerDeckChoices');
      const c0 = await loadCareer();
      const key = await pickPrecon('Un nouveau deck', `Ta série t'a valu un nouveau préconstruit : prends celui que tu veux, jusqu'au bracket ${c0.maxBracket} (bracket et puissance indiqués ; tes adversaires s'adaptent au deck que tu joues). Les cartes que tu as déjà deviennent des jetons.`, list, 'Prendre ce deck');
      if (!key) {
        return;
      }
      const c = await bridge.request('careerChooseDeck', {key});
      setCareer(c);
      const d = c.dupes || {};
      const n = Object.values(d).reduce((a, b) => a + b, 0);
      toast(n ? `Cartes déjà possédées changées en jetons : ${Object.entries(d).filter(([, k]) => k).map(([r, k]) => wildcardCount(r, k)).join(', ')}.` : 'Toutes ses cartes sont nouvelles.', {title: 'Deck ajouté'});
      this.deckKey = c.chosen || this.deckKey;
      this.render(c);
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  /** Achat d'un préconstruit avec du mana, parmi les brackets débloqués. */
  async buyDeck() {
    try {
      const [list, c0] = await Promise.all([bridge.request('careerDeckChoices'), loadCareer(true)]);
      const key = await pickPrecon('Acheter un deck', `Tu as ${Number(c0.mana).toLocaleString('fr-FR')} mana. Brackets débloqués : jusqu'au ${c0.maxBracket}. Les cartes que tu as déjà deviennent des jetons.`,
        list, 'Acheter', {buy: true, mana: c0.mana});
      if (!key) {
        return;
      }
      const c = await bridge.request('careerBuyDeck', {key});
      setCareer(c);
      const d = c.dupes || {};
      const n = Object.values(d).reduce((a, b) => a + b, 0);
      toast(n ? `Cartes déjà possédées changées en jetons : ${Object.entries(d).filter(([, k]) => k).map(([r, k]) => wildcardCount(r, k)).join(', ')}.` : 'Toutes ses cartes sont nouvelles.', {title: 'Deck acheté'});
      this.deckKey = c.chosen || this.deckKey;
      this.render(c);
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  render(c) {
    const decks = c.decks || [];
    const playable = decks.filter(d => d.legal);
    if (!playable.some(d => d.key === this.deckKey)) {
      const last = prefs.get('careerDeck');
      this.deckKey = (playable.find(d => d.key === last) || playable[0] || {}).key || null;
    }
    const toBonus = c.bonusEvery - (c.streak % c.bonusEvery);
    const sealed = (c.boosters || []).length;
    this.root.innerHTML = `<div class="page duel-page">
      <div class="pw-head">
        <h1>Duel</h1>
        <div class="pw-stats">
          ${manaAmount(c.mana, 'chip')}
          <span class="chip-stat" title="Victoires et défaites">${icon('swords')}<b>${c.wins}</b> V · <b>${c.losses}</b> D</span>
          <button class="chip-stat link" data-boosters title="Boosters à ouvrir">${icon('booster')}<b>${sealed}</b> booster${sealed > 1 ? 's' : ''}</button>
          <span class="chip-stat" title="Cartes différentes possédées">${icon('book')}<b>${c.unique}</b> cartes</span>
          ${wildcardsHtml(c.wildcards)}
        </div>
      </div>
      ${c.deckChoices > 0 ? `<div class="deck-gift panel">${icon('crown')}<div><b>Un nouveau deck t'attend !</b>
        <span class="muted small">Ta série de victoires te donne ${plural(c.deckChoices, 'préconstruit', 'préconstruits')} au choix.</span></div>
        <button class="btn gold" data-gift>Choisir</button></div>` : ''}
      <div class="streak panel">
        <div><b>Série : ${plural(c.streak, 'victoire', 'victoires')}</b>
          <span class="muted small">${toBonus === c.bonusEvery && c.streak ? 'Bonus obtenu ! ' : ''}Encore ${plural(toBonus, 'victoire', 'victoires')} d'affilée pour ${c.bonusBoosters} boosters et un nouveau deck.</span></div>
        <div class="streak-pips">${Array.from({length: c.bonusEvery}, (_, i) => `<i class="${i < c.streak % c.bonusEvery ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <div class="deck-shop panel">${icon('cards')}<div><b>Préconstruits jusqu'au bracket ${c.maxBracket}</b>
        <span class="muted small">${c.maxBracket >= 5 ? 'Tous les brackets sont débloqués.'
          : `Bracket ${c.maxBracket + 1} après ${plural(c.seriesPerBracket - (c.series % c.seriesPerBracket), 'série terminée', 'séries terminées')} de plus (${plural(c.series, 'série', 'séries')} jusqu'ici).`}</span></div>
        <button class="btn" data-buy-deck>${icon('mana')} Acheter un deck</button></div>
      <div class="versus">
        <div class="vs-side me"><div class="vs-label">Ton deck</div><div class="vs-tile mine"></div>
          <select class="vs-deck">${decks.map(d => `<option value="${esc(d.key)}"${d.key === this.deckKey ? ' selected' : ''}${d.legal ? '' : ' disabled'}>${esc(d.name)}${d.legal ? '' : ' (incomplet)'}</option>`).join('')}</select></div>
        <div class="vs-mid"><span>VS</span></div>
        <div class="vs-side them"><div class="vs-label">Ton adversaire</div><div class="vs-tile theirs"><p class="muted small">Recherche d'un adversaire à ta mesure…</p></div>
          <div class="muted small vs-note"></div></div>
      </div>
      <div class="duel-go">
        <div class="muted small">Victoire : <b>+${c.winMana} mana</b>, ${c.cardsPerWin} cartes de son deck, 1 booster d'une extension au hasard.</div>
        <button class="btn gold big" data-fight>${icon('swords')} Combattre</button>
        ${playable.length ? '' : '<div class="muted small">Aucun deck complet : termine un deck de 100 cartes dans Decks.</div>'}
      </div>
      <details class="pw-more"><summary class="muted small">Règles du mode Planeswalker</summary>${RULES}
        <button class="btn small danger" data-reset>Recommencer la carrière</button></details>
    </div>`;
    const mine = decks.find(d => d.key === this.deckKey);
    const tiles = [];
    if (mine) {
      const t = deckTile(mine, '', `${mine.count} cartes`);
      this.root.querySelector('.vs-tile.mine').appendChild(t);
      tiles.push(t);
    }
    fillBadges(tiles);
    const fight = this.root.querySelector('[data-fight]');
    fight.disabled = true;
    let opp = null;
    if (mine) {
      const key = this.deckKey;
      bridge.request('careerDuel', {deck: key}).then((info) => {
        if (key !== this.deckKey || !this.root.isConnected) {
          return;
        }
        opp = info.opponent;
        const t = deckTile(opp, '', 'Préconstruit Commander');
        t.querySelector('.deck-art').insertAdjacentHTML('beforeend', measureHtml(opp));
        this.root.querySelector('.vs-tile.theirs').replaceChildren(t);
        const power = (v) => Number(v).toLocaleString('fr-FR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
        this.root.querySelector('.vs-note').innerHTML = `Ton deck : bracket ${info.bracket}, puissance ${power(info.power)} · le sien : bracket ${opp.bracket}, puissance ${power(opp.power)}.<br>${
          opp.unowned ? `${plural(opp.unowned, 'carte', 'cartes')} de son deck te manquent.` : 'Tu as déjà toutes ses cartes.'}`;
        fight.disabled = false;
      }).catch((e) => {
        this.root.querySelector('.vs-tile.theirs').innerHTML = `<p class="muted small">${esc(e.message)}</p>`;
      });
    }
    const gift = this.root.querySelector('[data-gift]');
    if (gift) {
      gift.addEventListener('click', () => this.chooseNewDeck());
    }
    this.root.querySelector('[data-buy-deck]').addEventListener('click', () => this.buyDeck());
    this.root.querySelector('.vs-deck').addEventListener('change', (e) => {
      this.deckKey = e.target.value;
      prefs.set('careerDeck', this.deckKey);
      this.render(c);
    });
    this.root.querySelector('[data-boosters]').addEventListener('click', () => this.onBoosters());
    fight.addEventListener('click', () => {
      if (!opp) {
        return;
      }
      prefs.set('careerDeck', this.deckKey);
      this.onStart({career: true, format: 'commander', players: [
        {name: this.playerName() || 'Moi', ai: false, deckKey: this.deckKey},
        {name: 'Adversaire', ai: true, deckKey: opp.key},
      ]});
    });
    this.root.querySelector('[data-reset]').addEventListener('click', async () => {
      const running = this.duelRunning();
      if (await confirmBox('Recommencer la carrière ?', `${running ? 'Ton duel en cours sera abandonné. ' : ''}Ta collection, ton mana, tes boosters et tes decks Planeswalker seront effacés (sur tous tes appareils synchronisés).`, {yes: 'Tout effacer', danger: true})) {
        try {
          if (running) {
            await this.endDuel();
          }
          setCareer(await bridge.request('careerReset'));
          this.show();
        } catch (e) {
          toast(e.message, {error: true});
        }
      }
    });
  }
}

