// Essai automatique (index.html?autotest=1, lancé par scripts/ios-sim-test.sh dans le simulateur iPhone) : une fois Forge
// prêt, lance une partie rapide et la joue seul quelques minutes (garder sa main, passer, valider les choix), en notant
// chaque étape dans le journal de l'application.

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

export async function runAutotest() {
  log('Forge prêt, partie rapide');
  try {
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
    const end = Date.now() + 6 * 60000;
    while (Date.now() < end) {
      const turn = ((document.querySelector('.table') || {}).textContent || '').match(/Tour\s*(\d+)/);
      if (turn && turn[1] !== lastTurn) {
        lastTurn = turn[1];
        log(`tour ${lastTurn}, ${document.querySelectorAll('.table .mcard:not(.back)').length} cartes visibles`);
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
