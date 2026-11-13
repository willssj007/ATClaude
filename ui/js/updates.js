// Mises à jour : au lancement (et depuis les réglages), la dernière version publiée est comparée à celle de l'appli.
// Android : l'APK se télécharge dans l'appli, puis l'installateur d'Android s'ouvre (il demande confirmation).
// Windows : le zip se télécharge, l'appli se ferme, se remplace et se relance. iPhone : un lien vers la page de la
// version (l'IPA se réinstalle avec l'outil qui l'a installé). Les données (decks, compte, cartes perso) restent.

import {bridge} from './bridge.js';
import {customBox} from './dialogs.js';
import {el, esc, prefs, toast} from './util.js';

const LAST = 'at.update.lastCheck';
const SKIP = 'at.update.skip';
/** « Plus tard » : la même version n'est pas reproposée avant six heures. */
const LATER = 'at.update.later';
const LATER_FOR = 6 * 3600 * 1000;
/** Une vérification à la fois, et pas de seconde fenêtre si la première est encore ouverte. */
let checking = false;
/**
 * À chaque ouverture de l'appli, et quand on y revient (un téléphone garde l'appli ouverte en arrière-plan, sans la
 * relancer) : au plus une vérification toutes les vingt minutes.
 */
const EVERY = 20 * 60 * 1000;

function store(key, value) {
  try {
    if (value === undefined) {
      return localStorage.getItem(key);
    }
    localStorage.setItem(key, value);
  } catch (e) {
    // mémoire du navigateur indisponible : on vérifiera de nouveau la prochaine fois
  }
  return null;
}

/** Les notes de version (titres, listes, gras) en HTML simple. */
export function notesHtml(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let list = false;
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (!list) {
        out.push('<ul>');
        list = true;
      }
      out.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    if (list) {
      out.push('</ul>');
      list = false;
    }
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
    } else if (line.trim()) {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (list) {
    out.push('</ul>');
  }
  return out.join('');
}

/**
 * Vérifie s'il y a une nouvelle version. auto : au lancement et au retour dans l'appli (selon le réglage, pas plus
 * d'une fois toutes les vingt minutes, et pas pour une version ignorée ou remise à plus tard). Sinon (bouton des
 * réglages), dit aussi quand l'appli est à jour.
 */
export async function checkUpdates({auto = false} = {}) {
  if (auto) {
    if (!prefs.get('autoUpdate') || checking || document.querySelector('.upd-notes, .modal-back')) {
      return;
    }
    const last = Number(store(LAST)) || 0;
    if (Date.now() - last < EVERY) {
      return;
    }
  }
  let info;
  checking = true;
  try {
    info = await bridge.request('updateCheck');
  } catch (e) {
    if (!auto) {
      toast(e.message, {title: 'Mises à jour', error: true});
    }
    return;
  } finally {
    checking = false;
  }
  store(LAST, String(Date.now()));
  if (!info.current) {
    if (!auto) {
      toast(`Version de développement : la dernière version publiée est la ${info.latest || '?'}.`, {title: 'Mises à jour'});
    }
    return;
  }
  if (!info.newer) {
    if (!auto) {
      toast(`Tu as la dernière version (${info.current}).`, {title: 'Mises à jour'});
    }
    return;
  }
  if (auto && store(SKIP) === info.latest) {
    return;
  }
  const later = String(store(LATER) || '').split('|');
  if (auto && later[0] === info.latest && Date.now() - (Number(later[1]) || 0) < LATER_FOR) {
    return;
  }
  showUpdate(info);
}

/** Quand on revient dans l'appli (téléphone en veille, autre appli), une vérification si la dernière date un peu. */
export function watchUpdates(canCheck) {
  const again = () => {
    if (document.visibilityState !== 'hidden' && canCheck()) {
      checkUpdates({auto: true});
    }
  };
  document.addEventListener('visibilitychange', again);
  // Android prévient aussi quand l'appli revient au premier plan.
  window.addEventListener('at-resume', again);
}

/** La fenêtre « Nouvelle version » : ses nouveautés, puis mettre à jour, plus tard ou ignorer cette version. */
function showUpdate(info) {
  const where = {android: 'Elle se télécharge ici, puis Android te demande de confirmer l\'installation.',
    windows: 'Elle se télécharge ici, puis Arcane Table se ferme, se met à jour et se relance tout seul.',
    ios: 'Sur iPhone et iPad, l\'appli ne peut pas se mettre à jour toute seule : télécharge le nouvel IPA et réinstalle-le avec l\'outil qui l\'a installé (AltStore, SideStore, Sideloadly…).',
    desktop: 'Version de développement : récupère la nouvelle version sur la page de téléchargement.'}[info.platform] || '';
  customBox(`Nouvelle version : ${info.latest}`, (body, footer, close) => {
    body.innerHTML = `<p>Tu as la <b>${esc(info.current)}</b>. ${esc(where)} Tes decks, ton compte et tes cartes perso sont gardés.</p>
      <div class="upd-bar hidden"><div class="upd-fill"></div><span class="upd-text muted small"></span></div>
      <details class="upd-notes" open><summary>Nouveautés</summary><div class="upd-md">${notesHtml(info.notes)}</div></details>`;
    const later = el('<button class="btn">Plus tard</button>');
    later.addEventListener('click', () => {
      store(LATER, `${info.latest}|${Date.now()}`);
      close();
    });
    const skip = el('<button class="btn ghost">Ignorer cette version</button>');
    skip.addEventListener('click', () => {
      store(SKIP, info.latest);
      close();
    });
    const go = el(`<button class="btn gold">${info.install ? 'Mettre à jour' : 'Ouvrir la page de téléchargement'}</button>`);
    go.addEventListener('click', async () => {
      if (!info.install) {
        bridge.openUrl(info.page || 'https://github.com/willssj007/atclaude/releases');
        close();
        return;
      }
      go.disabled = true;
      later.disabled = true;
      skip.disabled = true;
      await install(info, body, () => {
        go.disabled = false;
        later.disabled = false;
        skip.disabled = false;
      });
    });
    footer.append(skip, later, go);
  }, {narrow: true});
}

/** Télécharge la mise à jour (avec une barre), puis l'installe (Android : l'installateur ; Windows : relance). */
async function install(info, body, failed) {
  const bar = body.querySelector('.upd-bar');
  const fill = body.querySelector('.upd-fill');
  const text = body.querySelector('.upd-text');
  bar.classList.remove('hidden');
  const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1).replace('.', ',');
  const total0 = info.asset.size || 0;
  text.textContent = 'Téléchargement…';
  const off = bridge.on('updateProgress', (m) => {
    const total = m.total > 0 ? m.total : total0;
    fill.style.width = total ? Math.min(100, Math.round(100 * m.done / total)) + '%' : '30%';
    text.textContent = total ? `${mb(m.done)} Mo sur ${mb(total)} Mo` : `${mb(m.done)} Mo`;
  });
  try {
    const r = await bridge.request('updateDownload', {url: info.asset.url, name: info.asset.name});
    fill.style.width = '100%';
    if (info.platform === 'android') {
      const state = bridge.installUpdate(r.file);
      text.textContent = state === 'permission'
        ? 'Autorise l\'installation depuis Arcane Table dans les réglages qui s\'ouvrent, puis reviens : l\'installation continue.'
        : state === 'installing' ? 'Confirme l\'installation dans la fenêtre d\'Android.' : 'Le fichier téléchargé est introuvable : réessaie.';
      if (state === 'missing') {
        failed();
      }
    } else {
      text.textContent = 'Arcane Table va se fermer, se mettre à jour et se relancer…';
      await bridge.request('updateInstall', {file: r.file});
    }
  } catch (e) {
    text.textContent = e.message;
    toast(e.message, {title: 'Mise à jour', error: true});
    failed();
  } finally {
    if (typeof off === 'function') {
      off();
    }
  }
}

/**
 * Premier lancement après une mise à jour : la fenêtre « Quoi de neuf » (les notes de la version installée). Au tout
 * premier lancement de l'appli, rien : la version est seulement notée.
 */
export async function whatsNew(version) {
  const SEEN = 'at.update.seen';
  if (!version) {
    return;
  }
  const seen = store(SEEN);
  store(SEEN, version);
  if (!seen || seen === version) {
    return;
  }
  const r = await bridge.request('whatsNew').catch(() => null);
  if (!r || !r.notes) {
    return;
  }
  customBox(`Quoi de neuf dans la ${version}`, (body, footer, close) => {
    body.innerHTML = `<div class="upd-md">${notesHtml(r.notes)}</div>`;
    const ok = el('<button class="btn gold">Super !</button>');
    ok.addEventListener('click', close);
    footer.appendChild(ok);
  });
}
