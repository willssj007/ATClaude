// Replays : les 5 dernières parties, revues sur le plateau. Le moteur garde les photos de chaque partie (ce que le
// joueur voyait) ; ici, on les remontre une à une dans un plateau en lecture seule, au rythme de la partie (les
// longues attentes raccourcies), avec lecture, pause, photo par photo, tour par tour et vitesse.

import {bridge} from './bridge.js';
import {Game} from './game.js';
import {icon} from './icons.js';
import {el, esc, prefs, toast} from './util.js';

const RESULT = {win: 'Victoire', loss: 'Défaite', draw: 'Égalité'};
/** Pause entre deux photos, en millisecondes (vitesse ×1) : les rafales gardent leur rythme, les attentes sont coupées. */
const MIN_GAP = 90;
const MAX_GAP = 1400;
const SPEEDS = [1, 2, 4];

export async function loadReplays() {
  return (await bridge.request('replays')) || [];
}

function when(at) {
  const d = new Date(at);
  return d.toLocaleDateString('fr-FR', {weekday: 'short', day: 'numeric', month: 'short'}) + ' à '
    + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
}

function deckName(p) {
  const raw = (p.name || '').replace(/\s*\[[^\]]*\]/g, '').trim();
  return raw || (p.commandersFr || p.commanders || []).join(' & ') || 'Deck';
}

/** Les replays gardés, en tuiles (écran Statistiques). */
export function replayListHtml(list) {
  if (!list.length) {
    return `<p class="muted small">Les 5 dernières parties terminées (victoire, défaite ou abandon) se gardent ici, à revoir tour par tour.</p>`;
  }
  return `<div class="replays">${list.map(r => {
    const me = (r.players || []).find(p => p.me) || {};
    const others = (r.players || []).filter(p => !p.me);
    return `<div class="replay-tile panel ${r.result || ''}" data-replay="${esc(r.id)}">
      <div class="rt-art" data-img="${esc(me.image || '')}"></div>
      <div class="rt-body">
        <div class="rt-top"><b class="rt-result">${RESULT[r.result] || ''}${r.conceded ? ' (abandon)' : ''}</b><span class="muted small">${esc(when(r.at))}</span></div>
        <div class="rt-decks"><b>${esc(deckName(me))}</b> <span class="muted">contre</span> ${others.map(p => esc(deckName(p))).join(', ')}</div>
        <div class="muted small">${r.mode === 'planeswalker' ? 'Planeswalker' : 'Sandbox'} · ${r.format === 'commander' ? 'Commander' : 'Construit'}${(r.players || []).length > 2 ? ` à ${r.players.length}` : ''} · ${r.turns} tours</div>
      </div>
      <button class="btn small gold" data-watch="${esc(r.id)}">${icon('play')} Revoir</button>
    </div>`;
  }).join('')}</div>`;
}

/** Les illustrations des tuiles, chargées si les images sont activées. */
export function fillReplayArt(root) {
  if (!prefs.get('images')) {
    return;
  }
  root.querySelectorAll('.replay-tile [data-img]').forEach(node => {
    if (!node.dataset.img) {
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
}

/** Le lecteur : un plateau en lecture seule et ses commandes, à la place de l'invite et des boutons. */
export class ReplayScreen {
  constructor(root, {onClose}) {
    this.root = root;
    this.onClose = onClose;
    this.game = null;
    this.token = 0;
  }

  async open(id) {
    this.stop();
    this.root.innerHTML = '<div class="waiting-start"><div class="spinner"></div><div>Chargement du replay…</div></div>';
    let meta;
    try {
      meta = await bridge.request('replayOpen', {id});
    } catch (e) {
      toast(e.message, {error: true});
      this.onClose();
      return;
    }
    this.meta = meta;
    this.names = new Map((meta.players || []).map(p => [p.id, p.player]));
    this.starts = meta.turnStarts || [];
    this.i = -1;
    this.cur = null;
    this.playing = false;
    this.speed = SPEEDS.includes(prefs.get('replaySpeed')) ? prefs.get('replaySpeed') : 1;
    this.root.innerHTML = '';
    const host = el('<div class="replay-host"></div>');
    this.root.appendChild(host);
    this.bar = this.buildBar();
    this.game = new Game(host, {
      replay: true,
      onExit: () => this.close(),
      onMenu: () => this.close(),
      onRematch: () => {},
      onBuild: (table) => table.querySelector('.actions').prepend(this.bar),
    });
    await this.seek(0);
    this.play();
  }

  buildBar() {
    const n = this.meta.frames;
    const bar = el(`<div class="replay-bar panel">
      <div class="rp-top"><span class="rp-title">${icon('reel')} Replay</span>
        <button class="rp-btn rp-x" data-rp="close" title="Fermer le replay">✕</button></div>
      <div class="rp-turn"></div>
      <div class="rp-ctl">
        <button class="rp-btn" data-rp="prevTurn" title="Tour précédent">${icon('skipBack')}</button>
        <button class="rp-btn" data-rp="prev" title="Photo précédente">${icon('chevronLeft')}</button>
        <button class="rp-btn rp-play" data-rp="toggle" title="Lecture / pause">${icon('play')}</button>
        <button class="rp-btn" data-rp="next" title="Photo suivante">${icon('chevronRight')}</button>
        <button class="rp-btn" data-rp="nextTurn" title="Tour suivant">${icon('skipForward')}</button>
      </div>
      <input class="rp-range" type="range" min="0" max="${Math.max(0, n - 1)}" value="0" aria-label="Moment de la partie">
      <div class="rp-speed seg">${SPEEDS.map(s => `<button data-speed="${s}" class="${s === this.speed ? 'on' : ''}">×${s}</button>`).join('')}</div>
    </div>`);
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('[data-rp]');
      const sp = e.target.closest('[data-speed]');
      if (sp) {
        this.speed = Number(sp.dataset.speed);
        prefs.set('replaySpeed', this.speed);
        bar.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === sp));
        return;
      }
      if (!b) {
        return;
      }
      const act = b.dataset.rp;
      if (act === 'close') {
        this.close();
      } else if (act === 'toggle') {
        this.playing ? this.pause() : this.play();
      } else if (act === 'prev' || act === 'next') {
        this.pause();
        this.seek(this.i + (act === 'next' ? 1 : -1));
      } else if (act === 'prevTurn' || act === 'nextTurn') {
        const target = act === 'nextTurn' ? this.starts.find(s => s.i > this.i)
          : [...this.starts].reverse().find(s => s.i < this.i - 2) || this.starts[0];
        if (target) {
          this.jump(target.i);
        }
      }
    });
    const range = bar.querySelector('.rp-range');
    let pending = null;
    range.addEventListener('input', () => {
      this.pause();
      this.label(Number(range.value));
      clearTimeout(pending);
      pending = setTimeout(() => this.seek(Number(range.value)), 80);
    });
    return bar;
  }

  /** Le tour de la photo i (d'après les débuts de tour enregistrés). */
  turnAt(i) {
    let t = null;
    for (const s of this.starts) {
      if (s.i <= i) {
        t = s;
      } else {
        break;
      }
    }
    return t;
  }

  label(i) {
    const t = this.turnAt(i);
    const node = this.bar.querySelector('.rp-turn');
    node.innerHTML = t ? `Tour <b>${t.turn}</b> · ${esc(this.names.get(t.player) || '')}` : '';
    node.title = `Photo ${i + 1} sur ${this.meta.frames}`;
  }

  async fetch(i) {
    return bridge.request('replayFrame', {id: this.meta.id, i});
  }

  /** Affiche une photo (pas « show » : showScreen appelle show() sur chaque écran). */
  showFrame(frame) {
    this.cur = frame;
    this.i = frame.replayIndex;
    this.shownAt = performance.now();
    this.game.setState(frame);
    this.bar.querySelector('.rp-range').value = String(this.i);
    this.label(this.i);
    const end = this.i >= this.meta.frames - 1;
    this.bar.querySelector('[data-rp="next"]').disabled = end;
    this.bar.querySelector('[data-rp="prev"]').disabled = this.i <= 0;
  }

  async seek(i) {
    const target = Math.max(0, Math.min(this.meta.frames - 1, i));
    const token = ++this.token;
    try {
      const f = await this.fetch(target);
      if (token === this.token && this.game) {
        this.showFrame(f);
      }
    } catch (e) {
      toast(e.message, {error: true});
    }
  }

  /** Saut (tour précédent ou suivant) : la lecture reprend si elle était en cours. */
  async jump(i) {
    const was = this.playing;
    this.pause();
    await this.seek(i);
    if (was) {
      this.play();
    }
  }

  play() {
    if (!this.game || this.playing) {
      return;
    }
    if (this.i >= this.meta.frames - 1) {
      this.seek(0).then(() => this.play());
      return;
    }
    this.playing = true;
    this.bar.querySelector('.rp-play').innerHTML = icon('pause');
    this.loop(++this.token);
  }

  pause() {
    if (this.playing) {
      this.playing = false;
      this.token++;
      if (this.bar) {
        this.bar.querySelector('.rp-play').innerHTML = icon('play');
      }
    }
  }

  async loop(token) {
    while (this.playing && token === this.token) {
      if (this.i >= this.meta.frames - 1) {
        this.pause();
        return;
      }
      let next;
      try {
        next = await this.fetch(this.i + 1);
      } catch (e) {
        this.pause();
        toast(e.message, {error: true});
        return;
      }
      const gap = Math.min(MAX_GAP, Math.max(MIN_GAP, next.replayTime - (this.cur ? this.cur.replayTime : 0))) / this.speed;
      const wait = gap - (performance.now() - this.shownAt);
      if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
      }
      if (!this.playing || token !== this.token || !this.game) {
        return;
      }
      this.showFrame(next);
    }
  }

  stop() {
    this.pause();
    this.token++;
    if (this.game) {
      this.game.destroy();
      this.game = null;
    }
  }

  close() {
    this.stop();
    this.root.innerHTML = '';
    this.onClose();
  }
}
