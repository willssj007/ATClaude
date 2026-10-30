// Contrôleur principal : chargement de Forge, navigation entre les écrans, cycle d'une partie.

import {AccountScreen, loadProfile, onProfile, syncNow} from './account.js';
import {initAudio, refreshAudio, setMusicMode} from './audio.js';
import {bridge} from './bridge.js';
import {BoostersScreen} from './boosters.js';
import {hideZoom, reloadImages, showZoom} from './cards.js';
import {DuelScreen, forgetCareer, isPlaneswalker, loadCareer, manaAmount, onCareer, wildcardsHtml} from './career.js';
import {Decks} from './decks.js';
import {closeAllForgeDialogs, closeForgeDialog, confirmBox, handleForgeDialog} from './dialogs.js';
import {Game} from './game.js';
import {Lobby} from './lobby.js';
import {SearchPanel} from './search.js';
import {enhanceSelects} from './select.js';
import {icon} from './icons.js';
import {ReplayScreen} from './replay.js';
import {StatsScreen} from './stats.js';
import {openLedger} from './ledger.js';
import {announceUnlocks, appearanceHtml, applyThemes, livePreviews, themeClicked} from './themes.js';
import {announceTrophy, Trophies} from './trophies.js';
import {$, $$, avatarHtml, debounce, esc, prefs, toast} from './util.js';

const screens = {};
let current = 'home';
let game = null;
let inMatch = false;
let lastSetup = null;
let decksCache = null;
let ready = false;

/** Écrans réservés à un mode : le Sandbox a ses salons, le Planeswalker ses duels et ses boosters. */
const SANDBOX_ONLY = ['lobby'];
const PLANESWALKER_ONLY = ['duel', 'boosters'];

function showScreen(name) {
  if (isPlaneswalker() && SANDBOX_ONLY.includes(name)) {
    name = 'duel';
  } else if (!isPlaneswalker() && PLANESWALKER_ONLY.includes(name)) {
    name = 'home';
  }
  current = name;
  // Téléphone et tablette : portrait permis sur les écrans des decks et des cartes, paysage partout ailleurs.
  bridge.orientation(name === 'decks' || name === 'cards' ? 'any' : 'landscape');
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  document.body.classList.toggle('in-game', name === 'game');
  // Replay : plein écran comme une partie, mais sans les raccourcis clavier de la partie en cours.
  document.body.classList.toggle('in-replay', name === 'replay');
  if (name !== 'replay' && screens.replay) {
    screens.replay.stop();
  }
  setMusicMode(name === 'game' ? 'match' : 'menus');
  $('#resume-game').classList.toggle('hidden', !inMatch || name === 'game' || name === 'replay');
  const screen = screens[name];
  if (screen && screen.show) {
    screen.show();
  }
  sendPresence();
}

/** Ordinateur : l'écran et le mode en cours, pour la présence Discord (la partie, elle, est suivie par le moteur). */
function sendPresence() {
  if (!bridge.android && !bridge.ios) {
    bridge.send('presence', {screen: current, mode: isPlaneswalker() ? 'planeswalker' : 'sandbox', enabled: !!prefs.get('discordPresence')});
  }
}

/** Mode de jeu : navigation, mana affiché, écrans. */
function applyMode() {
  const pw = isPlaneswalker();
  document.body.classList.toggle('mode-pw', pw);
  $$('#nav [data-mode-only]').forEach(b => b.classList.toggle('hidden', b.dataset.modeOnly !== (pw ? 'planeswalker' : 'sandbox')));
  const cards = $('#nav [data-screen="cards"] span');
  if (cards) {
    cards.textContent = pw ? 'Collection' : 'Cartes';
  }
  $('#mana-chip').classList.toggle('hidden', !pw);
  if (pw && ready) {
    loadCareer().catch(() => {});
  }
}

function setMode(mode) {
  if (prefs.get('mode') === mode) {
    return;
  }
  prefs.set('mode', mode);
  decksCache = null;
  screens.decks.deck = null;
  screens.cards.reset();
  applyMode();
  showScreen('home');
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
  game = newGame(() => startMatch(lastSetup));
  inMatch = true;
  showScreen('game');
  try {
    await bridge.request('startMatch', {setup});
    bridge.send('settings', {settings: {holdPriority: prefs.get('holdPriority'), autoPass: prefs.get('autoPass')}});
    prefetchImages();
  } catch (e) {
    inMatch = false;
    toast(e.message, {title: 'Impossible de lancer la partie', error: true, duration: 8000});
    showScreen('lobby');
  }
}

/** Écran de partie. Duel de carrière : « Duel suivant » ramène à l'écran Duel, avec le nouvel adversaire. */
function newGame(rematch) {
  return new Game($('#screen-game'), {
    onExit: leaveMatch,
    onRematch: () => (game && game.career ? leaveMatch().then(() => showScreen('duel')) : rematch()),
    onMenu: () => showScreen('home'),
    // Le replay de la partie finie est le plus récent (gardé avant l'écran de fin).
    onReplay: async () => {
      try {
        const [latest] = await bridge.request('replays');
        if (latest) {
          showScreen('replay');
          screens.replay.open(latest.id);
        }
      } catch (e) {
        toast(e.message, {error: true});
      }
    },
  });
}

/** Reprend la partie sauvegardée (l'application avait été fermée en pleine partie). */
async function resumeSaved() {
  closeAllForgeDialogs();
  if (game) {
    game.destroy();
  }
  game = newGame(() => startMatch(lastSetup || prefs.get('lastSetup')));
  game.pauseUntilResumed('Reprise de la partie sauvegardée…');
  inMatch = true;
  showScreen('game');
  try {
    await bridge.request('resumeSaved');
    bridge.send('settings', {settings: {holdPriority: prefs.get('holdPriority'), autoPass: prefs.get('autoPass')}});
    prefetchImages();
  } catch (e) {
    inMatch = false;
    toast(e.message, {title: 'Impossible de reprendre la partie', error: true, duration: 8000});
    showScreen('home');
  }
}

/** Images du deck téléchargées d'avance (une à la fois, derrière celles que l'écran demande). */
function prefetchImages() {
  if (prefs.get('images')) {
    bridge.send('prefetchImages', {lang: prefs.get('imageLang')});
  }
}

/** Quitte la partie (abandon si elle n'est pas finie), puis va à l'écran `to` (rien avec null). */
async function leaveMatch(to = 'home') {
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
  if (to) {
    showScreen(to);
  }
}

function playDeck(deckKey) {
  if (isPlaneswalker()) {
    screens.duel.useDeck(deckKey);
    showScreen('duel');
    return;
  }
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
      const pw = isPlaneswalker();
      const [decks, saved, c] = await Promise.all([
        ready && !pw ? getDecks() : {decks: [], precons: []},
        ready && !inMatch ? bridge.request('savedGame').catch(() => null) : null,
        ready && pw ? loadCareer(true).catch(() => null) : null,
      ]);
      const modes = `<div class="mode-pick" role="radiogroup" aria-label="Mode de jeu">
          <button class="mode-card${pw ? '' : ' on'}" data-mode="sandbox" role="radio" aria-checked="${!pw}">${icon('chest', 'mode-ic')}
            <span><b>Sandbox</b><span class="muted small">Tout est ouvert : toutes les cartes et les préconstruits, salons, mulligans à régler, triche.</span></span></button>
          <button class="mode-card${pw ? ' on' : ''}" data-mode="planeswalker" role="radio" aria-checked="${pw}">${icon('spark', 'mode-ic')}
            <span><b>Planeswalker</b><span class="muted small">Ta carrière : un deck tiré au hasard, des duels, des cartes, du mana et des boosters à gagner.</span></span></button>
        </div>`;
      const career = c && c.started ? `<div class="pw-stats home-stats">${manaAmount(c.mana, 'chip')}
          <span class="chip-stat">${icon('swords')}<b>${c.wins}</b> victoire${c.wins > 1 ? 's' : ''}</span>
          <span class="chip-stat">${icon('crown')}série <b>${c.streak}</b></span>
          <span class="chip-stat">${icon('booster')}<b>${(c.boosters || []).length}</b> booster${(c.boosters || []).length > 1 ? 's' : ''}</span>
          <span class="chip-stat">${icon('book')}<b>${c.unique}</b> cartes</span></div>` : '';
      const actions = pw ? `
            ${inMatch ? '<button class="btn gold" data-go="game">Reprendre la partie</button>' : ''}
            <button class="btn gold" data-go="duel">${icon('swords')} ${c && c.started ? 'Duel' : 'Commencer ma carrière'}</button>
            <button class="btn primary" data-go="boosters">${icon('booster')} Boutique</button>
            <button class="btn" data-go="decks">Mes decks</button>` : `
            ${inMatch ? '<button class="btn gold" data-go="game">Reprendre la partie</button>' : ''}
            <button class="btn gold" data-go="quick">${icon('swords')} Partie rapide</button>
            <button class="btn primary" data-go="lobby">Créer un salon</button>
            <button class="btn" data-go="decks">Mes decks</button>`;
      const tiles = pw ? `
          <div class="tile panel" data-go="duel">${icon('swords', 'tile-ic')}<h3>Duel</h3><p class="muted">Un adversaire à la fois : 200 mana, des cartes et un booster par victoire.</p></div>
          <div class="tile panel" data-go="boosters">${icon('booster', 'tile-ic')}<h3>Boutique</h3><p class="muted">Ouvre tes boosters, achètes-en de n'importe quelle extension, et des apparences mythiques.</p></div>
          <div class="tile panel" data-go="decks">${icon('cards', 'tile-ic')}<h3>Decks</h3><p class="muted">Construis tes decks avec les cartes de ta collection.</p></div>
          <div class="tile panel" data-go="cards">${icon('book', 'tile-ic')}<h3>Collection</h3><p class="muted">${c && c.started ? `${c.unique} cartes différentes, ${c.cards} au total.` : 'Les cartes que tu possèdes.'}</p></div>`
        : `
          <div class="tile panel" data-go="lobby">${icon('swords', 'tile-ic')}<h3>Jouer</h3><p class="muted">1 à 3 adversaires IA, Commander ou Construit.</p></div>
          <div class="tile panel" data-go="decks">${icon('cards', 'tile-ic')}<h3>Decks</h3><p class="muted">${decks.decks.length} deck(s) perso · ${decks.precons.length} préconstruits Commander.</p></div>
          <div class="tile panel" data-go="cards">${icon('book', 'tile-ic')}<h3>Cartes</h3><p class="muted">Cherche parmi toutes les cartes, en français ou en anglais.</p></div>`;
      root.innerHTML = `<div class="page">
        ${saved ? savedGameHtml(saved) : ''}
        <div class="hero">
          <span class="glow" aria-hidden="true"></span>
          <h1>Arcane Table</h1>
          <p>Magic: The Gathering contre l'IA, avec le moteur de règles Forge : toutes les cartes, en français, et un deck builder pensé pour le Commander.</p>
          ${modes}
          ${career}
          <div class="actions">${actions}</div>
        </div>
        <div class="tiles">${tiles}
          <div class="tile panel" data-go="stats">${icon('banner', 'tile-ic')}<h3>Statistiques</h3><p class="muted">Victoires, decks les plus joués, records de blessures...</p></div>
          <div class="tile panel" data-go="trophies">${icon('chalice', 'tile-ic')}<h3>Trophées et défis</h3><p class="muted">Succès de Forge, et défis qui débloquent des apparences.</p></div>
          <div class="tile panel" data-go="settings">${icon('gear', 'tile-ic')}<h3>Réglages</h3><p class="muted">Apparence, priorité, images, musique, sons.</p></div>
        </div>
      </div>`;
      root.onclick = (e) => {
        const mode = e.target.closest('[data-mode]');
        if (mode) {
          setMode(mode.dataset.mode);
          return;
        }
        const go = e.target.closest('[data-go]');
        if (!go) {
          return;
        }
        if (go.dataset.go === 'quick') {
          quickMatch();
        } else if (go.dataset.go === 'resumeSaved') {
          resumeSaved();
        } else if (go.dataset.go === 'dropSaved') {
          confirmBox('Abandonner la partie sauvegardée ?', saved && saved.career ? 'Le duel ne pourra plus être repris (ton adversaire t\'attendra toujours dans Duel).' : 'Elle ne pourra plus être reprise.', {yes: 'Abandonner', danger: true}).then(async (yes) => {
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
  const players = (s.players || []).map(p => `${esc(p.name)} <b>${p.lost ? icon('skull') : Number(p.life) || 0}</b>`).join(' · ');
  return `<div class="saved-game panel">
    <div class="sg-icon">${icon('hourglass')}</div>
    <div class="sg-info"><b>${s.career ? 'Duel Planeswalker sauvegardé' : 'Partie en cours sauvegardée'}</b>
      <div class="muted small">${s.format === 'constructed' ? 'Construit' : 'Commander'} · tour ${Number(s.turn) || 1}${s.active ? ` (${esc(s.active)})` : ''} · ${agoText}</div>
      <div class="small">${players}</div></div>
    <div class="sg-actions"><button class="btn small" data-go="dropSaved">Abandonner</button><button class="btn gold" data-go="resumeSaved">▶ Reprendre</button></div>
  </div>`;
}

const NAV_ICONS = {home: 'castle', lobby: 'swords', duel: 'swords', decks: 'cards', cards: 'book', boosters: 'booster', stats: 'banner', trophies: 'chalice', settings: 'gear'};

async function quickMatch() {
  if (isPlaneswalker()) {
    showScreen('duel');
    return;
  }
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
      // Mode Planeswalker : la collection (cartes possédées) ; mode Sandbox : toutes les cartes.
      const pw = isPlaneswalker();
      if (!panel) {
        root.innerHTML = `<div class="page cards-page"><div class="cards-head"><h1>${pw ? 'Collection' : 'Cartes'}</h1>${pw ? '<span class="cards-wc"></span>' : ''}</div><div class="browser"></div></div>`;
        const box = root.querySelector('.browser');
        panel = new SearchPanel(box, {onPick: (card) => showZoom(card, legalityHtml(card)), owned: pw});
        if (pw) {
          loadCareer().then(c => {
            const wc = root.querySelector('.cards-wc');
            if (wc) {
              wc.innerHTML = wildcardsHtml(c.wildcards);
            }
          }).catch(() => {});
        }
        panel.search(true);
      } else if (pw) {
        panel.search(true); // de nouvelles cartes ont pu arriver (duel, booster)
      }
    },
    reset() {
      panel = null;
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
  if (card.owned !== undefined) {
    bits.push(card.owned < 0 ? 'Terrain de base : illimité' : `Dans ta collection : ${card.owned} exemplaire${card.owned > 1 ? 's' : ''}`);
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
        <div class="appearance"><p class="muted small">Apparences…</p></div>
        <h2 style="margin-top:26px">Jeu</h2>
        ${row('images', 'Images des cartes', 'Télécharge les images depuis Scryfall et les garde en cache sur l\'appareil.')}
        <div class="row"><div><b>Langue des images</b><p class="muted small">En français quand Scryfall a une impression française de la carte, sinon en anglais.</p></div>
          <select data-pref-select="imageLang"><option value="fr">Français</option><option value="en">Anglais</option></select></div>
        ${row('animations', 'Animations', 'Déplacements de cartes, bannières de tour, effets de points de vie.')}
        ${row('musicOn', 'Musique d\'ambiance', 'Musiques douces, médiévales et féeriques, dans les menus et en partie.')}
        <div class="row"><div><b>Volume de la musique</b></div><input type="range" min="0" max="100" data-pref-range="musicVolume"></div>
        ${row('sfxOn', 'Effets sonores', 'Cartes engagées, sorts, terrains, boutons...')}
        <div class="row"><div><b>Volume des effets</b></div><input type="range" min="0" max="100" data-pref-range="sfxVolume"></div>
        ${row('holdPriority', 'Garder la priorité par défaut', 'Après avoir lancé un sort, s\'arrêter pour pouvoir y répondre soi-même.')}
        ${row('autoPass', 'Passer automatiquement', 'Ne pas s\'arrêter sur le tour adverse quand aucune action n\'est possible.')}
        ${bridge.android || bridge.ios ? '' : row('discordPresence', 'Montrer ma partie sur Discord', 'Si Discord est ouvert sur cet ordinateur, ton profil affiche ton mode, ton deck, tes points de vie et le tour.')}
        <h2 style="margin-top:26px"><span data-a>À</span> propos</h2>
        <p class="muted">Arcane Table utilise le moteur <b>Forge</b> (règles, IA, base de cartes et traductions françaises), sous licence GPL-3.0. Images de cartes : Scryfall. Musiques, bruitages, icônes et illustrations des apparences : composés, synthétisés et dessinés pour Arcane Table.</p>
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
        if (i.dataset.pref === 'animations') {
          applyThemes();
        }
        if (inMatch && (i.dataset.pref === 'holdPriority' || i.dataset.pref === 'autoPass')) {
          bridge.send('settings', {settings: {[i.dataset.pref]: i.checked}});
        }
        if (i.dataset.pref === 'discordPresence') {
          sendPresence();
        }
      }));
      bridge.request('hello').then(h => {
        root.querySelector('.version').textContent = `${h.appVersion ? `Arcane Table ${h.appVersion} · ` : ''}Version de Forge : ${h.version}`;
      });
      appearanceHtml().then((html) => {
        root.querySelector('.appearance').innerHTML = html;
        livePreviews(root.querySelector('.appearance'));
      });
      root.onclick = (e) => {
        if (e.target.closest('[data-a]') && isPlaneswalker()) {
          openLedger();
          return;
        }
        themeClicked(e.target);
      };
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
  forgetCareer();
  applyMode();
  refreshAudio();
  applyThemes();
  if (current !== 'game' && current !== 'account' && screens[current] && screens[current].show) {
    screens[current].show();
  }
}

function onReady(hello) {
  if (ready) {
    return;
  }
  ready = true;
  applyMode();
  loadProfile().then(() => syncNow({auto: true, onDone: afterSync}));
  checkUnlocks();
  $('#loading').classList.add('hidden');
  if (/[?&]autotest=1\b/.test(location.search)) {
    import('./autotest.js').then(m => m.runAutotest());
  }
  screens.lobby.setProfiles(hello && hello.aiProfiles);
  if (hello && hello.inMatch) {
    inMatch = true;
    game = newGame(() => startMatch(lastSetup || prefs.get('lastSetup')));
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

/** Apparences débloquées par la dernière partie ou le dernier trophée (les deux arrivent ensemble). */
const checkUnlocks = debounce(() => announceUnlocks().catch(() => {}), 1500);

function init() {
  applyThemes();
  initAudio();
  enhanceSelects();
  screens.home = homeScreen();
  screens.lobby = new Lobby($('#screen-lobby'), {onStart: startMatch, getDecks: () => getDecks(true)});
  screens.decks = new Decks($('#screen-decks'), {onPlay: playDeck, onChanged: () => {
    decksCache = null;
  }});
  screens.cards = cardsScreen();
  screens.duel = new DuelScreen($('#screen-duel'), {onStart: startMatch, onBoosters: () => showScreen('boosters'), playerName: () => screens.lobby.playerName,
    duelRunning: () => inMatch && !!(game && game.career), endDuel: () => leaveMatch(null)});
  screens.boosters = new BoostersScreen($('#screen-boosters'), {onDuel: () => showScreen('duel')});
  screens.settings = settingsScreen();
  screens.trophies = new Trophies($('#screen-trophies'));
  screens.replay = new ReplayScreen($('#screen-replay'), {onClose: () => showScreen('stats')});
  screens.stats = new StatsScreen($('#screen-stats'), {onWatch: (id) => {
    showScreen('replay');
    screens.replay.open(id);
  }});
  screens.account = new AccountScreen($('#screen-account'), {onSynced: afterSync});
  onProfile((p) => {
    $('#profile-btn').innerHTML = `${avatarHtml(p.name, p.avatar, 28, p.photo)}<span>${esc(p.name)}</span>${p.linked ? '<i title="Synchronisé">⟳</i>' : ''}`;
    screens.lobby.playerName = p.name;
  });

  $('#profile-btn').addEventListener('click', () => ready && showScreen('account'));
  $('#mana-chip').addEventListener('click', () => ready && showScreen('boosters'));
  onCareer((c) => {
    $('#mana-chip').innerHTML = c.started ? manaAmount(c.mana) : `${icon('spark')}<b>Carrière</b>`;
    document.querySelectorAll('.cards-wc, .builder-wc').forEach(n => {
      n.innerHTML = wildcardsHtml(c.wildcards);
    });
  });
  for (const b of $$('#nav button')) {
    b.innerHTML = `${icon(NAV_ICONS[b.dataset.screen])}<span>${b.textContent}</span>`;
    b.title = b.textContent;
  }
  applyMode();
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
    // Application Windows : F11 passe la fenêtre en plein écran (un navigateur garde cette touche pour lui).
    if (e.key === 'F11' && !bridge.android && document.fullscreenEnabled) {
      e.preventDefault();
      (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
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
  bridge.on('careerReward', (m) => {
    forgetCareer();
    loadCareer().catch(() => {});
    if (game) {
      game.setReward(m.reward);
    } else if (m.reward && !m.reward.won) {
      toast('Duel perdu : ta série repart de zéro.', {title: 'Planeswalker'});
    }
    checkUnlocks();
  });
  bridge.on('trophy', (m) => {
    announceTrophy(m);
    checkUnlocks();
  });
  bridge.on('statsChanged', () => {
    checkUnlocks();
    if (current === 'stats') {
      screens.stats.show();
    }
  });
  bridge.on('resumed', () => game && game.resumed());
  bridge.on('openUrl', (m) => bridge.openUrl(m.url));
  bridge.on('incorrectAction', () => {
    const p = document.querySelector('.table .actions');
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
}

init();
