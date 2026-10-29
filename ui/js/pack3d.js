// Boosters en 3D (WebGL ; Three.js n'est chargé qu'à la première ouverture). Un sachet bombé aux bords sertis, en
// feuille métallisée froissée qui accroche la lumière : il flotte, suit le doigt (on peut le faire tourner), et à
// l'ouverture une ligne de lumière court sur la soudure, le haut s'arrache et la lumière jaillit du paquet.
// Sans WebGL (ou s'il échoue), l'appelant garde le booster dessiné en CSS.

import {prefs} from './util.js';

let lib = null;
/** Three.js et son environnement de reflets, chargés une fois. */
function three() {
  lib = lib || Promise.all([import('../vendor/three/three.module.min.js'), import('../vendor/three/RoomEnvironment.js')])
    .then(([THREE, env]) => ({THREE, RoomEnvironment: env.RoomEnvironment}));
  return lib;
}

let glOk = null;
/** WebGL utilisable sur cet appareil ? */
export function webglOk() {
  if (glOk === null) {
    try {
      const c = document.createElement('canvas');
      glOk = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      glOk = false;
    }
  }
  return glOk;
}

const animated = () => prefs.get('animations') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
};

function hash(text) {
  let h = 0;
  for (const ch of String(text)) {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return h;
}

// Proportions du sachet (largeur 1), hauteur des bords sertis et ligne de déchirure.
const PW = 1;
const PH = 1.88;
const CRIMP = 0.085;
const TEAR = PH / 2 - 0.2;
const DEPTH = 0.085;

/** Bombé du sachet en (x, y) : plat sur les bords sertis, rebondi au milieu, nul sur les côtés. */
function bulge(x, y) {
  const bx = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * x / PW), 3)), 0.5);
  const inner = PH / 2 - CRIMP;
  if (Math.abs(y) >= inner) {
    // Sertissage : de fines stries verticales.
    return 0.006 * (0.5 + 0.5 * Math.sin(x * 140)) * bx;
  }
  const by = Math.pow(Math.max(0, 1 - Math.pow(y / inner, 2)), 0.32);
  return DEPTH * bx * by + 0.006 * bx;
}

/** Une face du sachet (side : 1 devant, -1 derrière) entre y0 et y1, avec la dentelure du bord serti en haut/bas. */
function faceGeometry(THREE, side, y0, y1) {
  const nx = 34;
  const ny = Math.max(4, Math.round(56 * (y1 - y0) / PH));
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= ny; j++) {
    let y = y0 + (y1 - y0) * j / ny;
    for (let i = 0; i <= nx; i++) {
      const x = -PW / 2 + PW * i / nx;
      let yy = y;
      // Bord dentelé : une dent sur deux recule un peu.
      if (j === ny && y1 >= PH / 2 - 1e-6 && i % 2) {
        yy -= 0.018;
      }
      if (j === 0 && y0 <= -PH / 2 + 1e-6 && i % 2) {
        yy += 0.018;
      }
      pos.push(x, yy, side * bulge(x, y));
      uv.push(side > 0 ? i / nx : 1 - i / nx, (yy + PH / 2) / PH);
    }
  }
  const row = nx + 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      if (side > 0) {
        idx.push(a, b, d, a, d, c);
      } else {
        idx.push(a, d, b, a, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Papier froissé : petites bosses aléatoires (relief de la feuille métallisée). */
function crinkle(THREE) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 900; k++) {
    const v = Math.round(90 + rnd() * 80);
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.beginPath();
    g.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 1 + rnd() * 5, rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let k = 0; k < 60; k++) {
    g.strokeStyle = `rgba(${rnd() > 0.5 ? 220 : 40},${rnd() > 0.5 ? 220 : 40},${rnd() > 0.5 ? 220 : 40},0.18)`;
    g.lineWidth = 0.6 + rnd();
    g.beginPath();
    const x = rnd() * 256;
    const y = rnd() * 256;
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 90);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}

/** Face avant dessinée (sans visuel de l'extension) : aux couleurs de l'extension, comme le booster CSS. */
function drawnFront(set, back = false) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 964;
  const g = c.getContext('2d');
  const hue = hash(set.code) % 360;
  const grad = g.createLinearGradient(0, 0, 512, 964);
  grad.addColorStop(0, `hsl(${hue} 55% ${back ? 22 : 34}%)`);
  grad.addColorStop(0.55, `hsl(${(hue + 30) % 360} 60% ${back ? 14 : 20}%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360} 55% ${back ? 8 : 12}%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 964);
  // Reflets de la feuille.
  for (let k = 0; k < 7; k++) {
    g.fillStyle = `rgba(255,255,255,${0.03 + (k % 3) * 0.02})`;
    g.beginPath();
    g.moveTo(-200 + k * 140, 964);
    g.lineTo(-60 + k * 140, 964);
    g.lineTo(380 + k * 140, 0);
    g.lineTo(300 + k * 140, 0);
    g.fill();
  }
  // Bandes serties.
  for (const y of [0, 964 - 44]) {
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(0, y, 512, 44);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < 512; x += 8) {
      g.fillRect(x, y, 3, 44);
    }
  }
  g.textAlign = 'center';
  g.fillStyle = '#f6d78f';
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = 10;
  if (back) {
    g.font = 'bold 40px Georgia, serif';
    g.fillText('MAGIC', 256, 200);
    g.font = 'italic 24px Georgia, serif';
    g.fillText('The Gathering', 256, 236);
    g.font = '600 30px sans-serif';
    g.fillStyle = '#e8e4f4';
    g.fillText('14 cartes', 256, 520);
    g.font = '22px sans-serif';
    g.fillText(set.code, 256, 560);
    return c;
  }
  g.font = 'bold 84px Georgia, serif';
  g.fillText('MAGIC', 256, 160);
  g.font = 'italic 34px Georgia, serif';
  g.fillText('The Gathering', 256, 206);
  // Emblème : étoile à quatre branches dans un cercle d'or.
  g.shadowBlur = 24;
  g.strokeStyle = '#f6d78f';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(256, 470, 120, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#ffe9b0';
  g.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 ? 26 : 100;
    g.lineTo(256 + r * Math.cos(a), 470 + r * Math.sin(a));
  }
  g.fill();
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.font = 'bold 40px sans-serif';
  const words = String(set.name).split(/\s+/);
  const lines = [];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && g.measureText(cur + ' ' + w).width < 440) {
      lines[lines.length - 1] = cur + ' ' + w;
    } else {
      lines.push(w);
    }
  }
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 256, 700 + i * 48));
  g.font = '24px sans-serif';
  g.fillStyle = '#e8e4f4';
  g.fillText(`${set.code} · 14 cartes`, 256, 880);
  return c;
}

/** Visuel de l'extension (image du vrai booster), servi par l'application elle-même (WebGL refuse les autres adresses). */
function loadArt(set) {
  if (!set.art || !prefs.get('images')) {
    return Promise.resolve(null);
  }
  const n = set.covers > 1 ? 1 + (hash(set.code) % set.covers) : 0;
  const img = new Image();
  img.decoding = 'async';
  return new Promise((resolve) => {
    img.onload = () => resolve(img.naturalWidth > 8 ? img : null);
    img.onerror = () => resolve(null);
    img.src = 'cardimg?key=' + encodeURIComponent('booster:' + set.code + (n ? '_' + n : '')) + '&lang=en';
    setTimeout(() => resolve(null), 6000);
  });
}

/** Texture de la face avant : l'image recadrée aux proportions du sachet, ou le dessin. */
function frontTexture(THREE, set, img) {
  let tex;
  if (img) {
    tex = new THREE.Texture(img);
    const aspect = img.naturalWidth / img.naturalHeight;
    const want = PW / PH;
    if (aspect > want) {
      tex.repeat.set(want / aspect, 1);
      tex.offset.set((1 - want / aspect) / 2, 0);
    } else {
      tex.repeat.set(1, aspect / want);
      tex.offset.set(0, (1 - aspect / want) / 2);
    }
  } else {
    tex = new THREE.CanvasTexture(drawnFront(set));
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Halo lumineux (sprite additif) : lumière qui jaillit, étincelle qui court sur la soudure. */
function glowTexture(THREE, inner = '#fff6dc', outer = 'rgba(255,190,90,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Scène 3D d'un ou plusieurs boosters dans {@code host} (le canvas le remplit).
 * Options : fan (éventail de plusieurs paquets), spin (vitrine : il tourne lentement sur lui-même), arrive (entrée en
 * glissant depuis le bas). Renvoie null si WebGL ou Three.js manque.
 */
export async function packScene(host, sets, {fan = false, spin = false, arrive = true} = {}) {
  if (!webglOk()) {
    return null;
  }
  let THREE;
  let RoomEnvironment;
  try {
    ({THREE, RoomEnvironment} = await three());
  } catch (e) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'pack3d-canvas';
  host.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, powerPreference: 'high-performance'});
  } catch (e) {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x202040, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xc8a0ff, 6, 10);
  rim.position.set(2.2, 1.5, -2);
  scene.add(rim);
  // Reflet qui glisse sur la feuille métallisée.
  const sheen = new THREE.PointLight(0xfff0d0, 5, 6);
  scene.add(sheen);

  const bump = crinkle(THREE);
  const glow = glowTexture(THREE);
  const lineGlow = glowTexture(THREE, '#ffe9b0', 'rgba(255,200,120,0)');
  const disposables = [bump, glow, lineGlow, envTarget, pmrem];

  const arts = await Promise.all(sets.map(loadArt));
  const packs = sets.map((set, k) => {
    const front = frontTexture(THREE, set, arts[k]);
    const backTex = new THREE.CanvasTexture(drawnFront(set, true));
    backTex.colorSpace = THREE.SRGBColorSpace;
    const mat = (map) => new THREE.MeshPhysicalMaterial({map, metalness: 0.32, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.16,
      bumpMap: bump, bumpScale: 1.2, envMapIntensity: 1.1, side: THREE.FrontSide});
    const fm = mat(front);
    const bm = mat(backTex);
    const group = new THREE.Group();
    const body = new THREE.Group();
    body.add(new THREE.Mesh(faceGeometry(THREE, 1, -PH / 2, TEAR), fm), new THREE.Mesh(faceGeometry(THREE, -1, -PH / 2, TEAR), bm));
    const strip = new THREE.Group();
    const stripFm = fm.clone();
    const stripBm = bm.clone();
    stripFm.transparent = stripBm.transparent = true;
    strip.add(new THREE.Mesh(faceGeometry(THREE, 1, TEAR, PH / 2), stripFm), new THREE.Mesh(faceGeometry(THREE, -1, TEAR, PH / 2), stripBm));
    // Pivot de la bande du haut : son coin gauche (elle s'arrache de gauche à droite).
    const stripPivot = new THREE.Group();
    stripPivot.position.set(-PW / 2, TEAR, 0);
    strip.position.set(PW / 2, -TEAR, 0);
    stripPivot.add(strip);
    // Lumière à l'intérieur du paquet (visible une fois ouvert) et soudure qui s'illumine.
    const innerMat = new THREE.MeshBasicMaterial({color: 0xfff2c8, transparent: true, opacity: 0, depthWrite: false});
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.scale.set(PW * 0.96, bulge(0, TEAR) * 2 / 1 + 0.01, 1);
    inner.position.y = TEAR - 0.005;
    const seamPts = [];
    for (let i = 0; i <= 30; i++) {
      const x = -PW / 2 + PW * i / 30;
      seamPts.push(new THREE.Vector3(x, TEAR, bulge(x, TEAR) + 0.004));
    }
    const seamMat = new THREE.MeshBasicMaterial({color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts), 40, 0.006, 6, false), seamMat);
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({map: lineGlow, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
    spark.scale.set(0.34, 0.34, 1);
    const burstSprite = new THREE.Sprite(new THREE.SpriteMaterial({map: glow, color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
    burstSprite.position.set(0, TEAR + 0.1, 0);
    burstSprite.scale.set(0.2, 0.2, 1);
    const innerLight = new THREE.PointLight(0xffd88a, 0, 4);
    innerLight.position.set(0, TEAR + 0.25, 0.25);
    group.add(body, stripPivot, inner, seam, spark, burstSprite, innerLight);
    scene.add(group);
    disposables.push(front, backTex, fm, bm, stripFm, stripBm, innerMat, seamMat, spark.material, burstSprite.material);
    return {set, group, body, strip, stripPivot, stripMats: [stripFm, stripBm], allMats: [fm, bm], inner, innerMat, seam, seamMat, spark, burstSprite, innerLight,
      phase: k * 0.9, torn: false, gone: false, base: {x: 0, y: 0, z: 0, rz: 0, ry: 0}};
  });

  // Disposition : un paquet au centre, ou un éventail.
  const n = packs.length;
  packs.forEach((p, k) => {
    const o = k - (n - 1) / 2;
    p.base = fan ? {x: o * 0.62, y: -Math.abs(o) * 0.08, z: -Math.abs(o) * 0.18, rz: -o * 0.11, ry: o * 0.06} : {x: 0, y: 0, z: 0, rz: 0, ry: 0};
  });
  const span = fan ? (n - 1) * 0.62 + PW * 1.2 : PW;

  let width = 1;
  let height = 1;
  const fit = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Le paquet (ou l'éventail) occupe ~82 % de la hauteur, ou de la largeur si elle manque.
    const vfov = camera.fov * Math.PI / 180;
    const distH = (PH * 1.22) / (2 * Math.tan(vfov / 2));
    const distW = (span * 1.25) / (2 * Math.tan(vfov / 2) * camera.aspect);
    camera.position.set(0, 0, Math.max(distH, distW, 2.5));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  fit();
  const ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
  if (ro) {
    ro.observe(host);
  }

  // Suivi du doigt : inclinaison (ou rotation complète en vitrine), avec élan.
  const look = {x: 0, y: 0, tx: 0, ty: 0, drag: null, spinY: 0, spinV: 0};
  const onMove = (e) => {
    const r = host.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    if (look.drag) {
      const dx = e.clientX - look.drag.x;
      look.spinV = (dx - look.drag.dx) * 0.012;
      look.drag.dx = dx;
      look.spinY = look.drag.start + dx * 0.012;
      look.ty = -ny * 0.5;
    } else if (e.pointerType === 'mouse') {
      look.tx = nx * 0.7;
      look.ty = -ny * 0.45;
    }
  };
  let moved = 0;
  const onDown = (e) => {
    look.drag = {x: e.clientX, y: e.clientY, dx: 0, start: look.spinY, t: performance.now()};
    moved = 0;
  };
  const onUp = (e) => {
    if (look.drag && e && e.clientX !== undefined) {
      moved = Math.hypot(e.clientX - look.drag.x, e.clientY - look.drag.y);
    }
    look.drag = null;
  };
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // Animations en cours : {from, to, ms, fn(k)}.
  const tweens = [];
  const tween = (ms, fn, curve = ease.out) => new Promise((resolve) => {
    if (!animated()) {
      fn(1);
      resolve();
      return;
    }
    tweens.push({start: performance.now(), ms, fn, curve, resolve});
  });
  let arriveK = arrive && animated() ? 0 : 1;
  if (arriveK < 1) {
    tween(900, (k) => {
      arriveK = k;
    }, ease.back);
  }

  let disposed = false;
  let last = performance.now();
  const frame = (now) => {
    if (disposed) {
      return;
    }
    if (!canvas.isConnected) {
      api.dispose();
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, (now - tw.start) / tw.ms);
      tw.fn(tw.curve(k));
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.resolve();
      }
    }
    look.x += (look.tx - look.x) * Math.min(1, dt * 6);
    look.y += (look.ty - look.y) * Math.min(1, dt * 6);
    if (!look.drag) {
      // Élan après un lancer, puis retour doux (sauf en vitrine, où il continue de tourner lentement).
      look.spinY += look.spinV;
      look.spinV *= 0.9;
      if (spin) {
        look.spinY += dt * 0.45;
      } else if (Math.abs(look.spinV) < 0.002) {
        const turns = Math.round(look.spinY / (Math.PI * 2)) * Math.PI * 2;
        look.spinY += (turns - look.spinY) * Math.min(1, dt * 3);
      }
    }
    const idle = animated() ? 1 : 0;
    for (const p of packs) {
      if (p.gone) {
        continue;
      }
      const b = p.base;
      const enter = 1 - arriveK;
      p.group.position.set(b.x, b.y + Math.sin(t * 1.6 + p.phase) * 0.03 * idle - enter * 3.2, b.z);
      p.group.rotation.set(
        Math.sin(t * 0.9 + p.phase) * 0.05 * idle + look.y * 0.6 - enter * 0.6,
        b.ry + Math.sin(t * 0.6 + p.phase) * 0.22 * idle * (spin ? 0 : 1) + look.x + look.spinY,
        b.rz + Math.sin(t * 0.8 + p.phase) * 0.03 * idle + enter * 0.5);
    }
    sheen.position.set(Math.sin(t * 0.7) * 1.6, Math.cos(t * 0.5) * 0.8 + 0.4, 2.2);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const api = {
    canvas,
    count: n,
    /** Le dernier appui a fait tourner le paquet (et n'est donc pas un toucher pour l'ouvrir). */
    dragged: () => moved > 10,
    /** Point d'un paquet à l'écran (coordonnées de la page) : 'center' ou 'top' (la soudure). */
    screenPoint(i = 0, where = 'center') {
      const p = packs[i] || packs[0];
      const v = new THREE.Vector3(0, where === 'top' ? TEAR : 0, 0);
      p.group.updateMatrixWorld(true);
      v.applyMatrix4(p.group.matrixWorld).project(camera);
      const r = canvas.getBoundingClientRect();
      return {x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height};
    },
    /** Hauteur d'un paquet à l'écran, en pixels. */
    packHeight() {
      return height * PH / (2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360));
    },
    /**
     * Ouverture d'un paquet : il se tasse, la soudure s'illumine d'un bord à l'autre, la bande du haut s'arrache et
     * s'envole, la lumière jaillit. onLight() quand la lumière sort (pour les étincelles).
     */
    async tear(i = 0, onLight = null) {
      const p = packs[i];
      if (!p || p.torn) {
        return;
      }
      p.torn = true;
      // D'abord de face (s'il a été retourné du doigt), puis il se tasse.
      look.spinV = 0;
      look.tx = look.ty = 0;
      const s0 = look.spinY;
      const turn = Math.round(s0 / (Math.PI * 2)) * Math.PI * 2;
      if (Math.abs(turn - s0) > 0.05) {
        await tween(Math.min(520, 160 + Math.abs(turn - s0) * 160), (k) => {
          look.spinY = s0 + (turn - s0) * k;
        }, ease.inOut);
      }
      await tween(200, (k) => {
        const s = Math.sin(k * Math.PI);
        p.body.scale.set(1 + s * 0.05, 1 - s * 0.045, 1);
        p.stripPivot.scale.set(1 + s * 0.05, 1 - s * 0.045, 1);
      }, ease.inOut);
      p.seamMat.opacity = 0.9;
      p.spark.material.opacity = 1;
      await tween(320, (k) => {
        const x = -PW / 2 + PW * k;
        p.spark.position.set(x, TEAR, bulge(x, TEAR) + 0.02);
        p.seamMat.opacity = 0.5 + 0.5 * k;
      }, ease.inOut);
      p.spark.material.opacity = 0;
      if (onLight) {
        onLight();
      }
      const fly = tween(720, (k) => {
        p.stripPivot.rotation.set(-k * 0.9, k * 0.5, -k * 1.15);
        p.stripPivot.position.set(-PW / 2 + k * 0.9, TEAR + k * 0.9 - k * k * 0.6, k * 0.6);
        for (const m of p.stripMats) {
          m.opacity = 1 - Math.max(0, (k - 0.55) / 0.45);
        }
      });
      const light = tween(620, (k) => {
        p.innerMat.opacity = Math.min(1, k * 1.6);
        p.burstSprite.material.opacity = Math.min(1, k * 2) * (1 - k * 0.35);
        const s = 0.3 + k * 2.6;
        p.burstSprite.scale.set(s, s * 1.15, 1);
        p.innerLight.intensity = k * 14;
        p.seamMat.opacity = 1 - k;
      });
      await Promise.all([fly, light]);
      p.stripPivot.visible = false;
    },
    /** Les paquets ouverts descendent et s'effacent (les cartes prennent le relais). */
    async exit() {
      const open = packs.filter(p => !p.gone);
      for (const p of open) {
        for (const m of p.allMats) {
          m.transparent = true;
        }
      }
      const y0 = open.map(p => p.base.y);
      await tween(520, (k) => {
        open.forEach((p, j) => {
          p.base.y = y0[j] - k * 0.9;
          for (const m of p.allMats) {
            m.opacity = 1 - k;
          }
          p.innerMat.opacity = 1 - k;
          p.burstSprite.material.opacity = (1 - k) * 0.65;
          p.innerLight.intensity = 14 * (1 - k);
        });
      }, (k) => k * k);
      open.forEach(p => {
        p.gone = true;
        p.group.visible = false;
      });
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      if (ro) {
        ro.disconnect();
      }
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      scene.traverse((o) => {
        if (o.geometry) {
          o.geometry.dispose();
        }
      });
      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
      canvas.remove();
    },
  };
  // Premier rendu prêt (images chargées) : l'appelant peut cacher le booster CSS de remplacement.
  await wait(0);
  return api;
}
