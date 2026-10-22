// Compte : pseudo et avatar, et synchronisation des decks, trophées, réglages et de la partie en cours
// entre appareils, par un Gist privé sur le compte GitHub du joueur.

import {bridge} from './bridge.js';
import {customBox} from './dialogs.js';
import {AVATAR_COLORS, avatarHtml, el, esc, prefs, toast} from './util.js';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Arcane%20Table';
let profile = null;
const listeners = [];

export function onProfile(fn) {
  listeners.push(fn);
  if (profile) {
    fn(profile);
  }
}

function setProfile(p) {
  profile = p;
  listeners.forEach(fn => fn(p));
}

export function currentProfile() {
  return profile;
}

export async function loadProfile() {
  try {
    setProfile(await bridge.request('profile'));
  } catch (e) {
    // Forge pas encore prêt
  }
  return profile;
}

/** Synchronise avec GitHub ; silencieux en cas d'échec si auto (démarrage, fin de partie). */
export async function syncNow({auto = false, onDone} = {}) {
  if (!profile || !profile.linked) {
    return null;
  }
  const {values, at} = prefs.synced();
  try {
    const r = await bridge.request('sync', {prefs: values, prefsAt: at});
    if (r.prefs && r.prefsAt > at) {
      prefs.applySynced(r.prefs, r.prefsAt);
    }
    setProfile(r.profile);
    const bits = [];
    if (r.decksAdded) {
      bits.push(`${r.decksAdded} deck(s) mis à jour`);
    }
    if (r.decksRemoved) {
      bits.push(`${r.decksRemoved} supprimé(s)`);
    }
    if (r.saveImported) {
      bits.push('partie en cours récupérée');
    }
    if (!auto || bits.length) {
      toast(bits.length ? bits.join(', ') + '.' : 'Tout est à jour.', {title: 'Compte synchronisé'});
    }
    if (onDone) {
      onDone(r);
    }
    return r;
  } catch (e) {
    if (!auto) {
      toast(e.message, {title: 'Synchronisation impossible', error: true, duration: 7000});
    }
    return null;
  }
}

export class AccountScreen {
  constructor(root, {onSynced}) {
    this.root = root;
    this.onSynced = onSynced;
  }

  async show() {
    const p = await loadProfile();
    if (!p) {
      this.root.innerHTML = '<div class="page"><h1>Mon compte</h1><p class="muted">Forge est encore en chargement.</p></div>';
      return;
    }
    const trophies = await bridge.request('trophies').catch(() => null);
    const since = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : '';
    const last = p.lastSync ? new Date(p.lastSync).toLocaleString('fr-FR') : 'jamais';
    this.root.innerHTML = `<div class="page account">
      <h1>Mon compte</h1>
      <div class="acc-card panel">
        <div class="acc-avatar">${avatarHtml(p.name, p.avatar, 72)}</div>
        <div class="acc-main">
          <label class="muted small">Pseudo (ton nom en partie)</label>
          <div class="acc-name"><input type="text" maxlength="24" value="${esc(p.name)}" class="acc-name-input"><button class="btn small" data-save-name>Enregistrer</button></div>
          <div class="acc-colors">${AVATAR_COLORS.map((c, i) => `<button class="acc-color${i === p.avatar ? ' on' : ''}" data-avatar="${i}" style="background:${c}" title="Couleur ${i + 1}"></button>`).join('')}</div>
          <div class="muted small">${since ? `Compte créé le ${since} · ` : ''}${p.decks} deck(s)${trophies ? ` · ${trophies.earned} trophée(s)` : ''}</div>
        </div>
      </div>

      <h2>Un seul compte sur tous tes appareils</h2>
      ${p.linked ? `<div class="panel acc-sync">
          <p>Relié au compte GitHub <b>${esc(p.login || '?')}</b>. Tes decks, tes trophées, tes réglages et la partie en cours sont partagés avec tes autres appareils reliés au même compte.</p>
          <p class="muted small">Dernière synchronisation : ${esc(last)}. Elle se fait aussi toute seule au démarrage et à la fin de chaque partie.</p>
          <div class="acc-actions"><button class="btn gold" data-sync>⟳ Synchroniser maintenant</button><button class="btn" data-unlink>Délier</button></div>
        </div>` : `<div class="panel acc-sync">
          <p>Arcane Table n'a pas de serveur : pour retrouver tes decks et tes trophées sur ton téléphone et sur ton ordinateur, l'application les range dans un <b>Gist privé</b> de ton compte GitHub.</p>
          <ol class="small">
            <li>Crée un jeton GitHub avec seulement la case <b>gist</b> cochée : <a href="${TOKEN_URL}" data-ext>ouvrir la page GitHub</a>.</li>
            <li>Copie le jeton (il commence par <code>ghp_</code> ou <code>github_pat_</code>) et colle-le ici.</li>
            <li>Fais pareil sur chaque appareil, avec le même compte GitHub.</li>
          </ol>
          <div class="acc-name"><input type="password" class="acc-token" placeholder="Jeton GitHub" autocomplete="off"><button class="btn gold" data-link>Relier</button></div>
          <p class="muted small">Le jeton reste sur cet appareil et ne sert qu'à lire et écrire ce Gist.</p>
        </div>`}
    </div>`;
    this.root.onclick = async (e) => {
      const b = e.target.closest('button, a[data-ext]');
      if (!b) {
        return;
      }
      if (b.matches('a[data-ext]')) {
        e.preventDefault();
        bridge.openUrl(TOKEN_URL);
      } else if (b.hasAttribute('data-save-name')) {
        setProfile(await bridge.request('updateProfile', {profile: {name: this.root.querySelector('.acc-name-input').value}}));
        toast('Pseudo enregistré.');
        this.show();
      } else if (b.dataset.avatar !== undefined) {
        setProfile(await bridge.request('updateProfile', {profile: {avatar: Number(b.dataset.avatar)}}));
        this.show();
      } else if (b.hasAttribute('data-link')) {
        const token = this.root.querySelector('.acc-token').value;
        b.disabled = true;
        b.textContent = 'Vérification…';
        try {
          setProfile(await bridge.request('linkGithub', {token}));
          await syncNow({onDone: this.onSynced});
        } catch (err) {
          toast(err.message, {title: 'Jeton refusé', error: true, duration: 7000});
        }
        this.show();
      } else if (b.hasAttribute('data-sync')) {
        b.disabled = true;
        b.textContent = 'Synchronisation…';
        await syncNow({onDone: this.onSynced});
        this.show();
      } else if (b.hasAttribute('data-unlink')) {
        customBox('Délier GitHub ?', (body, footer, close) => {
          body.appendChild(el('<p>Tes decks restent sur cet appareil. Le Gist reste sur GitHub (tu peux le supprimer toi-même).</p>'));
          const no = el('<button class="btn">Annuler</button>');
          const yes = el('<button class="btn danger">Délier</button>');
          no.addEventListener('click', close);
          yes.addEventListener('click', async () => {
            close();
            setProfile(await bridge.request('unlinkGithub'));
            this.show();
          });
          footer.append(no, yes);
        }, {narrow: true});
      }
    };
  }
}
