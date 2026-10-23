// Salon : préparation d'une partie contre 1 à 3 IA.

import {bracketBadgeHtml} from './analysis.js';
import {bridge} from './bridge.js';
import {confirmBox} from './dialogs.js';
import {esc, el, prefs, toast, avatarHtml} from './util.js';

const PROFILE_LABELS = {Default: 'Équilibrée', Cautious: 'Prudente', Reckless: 'Agressive', Experimental: 'Expérimentale'};
const MULLIGANS = [['null', 'Normal'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['-1', '∞']];

function mulliganHelp(free, count) {
  if (free === null) {
    return count > 2 ? 'Règle officielle : le premier mulligan est gratuit, chaque suivant coûte une carte.'
      : 'Règle officielle : chaque mulligan coûte une carte (on pioche 7, on en remet sous la bibliothèque).';
  }
  if (free === -1) {
    return 'Mulligans illimités : on garde toujours 7 cartes. Vaut pour tous les joueurs, IA comprises.';
  }
  if (free === 0) {
    return 'Aucun mulligan gratuit : chaque mulligan coûte une carte, même à plusieurs. Vaut pour tous les joueurs.';
  }
  return `${free === 1 ? 'Le premier mulligan est gratuit' : `Les ${free} premiers mulligans sont gratuits`} (on garde 7 cartes), puis chacun coûte une carte. Vaut pour tous les joueurs.`;
}

export class Lobby {
  constructor(root, {onStart, getDecks}) {
    this.root = root;
    this.onStart = onStart;
    this.getDecks = getDecks;
    this.profiles = [];
    const last = prefs.get('lastSetup');
    this.format = last && last.format || 'commander';
    this.count = last && last.players ? last.players.length : 2;
    this.seats = last && last.players ? last.players : null;
    // Mulligans gratuits : absent = règle de Forge, -1 = illimités.
    this.mulligans = last && typeof last.mulligans === 'number' ? last.mulligans : null;
  }

  setProfiles(list) {
    this.profiles = list || [];
  }

  async show() {
    const decks = await this.getDecks();
    this.decks = decks;
    if (!this.seats) {
      this.seats = [{name: this.playerName || 'Moi', ai: false, deckKey: this.defaultDeck(true)}, {name: 'IA 1', ai: true, deckKey: 'random'}];
    }
    this.render();
  }

  defaultDeck(human) {
    const mine = (this.decks.decks || []).filter(d => d.format === this.format);
    if (human && mine.length) {
      return mine[0].key;
    }
    if (this.format === 'commander' && this.decks.precons && this.decks.precons.length) {
      return human ? this.decks.precons[0].key : 'random';
    }
    return this.format === 'commander' ? 'random' : 'randomConstructed';
  }

  deckOptions(selected) {
    const mine = (this.decks.decks || []).filter(d => d.format === this.format);
    const opt = (key, label) => `<option value="${esc(key)}"${key === selected ? ' selected' : ''}>${esc(label)}</option>`;
    let html = '';
    if (this.format === 'commander') {
      html += opt('random', '🎲 Deck aléatoire (généré par Forge)');
    } else {
      html += opt('randomConstructed', '🎲 Deck aléatoire (généré par Forge)');
    }
    if (mine.length) {
      html += `<optgroup label="Mes decks">${mine.map(d => opt(d.key, d.name + (d.commanders && d.commanders.length ? ' — ' + d.commanders.join(' & ') : ''))).join('')}</optgroup>`;
    }
    if (this.format === 'commander' && this.decks.precons) {
      html += `<optgroup label="Préconstruits Commander (${this.decks.precons.length})">${this.decks.precons.map(d => opt(d.key, d.name)).join('')}</optgroup>`;
    }
    return html;
  }

  render() {
    while (this.seats.length < this.count) {
      const n = this.seats.length;
      this.seats.push({name: 'IA ' + n, ai: true, deckKey: this.defaultDeck(false), profile: ''});
    }
    this.seats.length = this.count;
    const profiles = this.profiles.length ? this.profiles : ['Default'];
    const seatHtml = this.seats.map((s, i) => `<div class="seat" data-i="${i}">
      ${avatarHtml(s.name, i, 44)}
      <div class="fields">
        <input type="text" data-f="name" value="${esc(s.name)}" maxlength="24" placeholder="Nom">
        ${s.ai ? `<select data-f="profile">${profiles.map(p => `<option value="${esc(p)}"${p === s.profile ? ' selected' : ''}>IA ${esc(PROFILE_LABELS[p] || p)}</option>`).join('')}</select>`
          : '<div class="muted small" style="align-self:center">Vous</div>'}
        <div class="deck-line"><select data-f="deckKey">${this.deckOptions(s.deckKey)}</select><span class="seat-bk"></span></div>
      </div>
    </div>`).join('');
    this.root.innerHTML = `<div class="page">
      <h1>Créer un salon</h1>
      <p class="muted">Partie locale contre l'IA de Forge. Toutes les règles sont appliquées par le moteur Forge.</p>
      <div class="lobby">
        <div class="box panel">
          <div class="field"><span>Format</span>
            <div class="seg" data-seg="format">
              <button data-v="commander" class="${this.format === 'commander' ? 'on' : ''}">Commander</button>
              <button data-v="constructed" class="${this.format === 'constructed' ? 'on' : ''}">Construit</button>
            </div>
            <div class="muted small">${this.format === 'commander' ? '100 cartes, 40 points de vie, blessures de commandant.' : '60 cartes, 20 points de vie.'}</div>
          </div>
          <div class="field"><span>Joueurs</span>
            <div class="seg" data-seg="count">
              ${[2, 3, 4].map(n => `<button data-v="${n}" class="${this.count === n ? 'on' : ''}">${n}</button>`).join('')}
            </div>
            <div class="muted small">Vous + ${this.count - 1} IA${this.count > 2 ? ', chacun pour soi' : ''}.</div>
          </div>
          <div class="field"><span>Mulligans gratuits</span>
            <div class="seg" data-seg="mulligans">
              ${MULLIGANS.map(([v, label]) => `<button data-v="${v}" class="${String(this.mulligans) === v ? 'on' : ''}">${label}</button>`).join('')}
            </div>
            <div class="muted small">${mulliganHelp(this.mulligans, this.count)}</div>
          </div>
          <button class="btn gold" data-start style="width:100%;min-height:48px;font-size:16px;margin-top:6px">▶ Lancer la partie</button>
          <p class="muted small" style="margin-top:12px">Astuce : les decks préconstruits Commander de Forge sont prêts à jouer. Crée les tiens dans l'onglet Decks, ou importe-les depuis Moxfield.</p>
        </div>
        <div class="box panel">
          <h3>Places</h3>
          ${seatHtml}
        </div>
      </div>
    </div>`;

    this.root.querySelectorAll('[data-seg]').forEach(seg => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) {
        return;
      }
      if (seg.dataset.seg === 'format') {
        this.format = b.dataset.v;
        this.seats.forEach((s, i) => {
          s.deckKey = this.defaultDeck(i === 0);
        });
      } else if (seg.dataset.seg === 'mulligans') {
        this.mulligans = b.dataset.v === 'null' ? null : Number(b.dataset.v);
      } else {
        this.count = Number(b.dataset.v);
      }
      this.render();
    }));
    this.root.querySelectorAll('.seat').forEach(node => {
      const seat = this.seats[Number(node.dataset.i)];
      node.querySelectorAll('[data-f]').forEach(input => input.addEventListener('change', () => {
        seat[input.dataset.f] = input.value;
        if (input.dataset.f === 'deckKey') {
          this.seatArt(node, seat.deckKey);
          this.seatBadges();
        }
      }));
      this.seatArt(node, seat.deckKey);
    });
    this.root.querySelector('[data-start]').addEventListener('click', () => this.start());
    this.seatBadges();
  }

  /** Bracket et puissance du deck de chaque place : pour composer une table équilibrée. */
  async seatBadges() {
    const nodes = [...this.root.querySelectorAll('.seat')];
    const keys = this.seats.map(s => s.deckKey).filter(k => k && !k.startsWith('random'));
    nodes.forEach((n, i) => {
      const k = this.seats[i] && this.seats[i].deckKey;
      n.querySelector('.seat-bk').innerHTML = !k || k.startsWith('random') ? '<span class="muted small">bracket inconnu</span>' : '';
    });
    if (!keys.length) {
      return;
    }
    try {
      const sums = await bridge.request('deckSummaries', {keys: [...new Set(keys)]});
      nodes.forEach((n, i) => {
        const sum = this.seats[i] && sums[this.seats[i].deckKey];
        if (sum && n.isConnected) {
          n.querySelector('.seat-bk').innerHTML = bracketBadgeHtml(sum);
        }
      });
    } catch (e) {
      // pas de pastille
    }
  }

  /** Illustration du commandant du deck choisi, en fond de la place. */
  seatArt(node, key) {
    const all = [...((this.decks && this.decks.decks) || []), ...((this.decks && this.decks.precons) || [])];
    const deck = all.find(d => d.key === key);
    node.classList.remove('has-art');
    node.style.removeProperty('--seat-art');
    if (!deck || !deck.image || !prefs.get('images')) {
      return;
    }
    const url = bridge.imageUrl(deck.image, prefs.get('imageLang'));
    const img = new Image();
    img.onload = () => {
      node.style.setProperty('--seat-art', `url("${url}")`);
      node.classList.add('has-art');
    };
    img.src = url;
  }

  async start() {
    const target = this.format === 'commander' ? 100 : 60;
    const short = this.seats.map(s => (this.decks.decks || []).find(d => d.key === s.deckKey)).filter(d => d && d.count < target);
    if (short.length && !await confirmBox('Deck incomplet',
      short.map(d => `« ${d.name} » ne contient que ${d.count} cartes sur ${target} : le joueur risque de perdre en piochant dans une bibliothèque vide.`).join('\n'),
      {yes: 'Jouer quand même'})) {
      return;
    }
    const setup = {
      format: this.format,
      players: this.seats.map(s => ({name: s.name.trim() || (s.ai ? 'IA' : 'Moi'), ai: s.ai, deckKey: s.deckKey, profile: s.ai ? s.profile || '' : ''})),
    };
    if (this.mulligans !== null) {
      setup.mulligans = this.mulligans;
    }
    const names = new Set(setup.players.map(p => p.name));
    if (names.size !== setup.players.length) {
      toast('Donne un nom différent à chaque joueur.', {error: true});
      return;
    }
    prefs.set('lastSetup', setup);
    this.onStart(setup);
  }
}
