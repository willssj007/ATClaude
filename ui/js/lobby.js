// Salon : préparation d'une partie contre 1 à 3 IA.

import {bridge} from './bridge.js';
import {confirmBox} from './dialogs.js';
import {esc, el, prefs, toast, avatarHtml} from './util.js';

const PROFILE_LABELS = {Default: 'Équilibrée', Cautious: 'Prudente', Reckless: 'Agressive', Experimental: 'Expérimentale'};

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
  }

  setProfiles(list) {
    this.profiles = list || [];
  }

  async show() {
    const decks = await this.getDecks();
    this.decks = decks;
    if (!this.seats) {
      this.seats = [{name: 'Moi', ai: false, deckKey: this.defaultDeck(true)}, {name: 'IA 1', ai: true, deckKey: 'random'}];
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
        <div class="deck-line"><select data-f="deckKey">${this.deckOptions(s.deckKey)}</select></div>
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
      } else {
        this.count = Number(b.dataset.v);
      }
      this.render();
    }));
    this.root.querySelectorAll('.seat').forEach(node => {
      const seat = this.seats[Number(node.dataset.i)];
      node.querySelectorAll('[data-f]').forEach(input => input.addEventListener('change', () => {
        seat[input.dataset.f] = input.value;
      }));
    });
    this.root.querySelector('[data-start]').addEventListener('click', () => this.start());
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
    const names = new Set(setup.players.map(p => p.name));
    if (names.size !== setup.players.length) {
      toast('Donne un nom différent à chaque joueur.', {error: true});
      return;
    }
    prefs.set('lastSetup', setup);
    this.onStart(setup);
  }
}
