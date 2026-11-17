/**
 * Zoom du plateau : à deux doigts sur téléphone (pincer), Ctrl + molette ou pincement du pavé tactile sur ordinateur.
 *
 * Chaque moitié du plateau (adversaires, moi) se zoome à part ; la ligne du milieu (phase, outils), la main et les
 * boutons restent à leur place. Pincer zoome autour des doigts, les déplacer fait glisser la vue ; une fois zoomée,
 * un seul doigt (ou la molette) la fait glisser aussi. Toucher deux fois une zone vide zoome (ou remet à plat), le
 * bouton « 100 % » et le pincement jusqu'au bout la remettent à plat.
 *
 * Le zoom n'est qu'une transformation de la moitié (agrandie depuis son coin, puis découpée à sa taille) : la mise en
 * page ne change pas, les rangées ne se recalculent pas et les cartes restent touchables là où on les voit.
 */
const MAX = 3;
const SNAP = 1.08;

/** Échelle du zoom de la moitié qui contient {@code node} (1 hors zoom). */
export function zoomOf(node) {
  const half = node && node.closest && node.closest('.half');
  return half && half._zoom ? half._zoom.s : 1;
}

/** Rectangle d'une moitié à l'écran sans son zoom (sa place dans la mise en page). */
export function layoutRect(half) {
  const z = half._zoom;
  if (!z || z.s === 1 || !half.offsetParent) {
    return half.getBoundingClientRect();
  }
  // Lue depuis le plateau (jamais zoomé) : juste même pendant l'animation du retour à plat.
  const b = half.offsetParent.getBoundingClientRect();
  const left = b.left + half.offsetLeft;
  const top = b.top + half.offsetTop;
  return {left, top, right: left + half.offsetWidth, bottom: top + half.offsetHeight, width: half.offsetWidth, height: half.offsetHeight};
}

export class BoardZoom {
  /**
   * @param table le plateau
   * @param onChange appelé (une fois par image au plus) quand un zoom change : flèches à redessiner
   */
  constructor(table, onChange) {
    this.table = table;
    this.onChange = onChange;
    this.gesture = null;
    this.quietUntil = 0;
    this.lastTap = null;
    this.frame = 0;
    this.buttons = new Map();
    this.bind();
  }

  halves() {
    return [...this.table.querySelectorAll('.opp-half, .me-half')];
  }

  /** Vrai pendant un pincement ou un glissement (et juste après) : pas d'appui long ni de clic. */
  busy() {
    return !!this.gesture && this.gesture.moved || performance.now() < this.quietUntil;
  }

  zoomed() {
    return this.halves().some(h => h._zoom && h._zoom.s > 1);
  }

  // ------------------------------------------------------------------ état

  /** Place de la moitié dans le plateau, lue au début de chaque geste (et après un changement de taille). */
  measure(half) {
    const parent = half.offsetParent;
    const b = parent ? parent.getBoundingClientRect() : {left: 0, top: 0};
    return {left: b.left + half.offsetLeft, top: b.top + half.offsetTop, w: half.offsetWidth, h: half.offsetHeight};
  }

  /** Applique {s, x, y} à la moitié, borné pour que le plateau remplisse toujours sa place. */
  set(half, s, x, y, box = this.measure(half), animate = false) {
    s = Math.max(1, Math.min(MAX, s));
    x = Math.min(0, Math.max(box.w * (1 - s), x));
    y = Math.min(0, Math.max(box.h * (1 - s), y));
    if (s === 1) {
      x = 0;
      y = 0;
    }
    half._zoom = {s, x, y};
    half.classList.toggle('zoom-anim', animate);
    if (s === 1) {
      half.classList.remove('zoomed');
      half.style.transform = '';
      half.style.clipPath = '';
      if (animate) {
        // Retour à plat animé : la classe part une fois arrivé.
        half.style.transform = 'translate(0px, 0px) scale(1)';
        half.style.clipPath = 'inset(0px)';
        clearTimeout(half._zoomEnd);
        half._zoomEnd = setTimeout(() => {
          if (half._zoom && half._zoom.s === 1) {
            half.style.transform = '';
            half.style.clipPath = '';
            half.classList.remove('zoom-anim');
          }
          this.changed();
        }, 220);
      }
    } else {
      clearTimeout(half._zoomEnd);
      half.classList.add('zoomed');
      half.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
      // Découpe dans le repère de la moitié agrandie : seule sa place d'origine reste visible (et touchable).
      const top = -y / s;
      const left = -x / s;
      const right = box.w - (box.w - x) / s;
      const bottom = box.h - (box.h - y) / s;
      half.style.clipPath = `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px)`;
    }
    this.placeButton(half, box);
    this.changed();
  }

  reset(half, animate = true) {
    if (half._zoom && half._zoom.s !== 1) {
      this.set(half, 1, 0, 0, this.measure(half), animate);
    }
  }

  resetAll(animate = true) {
    this.halves().forEach(h => this.reset(h, animate));
  }

  /** Après un changement de taille du plateau : le zoom reste, borné à la nouvelle place. */
  refit() {
    for (const h of this.halves()) {
      const z = h._zoom;
      if (z && z.s > 1) {
        this.set(h, z.s, z.x, z.y);
      }
    }
  }

  /** Zoome {@code half} d'un facteur autour du point (clientX, clientY). */
  zoomAt(half, factor, cx, cy, animate = false) {
    const box = this.measure(half);
    const z = half._zoom || {s: 1, x: 0, y: 0};
    const s = Math.max(1, Math.min(MAX, z.s * factor));
    const px = cx - box.left;
    const py = cy - box.top;
    // Le point sous les doigts reste sous les doigts.
    const qx = (px - z.x) / z.s;
    const qy = (py - z.y) / z.s;
    this.set(half, s, px - s * qx, py - s * qy, box, animate);
  }

  changed() {
    if (this.frame) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.onChange && this.onChange();
    });
  }

  /** Bouton « 100 % » au coin de la moitié zoomée (posé sur le plateau : il ne grossit pas avec elle). */
  placeButton(half, box) {
    let b = this.buttons.get(half);
    const z = half._zoom;
    if (!z || z.s === 1) {
      if (b) {
        b.remove();
        this.buttons.delete(half);
      }
      return;
    }
    if (!b) {
      b = document.createElement('button');
      b.className = 'zoom-reset';
      b.type = 'button';
      b.title = 'Revenir à la taille normale';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.reset(half);
      });
      this.table.appendChild(b);
      this.buttons.set(half, b);
    }
    const t = this.table.getBoundingClientRect();
    b.textContent = `${Math.round(z.s * 100)} % ⟲`;
    b.style.left = '';
    b.style.right = Math.max(4, t.right - (box.left + box.w) + 6) + 'px';
    b.style.top = (box.top - t.top + 6) + 'px';
  }

  // ------------------------------------------------------------------ gestes

  bind() {
    const t = this.table;
    const halfOf = (target) => target && target.closest && target.closest('.opp-half, .me-half');
    const point = (a, b) => ({x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)});

    const startPinch = (half, a, b) => {
      const box = this.measure(half);
      const z = half._zoom || {s: 1, x: 0, y: 0};
      const p = point(a, b);
      this.gesture = {mode: 'pinch', half, box, s0: z.s, x0: z.x, y0: z.y, d0: Math.max(10, p.d), m0: p, moved: true};
      half.classList.remove('zoom-anim');
      this.lastTap = null;
    };
    const startPan = (half, touch, moved) => {
      const z = half._zoom;
      this.gesture = {mode: 'pan', half, box: this.measure(half), x0: z.x, y0: z.y, sx: touch.clientX, sy: touch.clientY, id: touch.identifier, moved};
    };

    t.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const half = halfOf(e.touches[0].target) || halfOf(e.touches[1].target);
        if (half) {
          e.preventDefault();
          startPinch(half, e.touches[0], e.touches[1]);
        }
        return;
      }
      if (e.touches.length === 1) {
        const half = halfOf(e.target);
        const z = half && half._zoom;
        this.gesture = null;
        if (z && z.s > 1) {
          startPan(half, e.touches[0], false);
        }
      } else {
        this.gesture = null;
      }
    }, {passive: false});

    t.addEventListener('touchmove', (e) => {
      const g = this.gesture;
      if (!g) {
        return;
      }
      if (g.mode === 'pinch') {
        if (e.touches.length < 2) {
          return;
        }
        e.preventDefault();
        const p = point(e.touches[0], e.touches[1]);
        const s = Math.max(1, Math.min(MAX, g.s0 * p.d / g.d0));
        // Point de la moitié qui était sous les doigts au départ : il suit leur milieu.
        const qx = (g.m0.x - g.box.left - g.x0) / g.s0;
        const qy = (g.m0.y - g.box.top - g.y0) / g.s0;
        this.set(g.half, s, p.x - g.box.left - s * qx, p.y - g.box.top - s * qy, g.box);
        return;
      }
      const touch = [...e.touches].find(x => x.identifier === g.id);
      if (!touch) {
        return;
      }
      const dx = touch.clientX - g.sx;
      const dy = touch.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) < 10) {
        return;
      }
      g.moved = true;
      e.preventDefault();
      const z = g.half._zoom;
      this.set(g.half, z.s, g.x0 + dx, g.y0 + dy, g.box);
    }, {passive: false});

    const end = (e) => {
      const g = this.gesture;
      if (!g) {
        this.doubleTap(e);
        return;
      }
      if (g.mode === 'pinch' && e.touches.length === 1 && g.half._zoom.s > 1) {
        // Un doigt levé : l'autre continue de faire glisser la vue.
        startPan(g.half, e.touches[0], true);
        return;
      }
      if (e.touches.length) {
        return;
      }
      this.gesture = null;
      if (g.moved) {
        // Le clic (et l'appui long) qui suivent le geste ne jouent rien.
        this.quietUntil = performance.now() + 380;
        this.lastTap = null;
        if (g.mode === 'pinch' && g.half._zoom.s < SNAP) {
          this.reset(g.half);
        }
      } else {
        this.doubleTap(e);
      }
    };
    t.addEventListener('touchend', end);
    t.addEventListener('touchcancel', (e) => {
      if (!e.touches.length) {
        this.gesture = null;
      }
    });

    // Clic qui suit un pincement ou un glissement : avalé avant le reste du plateau.
    t.addEventListener('click', (e) => {
      if (performance.now() < this.quietUntil && halfOf(e.target)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);

    // iPhone : ses gestes de zoom de la page ne doivent pas se mêler à ceux du plateau.
    t.addEventListener('gesturestart', (e) => e.preventDefault());

    // Ordinateur : Ctrl + molette (ou pincer le pavé tactile) zoome ; zoomé, la molette fait glisser la vue.
    t.addEventListener('wheel', (e) => {
      const half = halfOf(e.target);
      if (!half) {
        return;
      }
      const z = half._zoom;
      if (e.ctrlKey) {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : 1;
        this.zoomAt(half, Math.exp(-e.deltaY * unit * 0.01), e.clientX, e.clientY);
        if (half._zoom.s < 1.02) {
          this.reset(half, false);
        }
      } else if (z && z.s > 1) {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : 1;
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        this.set(half, z.s, z.x - dx * unit, z.y - dy * unit);
      }
    }, {passive: false});
  }

  /** Deux touchers rapprochés sur une zone vide d'une moitié : zoom ×2 à cet endroit, ou retour à plat. */
  doubleTap(e) {
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch || e.touches.length) {
      return;
    }
    const target = e.target;
    const half = target && target.closest && target.closest('.opp-half, .me-half');
    if (!half || target.closest('.slot, .plate, .player-hit, button, .atk-chip, [data-mana], .pile, .stat')) {
      this.lastTap = null;
      return;
    }
    const now = performance.now();
    const last = this.lastTap;
    if (last && last.half === half && now - last.at < 320 && Math.hypot(touch.clientX - last.x, touch.clientY - last.y) < 30) {
      this.lastTap = null;
      this.quietUntil = now + 380;
      const z = half._zoom;
      if (z && z.s > 1) {
        this.reset(half);
      } else {
        this.zoomAt(half, 2, touch.clientX, touch.clientY, true);
      }
      return;
    }
    this.lastTap = {half, at: now, x: touch.clientX, y: touch.clientY};
  }
}
