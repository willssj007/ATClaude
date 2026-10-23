// Contrôleur principal : chargement de Forge, navigation entre les écrans, cycle d'une partie.

import {AccountScreen, loadProfile, onProfile, syncNow} from './account.js';
import {initAudio, refreshAudio, setMusicMode} from './audio.js';
import {bridge} from './bridge.js';
import {hideZoom, reloadImages, showZoom} from './cards.js';
import {Decks} from './decks.js';
import {closeAllForgeDialogs, closeForgeDialog, confirmBox, handleForgeDialog} from './dialogs.js';
import {Game} from './game.js';
import {Lobby} from './lobby.js';
import {SearchPanel} from './search.js';
import {StatsScreen} from './stats.js';
import {announceTrophy, Trophies} from './trophies.js';
import {$, $$, avatarHtml, esc, prefs, toast} from './util.js';

const screens = {};
let current = 'home';
let game = null;
let inMatch = false;
let lastSetup = null;
let decksCache = null;
let ready = false;

function showScreen(name) {
  current = name;
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  document.body.classList.toggle('in-game', name === 'game');
  setMusicMode(name === 'game' ? 'match' : 'menus');
  $('#resume-game').classList.toggle('hidden', !inMatch || name === 'game');
  const screen = screens[name];
  if (screen && screen.show) {
    screen.show();
  }
}

async function getDecks(force = false) {
  if (!decksCache || force) {
    decksCache = await bridge.request('listDecks');
  }
  return decksCache;
}

// ------------------------------------------------------------------ parties

async function startMatch(setup) {
  const running = inMatch && !(game && game.state && game.state.game && game.state.game.gameOver);
  if (running && !(await confirmBox('Nouvelle partie ?', 'La partie en cours sera abandonnée.', {yes: 'Nouvelle partie', danger: true}))) {
    return;
  }
  lastSetup = setup;
  closeAllForgeDialogs();
  if (game) {
    game.destroy();
  }
  game = new Game($('#screen-game'), {onExit: leaveMatch, onRematch: () => startMatch(lastSetup), onMenu: () => showScreen('home')});
  inMatch = true;
  showScreen('game');
  try {
    await bridge.request('startMatch', {setup});
    bridge.send('settings', {settings: {holdPriority: prefs.get('holdPriority'), autoPass: prefs.get('autoPass')}});
  } catch (e) {
    inMatch = false;
    toast(e.message, {title: 'Impossible de lancer la partie', error: true, duration: 8000});
    showScreen('lobby');
  }
}

/** Reprend la partie sauvegardée (l'application avait été fermée en pleine partie). */
async function resumeSaved() {
  closeAllForgeDialogs();
  if (game) {
    game.destroy();
  }
  game = new Game($('#screen-game'), {onExit: leaveMatch, onRematch: () => startMatch(lastSetup || prefs.get('lastSetup')), onMenu: () => showScreen('home')});
  game.pauseUntilResumed('Reprise de la partie sauvegardée…');
  inMatch = true;
  showScreen('game');
  try {
    await bridge.request('resumeSaved');
    bridge.send('settings', {settings: {holdPriority: prefs.get('holdPriority'), autoPass: prefs.get('autoPass')}});
  } catch (e) {
    inMatch = false;
    toast(e.message, {title: 'Impossible de reprendre la partie', error: true, duration: 8000});
    showScreen('home');
  }
}

async function leaveMatch() {
  inMatch = false;
  closeAllForgeDialogs();
  try {
    await bridge.request('leaveMatch');
  } catch (e) {
    // la partie était déjà terminée
  }
  if (game) {
    game.destroy();
    game = null;
  }
  showScreen('home');
}

function playDeck(deckKey) {
  const format = deckKey.startsWith('constructed:') ? 'constructed' : 'commander';
  const lobby = screens.lobby;
  lobby.format = format;
  lobby.seats = [{name: 'Moi', ai: false, deckKey}, {name: 'IA 1', ai: true, deckKey: format === 'commander' ? 'random' : 'randomConstructed'}];
  lobby.count = 2;
  showScreen('lobby');
}

// ------------------------------------------------------------------ écrans simples

function homeScreen() {
  const root = $('#screen-home');
  return {
    async show() {
      const decks = ready ? await getDecks() : {decks: [], precons: []};
      const saved = ready && !inMatch ? await bridge.request('savedGame').catch(() => null) : null;
      root.innerHTML = `<div class="page">
        ${saved ? savedGameHtml(saved) : ''}
        <div class="hero">
          <img src="img/icon.svg" class="glow" alt="">
          <h1>Arcane Table</h1>
          <p>Magic: The Gathering contre l'IA, avec le moteur de règles Forge : toutes les cartes, en français, et un deck builder pensé pour le Commander.</p>
          <div class="actions">
            ${inMatch ? '<button class="btn gold" data-go="game">Reprendre la partie</button>' : ''}
            <button class="btn gold" data-go="quick">⚡ Partie rapide</button>
            <button class="btn primary" data-go="lobby">Créer un salon</button>
            <button class="btn" data-go="decks">Mes decks</button>
          </div>
        </div>
        <div class="tiles">
          <div class="tile panel" data-go="lobby"><h3>Jouer</h3><p class="muted">1 à 3 adversaires IA, Commander ou Construit.</p></div>
          <div class="tile panel" data-go="decks"><h3>Decks</h3><p class="muted">${decks.decks.length} deck(s) perso · ${decks.precons.length} préconstruits Commander.</p></div>
          <div class="tile panel" data-go="cards"><h3>Cartes</h3><p class="muted">Cherche parmi toutes les cartes, en français ou en anglais.</p></div>
          <div class="tile panel" data-go="stats"><h3>Statistiques</h3><p class="muted">Victoires, decks les plus joués, records de blessures...</p></div>
          <div class="tile panel" data-go="trophies"><h3>Trophées</h3><p class="muted">Séries de victoires, victoires alternatives, défis...</p></div>
          <div class="tile panel" data-go="settings"><h3>Réglages</h3><p class="muted">Priorité, images, musique, sons.</p></div>
        </div>
      </div>`;
      root.onclick = (e) => {
        const go = e.target.closest('[data-go]');
        if (!go) {
          return;
        }
        if (go.dataset.go === 'quick') {
          quickMatch();
        } else if (go.dataset.go === 'resumeSaved') {
          resumeSaved();
        } else if (go.dataset.go === 'dropSaved') {
          confirmBox('Abandonner la partie sauvegardée ?', 'Elle ne pourra plus être reprise.', {yes: 'Abandonner', danger: true}).then(async (yes) => {
            if (yes) {
              await bridge.request('deleteSaved').catch(() => {});
              screens.home.show();
            }
          });
        } else {
          showScreen(go.dataset.go);
        }
      };
    },
  };
}

function savedGameHtml(s) {
  const when = s.savedAt ? new Date(s.savedAt) : null;
  const ago = when ? Math.max(0, Math.round((Date.now() - when.getTime()) / 60000)) : null;
  const agoText = ago === null ? '' : ago < 1 ? 'à l\'instant' : ago < 60 ? `il y a ${ago} min` : ago < 1440 ? `il y a ${Math.round(ago / 60)} h` : `le ${when.toLocaleDateString('fr-FR')}`;
  const players = (s.players || []).map(p => `${esc(p.name)} <b>${p.lost ? '✝' : Number(p.life) || 0}</b>`).join(' · ');
  return `<div class="saved-game panel">
    <div class="sg-icon">⏳</div>
    <div class="sg-info"><b>Partie en cours sauvegardée</b>
      <div class="muted small">${s.format === 'constructed' ? 'Construit' : 'Commander'} · tour ${Number(s.turn) || 1}${s.active ? ` (${esc(s.active)})` : ''} · ${agoText}</div>
      <div class="small">${players}</div></div>
    <div class="sg-actions"><button class="btn small" data-go="dropSaved">Abandonner</button><button class="btn gold" data-go="resumeSaved">▶ Reprendre</button></div>
  </div>`;
}

async function quickMatch() {
  const setup = prefs.get('lastSetup');
  if (setup) {
    startMatch(setup);
    return;
  }
  const decks = await getDecks();
  const mine = decks.decks.find(d => d.format === 'commander');
  const myDeck = mine ? mine.key : (decks.precons[0] ? decks.precons[0].key : 'random');
  startMatch({format: 'commander', players: [{name: 'Moi', ai: false, deckKey: myDeck}, {name: 'IA 1', ai: true, deckKey: 'random'}]});
}

function cardsScreen() {
  const root = $('#screen-cards');
  let panel = null;
  return {
    show() {
      if (!panel) {
        root.innerHTML = '<div class="page" style="height:100%;display:flex;flex-direction:column"><h1>Cartes</h1><div class="browser" style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>';
        const box = root.querySelector('.browser');
        panel = new SearchPanel(box, {onPick: (card) => showZoom(card, legalityHtml(card))});
        box.querySelector('.results').style.cssText = 'flex:1;overflow:auto';
        panel.search(true);
      }
    },
  };
}

function legalityHtml(card) {
  const bits = [];
  bits.push(card.commanderLegal ? '✓ Légale en Commander' : '✗ Non légale en Commander');
  if (card.canBeCommander) {
    bits.push('♛ Peut être commandant');
  }
  if (card.set) {
    bits.push('Édition : ' + card.set);
  }
  return `<div class="muted small" style="margin-top:12px">${bits.map(esc).join('<br>')}</div>`;
}

function settingsScreen() {
  const root = $('#screen-settings');
  return {
    show() {
      const row = (key, title, text) => `<div class="row"><div><b>${title}</b><p class="muted small">${text}</p></div>
        <input type="checkbox" data-pref="${key}" ${prefs.get(key) ? 'checked' : ''}></div>`;
      root.innerHTML = `<div class="page settings">
        <h1>Réglages</h1>
        ${row('images', 'Images des cartes', 'Télécharge les images depuis Scryfall et les garde en cache sur l\'appareil.')}
        <div class="row"><div><b>Langue des images</b><p class="muted small">En français quand Scryfall a une impression française de la carte, sinon en anglais.</p></div>
          <select data-pref-select="imageLang"><option value="fr">Français</option><option value="en">Anglais</option></select></div>
        ${row('animations', 'Animations', 'Déplacements de cartes, bannières de tour, effets de points de vie.')}
        ${row('musicOn', 'Musique d\'ambiance', 'Musiques médiévales de Kevin MacLeod, dans les menus et en partie.')}
        <div class="row"><div><b>Volume de la musique</b></div><input type="range" min="0" max="100" data-pref-range="musicVolume"></div>
        ${row('sfxOn', 'Effets sonores', 'Cartes engagées, sorts, terrains, boutons...')}
        <div class="row"><div><b>Volume des effets</b></div><input type="range" min="0" max="100" data-pref-range="sfxVolume"></div>
        ${row('holdPriority', 'Garder la priorité par défaut', 'Après avoir lancé un sort, s\'arrêter pour pouvoir y répondre soi-même.')}
        ${row('autoPass', 'Passer automatiquement', 'Ne pas s\'arrêter sur le tour adverse quand aucune action n\'est possible.')}
        <h2 style="margin-top:26px">À propos</h2>
        <p class="muted">Arcane Table utilise le moteur <b>Forge</b> (règles, IA, base de cartes et traductions françaises), sous licence GPL-3.0. Images de cartes : Scryfall. Musiques : Kevin MacLeod (incompetech.com), licence Creative Commons Attribution 3.0.</p>
        <p class="muted small">Arcane Table n'est ni produit ni approuvé par Wizards of the Coast. Magic: The Gathering est une marque de Wizards of the Coast LLC.</p>
        <p class="muted small version"></p>
      </div>`;
      root.querySelectorAll('[data-pref-select]').forEach(sel => {
        sel.value = prefs.get(sel.dataset.prefSelect);
        sel.addEventListener('change', () => {
          prefs.set(sel.dataset.prefSelect, sel.value);
          reloadImages();
        });
      });
      root.querySelectorAll('[data-pref-range]').forEach(r => {
        r.value = Math.round(Number(prefs.get(r.dataset.prefRange)) * 100);
        r.addEventListener('input', () => {
          prefs.set(r.dataset.prefRange, Number(r.value) / 100);
          refreshAudio();
        });
      });
      root.querySelectorAll('[data-pref]').forEach(i => i.addEventListener('change', () => {
        prefs.set(i.dataset.pref, i.checked);
        refreshAudio();
        if (inMatch && (i.dataset.pref === 'holdPriority' || i.dataset.pref === 'autoPass')) {
          bridge.send('settings', {settings: {[i.dataset.pref]: i.checked}});
        }
      }));
      bridge.request('hello').then(h => {
        root.querySelector('.version').textContent = 'Version de Forge : ' + h.version;
      });
    },
  };
}

// ------------------------------------------------------------------ démarrage

function setLoading(text, percent) {
  $('#loading-text').textContent = text;
  if (percent >= 0) {
    $('#loading-bar').style.width = Math.max(5, percent) + '%';
  }
}

/** Après une synchronisation : decks et réglages ont pu changer. */
function afterSync() {
  decksCache = null;
  refreshAudio();
  if (current !== 'game' && current !== 'account' && screens[current] && screens[current].show) {
    screens[current].show();
  }
}

function onReady(hello) {
  if (ready) {
    return;
  }
  ready = true;
  loadProfile().then(() => syncNow({auto: true, onDone: afterSync}));
  $('#loading').classList.add('hidden');
  screens.lobby.setProfiles(hello && hello.aiProfiles);
  if (hello && hello.inMatch) {
    inMatch = true;
    game = new Game($('#screen-game'), {onExit: leaveMatch, onRematch: () => startMatch(lastSetup || prefs.get('lastSetup')), onMenu: () => showScreen('home')});
    showScreen('game');
  } else {
    showScreen(current === 'game' ? 'home' : current);
  }
}

async function hello() {
  try {
    const h = await bridge.request('hello');
    if (h.ready) {
      onReady(h);
    } else {
      setLoading(h.status || 'Chargement de Forge…', -1);
    }
  } catch (e) {
    setLoading('Le moteur ne répond pas : ' + e.message, -1);
  }
}

function init() {
  initAudio();
  screens.home = homeScreen();
  screens.lobby = new Lobby($('#screen-lobby'), {onStart: startMatch, getDecks: () => getDecks(true)});
  screens.decks = new Decks($('#screen-decks'), {onPlay: playDeck, onChanged: () => {
    decksCache = null;
  }});
  screens.cards = cardsScreen();
  screens.settings = settingsScreen();
  screens.trophies = new Trophies($('#screen-trophies'));
  screens.stats = new StatsScreen($('#screen-stats'));
  screens.account = new AccountScreen($('#screen-account'), {onSynced: afterSync});
  onProfile((p) => {
    $('#profile-btn').innerHTML = `${avatarHtml(p.name, p.avatar, 28)}<span>${esc(p.name)}</span>${p.linked ? '<i title="Synchronisé">⟳</i>' : ''}`;
    screens.lobby.playerName = p.name;
  });

  $('#profile-btn').addEventListener('click', () => ready && showScreen('account'));
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-screen]');
    if (b && ready) {
      showScreen(b.dataset.screen);
    }
  });
  $('#resume-game').addEventListener('click', () => showScreen('game'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideZoom();
    }
  });

  bridge.on('connection', (m) => {
    if (m.connected) {
      hello();
    } else if (!ready) {
      setLoading('Connexion au moteur perdue, nouvel essai…', -1);
    } else {
      toast('Connexion au moteur perdue.', {error: true});
    }
  });
  bridge.on('loading', (m) => setLoading(m.text || 'Chargement…', m.percent));
  bridge.on('ready', () => hello());
  bridge.on('fatal', (m) => setLoading(m.message, -1));
  bridge.on('state', (s) => {
    if (!inMatch) {
      return;
    }
    if (game) {
      game.setState(s);
    }
  });
  bridge.on('dialog', (d) => handleForgeDialog(d));
  bridge.on('dialogClosed', (m) => closeForgeDialog(m.id));
  bridge.on('notice', (m) => toast(m.message, {title: m.title}));
  bridge.on('error', (m) => toast(m.message, {title: 'Erreur', error: true, duration: 6000}));
  bridge.on('gameOver', (m) => {
    if (game) {
      game.gameOver(m);
    }
    // Trophées et decks à jour sur les autres appareils.
    setTimeout(() => syncNow({auto: true, onDone: afterSync}), 1500);
  });
  bridge.on('trophy', (m) => announceTrophy(m));
  bridge.on('statsChanged', () => {
    if (current === 'stats') {
      screens.stats.show();
    }
  });
  bridge.on('resumed', () => game && game.resumed());
  bridge.on('openUrl', (m) => bridge.openUrl(m.url));
  bridge.on('incorrectAction', () => {
    const p = document.querySelector('.prompt');
    if (p) {
      p.classList.remove('shake');
      void p.offsetWidth;
      p.classList.add('shake');
    }
  });

  // Bouton retour d'Android : ferme ce qui est ouvert ; renvoie false pour mettre l'application en arrière-plan.
  window.__atBack = () => {
    if (hideZoom()) {
      return true;
    }
    const box = document.querySelector('#dialogs .modal-back:last-child');
    if (box && !box.dataset.forge) {
      box.remove();
      return true;
    }
    if (current === 'game') {
      if (game && game.closeOverlays()) {
        return true;
      }
      return false;
    }
    if (current !== 'home') {
      showScreen('home');
      return true;
    }
    return false;
  };

  bridge.connect();
  if ('serviceWorker' in navigator && !bridge.android && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
