// Decks : liste, édition (deck builder orienté Commander), import Moxfield ou texte, export.

import {bracketBadgeHtml, openAnalysis, openDeckStats, openEdhrec, summaryLineHtml} from './analysis.js';
import {bridge} from './bridge.js';
import {cardElement, showZoom, onLongPress} from './cards.js';
import {confirmBox, customBox} from './dialogs.js';
import {SearchPanel} from './search.js';
import {esc, el, manaHtml, prefs, toast, debounce} from './util.js';

const GROUPS = [
  ['Créatures', c => c.creature],
  ['Planeswalkers', c => /planeswalker/i.test(c.typeEn)],
  ['Éphémères', c => /instant/i.test(c.typeEn)],
  ['Rituels', c => /sorcery/i.test(c.typeEn)],
  ['Artefacts', c => /artifact/i.test(c.typeEn)],
  ['Enchantements', c => /enchantment/i.test(c.typeEn)],
  ['Batailles', c => /battle/i.test(c.typeEn)],
  ['Terrains', c => c.land],
  ['Autres', () => true],
];

// Messages de validation de Forge (en anglais), traduits pour l'affichage.
const PROBLEMS = [
  [/should have at least (\d+) cards/i, 'doit contenir au moins $1 cartes'],
  [/should have no more than (\d+) cards/i, 'ne doit pas dépasser $1 cartes'],
  [/must not contain more than (\d+) copies of the card (.+)/i, 'ne doit pas contenir plus de $1 exemplaire(s) de $2'],
  [/contains the following illegal cards:/i, 'contient des cartes interdites ou hors identité :'],
  [/contains the nonexisting card (.+)/i, 'contient une carte inconnue : $1'],
  [/has an illegal commander partnership/i, 'a des commandants qui ne peuvent pas être associés'],
  [/has an illegal commander/i, 'a un commandant non valide'],
  [/has too many commanders/i, 'a trop de commandants'],
  [/must have a sideboard of (\d+) to (\d+) cards or no sideboard at all/i, 'doit avoir une réserve de $1 à $2 cartes, ou aucune'],
  [/^Deck /, 'Le deck '],
];

function translateProblem(text) {
  return PROBLEMS.reduce((s, [re, to]) => s.replace(re, to), String(text));
}

/**
 * Tuile de deck façon Arena : l'illustration du commandant (recadrée sur l'image de la carte) en bandeau,
 * puis le nom, le commandant et l'identité de couleur.
 */
function deckTile(d, actionHtml, subtitle) {
  const tile = el(`<div class="deck-tile panel" data-key="${esc(d.key)}">
    <div class="deck-art" style="--id-grad:${identityGradient(d.identity)}"><div class="deck-art-img"></div><div class="deck-pips">${identityHtml(d.identity)}</div></div>
    <div class="deck-body">
      <div class="info"><b title="${esc(d.name)}">${esc(d.name)}</b>
        <div class="muted small">${esc((d.commanders || []).join(' & ') || subtitle)}</div>
        ${(d.commanders || []).length ? `<div class="muted small">${esc(subtitle)}</div>` : ''}</div>
      ${actionHtml}
    </div></div>`);
  if (d.image && prefs.get('images')) {
    const url = bridge.imageUrl(d.image, prefs.get('imageLang'));
    const img = new Image();
    img.onload = () => {
      tile.querySelector('.deck-art-img').style.backgroundImage = `url("${url}")`;
      tile.querySelector('.deck-art').classList.add('has-img');
    };
    img.src = url;
  }
  return tile;
}

/** Pastilles bracket / puissance sur des tuiles déjà affichées (calculées en arrière-plan). */
async function fillBadges(tiles) {
  const keys = tiles.map(t => t.dataset.key).filter(k => !k.startsWith('random'));
  if (!keys.length) {
    return;
  }
  try {
    const sums = await bridge.request('deckSummaries', {keys});
    for (const t of tiles) {
      const sum = sums[t.dataset.key];
      if (sum && t.isConnected && !t.querySelector('.bk-badge')) {
        t.querySelector('.deck-art').insertAdjacentHTML('beforeend', bracketBadgeHtml(sum));
      }
    }
  } catch (e) {
    // pas de pastille : l'analyse reste disponible dans l'éditeur
  }
}

const ID_COLORS = {W: '#e9e2c4', U: '#3d8fd8', B: '#5d5263', R: '#d9553b', G: '#3c9a5a'};

function identityGradient(identity) {
  const cols = (identity || '').split('').map(c => ID_COLORS[c]).filter(Boolean);
  if (!cols.length) {
    return 'linear-gradient(135deg, #8a8aa0, #4a4a5c)';
  }
  if (cols.length === 1) {
    cols.push(cols[0]);
  }
  return `linear-gradient(135deg, ${cols.join(', ')})`;
}

function identityHtml(identity) {
  return identity ? manaHtml(identity.split('').map(c => `{${c}}`).join('')) : '<span class="muted small">incolore</span>';
}

function deckText(deck) {
  const lines = [];
  const s = deck.sections;
  if (s.commander.length) {
    lines.push('Commander');
    s.commander.forEach(l => lines.push(`${l.count} ${l.card.name}`));
    lines.push('');
  }
  lines.push('Deck');
  s.main.forEach(l => lines.push(`${l.count} ${l.card.name}`));
  if (s.side.length) {
    lines.push('', 'Sideboard');
    s.side.forEach(l => lines.push(`${l.count} ${l.card.name}`));
  }
  return lines.join('\n');
}

export class Decks {
  constructor(root, {onPlay, onChanged}) {
    this.root = root;
    this.onPlay = onPlay;
    this.onChanged = onChanged;
    this.data = {decks: [], precons: []};
    this.deck = null;
  }

  async show() {
    if (this.deck) {
      return;
    }
    await this.list();
  }

  async list() {
    this.deck = null;
    this.data = await bridge.request('listDecks');
    const mine = this.data.decks;
    this.root.innerHTML = `<div class="page">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <h1 style="margin:0;flex:1">Mes decks</h1>
        <button class="btn" data-new="constructed">+ Deck construit</button>
        <button class="btn" data-import>⇩ Importer (Moxfield, texte)</button>
        <button class="btn gold" data-new="commander">+ Deck Commander</button>
      </div>
      <div class="deck-list mine">${mine.length ? '' : '<div class="panel" style="padding:18px"><p>Aucun deck pour l\'instant.</p><p class="muted">Crée un deck Commander, importe une liste Moxfield, ou pars d\'un des decks préconstruits ci-dessous.</p></div>'}</div>
      <h2 style="margin-top:28px">Préconstruits Commander <span class="muted small">(${this.data.precons.length}, fournis par Forge)</span></h2>
      <input type="search" class="precon-q" placeholder="Filtrer les préconstruits…" style="width:min(420px,100%);margin-bottom:10px">
      <div class="deck-list precons"></div>
    </div>`;
    const box = this.root.querySelector('.mine');
    const mineTiles = mine.map(d => deckTile(d, `<button class="btn small gold" data-play>Jouer</button>`,
      `${d.format === 'commander' ? 'Commander' : 'Construit'} · ${d.count} cartes`));
    mineTiles.forEach(t => box.appendChild(t));
    fillBadges(mineTiles);
    const renderPrecons = (filter = '') => {
      const f = filter.toLowerCase();
      const list = this.root.querySelector('.precons');
      const tiles = this.data.precons
        .filter(p => !f || p.name.toLowerCase().includes(f) || (p.commanders || []).some(c => c.toLowerCase().includes(f)))
        .slice(0, 80).map(p => deckTile(p, '<button class="btn small" data-copy>Copier</button>', 'Préconstruit'));
      list.replaceChildren(...tiles);
      fillBadges(tiles);
    };
    renderPrecons();
    this.root.querySelector('.precon-q').addEventListener('input', debounce(e => renderPrecons(e.target.value), 150));
    this.root.onclick = async (e) => {
      if (this.deck) {
        return;
      }
      const tile = e.target.closest('.deck-tile');
      const newBtn = e.target.closest('[data-new]');
      if (newBtn) {
        this.edit({name: '', format: newBtn.dataset.new, sections: {commander: [], main: [], side: []}});
      } else if (e.target.closest('[data-import]')) {
        this.importDialog();
      } else if (tile && e.target.closest('[data-play]')) {
        this.onPlay(tile.dataset.key);
      } else if (tile) {
        const deck = await bridge.request('loadDeck', {name: tile.dataset.key});
        if (e.target.closest('[data-copy]') || tile.dataset.key.startsWith('precon:')) {
          deck.name = deck.name.replace(/\s*\[.*$/, '') + ' (copie)';
        } else {
          deck.previousName = deck.name;
        }
        this.edit(deck);
      }
    };
  }

  // ------------------------------------------------------------------ deck builder

  edit(deck) {
    this.deck = deck;
    this.analysis = null;
    this.dirty = false;
    this.root.innerHTML = `<div class="tabs-mobile seg"><button data-tab="left" class="on">Recherche</button><button data-tab="right">Deck</button></div>
      <div class="builder">
        <div class="left"></div>
        <div class="right panel"></div>
      </div>`;
    const left = this.root.querySelector('.left');
    const right = this.root.querySelector('.right');
    right.classList.add('mobile-hidden');
    this.search = new SearchPanel(left, {
      onAdd: (card) => this.add(card),
      onPick: (card) => showZoom(card, card.canBeCommander && this.deck.format === 'commander'
        ? '<p class="muted small">Ajoute la carte puis touche ♛ dans le deck pour en faire le commandant.</p>' : ''),
      counts: (name) => this.count(name),
      identityLock: () => this.deck.format === 'commander' && this.deck.sections.commander.length ? this.identity() : null,
    });
    this.root.querySelector('.tabs-mobile').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) {
        return;
      }
      this.root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
      left.classList.toggle('mobile-hidden', b.dataset.tab !== 'left');
      right.classList.toggle('mobile-hidden', b.dataset.tab !== 'right');
    });
    this.renderDeck();
    this.analyze();
    this.search.search(true);
  }

  identity() {
    const set = new Set();
    for (const l of this.deck.sections.commander) {
      for (const c of l.card.identity || '') {
        set.add(c);
      }
    }
    return 'WUBRG'.split('').filter(c => set.has(c)).join('');
  }

  count(name) {
    const s = this.deck.sections;
    return [...s.commander, ...s.main].filter(l => l.card.name === name).reduce((a, l) => a + l.count, 0);
  }

  add(card, section = 'main') {
    const list = this.deck.sections[section];
    const line = list.find(l => l.card.name === card.name);
    if (line) {
      line.count++;
    } else {
      list.push({count: 1, card});
    }
    if (this.deck.format === 'commander' && section === 'main' && !card.basic && this.count(card.name) > 1 && !/any number|up to/i.test(card.textEn || '')) {
      toast(`${card.nameFr} est déjà dans le deck (Commander : un seul exemplaire).`);
    }
    this.changed();
  }

  remove(name, section) {
    const list = this.deck.sections[section];
    const i = list.findIndex(l => l.card.name === name);
    if (i >= 0) {
      list[i].count--;
      if (list[i].count <= 0) {
        list.splice(i, 1);
      }
    }
    this.changed();
  }

  setCommander(name) {
    const s = this.deck.sections;
    const line = s.main.find(l => l.card.name === name) || s.side.find(l => l.card.name === name);
    if (!line) {
      return;
    }
    if (s.commander.length >= 2) {
      toast('Deux commandants au maximum (partenaires).', {error: true});
      return;
    }
    this.remove(name, s.main.includes(line) ? 'main' : 'side');
    s.commander.push({count: 1, card: line.card});
    this.changed();
    this.search.search(true);
  }

  unsetCommander(name) {
    const s = this.deck.sections;
    const i = s.commander.findIndex(l => l.card.name === name);
    if (i >= 0) {
      const [line] = s.commander.splice(i, 1);
      this.add(line.card, 'main');
      this.search.search(true);
    }
  }

  changed() {
    this.dirty = true;
    this.renderDeck();
    this.search && this.search.refreshCounts();
    this.validate();
    this.analyze();
  }

  analyze = debounce(async () => {
    const deck = this.deck;
    try {
      const a = await bridge.request('analyzeDeck', {deck});
      if (deck !== this.deck) {
        return;
      }
      this.analysis = a;
    } catch (e) {
      this.analysis = null;
    }
    const slot = this.root.querySelector('.analysis-slot');
    if (slot) {
      slot.innerHTML = summaryLineHtml(this.analysis);
    }
  }, 400);

  validate = debounce(async () => {
    try {
      const r = await bridge.request('validateDeck', {deck: this.deck});
      this.problems = r.problems;
    } catch (e) {
      this.problems = [e.message];
    }
    const box = this.root.querySelector('.problems');
    if (box) {
      box.classList.toggle('ok', !this.problems.length);
      box.textContent = this.problems.length ? this.problems.map(translateProblem).join('\n') : '✓ Deck valide pour ce format.';
    }
  }, 300);

  renderDeck() {
    const right = this.root.querySelector('.right');
    const d = this.deck;
    const s = d.sections;
    const total = [...s.commander, ...s.main].reduce((a, l) => a + l.count, 0);
    const target = d.format === 'commander' ? 100 : 60;
    const curve = Array(8).fill(0);
    let lands = 0;
    for (const l of s.main) {
      if (l.card.land) {
        lands += l.count;
      } else {
        curve[Math.min(7, Math.floor(l.card.cmc || 0))] += l.count;
      }
    }
    const maxBar = Math.max(1, ...curve);
    const groups = GROUPS.map(([label, test]) => [label, []]);
    for (const l of [...s.main].sort((a, b) => (a.card.cmc - b.card.cmc) || a.card.nameFr.localeCompare(b.card.nameFr))) {
      const gi = GROUPS.findIndex(([, test]) => test(l.card));
      groups[gi][1].push(l);
    }
    const row = (l, section) => `<div class="deck-row" data-name="${esc(l.card.name)}" data-section="${section}">
      <span class="qty">${l.count}</span><span class="nm" title="${esc(l.card.name)}">${esc(l.card.nameFr)}</span>${manaHtml(l.card.cost)}
      <span class="acts">${section === 'main' && d.format === 'commander' && l.card.canBeCommander ? '<button data-act="cmd" title="Définir comme commandant">♛</button>' : ''}
      <button data-act="minus" title="Retirer">−</button><button data-act="plus" title="Ajouter">+</button></span></div>`;
    right.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <button class="btn small ghost" data-act="back">← Decks</button>
        <input type="text" class="deck-name" placeholder="Nom du deck" value="${esc(d.name)}" style="flex:1;min-width:0">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn small gold" data-act="save">Enregistrer</button>
        <button class="btn small" data-act="play">Jouer</button>
        ${d.format === 'commander' ? '<button class="btn small" data-act="edhrec" title="Cartes et combos conseillés par EDHREC pour ce commandant">EDHREC</button>' : ''}
        <button class="btn small" data-act="analysis">Analyse</button>
        ${d.previousName ? '<button class="btn small" data-act="stats">Stats</button>' : ''}
        <button class="btn small" data-act="export">Exporter</button>
        <button class="btn small" data-act="import">Importer</button>
        ${d.previousName ? '<button class="btn small danger" data-act="delete">Supprimer</button>' : ''}
      </div>
      <div class="muted small">${d.format === 'commander' ? 'Commander' : 'Construit'} · <b style="color:var(--text)">${total}</b> / ${target} cartes · ${lands} terrains · identité ${identityHtml(this.identity())}</div>
      <div class="analysis-slot">${summaryLineHtml(this.analysis)}</div>
      <div class="problems ok">Vérification…</div>
      ${d.format === 'commander' ? `<div class="deck-section"><h4>Commandant</h4>
        <div class="commander-slot">${s.commander.length ? '' : '<span class="muted small">Ajoute une créature légendaire, puis touche ♛ pour en faire le commandant.</span>'}</div></div>` : ''}
      <div class="deck-section"><h4>Courbe de mana <span>${s.main.length ? '' : ''}</span></h4>
        <div class="curve">${curve.map((n, i) => `<div class="bar" style="height:${Math.round(n / maxBar * 100)}%"><i>${n || ''}</i><span>${i === 7 ? '7+' : i}</span></div>`).join('')}</div>
      </div>
      <div style="height:16px"></div>
      ${groups.filter(([, list]) => list.length).map(([label, list]) => `<div class="deck-section"><h4>${label}<span>${list.reduce((a, l) => a + l.count, 0)}</span></h4>${list.map(l => row(l, 'main')).join('')}</div>`).join('')}
      ${s.side.length ? `<div class="deck-section"><h4>Réserve<span>${s.side.reduce((a, l) => a + l.count, 0)}</span></h4>${s.side.map(l => row(l, 'side')).join('')}</div>` : ''}
      ${s.main.length ? '' : '<p class="muted">Le deck est vide : ajoute des cartes avec le bouton + de la recherche.</p>'}`;
    const slot = right.querySelector('.commander-slot');
    if (slot) {
      for (const l of s.commander) {
        const wrap = el(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px" data-cmd="${esc(l.card.name)}"></div>`);
        const c = cardElement(l.card);
        c._card = l.card;
        wrap.appendChild(c);
        wrap.appendChild(el('<button class="btn small ghost" data-act="uncmd">Retirer</button>'));
        slot.appendChild(wrap);
      }
    }
    right.querySelector('.deck-name').addEventListener('input', (e) => {
      d.name = e.target.value;
      this.dirty = true;
    });
    const consumed = onLongPress(right, '.deck-row, .mcard', (node) => {
      const card = node._card || this.lineCard(node.dataset.name);
      card && showZoom(card);
    });
    right.onclick = async (e) => {
      if (consumed()) {
        return;
      }
      const act = e.target.closest('[data-act]');
      const rowEl = e.target.closest('.deck-row');
      if (act) {
        const a = act.dataset.act;
        if (a === 'plus') {
          this.add(this.lineCard(rowEl.dataset.name), rowEl.dataset.section);
        } else if (a === 'minus') {
          this.remove(rowEl.dataset.name, rowEl.dataset.section);
        } else if (a === 'cmd') {
          this.setCommander(rowEl.dataset.name);
        } else if (a === 'uncmd') {
          this.unsetCommander(act.closest('[data-cmd]').dataset.cmd);
        } else if (a === 'save') {
          await this.save();
        } else if (a === 'play') {
          if (await this.save()) {
            this.onPlay(this.deck.format + ':' + this.deck.name);
          }
        } else if (a === 'analysis') {
          if (this.analysis) {
            openAnalysis(this.deck, this.analysis);
          } else {
            toast('Analyse en cours, réessaie dans un instant.');
          }
        } else if (a === 'edhrec') {
          if (!s.commander.length) {
            toast('Choisis d\'abord le commandant (♛) : EDHREC donne les cartes jouées avec lui.', {error: true});
          } else {
            openEdhrec(s.commander.map(l => l.card), {add: (card) => this.add(card), count: (name) => this.count(name)});
          }
        } else if (a === 'stats') {
          openDeckStats(d.format + ':' + d.previousName, d.previousName);
        } else if (a === 'export') {
          this.exportDialog();
        } else if (a === 'import') {
          this.importDialog();
        } else if (a === 'delete') {
          if (await confirmBox('Supprimer le deck ?', `« ${d.previousName} » sera supprimé.`, {yes: 'Supprimer', danger: true})) {
            await bridge.request('deleteDeck', {name: d.format + ':' + d.previousName});
            toast('Deck supprimé.');
            this.onChanged();
            this.list();
          }
        } else if (a === 'back') {
          if (!this.dirty || await confirmBox('Quitter sans enregistrer ?', 'Les modifications seront perdues.', {yes: 'Quitter'})) {
            this.list();
          }
        }
        return;
      }
      if (rowEl) {
        const card = this.lineCard(rowEl.dataset.name);
        card && showZoom(card);
      }
    };
    this.validate();
  }

  lineCard(name) {
    const s = this.deck.sections;
    const line = [...s.commander, ...s.main, ...s.side].find(l => l.card.name === name);
    return line && line.card;
  }

  async save() {
    const d = this.deck;
    if (!d.name.trim()) {
      toast('Donne un nom au deck.', {error: true});
      this.root.querySelector('.deck-name').focus();
      return false;
    }
    d.name = d.name.trim().replace(/[\\/:*?"<>|]/g, '-');
    try {
      await bridge.request('saveDeck', {deck: d});
      d.previousName = d.name;
      this.dirty = false;
      toast(`« ${d.name} » enregistré.`);
      this.onChanged();
      this.renderDeck();
      return true;
    } catch (e) {
      toast(e.message, {error: true});
      return false;
    }
  }

  exportDialog() {
    const text = deckText(this.deck);
    customBox('Exporter le deck', (body, footer, close) => {
      const area = el('<textarea rows="16" readonly></textarea>');
      area.value = text;
      body.appendChild(el('<p class="muted small">Format texte compatible Moxfield, Archidekt et Arena (Importer &gt; coller).</p>'));
      body.appendChild(area);
      const copy = el('<button class="btn gold">Copier</button>');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast('Liste copiée.');
        } catch (e) {
          area.select();
          document.execCommand('copy');
          toast('Liste copiée.');
        }
      });
      const done = el('<button class="btn">Fermer</button>');
      done.addEventListener('click', close);
      footer.append(done, copy);
    });
  }

  importDialog() {
    customBox('Importer un deck', (body, footer, close) => {
      body.innerHTML = `<div class="field"><span>Lien Moxfield</span>
          <div style="display:flex;gap:6px"><input type="text" class="url" placeholder="https://www.moxfield.com/decks/..." style="flex:1"><button class="btn" data-mox>Récupérer</button></div>
          <div class="muted small">Le deck doit être public. Si Moxfield refuse, utilise l'import texte : Moxfield &gt; Exporter &gt; Copier en texte.</div></div>
        <div class="field"><span>Ou colle une liste</span>
          <textarea rows="12" class="txt" placeholder="Commander&#10;1 Atraxa, Praetors' Voice&#10;&#10;Deck&#10;1 Sol Ring&#10;1 Anneau solaire…"></textarea></div>
        <div class="status muted small"></div>`;
      const status = body.querySelector('.status');
      const finish = (result) => {
        const deck = result.deck;
        if (result.unknown && result.unknown.length) {
          toast(`${result.unknown.length} ligne(s) non reconnue(s) :\n${result.unknown.slice(0, 8).join('\n')}`, {title: 'Import partiel', error: true, duration: 9000});
        }
        close();
        this.edit(deck);
        this.dirty = true;
      };
      body.querySelector('[data-mox]').addEventListener('click', async () => {
        status.textContent = 'Connexion à Moxfield…';
        try {
          finish(await bridge.request('fetchMoxfield', {url: body.querySelector('.url').value}));
        } catch (e) {
          status.textContent = e.message;
        }
      });
      const go = el('<button class="btn gold">Importer la liste</button>');
      go.addEventListener('click', async () => {
        const text = body.querySelector('.txt').value;
        if (!text.trim()) {
          status.textContent = 'Colle d\'abord une liste.';
          return;
        }
        status.textContent = 'Lecture…';
        try {
          finish(await bridge.request('parseDeck', {text}));
        } catch (e) {
          status.textContent = e.message;
        }
      });
      const cancel = el('<button class="btn">Annuler</button>');
      cancel.addEventListener('click', close);
      footer.append(cancel, go);
    });
  }
}
