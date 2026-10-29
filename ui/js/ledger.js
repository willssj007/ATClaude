// Registre de la carrière de Planeswalker : réglages directs du mana, des boosters, des jetons, de la série et
// des decks gagnés.

import {bridge} from './bridge.js';
import {boosterSets} from './boosters.js';
import {RARITY_FR, loadCareer, manaAmount, setCareer, wildcardHtml} from './career.js';
import {customBox} from './dialogs.js';
import {appearanceHtml, applyThemes, livePreviews} from './themes.js';
import {el, esc, prefs, toast} from './util.js';

const RARITIES = ['common', 'uncommon', 'rare', 'mythic'];

export async function openLedger() {
  let c;
  let sets = [];
  try {
    [c, sets] = await Promise.all([loadCareer(true), boosterSets().catch(() => [])]);
  } catch (e) {
    toast(e.message, {error: true});
    return;
  }
  if (!c.started) {
    toast('Commence d\'abord ta carrière (écran Duel).');
    return;
  }
  customBox('Registre du Planeswalker', (body, footer, close) => {
    const render = () => {
      const wc = c.wildcards || {};
      body.innerHTML = `<div class="ledger">
        <div class="lg-row"><b>Mana</b><span class="lg-now">${manaAmount(c.mana, 'chip')}</span>
          <input type="number" class="lg-n" data-for="mana" value="1000" min="1" step="100">
          <button class="btn small" data-op="mana" data-sign="1">Ajouter</button><button class="btn small" data-op="mana" data-sign="-1">Retirer</button></div>
        <div class="lg-row"><b>Boosters</b><span class="lg-now">${(c.boosters || []).length}</span>
          <select class="lg-set"><option value="">Extension au hasard</option>${sets.map(s => `<option value="${esc(s.code)}">${esc(s.name)} (${esc(s.code)})</option>`).join('')}</select>
          <input type="number" class="lg-n" data-for="boosters" value="1" min="1" max="100">
          <button class="btn small" data-op="boosters" data-sign="1">Ajouter</button></div>
        ${RARITIES.map(r => `<div class="lg-row"><b>Jetons ${esc(RARITY_FR[r])}s</b><span class="lg-now">${wildcardHtml(r, wc[r] || 0)}</span>
          <button class="btn small" data-op="wildcards" data-rarity="${r}" data-n="-1">−1</button>
          <button class="btn small" data-op="wildcards" data-rarity="${r}" data-n="1">+1</button>
          <button class="btn small" data-op="wildcards" data-rarity="${r}" data-n="10">+10</button></div>`).join('')}
        <div class="lg-row"><b>Série de victoires</b><span class="lg-now">${c.streak}</span>
          <input type="number" class="lg-n" data-for="streak" value="${c.streak}" min="0" max="999">
          <button class="btn small" data-op="streak">Fixer</button></div>
        <div class="lg-row"><b>Decks à choisir</b><span class="lg-now">${c.deckChoices || 0}</span>
          <button class="btn small" data-op="deckChoice" data-n="1">+1</button>
          <button class="btn small" data-op="deckChoice" data-n="-1">−1</button></div>
        <div class="lg-row"><b>Adversaires</b><span class="lg-now"></span>
          <button class="btn small" data-op="rerollOpponents">Tirer de nouveaux adversaires</button></div>
        <label class="lg-row check"><input type="checkbox" data-preview ${prefs.get('themePreview') === true ? 'checked' : ''}> <b>Toutes les apparences disponibles</b></label>
      </div>`;
    };
    render();
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-op]');
      if (!b) {
        return;
      }
      const op = b.dataset.op;
      const input = body.querySelector(`.lg-n[data-for="${op}"]`);
      const data = {op};
      if (op === 'mana' || op === 'boosters') {
        data.n = Math.max(1, Math.round(Number(input.value) || 0)) * Number(b.dataset.sign || 1);
      } else if (op === 'streak') {
        data.n = Math.max(0, Math.round(Number(input.value) || 0));
      } else if (b.dataset.n) {
        data.n = Number(b.dataset.n);
      }
      if (op === 'boosters') {
        data.set = body.querySelector('.lg-set').value;
      }
      if (op === 'wildcards') {
        data.rarity = b.dataset.rarity;
      }
      b.disabled = true;
      try {
        c = await bridge.request('careerAdjust', data);
        setCareer(c);
        render();
      } catch (err) {
        toast(err.message, {error: true});
        b.disabled = false;
      }
    });
    body.addEventListener('change', (e) => {
      if (e.target.matches('[data-preview]')) {
        prefs.set('themePreview', e.target.checked);
        applyThemes();
        const grid = document.querySelector('#screen-settings .appearance');
        grid && appearanceHtml().then((html) => {
          grid.innerHTML = html;
          livePreviews(grid);
        });
      }
    });
    const done = el('<button class="btn gold">Fermer</button>');
    done.addEventListener('click', close);
    footer.appendChild(done);
  }, {narrow: true});
}
