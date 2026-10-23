// Analyse d'un deck (bracket officiel, puissance, rôles des cartes, courbe, couleurs) et
// recommandations EDHREC pour son commandant.

import {bridge} from './bridge.js';
import {cardElement, onLongPress, showZoom} from './cards.js';
import {customBox} from './dialogs.js';
import {esc, el, manaHtml, toast} from './util.js';
import {deckStatsHtml, loadGames} from './stats.js';

const COLOR_NAMES = {W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert'};

function num(n, digits = 1) {
  return Number(n || 0).toFixed(digits).replace('.', ',');
}

/** Pastille compacte : « B2 · 4,6 ». */
export function bracketBadgeHtml(summary) {
  if (!summary || !summary.bracket) {
    return '';
  }
  const b = summary.bracket;
  return `<span class="bk-badge" title="Bracket ${b.value} (${esc(b.name)}) · puissance ${num(summary.power.score)}/10">
    <b class="bk bk-${b.value}">B${b.value}${b.maybeCedh ? '+' : ''}</b><span>${num(summary.power.score)}</span></span>`;
}

/** Ligne de résumé sous l'en-tête de l'éditeur. */
export function summaryLineHtml(a) {
  if (!a) {
    return '<span class="muted small">Analyse…</span>';
  }
  const b = a.bracket;
  return `<button class="analysis-line" data-act="analysis">
    <b class="bk bk-${b.value}">Bracket ${b.value}</b>
    <span>${esc(b.name)}${b.maybeCedh ? ' · niveau cEDH' : ''}</span>
    <span class="pw">Puissance <b>${num(a.power.score)}</b>/10</span>
    <span class="muted small">Analyse ▸</span></button>`;
}

export function openAnalysis(deck, a) {
  customBox(`Analyse — ${deck.name || 'deck sans nom'}`, (body, footer, close) => {
    const b = a.bracket;
    const p = a.power;
    const curveMax = Math.max(1, ...a.curve);
    const list = (title, items, note = '') => items && items.length
      ? `<div class="an-list"><b>${esc(title)}</b> <span class="muted small">${esc(note)}</span><div class="small">${items.map(esc).join(', ')}</div></div>` : '';
    const combos = (title, pairs) => pairs && pairs.length
      ? `<div class="an-list"><b>${esc(title)}</b><div class="small">${pairs.map(c => esc(c.join(' + '))).join('<br>')}</div></div>` : '';
    const roleRow = (r) => {
      const scale = Math.max(r.max < 99 ? r.max + 4 : 0, r.count, r.min + 4, 8);
      const state = r.count < r.min ? 'low' : r.max < 99 && r.count > r.max ? 'high' : 'ok';
      const target = r.min === 0 && r.max >= 99 ? '' : r.max >= 99 ? `${r.min}+ conseillé` : `${r.min}–${r.max} conseillé`;
      return `<div class="role ${state}" data-role="${esc(r.key)}">
        <div class="role-head"><b>${esc(r.label)}</b><span class="role-n">${r.count}</span><span class="muted small">${target}</span>
          ${state === 'low' ? '<span class="role-flag">peu</span>' : state === 'high' ? '<span class="role-flag">beaucoup</span>' : ''}</div>
        <div class="role-meter">${r.min > 0 || r.max < 99 ? `<i class="zone" style="left:${(100 * r.min) / scale}%;width:${(100 * (Math.min(r.max, scale) - r.min)) / scale}%"></i>` : ''}<i class="val" style="width:${(100 * Math.min(r.count, scale)) / scale}%"></i></div>
        <div class="role-cards small muted hidden">${r.cards.length ? r.cards.map(esc).join(', ') : 'Aucune carte.'}</div>
      </div>`;
    };
    const colors = 'WUBRG'.split('').filter(c => a.colors.pips[c] || a.colors.sources[c]);
    body.innerHTML = `<div class="an">
      <div class="an-top">
        <div class="an-card panel bk-card bk-${b.value}">
          <span class="k-label">Bracket officiel</span>
          <b class="an-big">${b.value}${b.maybeCedh ? '<small> → 5 ?</small>' : ''}</b>
          <span>${esc(b.name)} <span class="muted">(${esc(b.nameFr)})</span></span>
          <ul class="an-reasons small">${b.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        </div>
        <div class="an-card panel">
          <span class="k-label">Puissance estimée</span>
          <b class="an-big">${num(p.score)}<small>/10</small></b>
          <span>${esc(p.label)}</span>
          <div class="pw-meter" role="img" aria-label="Puissance ${num(p.score)} sur 10"><i style="width:${p.score * 10}%"></i></div>
          <p class="muted small">Indépendante du bracket : vitesse (mana rapide, coût moyen), régularité (tuteurs, pioche), interaction et combos.</p>
        </div>
      </div>
      ${list('Game Changers', b.gameChangers, `${b.gameChangers.length} (3 au plus en bracket 3)`)}
      ${list('Destruction massive de terrains', b.massLandDenial)}
      ${list('Tours supplémentaires', b.extraTurns)}
      ${list('Tours supplémentaires enchaînables', b.chainedExtraTurns)}
      ${combos('Combos à deux cartes, possibles tôt', b.earlyCombos)}
      ${combos('Combos à deux cartes de fin de partie', b.lateCombos)}
      <h3>Ce qui fait la puissance</h3>
      <table class="st-table an-factors"><tbody>${p.factors.map(f => `<tr><td>${esc(f.label)}</td><td class="muted small">${esc(f.detail)}</td><td class="delta ${f.delta > 0 ? 'up' : f.delta < 0 ? 'down' : ''}">${f.delta > 0 ? '+' : ''}${num(f.delta)}</td></tr>`).join('')}
        <tr><td colspan="2"><b>Total</b> <span class="muted small">(base 3,8, entre 1 et 10)</span></td><td class="delta"><b>${num(p.score)}</b></td></tr></tbody></table>
      ${a.advice.length ? `<h3>Conseils</h3><ul class="an-advice">${a.advice.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <h3>Rôles des cartes <span class="muted small">(touche une ligne pour voir les cartes)</span></h3>
      <div class="roles">${a.roles.map(roleRow).join('')}</div>
      <h3>Courbe de mana <span class="muted small">coût moyen ${num(a.avgCmc, 2)} · ${a.counts.lands} terrains (≈ ${a.landsAdvised} conseillés)</span></h3>
      <div class="curve">${a.curve.map((n, i) => `<div class="bar" style="height:${Math.round((n / curveMax) * 100)}%" title="${n} carte(s) de valeur ${i === 7 ? '7 ou plus' : i}"><i>${n || ''}</i><span>${i === 7 ? '7+' : i}</span></div>`).join('')}</div>
      <h3>Couleurs</h3>
      <table class="st-table"><thead><tr><th>Couleur</th><th>Symboles de mana</th><th>Terrains qui la produisent</th></tr></thead><tbody>
        ${colors.map(c => `<tr><td>${manaHtml(`{${c}}`)} ${COLOR_NAMES[c]}</td><td>${a.colors.pips[c]}</td><td>${a.colors.sources[c]}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Incolore</td></tr>'}
      </tbody></table>
      <h3>Composition</h3>
      <div class="an-types small">${[['creature', 'Créatures'], ['instant', 'Éphémères'], ['sorcery', 'Rituels'], ['artifact', 'Artefacts'], ['enchantment', 'Enchantements'], ['planeswalker', 'Planeswalkers'], ['battle', 'Batailles'], ['land', 'Terrains']]
        .filter(([k]) => a.counts[k]).map(([k, l]) => `<span class="chip">${l} <b>${a.counts[k]}</b></span>`).join('')}</div>
      <p class="muted small" style="margin-top:14px">Bracket : critères officiels de Wizards of the Coast (Game Changers, destruction massive de terrains, tours supplémentaires, combos à deux cartes), avec les listes tenues à jour par Forge. Les rôles sont repérés d'après le texte des cartes et peuvent en oublier quelques-unes.</p>
    </div>`;
    body.addEventListener('click', (e) => {
      const role = e.target.closest('.role');
      if (role) {
        role.querySelector('.role-cards').classList.toggle('hidden');
      }
    });
    const done = el('<button class="btn gold">Fermer</button>');
    done.addEventListener('click', close);
    footer.append(done);
  }, {full: true});
}

export async function openDeckStats(key, name) {
  let games = [];
  try {
    games = await loadGames();
  } catch (e) {
    toast(e.message, {error: true});
    return;
  }
  customBox(`Statistiques — ${name}`, (body, footer, close) => {
    body.innerHTML = `<div class="stats-page">${deckStatsHtml(games, key)}</div>`;
    const done = el('<button class="btn gold">Fermer</button>');
    done.addEventListener('click', close);
    footer.append(done);
  }, {full: true});
}

/**
 * Recommandations EDHREC pour les commandants du deck. {@code add(card)} ajoute une carte au deck,
 * {@code count(name)} donne le nombre d'exemplaires déjà présents.
 */
export function openEdhrec(commanders, {add, count}) {
  customBox(`EDHREC — ${commanders.map(c => c.nameFr || c.name).join(' & ')}`, async (body, footer, close) => {
    body.innerHTML = '<p class="muted">Lecture d\'EDHREC…</p>';
    const done = el('<button class="btn gold">Fermer</button>');
    done.addEventListener('click', close);
    footer.append(done);
    let data;
    try {
      data = await bridge.request('edhrec', {commanders: commanders.map(c => c.name)});
    } catch (e) {
      body.innerHTML = `<p>${esc(e.message)}</p><p class="muted small">EDHREC recense les decks Commander publiés en ligne : les cartes les plus jouées avec chaque commandant, leur synergie et les combos connus. Il faut une connexion Internet.</p>`;
      return;
    }
    const site = el('<button class="btn">Ouvrir sur EDHREC</button>');
    site.addEventListener('click', () => bridge.openUrl(data.url));
    footer.prepend(site);
    let tab = 'synergy';
    let list = data.lists.length ? data.lists[0].tag : '';
    let hideOwned = true;
    const when = new Date(data.fetchedAt);
    const render = (keepScroll = false) => {
      const top = body.scrollTop;
      const lists = data.lists.find(l => l.tag === list);
      const cards = tab === 'synergy' ? data.synergy : tab === 'lists' && lists ? lists.cards : [];
      const shown = hideOwned ? cards.filter(c => !count(c.name)) : cards;
      body.innerHTML = `<div class="edh">
        <div class="edh-head small muted">${Number(data.decks || 0).toLocaleString('fr-FR')} decks recensés · données du ${when.toLocaleDateString('fr-FR')}${data.offline ? ' (hors connexion : dernière version gardée)' : ''}
          ${data.themes.length ? `<div class="edh-themes"><span class="edh-th">Thèmes :</span> ${data.themes.map(t => `<span class="chip">${esc(t.name)} <span class="muted">${Number(t.decks).toLocaleString('fr-FR')}</span></span>`).join('')}</div>` : ''}</div>
        <div class="edh-bar">
          <div class="seg" data-seg="tab">
            <button data-v="synergy" class="${tab === 'synergy' ? 'on' : ''}">Meilleures synergies</button>
            <button data-v="combos" class="${tab === 'combos' ? 'on' : ''}">Combos (${data.combos.length})</button>
            <button data-v="lists" class="${tab === 'lists' ? 'on' : ''}">Par catégorie</button>
          </div>
          ${tab !== 'combos' ? `<label class="check small"><input type="checkbox" data-hide ${hideOwned ? 'checked' : ''}> Masquer celles déjà dans le deck</label>` : ''}
        </div>
        ${tab === 'lists' ? `<div class="chips edh-lists">${data.lists.map(l => `<span class="chip ${l.tag === list ? 'on' : ''}" data-list="${esc(l.tag)}">${esc(l.title)}</span>`).join('')}</div>` : ''}
        ${tab === 'synergy' ? '<p class="muted small">Cartes jouées bien plus souvent avec ce commandant qu\'avec les autres decks de mêmes couleurs (synergie), et part des decks de ce commandant qui les jouent.</p>' : ''}
        ${tab === 'combos' ? combosHtml(data.combos, count) : `<div class="card-grid edh-grid">${shown.length ? '' : '<p class="muted">Toutes ces cartes sont déjà dans le deck.</p>'}</div>`}
      </div>`;
      const grid = body.querySelector('.edh-grid');
      if (grid) {
        for (const c of shown) {
          const cell = el('<div class="cell"></div>');
          cell._card = c;
          cell.appendChild(cardElement(c));
          cell.appendChild(el('<button class="add always" title="Ajouter au deck">+</button>'));
          cell.appendChild(el(`<div class="edh-stat small"><span title="Synergie">${c.synergy > 0 ? '+' : ''}${Math.round(c.synergy)} %</span><span class="muted" title="Part des decks de ce commandant">${Math.round(c.inclusion)} % des decks</span></div>`));
          const n = count(c.name);
          if (n) {
            cell.appendChild(el(`<div class="count">×${n}</div>`));
          }
          grid.appendChild(cell);
        }
      }
      if (keepScroll) {
        body.scrollTop = top;
      }
    };
    render();
    const consumed = onLongPress(body, '.cell, .combo-card', (node) => node._card && showZoom(node._card));
    body.addEventListener('click', (e) => {
      if (consumed()) {
        return;
      }
      const seg = e.target.closest('[data-seg] button');
      if (seg) {
        tab = seg.dataset.v;
        render();
        return;
      }
      const chip = e.target.closest('[data-list]');
      if (chip) {
        list = chip.dataset.list;
        render();
        return;
      }
      const cell = e.target.closest('.cell');
      if (cell && e.target.closest('.add')) {
        add(cell._card);
        toast(`${cell._card.nameFr} ajoutée.`);
        render(true);
        return;
      }
      if (cell) {
        showZoom(cell._card);
        return;
      }
      const missing = e.target.closest('[data-add-combo]');
      if (missing) {
        const combo = data.combos[Number(missing.dataset.addCombo)];
        const added = combo.cards.filter(c => !count(c.name));
        added.forEach(c => add(c));
        toast(added.length ? `Ajouté : ${added.map(c => c.nameFr).join(', ')}.` : 'Déjà complet.');
        render(true);
        return;
      }
      const cc = e.target.closest('.combo-card');
      if (cc && cc._card) {
        showZoom(cc._card);
      }
    });
    body.addEventListener('change', (e) => {
      if (e.target.matches('[data-hide]')) {
        hideOwned = e.target.checked;
        render();
      }
    });
    // Vignettes des combos : attachées après le rendu (elles portent leur carte pour le zoom).
    const observer = new MutationObserver(() => {
      body.querySelectorAll('.combo-card:not([data-ready])').forEach(node => {
        const combo = data.combos[Number(node.dataset.combo)];
        const card = combo && combo.cards[Number(node.dataset.i)];
        if (card) {
          node.dataset.ready = '1';
          node._card = card;
          node.appendChild(cardElement(card));
        }
      });
    });
    observer.observe(body, {childList: true, subtree: true});
  }, {full: true});
}

function combosHtml(combos, count) {
  if (!combos.length) {
    return '<p class="muted">EDHREC ne connaît pas de combo pour ce commandant.</p>';
  }
  return `<p class="muted small">Combos les plus joués avec ce commandant (d'après Commander Spellbook). Un combo à deux cartes compte pour le bracket.</p>
    <div class="combos">${combos.map((c, i) => {
      const missing = c.cards.filter(x => !count(x.name));
      return `<div class="combo panel">
        <div class="combo-cards">${c.cards.map((x, j) => `<div class="combo-card" data-combo="${i}" data-i="${j}"></div>`).join('')}</div>
        <div class="combo-body">
          <b>${c.cards.map(x => esc(x.nameFr)).join(' + ')}</b>
          <div class="small">${c.results.map(esc).join(' · ')}</div>
          <div class="muted small">${Number(c.decks).toLocaleString('fr-FR')} decks${c.bracket ? ` · bracket voté : ${esc(c.bracket === 'any' ? 'tous' : c.bracket)}` : ''}</div>
          <div class="combo-state small">${missing.length ? `Manque : ${missing.map(x => esc(x.nameFr)).join(', ')} <button class="btn small" data-add-combo="${i}">Ajouter ${missing.length > 1 ? 'les cartes manquantes' : 'la carte'}</button>` : '<span class="ok">✓ Toutes les cartes sont dans le deck</span>'}</div>
        </div>
      </div>`;
    }).join('')}</div>`;
}
