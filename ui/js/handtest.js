// Test de main de départ (éditeur de deck) : 7 cartes au hasard de la bibliothèque, mulligan selon la règle de Londres
// (on repioche 7 cartes, puis on en met autant sous la bibliothèque que de mulligans), les pioches des tours suivants, et
// les chances d'avoir peu ou beaucoup de terrains en main de départ (loi hypergéométrique).

import {cardElement, onLongPress, showZoom} from './cards.js';
import {customBox} from './dialogs.js';
import {icon} from './icons.js';
import {toast} from './util.js';

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** C(n, k) en flottant (assez précis pour des paquets de 100 cartes). */
function choose(n, k) {
  if (k < 0 || k > n) {
    return 0;
  }
  let r = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) {
    r = r * (n - Math.min(k, n - k) + i) / i;
  }
  return r;
}

/** Probabilité d'avoir exactement k terrains parmi `draw` cartes d'un paquet de n cartes dont `lands` terrains. */
export function landOdds(n, lands, draw, k) {
  return choose(lands, k) * choose(n - lands, draw - k) / choose(n, draw);
}

const pct = (x) => `${Math.round(x * 100)}\u00a0%`;

/** Ouvre le testeur pour ce deck (sections de l'éditeur : main, commandant). */
export function openHandTest(deck) {
  const lib = [];
  for (const l of deck.sections.main) {
    for (let i = 0; i < l.count; i++) {
      lib.push(l.card);
    }
  }
  if (lib.length < 8) {
    toast('Ajoute d\'abord des cartes : il en faut au moins 8 pour tester une main.', {error: true});
    return;
  }
  const n = lib.length;
  const lands = lib.filter(c => c.land).length;
  const odds = Array.from({length: 8}, (_, k) => landOdds(n, lands, 7, k));
  const good = odds.slice(2, 5).reduce((a, b) => a + b, 0);
  const st = {order: [], hand: [], next: 7, mulligans: 0, kept: true, bottom: new Set(), turn: 0, hands: 0, keptLands: []};

  const deal = (mulligan) => {
    st.mulligans = mulligan ? st.mulligans + 1 : 0;
    st.order = shuffle(lib.slice());
    st.hand = st.order.slice(0, 7).map((card, i) => ({card, i}));
    st.next = 7;
    st.bottom = new Set();
    st.kept = st.mulligans === 0;
    st.turn = 0;
    st.hands++;
  };

  customBox('Tester la main de départ', (body, footer, close) => {
    const render = () => {
      const handLands = st.hand.filter(h => !st.bottom.has(h.i) && h.card.land).length;
      const toBottom = st.kept ? 0 : st.mulligans;
      const msg = !st.kept
        ? `Mulligan ${st.mulligans} : touche ${toBottom === 1 ? 'la carte' : `les ${toBottom} cartes`} à mettre sous la bibliothèque (${st.bottom.size}/${toBottom}).`
        : st.turn ? `Tour ${st.turn + 1} : ${st.hand.length} cartes en main, dont ${handLands} terrain${handLands > 1 ? 's' : ''}.`
          : `Main de ${st.hand.length} cartes : ${handLands} terrain${handLands > 1 ? 's' : ''}, ${st.hand.length - handLands} sort${st.hand.length - handLands > 1 ? 's' : ''}${st.mulligans ? ` (après ${st.mulligans} mulligan${st.mulligans > 1 ? 's' : ''})` : ''}.`;
      body.innerHTML = `<div class="ht">
        <div class="ht-odds panel">
          <div class="small"><b>${n}</b> cartes dans la bibliothèque, dont <b>${lands}</b> terrains (${pct(lands / n)}).
            Main de 7 cartes avec 2 à 4 terrains : <b>${pct(good)}</b> · 0 ou 1 : ${pct(odds[0] + odds[1])} · 5 ou plus : ${pct(odds[5] + odds[6] + odds[7])}.</div>
          <div class="ht-bars">${odds.map((p, k) => `<div class="ht-bar${k >= 2 && k <= 4 ? ' good' : ''}" title="${k} terrain(s) : ${pct(p)}"><i style="height:${Math.max(2, Math.round(p * 100 / Math.max(...odds)))}%"></i><span>${k}</span></div>`).join('')}</div>
        </div>
        <p class="ht-msg">${msg}</p>
        <div class="ht-hand"></div>
        <p class="muted small">Appui long sur une carte pour la voir en grand. Règle de Londres : chaque mulligan, on repioche 7 cartes puis on en
          remet une de plus sous la bibliothèque${deck.format === 'commander' ? ' (en multijoueur, le premier mulligan est gratuit)' : ''}.</p>
      </div>`;
      const handBox = body.querySelector('.ht-hand');
      for (const h of st.hand) {
        const node = cardElement(h.card, st.bottom.has(h.i) ? 'ht-under' : '');
        node._card = h.card;
        node.dataset.i = h.i;
        if (h.drawn) {
          node.classList.add('ht-new');
        }
        handBox.appendChild(node);
      }
      footer.innerHTML = `
        <button class="btn" data-ht="new">${icon('cards')} Nouvelle main</button>
        <button class="btn" data-ht="mull"${st.mulligans >= 6 || st.turn ? ' disabled' : ''}>Mulligan</button>
        ${st.kept ? `<button class="btn" data-ht="draw"${st.next >= st.order.length ? ' disabled' : ''}>Piocher (tour ${st.turn + 2})</button>`
          : `<button class="btn gold" data-ht="keep"${st.bottom.size === toBottom ? '' : ' disabled'}>Garder</button>`}
        <button class="btn ghost" data-ht="close">Fermer</button>`;
    };
    const consumed = onLongPress(body, '.mcard', (node) => node._card && showZoom(node._card));
    body.addEventListener('click', (e) => {
      const node = e.target.closest('.ht-hand .mcard');
      if (!node || consumed()) {
        return;
      }
      if (st.kept) {
        showZoom(node._card);
        return;
      }
      const i = Number(node.dataset.i);
      if (st.bottom.has(i)) {
        st.bottom.delete(i);
      } else if (st.bottom.size < st.mulligans) {
        st.bottom.add(i);
      }
      render();
    });
    footer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ht]');
      if (!b || b.disabled) {
        return;
      }
      const a = b.dataset.ht;
      if (a === 'close') {
        close();
        return;
      }
      if (a === 'new') {
        deal(false);
      } else if (a === 'mull') {
        deal(true);
      } else if (a === 'keep') {
        // Les cartes choisies passent sous la bibliothèque, dans l'ordre.
        const under = st.hand.filter(h => st.bottom.has(h.i)).map(h => h.card);
        st.hand = st.hand.filter(h => !st.bottom.has(h.i));
        st.order = [...st.hand.map(h => h.card), ...st.order.slice(st.next), ...under];
        st.next = st.hand.length;
        st.bottom = new Set();
        st.kept = true;
      } else if (a === 'draw') {
        st.hand.forEach(h => {
          h.drawn = false;
        });
        st.hand.push({card: st.order[st.next], i: 100 + st.next, drawn: true});
        st.next++;
        st.turn++;
      }
      render();
    });
    deal(false);
    render();
  });
}
