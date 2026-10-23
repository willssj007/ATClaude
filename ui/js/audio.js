// Musique d'ambiance et effets sonores.
//
// Les fichiers viennent de Forge (servis sous audio/) : musiques douces et médiévales du mode Aventure
// (Vindsvept, Brandon et Derek Fiechter, Logan Epic Canto) pour les menus et la partie, et effets sonores
// choisis par Forge pour chaque événement de jeu (le pont envoie un message « sound » avec le nom du fichier).

import {bridge} from './bridge.js';
import {prefs} from './util.js';

const music = new Audio();
music.preload = 'auto';
let files = null;
let mode = null;
let playlist = [];
let track = 0;
let blobUrl = null;
let unlocked = false;
let ctx = null;
const buffers = new Map();
const lastPlayed = new Map();
let fadeTimer = 0;
let gain = 1;

function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      return null;
    }
    ctx = new AC();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

async function audioFiles() {
  if (!files) {
    try {
      files = await bridge.request('audioFiles');
    } catch (e) {
      files = null;
      return {menus: [], match: [], sounds: []};
    }
  }
  return files;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Les navigateurs n'autorisent le son qu'après un premier geste de l'utilisateur. */
export function initAudio() {
  const unlock = () => {
    unlocked = true;
    audioContext();
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    if (mode) {
      playMusic(!music.src);
    }
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  // Petit son sur les boutons de l'interface.
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .btn, .chip, .tile, [data-screen]')) {
      sfx('button_press.mp3', 0.55);
    }
  }, true);
  bridge.on('sound', ({name}) => sfx(name));
  music.addEventListener('ended', () => {
    track++;
    playMusic(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      music.pause();
    } else if (mode && prefs.get('musicOn') && unlocked) {
      music.play().catch(() => {});
    }
  });
}

/** Ambiance des menus (« menus ») ou de la partie (« match »). */
export async function setMusicMode(next) {
  if (mode === next) {
    return;
  }
  mode = next;
  const f = await audioFiles();
  if (mode !== next) {
    return;
  }
  playlist = shuffle([...(f[next] || [])]);
  track = 0;
  fadeOut(() => playMusic(true));
}

function fadeOut(then) {
  clearInterval(fadeTimer);
  if (music.paused || !music.src) {
    then();
    return;
  }
  fadeTimer = setInterval(() => {
    music.volume = Math.max(0, music.volume - 0.05);
    if (music.volume <= 0.01) {
      clearInterval(fadeTimer);
      music.pause();
      then();
    }
  }, 40);
}

/** Volume voulu pour le morceau en cours (réglage × volume propre au morceau). */
function targetVolume() {
  return Math.max(0, Math.min(1, Number(prefs.get('musicVolume')) * gain));
}

async function playMusic(load) {
  if (!prefs.get('musicOn') || !unlocked || !playlist.length || !mode) {
    music.pause();
    return;
  }
  if (load) {
    const entry = playlist[track % playlist.length];
    try {
      // Lue depuis un blob : la WebView Android ne passe pas toujours les lectures de médias par le pont.
      const res = await fetch('audio/' + entry.path.split('/').map(encodeURIComponent).join('/'));
      if (!res.ok) {
        return;
      }
      const blob = await res.blob();
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      blobUrl = URL.createObjectURL(blob);
      music.src = blobUrl;
      gain = Number(entry.gain) || 1;
    } catch (e) {
      return;
    }
    // Chaque morceau commence en douceur.
    clearInterval(fadeTimer);
    music.volume = 0;
    music.play().catch(() => {});
    const to = targetVolume();
    fadeTimer = setInterval(() => {
      music.volume = Math.min(to, music.volume + to / 60);
      if (music.volume >= to) {
        clearInterval(fadeTimer);
      }
    }, 50);
    return;
  }
  music.volume = targetVolume();
  music.play().catch(() => {});
}

/** Après un changement de réglage. */
export function refreshAudio() {
  clearInterval(fadeTimer);
  music.volume = targetVolume();
  if (!prefs.get('musicOn')) {
    music.pause();
  } else if (unlocked && mode) {
    playMusic(!music.src);
  }
}

async function buffer(name) {
  if (buffers.has(name)) {
    return buffers.get(name);
  }
  const promise = (async () => {
    try {
      const res = await fetch('audio/sound/' + encodeURIComponent(name));
      if (!res.ok) {
        return null;
      }
      const data = await res.arrayBuffer();
      return await new Promise((resolve) => audioContext().decodeAudioData(data, resolve, () => resolve(null)));
    } catch (e) {
      return null;
    }
  })();
  buffers.set(name, promise);
  return promise;
}

/** Joue un effet sonore de Forge (« tap.mp3 », « draw.mp3 »...). */
export async function sfx(name, gain = 1) {
  if (!name || !prefs.get('sfxOn') || !unlocked) {
    return;
  }
  const now = performance.now();
  if (now - (lastPlayed.get(name) || 0) < 90) {
    return; // plusieurs cartes engagées d'un coup : un seul son
  }
  lastPlayed.set(name, now);
  const c = audioContext();
  if (!c) {
    return;
  }
  const buf = await buffer(name);
  if (!buf) {
    return;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = Number(prefs.get('sfxVolume')) * gain;
  src.connect(g).connect(c.destination);
  src.start();
}
