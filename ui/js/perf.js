/**
 * Mode économie et relevé de performance.
 *
 * Mode économie (Réglages → Performance) : « auto » (par défaut), « on » ou « off ». En auto, il s'active quand
 * l'appareil est lent : un petit calcul chronométré au lancement, ou des images trop longues à dessiner pendant une
 * partie (alors retenu quelques jours). Il coupe les effets qui coûtent sans rien apprendre au joueur : décors
 * animés, flous derrière les fenêtres, halos qui pulsent, glissement des cartes d'une place à l'autre.
 *
 * Relevé : quelques mesures toujours prises (bon marché) — fluidité en partie, temps de dessin du plateau, taille des
 * photos de la partie, temps de chargement des images, étapes du démarrage — à copier dans un message.
 */
import {bridge} from './bridge.js';
import {prefs, toast} from './util.js';

// ------------------------------------------------------------------ mesures

/** Une série de valeurs : nombre, moyenne, médiane, 95e centile, maximum (sur les 300 dernières). */
class Series {
  constructor() {
    this.recent = [];
    this.n = 0;
    this.sum = 0;
    this.max = 0;
  }

  add(v) {
    this.n++;
    this.sum += v;
    this.max = Math.max(this.max, v);
    this.recent.push(v);
    if (this.recent.length > 300) {
      this.recent.shift();
    }
  }

  summary() {
    if (!this.n) {
      return null;
    }
    const s = [...this.recent].sort((a, b) => a - b);
    return {n: this.n, avg: this.sum / this.n, p50: s[Math.floor(s.length / 2)], p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], max: this.max};
  }
}

export const stats = {
  render: new Series(),
  frames: new Series(),
  images: new Series(),
  janky: 0,
  frameCount: 0,
  startup: [],
};

/** Étape du démarrage de l'interface (ms depuis l'ouverture de la page). */
export function mark(step) {
  stats.startup.push([step, Math.round(performance.now())]);
}

/** Temps de chargement des images de cartes, lus dans le minutage du navigateur (rien à mesurer soi-même). */
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.name.includes('cardimg') && e.duration > 0) {
        stats.images.add(e.duration);
      }
    }
  }).observe({type: 'resource', buffered: true});
} catch (e) {
  // minutage indisponible (certaines vues web)
}

// ------------------------------------------------------------------ mode économie

const SLOW_KEY = 'at.ecoSlowUntil';
// Calibré en ralentissant le processeur : ≈ 5 ms sur un ordinateur, 20 ms à ×4, 35–40 ms à ×6 (téléphone d'entrée de gamme).
const BENCH_SLOW_MS = 30;
let bench = null;

/** Petit calcul chronométré (le meilleur de trois) : quelques millisecondes sur un appareil rapide. */
function benchmark() {
  const arr = new Float64Array(4096);
  let best = Infinity;
  let acc = 0;
  for (let run = 0; run < 3; run++) {
    const t0 = performance.now();
    for (let r = 0; r < 160; r++) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = arr[i] * 0.5 + i;
        acc += arr[i] % 7;
      }
    }
    best = Math.min(best, performance.now() - t0);
  }
  return {ms: Math.round(best * 10) / 10, check: acc > 0};
}

/** Lenteur constatée en partie : retenue jusqu'à cette date (lue une fois, puis tenue à jour ici). */
let slowUntil = (() => {
  try {
    return Number(localStorage.getItem(SLOW_KEY) || 0);
  } catch (e) {
    return 0;
  }
})();

function slowRemembered() {
  return slowUntil > Date.now();
}

/** Ce que l'appareil laisse savoir de lui, et le calcul chronométré. */
export function deviceInfo() {
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0;
  const benchSlow = !!bench && bench.ms > BENCH_SLOW_MS;
  const hintSlow = (cores > 0 && cores <= 4 && memory > 0 && memory <= 2) || (memory > 0 && memory < 2);
  return {cores, memory, bench: bench && bench.ms, slow: benchSlow || hintSlow || slowRemembered(), benchSlow, hintSlow, remembered: slowRemembered()};
}

/** Vrai si le mode économie est actif. */
export function ecoOn() {
  const mode = prefs.get('eco');
  return mode === 'on' || (mode !== 'off' && deviceInfo().slow);
}

/** Pose l'attribut lu par les styles (et la coupure des décors animés, comme Animations décoché). */
export function applyEco() {
  const root = document.documentElement;
  const on = ecoOn();
  root.dataset.eco = on ? 'on' : 'off';
  if (on) {
    root.dataset.motion = 'off';
  }
  return on;
}

/** Au lancement, une fois l'interface montrée : le calcul chronométré, puis le mode appliqué. */
export function detectDevice(onChange) {
  const run = () => {
    const before = ecoOn();
    bench = benchmark();
    if (ecoOn() !== before) {
      onChange && onChange();
    }
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, {timeout: 3000});
  } else {
    setTimeout(run, 1500);
  }
}

// ------------------------------------------------------------------ fluidité en partie

let watching = 0;
let quietUntil = 0;
let longFrames = [];

/**
 * Suit la durée des images pendant une partie. En auto, trop d'images longues (au moins 15 de plus de 80 ms en
 * 30 secondes) activent le mode économie, retenu deux semaines.
 */
export function watchFrames(onSlow) {
  stopFrames();
  quietUntil = performance.now() + 3000;
  longFrames = [];
  let last = 0;
  const tick = (t) => {
    if (!watching) {
      return;
    }
    watching = requestAnimationFrame(tick);
    const dt = last ? t - last : 0;
    last = t;
    // Onglet caché, appli en arrière-plan ou plateau qu'on vient de bâtir : rien à compter.
    if (!dt || dt > 1000 || document.hidden || t < quietUntil) {
      return;
    }
    stats.frames.add(dt);
    stats.frameCount++;
    if (dt > 50) {
      stats.janky++;
    }
    if (dt > 80 && prefs.get('eco') === 'auto' && !ecoOn()) {
      longFrames.push(t);
      longFrames = longFrames.filter(x => t - x < 30000);
      if (longFrames.length >= 15) {
        slowUntil = Date.now() + 14 * 86400000;
        try {
          localStorage.setItem(SLOW_KEY, String(slowUntil));
        } catch (e) {
          // retenu pour cette fois seulement
        }
        longFrames = [];
        applyEco();
        onSlow && onSlow();
        toast('Le jeu manquait de fluidité : les effets décoratifs sont coupés (Réglages → Performance).', {title: 'Mode économie activé', duration: 6000});
      }
    }
  };
  watching = requestAnimationFrame(tick);
}

export function stopFrames() {
  if (watching) {
    cancelAnimationFrame(watching);
  }
  watching = 0;
}

/** Après un gros travail attendu (plateau rebâti) : ces images-là ne comptent pas. */
export function quiet(ms = 1500) {
  quietUntil = Math.max(quietUntil, performance.now() + ms);
}

/** Oublie la lenteur constatée en partie (bouton « Réévaluer » des Réglages). */
export function forgetSlow() {
  slowUntil = 0;
  try {
    localStorage.removeItem(SLOW_KEY);
  } catch (e) {
    // rien à oublier
  }
  bench = benchmark();
}

// ------------------------------------------------------------------ relevé

const line = (s, unit = 'ms') => s && s.n ? `moy. ${Math.round(s.avg)} ${unit}, médiane ${Math.round(s.p50)}, 95 % ≤ ${Math.round(s.p95)}, max ${Math.round(s.max)} (${s.n})` : 'pas encore de mesure';

/** Le relevé complet, en texte à copier. */
export async function reportText() {
  let j = {};
  try {
    j = await bridge.request('perfReport');
  } catch (e) {
    j = {error: e.message};
  }
  const d = deviceInfo();
  const plat = bridge.android ? 'Android' : bridge.ios ? 'iPhone/iPad' : 'Ordinateur';
  const out = [];
  out.push(`Relevé de performance — Arcane Table ${j.appVersion || 'dev'}${j.channel === 'test' ? ' (AT TEST)' : ''}, ${new Date().toLocaleString('fr-FR')}`);
  out.push(`Appareil : ${plat}, écran ${screen.width}×${screen.height} (×${window.devicePixelRatio || 1}), fenêtre ${innerWidth}×${innerHeight}`);
  out.push(`Processeur : ${d.cores || '?'} cœurs${d.memory ? `, mémoire ≈ ${d.memory} Go` : ''}, calcul test ${d.bench == null ? '–' : d.bench + ' ms'} (lent au-delà de ${BENCH_SLOW_MS})`);
  out.push(`Mode économie : réglé sur « ${{auto: 'auto', on: 'toujours', off: 'jamais'}[prefs.get('eco')] || prefs.get('eco')} », ${ecoOn() ? 'actif' : 'inactif'}${d.remembered ? ' (lenteur constatée en partie)' : ''}`);
  out.push(`Navigateur : ${navigator.userAgent}`);
  if (j.error) {
    out.push(`Moteur : indisponible (${j.error})`);
  } else {
    out.push(`Moteur : ${j.java || '?'}, ${j.os || '?'}, ${j.cpus} processeurs, mémoire ${j.memUsedMb}/${j.memMaxMb} Mo, lancé depuis ${Math.round((j.uptimeS || 0) / 60)} min`);
    out.push('');
    out.push('Démarrage du moteur :');
    const steps = j.startup || [];
    steps.forEach((s, i) => {
      const next = steps[i + 1];
      out.push(`  ${String(s.ms).padStart(6)} ms  ${s.step}${next ? `  (${next.ms - s.ms} ms)` : ''}`);
    });
  }
  out.push('Démarrage de l\'interface :');
  stats.startup.forEach(([step, t]) => out.push(`  ${String(t).padStart(6)} ms  ${step}`));
  out.push('');
  out.push('En partie :');
  out.push(`  Images à l'écran : ${line(stats.frames.summary())}, ${stats.frameCount ? Math.round(stats.janky * 1000 / stats.frameCount) / 10 : 0} % au-delà de 50 ms`);
  out.push(`  Dessin du plateau : ${line(stats.render.summary())}`);
  if (!j.error) {
    out.push(`  Photo de la partie (moteur) : ${line(j.snapshotMs)}`);
    out.push(`  Taille d'une photo : ${line(j.snapshotKb, 'Ko')}`);
    out.push(`  Réflexion de l'IA : ${line(j.aiMs)}${j.aiCut ? `, ${j.aiCut} décisions écourtées` : ''}`);
    out.push('');
    out.push('Images des cartes :');
    out.push(`  Réponse du moteur : ${line(j.imageMs)}${j.imageMissing ? `, ${j.imageMissing} introuvables` : ''}`);
  }
  out.push(`  Chargement à l'écran : ${line(stats.images.summary())}`);
  if (j.stuck) {
    out.push('');
    out.push(`Dernier blocage de partie : ${j.stuck}`);
  }
  return out.join('\n');
}

