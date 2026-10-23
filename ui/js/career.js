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
    ${r.bonus ? `<div class="rw-bonus">${icon('crown')} ${r.streak} victoires d'affilée : ${plural(r.bonus.length, 'booster', 'boosters')} en bonus !</div>` : ''}
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

/** Le deck de départ, révélé au début de la carrière. */
function starterReveal(c) {
  const deck = (c.decks || []).find(d => d.name === c.starter) || (c.decks || [])[0];
  customBox('Ta carrière commence', (body, footer, close) => {
    body.innerHTML = `<p>Les étincelles se sont posées sur un deck : <b>${esc(deck ? deck.name : '')}</b>.</p>
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

const RULES = `<ul class="pw-rules">
  <li>${icon('cards')} Un deck Commander tiré au hasard pour commencer : ses cartes sont ta collection.</li>
  <li>${icon('swords')} Des duels contre l'IA, un adversaire à la fois, sans triche ni réglages.</li>
  <li>${icon('mana')} Chaque victoire : 100 mana, quelques cartes du deck adverse que tu n'as pas, et un booster.</li>
  <li>${icon('crown')} 5 victoires d'affilée : 10 boosters d'extensions au hasard.</li>
  <li>${icon('booster')} La boutique vend des boosters de toutes les extensions, 1 000 mana pièce.</li>
</ul>`;

/** Écran Duel du mode Planeswalker : ton deck contre le prochain adversaire. */
export class DuelScreen {
  constructor(root, {onStart, onBoosters, playerName}) {
    this.root = root;
    this.onStart = onStart;
    this.onBoosters = onBoosters;
    this.playerName = playerName;
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
        <button class="btn gold big" data-start>${icon('spark')} Commencer ma carrière</button>
      </div></div>`;
    this.root.querySelector('[data-start]').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const c = await bridge.request('careerStart');
        setCareer(c);
        this.render(c);
        starterReveal(c);
      } catch (err) {
        e.target.disabled = false;
        toast(err.message, {error: true});
      }
    });
  }

  render(c) {
    const decks = c.decks || [];
    const playable = decks.filter(d => d.legal);
    if (!playable.some(d => d.key === this.deckKey)) {
      const last = prefs.get('careerDeck');
      this.deckKey = (playable.find(d => d.key === last) || playable[0] || {}).key || null;
    }
    const opp = c.opponent || {};
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
        </div>
      </div>
      <div class="streak panel">
        <div><b>Série : ${plural(c.streak, 'victoire', 'victoires')}</b>
          <span class="muted small">${toBonus === c.bonusEvery && c.streak ? 'Bonus obtenu ! ' : ''}Encore ${plural(toBonus, 'victoire', 'victoires')} d'affilée pour ${c.bonusBoosters} boosters.</span></div>
        <div class="streak-pips">${Array.from({length: c.bonusEvery}, (_, i) => `<i class="${i < c.streak % c.bonusEvery ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <div class="versus">
        <div class="vs-side me"><div class="vs-label">Ton deck</div><div class="vs-tile mine"></div>
          <select class="vs-deck">${decks.map(d => `<option value="${esc(d.key)}"${d.key === this.deckKey ? ' selected' : ''}${d.legal ? '' : ' disabled'}>${esc(d.name)}${d.legal ? '' : ' (incomplet)'}</option>`).join('')}</select></div>
        <div class="vs-mid"><span>VS</span></div>
        <div class="vs-side them"><div class="vs-label">Ton adversaire</div><div class="vs-tile theirs"></div>
          <div class="muted small">${opp.unowned ? `${plural(opp.unowned, 'carte', 'cartes')} de son deck te manquent.` : 'Tu as déjà toutes ses cartes.'}</div></div>
      </div>
      <div class="duel-go">
        <div class="muted small">Victoire : <b>+${c.winMana} mana</b>, ${c.cardsPerWin} cartes de son deck, 1 booster d'une extension au hasard.</div>
        <button class="btn gold big" data-fight ${this.deckKey ? '' : 'disabled'}>${icon('swords')} Combattre</button>
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
    if (opp.key) {
      const t = deckTile(opp, '', 'Préconstruit Commander');
      this.root.querySelector('.vs-tile.theirs').appendChild(t);
      tiles.push(t);
    }
    fillBadges(tiles);
    this.root.querySelector('.vs-deck').addEventListener('change', (e) => {
      this.deckKey = e.target.value;
      prefs.set('careerDeck', this.deckKey);
      this.render(c);
    });
    this.root.querySelector('[data-boosters]').addEventListener('click', () => this.onBoosters());
    this.root.querySelector('[data-fight]').addEventListener('click', () => {
      prefs.set('careerDeck', this.deckKey);
      this.onStart({career: true, format: 'commander', players: [
        {name: this.playerName() || 'Moi', ai: false, deckKey: this.deckKey},
        {name: 'Adversaire', ai: true, deckKey: opp.key},
      ]});
    });
    this.root.querySelector('[data-reset]').addEventListener('click', async () => {
      if (await confirmBox('Recommencer la carrière ?', 'Ta collection, ton mana, tes boosters et tes decks Planeswalker seront effacés (sur tous tes appareils synchronisés).', {yes: 'Tout effacer', danger: true})) {
        try {
          setCareer(await bridge.request('careerReset'));
          this.show();
        } catch (e) {
          toast(e.message, {error: true});
        }
      }
    });
  }
}

