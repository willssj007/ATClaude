// Compte : pseudo et avatar, et synchronisation des decks, trophées, statistiques, réglages et de la partie en cours
// entre appareils, par un Gist secret sur le compte GitHub du joueur.

import {bridge} from './bridge.js';
import {customBox} from './dialogs.js';
import {icon} from './icons.js';
import {AVATAR_COLORS, avatarHtml, el, esc, prefs, setOwnPhoto, toast} from './util.js';

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
  setOwnPhoto(p && p.photo);
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

/**
 * Photo de profil : choisie dans la galerie (ou un fichier sur ordinateur), recadrée en carré
 * dans un cercle qu'on peut déplacer et agrandir, puis réduite à 256 px (JPEG, quelques dizaines de Ko).
 * À appeler pendant le toucher (le sélecteur de fichiers ne s'ouvre que sur un geste).
 */
export function pickPhoto() {
  return new Promise((resolve) => {
    const input = el('<input type="file" accept="image/*" style="display:none">');
    document.body.appendChild(input);
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const src = downscale(img, 1024);
        URL.revokeObjectURL(url);
        cropDialog(src, resolve);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast('Cette image ne peut pas être lue.', {error: true});
        resolve(null);
      };
      img.src = url;
    });
    input.click();
  });
}

/** Copie réduite (petit côté à {@code max} px au plus) : le recadrage reste fluide avec les photos de 12 Mpx. */
function downscale(img, max) {
  const k = Math.min(1, max / Math.min(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function cropDialog(src, done) {
  const OUT = 256;
  let answered = false;
  const answer = (value) => {
    if (!answered) {
      answered = true;
      done(value);
    }
  };
  const box = customBox('Recadrer la photo', (body, footer, close) => {
    body.innerHTML = `<div class="crop">
      <div class="crop-view"><canvas width="${OUT}" height="${OUT}"></canvas></div>
      <div class="crop-side">
        <label class="crop-zoom"><span class="muted small">Zoom</span><input type="range" min="100" max="400" value="100"></label>
        <p class="muted small">Glisse la photo pour la placer dans le cercle.</p>
      </div>
    </div>`;
    const canvas = body.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const view = body.querySelector('.crop-view');
    const zoom = body.querySelector('input');
    // Échelle de départ : le petit côté de la photo remplit le cercle ; (cx, cy) : centre du cadrage dans la photo.
    const base = OUT / Math.min(src.width, src.height);
    let scale = base;
    let cx = src.width / 2;
    let cy = src.height / 2;
    const draw = () => {
      const half = OUT / 2 / scale;
      cx = Math.min(Math.max(cx, half), src.width - half);
      cy = Math.min(Math.max(cy, half), src.height - half);
      ctx.fillStyle = '#0b0d17';
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(src, OUT / 2 - cx * scale, OUT / 2 - cy * scale, src.width * scale, src.height * scale);
    };
    draw();
    zoom.addEventListener('input', () => {
      scale = base * Number(zoom.value) / 100;
      draw();
    });
    let drag = null;
    view.addEventListener('pointerdown', (e) => {
      drag = {id: e.pointerId, x: e.clientX, y: e.clientY, cx, cy};
      view.setPointerCapture(e.pointerId);
    });
    view.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) {
        return;
      }
      const k = OUT / view.clientWidth / scale;
      cx = drag.cx - (e.clientX - drag.x) * k;
      cy = drag.cy - (e.clientY - drag.y) * k;
      draw();
    });
    const end = () => {
      drag = null;
    };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom.value = String(Math.min(400, Math.max(100, Number(zoom.value) - e.deltaY * 0.25)));
      zoom.dispatchEvent(new Event('input'));
    }, {passive: false});
    const cancel = el('<button class="btn">Annuler</button>');
    const ok = el('<button class="btn gold">Utiliser cette photo</button>');
    cancel.addEventListener('click', () => {
      close();
      answer(null);
    });
    ok.addEventListener('click', () => {
      const data = canvas.toDataURL('image/jpeg', 0.86);
      close();
      answer(data);
    });
    footer.append(cancel, ok);
  }, {narrow: true});
  // Fermée en touchant à côté : pas de photo.
  box.back.addEventListener('click', (e) => e.target === box.back && answer(null));
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
    if (r.statsChange > 0) {
      bits.push(`${r.statsChange} partie(s) ajoutée(s) aux statistiques`);
    } else if (r.statsChange < 0) {
      bits.push('statistiques effacées sur un autre appareil');
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
        <div class="acc-avatar">${avatarHtml(p.name, p.avatar, 72, p.photo)}</div>
        <div class="acc-main">
          <label class="muted small">Pseudo (ton nom en partie)</label>
          <div class="acc-name"><input type="text" maxlength="24" value="${esc(p.name)}" class="acc-name-input"><button class="btn small" data-save-name>Enregistrer</button></div>
          <div class="acc-photo">
            <button class="btn small" data-photo>${icon('portrait')}${p.photo ? 'Changer la photo' : 'Photo depuis la galerie'}</button>
            ${p.photo ? '<button class="btn small ghost" data-photo-remove>Retirer la photo</button>' : ''}
          </div>
          <div class="acc-colors" title="Couleur de la pastille quand il n'y a pas de photo">${AVATAR_COLORS.map((c, i) => `<button class="acc-color${i === p.avatar ? ' on' : ''}" data-avatar="${i}" style="background:${c}" title="Couleur ${i + 1}"></button>`).join('')}</div>
          <div class="muted small">${since ? `Compte créé le ${since} · ` : ''}${p.decks} deck(s)${trophies ? ` · ${trophies.earned} trophée(s)` : ''}</div>
        </div>
      </div>

      <h2>Un seul compte sur tous tes appareils</h2>
      ${p.linked ? `<div class="panel acc-sync">
          <p>Relié au compte GitHub <b>${esc(p.login || '?')}</b>. Tes decks, tes trophées, tes statistiques, tes réglages et la partie en cours sont partagés avec tes autres appareils reliés au même compte.</p>
          <p class="muted small">Dernière synchronisation : ${esc(last)}. Elle se fait aussi toute seule au démarrage et à la fin de chaque partie.</p>
          <div class="acc-actions"><button class="btn gold" data-sync>⟳ Synchroniser maintenant</button><button class="btn" data-unlink>Délier</button></div>
        </div>` : `<div class="panel acc-sync">
          <p>Arcane Table n'a pas de serveur : pour retrouver tes decks et tes trophées sur ton téléphone et sur ton ordinateur, l'application les range dans un <b>Gist secret</b> de ton compte GitHub (non listé : seul quelqu'un qui connaît son adresse peut le lire ; il ne contient ni le jeton ni mot de passe).</p>
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
      } else if (b.hasAttribute('data-photo')) {
        const photo = await pickPhoto();
        if (photo) {
          try {
            setProfile(await bridge.request('updateProfile', {profile: {photo}}));
            toast('Photo de profil enregistrée.');
          } catch (err) {
            toast(err.message, {error: true});
          }
          this.show();
        }
      } else if (b.hasAttribute('data-photo-remove')) {
        setProfile(await bridge.request('updateProfile', {profile: {photo: ''}}));
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
