// Trophées : les succès de Forge, gagnés au fil des parties (sans triche).

import {bridge} from './bridge.js';
import {sfx} from './audio.js';
import {esc, el} from './util.js';
import {icon} from './icons.js';
import {challengesHtml} from './themes.js';

const LEVELS = {common: 'Bronze', uncommon: 'Argent', rare: 'Or', mythic: 'Mythique', special: 'Spécial'};

export class Trophies {
  constructor(root) {
    this.root = root;
  }

  async show() {
    this.root.innerHTML = '<div class="page"><h1>Trophées</h1><div class="muted">Chargement…</div></div>';
    let data;
    try {
      data = await bridge.request('trophies');
    } catch (e) {
      this.root.innerHTML = `<div class="page"><h1>Trophées</h1><p class="muted">${esc(e.message)}</p></div>`;
      return;
    }
    const sections = data.collections.map(c => `<h2>${esc(c.name)}</h2>
      <div class="trophy-grid">${c.items.map(t => this.trophyHtml(t)).join('')}</div>`).join('');
    this.root.innerHTML = `<div class="page trophies">
      <div class="trophy-head">
        <h1 style="margin:0">Trophées</h1>
        <div class="trophy-count"><b>${data.earned}</b> / ${data.total} obtenus</div>
      </div>
      <p class="muted small">Les trophées se gagnent en fin de partie. Une partie où le menu de triche a servi ne compte pas (règle de Forge).</p>
      <div class="challenges"></div>
      ${sections}
    </div>`;
    challengesHtml().then((html) => {
      const box = this.root.querySelector('.challenges');
      if (box) {
        box.innerHTML = html;
      }
    }).catch(() => {});
  }

  trophyHtml(t) {
    const tiers = (t.tiers || []).map(x => `<li class="${x.earned ? 'on' : ''}" data-l="${x.key}"><span class="dot"></span><b>${esc(x.label)}</b> ${esc(x.desc)}</li>`).join('');
    return `<div class="trophy panel${t.level ? ' earned' : ''}" data-level="${esc(t.level || "")}">
      <div class="cup" title="${esc(LEVELS[t.level] || 'Pas encore obtenu')}">${icon('chalice')}</div>
      <div class="t-body">
        <b>${esc(t.name)}</b>
        ${t.desc ? `<div class="muted small">${esc(t.desc)}</div>` : ''}
        ${tiers ? `<ul class="tiers">${tiers}</ul>` : ''}
        ${t.best && /[1-9]/.test(t.best) ? `<div class="best small">${esc(t.best)}</div>` : ''}
      </div>
    </div>`;
  }
}

/** Annonce d'un trophée gagné (envoyée par Forge en fin de partie). */
export function announceTrophy({title, message}) {
  const lines = String(message || '').split('\n');
  const box = el(`<div class="trophy-pop">
    <div class="cup">${icon('chalice')}</div>
    <div><div class="t-title">${esc(title || 'Trophée obtenu')}</div>
      <b>${esc(lines[0] || '')}</b>
      <div class="small">${esc(lines.slice(1).join(' '))}</div></div>
  </div>`);
  document.body.appendChild(box);
  sfx('win_duel.mp3', 0.6);
  setTimeout(() => box.classList.add('out'), 5200);
  setTimeout(() => box.remove(), 6000);
  box.addEventListener('click', () => box.remove());
}
