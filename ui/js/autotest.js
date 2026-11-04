// Essai automatique (index.html?autotest=1, lancé par scripts/ios-sim-test.sh dans le simulateur iPhone) : une fois Forge
// prêt, fait le tour des menus, relie le compte au faux GitHub de l'essai (restauration d'un compte déjà synchronisé),
// puis lance une partie rapide et la joue seul quelques minutes (garder sa main, passer, valider les choix). Chaque
// étape, chaque message d'erreur et le nombre d'images chargées vont dans le journal de l'application.

import {bridge} from './bridge.js';

const t0 = Date.now();

function log(text) {
  const line = `[autotest +${Math.round((Date.now() - t0) / 1000)} s] ${text}`;
  const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.atclaudeLog;
  if (h) {
    h.postMessage(line);
  } else {
    console.log(line);
  }
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function until(test, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = test();
    if (v) {
      return v;
    }
    await wait(500);
  }
  return null;
}

/** Messages affichés (erreurs comprises), requêtes au pont en échec, erreurs signalées par le pont. */
function watchErrors() {
  const box = document.getElementById('toasts');
  const seen = new WeakSet();
  const report = (t) => {
    if (t.nodeType !== 1 || seen.has(t)) {
      return;
    }
    seen.add(t);
    log(`${t.classList.contains('error') ? 'MESSAGE D\'ERREUR' : 'message'} : ${t.textContent.replace(/\s+/g, ' ').trim().slice(0, 400)}`);
  };
  [...box.children].forEach(report);
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(report))).observe(box, {childList: true});
  const request = bridge.request.bind(bridge);
  bridge.request = (type, payload) => request(type, payload).catch((e) => {
    log(`requête « ${type} » en échec : ${String(e && e.message || e).slice(0, 400)}`);
    throw e;
  });
  bridge.on('error', m => log(`erreur du pont : ${String(m.message).slice(0, 400)}`));
}

/** Cartes affichées dans la zone et combien ont leur image. */
function images(scope) {
  const cards = [...document.querySelectorAll(`${scope} .mcard:not(.back)`)].filter(n => n.querySelector('img.art'));
  return `${cards.filter(n => n.classList.contains('has-img')).length}/${cards.length} images`;
}

async function menuTour() {
  for (const name of ['home', 'decks', 'cards', 'stats', 'trophies', 'settings', 'home']) {
    const b = document.querySelector(`#nav [data-screen="${name}"]`);
    if (!b || b.offsetParent === null) {
      continue;
    }
    const t = performance.now();
    b.click();
    await wait(5000);
    log(`écran ${name} : ${images('#screen-' + name)} au bout de 5 s (${Math.round(performance.now() - t)} ms)`);
  }
}

async function restoreAccount() {
  document.getElementById('profile-btn').click();
  const input = await until(() => document.querySelector('.acc-token, [data-sync]'), 15000);
  if (!input) {
    log('ÉCHEC : écran du compte introuvable');
    return;
  }
  if (input.matches('[data-sync]')) {
    input.click();
    log('compte déjà relié : synchronisation');
  } else {
    input.value = 'ghp_test';
    document.querySelector('[data-link]').click();
    log('jeton GitHub envoyé (faux GitHub de l\'essai)');
  }
  const done = await until(() => [...document.querySelectorAll('#toasts .toast')].find(t => /synchronisé|refusé|Erreur/i.test(t.textContent)), 90000);
  log(`compte : ${done ? done.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : 'pas de réponse en 90 s'}`);
  const decks = await bridge.request('listDecks', {}).catch(() => null);
  log(`decks après la restauration : ${decks && decks.decks ? decks.decks.length : '?'}`);
}

export async function runAutotest() {
  watchErrors();
  log(`Forge prêt, ${Math.round(performance.now() / 1000)} s après l'ouverture de la page`);
  try {
    await menuTour();
    await restoreAccount();
    log('partie rapide');
    document.querySelector('#nav [data-screen="lobby"]').click();
    if (!await until(() => document.querySelector('[data-start]'), 60000)) {
      log('ÉCHEC : salon introuvable');
      return;
    }
    await wait(1500);
    document.querySelector('[data-start]').click();
    if (!await until(() => document.querySelector('.table'), 5 * 60000)) {
      log('ÉCHEC : la table de jeu ne s\'affiche pas');
      return;
    }
    log('table affichée');
    let lastTurn = '';
    let lastPrompt = '';
    const end = Date.now() + 4 * 60000;
    while (Date.now() < end) {
      const turn = ((document.querySelector('.table') || {}).textContent || '').match(/Tour\s*(\d+)/);
      if (turn && turn[1] !== lastTurn) {
        lastTurn = turn[1];
        log(`tour ${lastTurn}, ${document.querySelectorAll('.table .mcard:not(.back)').length} cartes visibles, ${images('.table')}`);
      }
      const prompt = ((document.querySelector('.prompt') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      if (prompt && prompt !== lastPrompt) {
        lastPrompt = prompt;
        log(`invite : ${prompt.slice(0, 120)}`);
      }
      const gold = document.querySelector('#dialogs footer .btn.gold:not([disabled])');
      if (gold) {
        const title = ((document.querySelector('#dialogs .modal:last-child header') || {}).textContent || '').trim();
        log(`fenêtre « ${title.slice(0, 80)} » validée`);
        gold.click();
      } else {
        const ok = document.querySelector('.ok-btn:not(.hidden):not([disabled])');
        if (ok) {
          ok.click();
        } else {
          // Un choix de carte à faire (défausse, cible...) : la première proposée.
          const pick = document.querySelector('#dialogs .choice-grid .pick, #dialogs .choice-list button, .mcard.selectable');
          if (pick) {
            pick.click();
          }
        }
      }
      await wait(1500);
    }
    log(`fin de l'essai : tour ${lastTurn || '?'}`);
  } catch (e) {
    log('ÉCHEC : ' + (e && e.message || e));
  }
}
