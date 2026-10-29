#!/usr/bin/env python3
"""Dix fonds mythiques (menus et plateau) et dix dos de cartes mythiques, avec les calques de leurs animations.

Les fonds (1600×900, « slice ») sont fixes ; ce qui bouge est dessiné à part (fx-*.svg, fond transparent) et animé
par le CSS (transformations et opacité seulement).

Le hasard est figé (graine par image) : relancer le script redonne les mêmes fichiers.
Usage : python3 scripts/make-mythic-themes.py [dossier img de l'interface, ui/img par défaut]
"""
import math, os, random, sys

# ---------------------------------------------------------------- outils SVG communs

def f(x):
    s = ('%.1f' % x)
    return s[:-2] if s.endswith('.0') else s

FILTERS = ''.join(f'<filter id="b{n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{n}"/></filter>' for n in (2, 3, 6, 10, 20, 40))

def svg(w, h, defs, body, slice_=True):
    par = ' preserveAspectRatio="xMidYMid slice"' if slice_ else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"{par}><defs>{FILTERS}{defs}</defs>{body}</svg>'

def lin(id_, stops, x2=0, y2=1):
    return f'<linearGradient id="{id_}" x1="0" y1="0" x2="{x2}" y2="{y2}">' + ''.join(
        f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>' for o, c, a in stops) + '</linearGradient>'

def rad(id_, stops, cx=.5, cy=.5, r=.5):
    return f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}">' + ''.join(
        f'<stop offset="{o}" stop-color="{c}"' + (f' stop-opacity="{a}"' if a is not None else '') + '/>' for o, c, a in stops) + '</radialGradient>'

def ridge(rng, x0, x1, base, amp, step=14, rough=.5, smooth=4, bottom=910):
    """Silhouette : ligne de crête bruitée fermée vers le bas."""
    n = int((x1 - x0) / step) + 1
    ys = [rng.uniform(-1, 1) for _ in range(n + 8)]
    # lissage
    for _ in range(smooth):
        ys = [(ys[max(0, i - 1)] + ys[i] * 2 + ys[min(len(ys) - 1, i + 1)]) / 4 for i in range(len(ys))]
    pts = []
    for i in range(n):
        x = x0 + i * step
        y = base + ys[i] * amp + math.sin(i * 0.11 + amp) * amp * rough
        pts.append(f'{f(x)},{f(y)}')
    return f'M{f(x0)},{bottom} L' + ' '.join(pts) + f' {f(x1)},{bottom} Z'

def wave_line(x0, x1, base, amp, freq, phase=0, step=10, bottom=None):
    pts = []
    x = x0
    while x <= x1:
        pts.append(f'{f(x)},{f(base + amp * math.sin(x * freq + phase))}')
        x += step
    d = 'M' + ' L'.join(pts)
    if bottom is not None:
        d = f'M{f(x0)},{bottom} L' + ' '.join(pts) + f' {f(x1)},{bottom} Z'
    return d

def stars(rng, n, x0, y0, x1, y1, rmin=.6, rmax=1.8, color='#fff', omin=.3, omax=.9):
    return ''.join(f'<circle cx="{f(rng.uniform(x0, x1))}" cy="{f(rng.uniform(y0, y1))}" r="{f(rng.uniform(rmin, rmax))}" fill="{color}" opacity="{rng.uniform(omin, omax):.2f}"/>' for _ in range(n))

VIGNETTE = rad('vig', [(0.55, '#000', 0), (1, '#000', 0.55)], r=.75)
def vignette(w=1600, h=900):
    return f'<rect width="{w}" height="{h}" fill="url(#vig)"/>'

def poly(pts):
    return 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in pts) + ' Z'


OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ui', 'img')
TAU = math.tau


def blob(rng, cx, cy, rx, ry, color, op, blur=40):
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{color}" opacity="{op:.2f}" filter="url(#b{blur})"/>'


def flare(x, y, r, color='#fff', op=.9):
    return (f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * 3)}" fill="{color}" opacity="{op * .18:.2f}" filter="url(#b6)"/>'
            f'<path d="M{f(x)},{f(y - r * 4)} L{f(x + r * .5)},{f(y)} L{f(x)},{f(y + r * 4)} L{f(x - r * .5)},{f(y)} Z" fill="{color}" opacity="{op:.2f}"/>'
            f'<path d="M{f(x - r * 4)},{f(y)} L{f(x)},{f(y + r * .5)} L{f(x + r * 4)},{f(y)} L{f(x)},{f(y - r * .5)} Z" fill="{color}" opacity="{op:.2f}"/>'
            f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{color}"/>')


def pine(x, y, h, color, snow=None):
    w = h * .34
    d = (f'M{f(x)},{f(y - h)} L{f(x + w * .5)},{f(y - h * .55)} L{f(x + w * .3)},{f(y - h * .55)} L{f(x + w * .75)},{f(y - h * .15)} '
         f'L{f(x + w * .1)},{f(y - h * .15)} L{f(x + w * .1)},{f(y)} L{f(x - w * .1)},{f(y)} L{f(x - w * .1)},{f(y - h * .15)} '
         f'L{f(x - w * .75)},{f(y - h * .15)} L{f(x - w * .3)},{f(y - h * .55)} L{f(x - w * .5)},{f(y - h * .55)} Z')
    s = f'<path d="{d}" fill="{color}"/>'
    if snow:
        s += f'<path d="M{f(x)},{f(y - h)} L{f(x + w * .28)},{f(y - h * .72)} L{f(x - w * .28)},{f(y - h * .72)} Z" fill="{snow}" opacity=".85"/>'
        s += f'<path d="M{f(x - w * .5)},{f(y - h * .52)} L{f(x + w * .5)},{f(y - h * .52)} L{f(x + w * .2)},{f(y - h * .46)} L{f(x - w * .2)},{f(y - h * .46)} Z" fill="{snow}" opacity=".6"/>'
    return s


def transparent(w, h, defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><defs>{FILTERS}{defs}</defs>{body}</svg>'


# ================================================================ FONDS

def nebula():
    rng = random.Random(101)
    defs = lin('sky', [(0, '#04020c', None), (.5, '#0c0622', None), (1, '#150a2c', None)]) + VIGNETTE
    defs += rad('planet', [(0, '#7a5cff', None), (.6, '#3a2290', None), (1, '#120838', None)], cx=.35, cy=.3, r=.8)
    defs += lin('ring', [(0, '#ffd9a0', .1), (.5, '#ffe7c0', .75), (1, '#ffd9a0', .1)], x2=1, y2=0)
    defs += rad('gal', [(0, '#fff3dc', .9), (.3, '#ffb0e0', .35), (1, '#ffb0e0', 0)])
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    for cx, cy, rx, ry, col, op in [(420, 300, 520, 260, '#c03aa8', .38), (980, 420, 640, 300, '#3a6aff', .3), (1260, 220, 380, 200, '#3fe0d0', .22),
                                    (700, 620, 520, 220, '#7a3cff', .3), (220, 700, 360, 180, '#ff5a8a', .18)]:
        b += blob(rng, cx, cy, rx, ry, col, op)
    for k in range(70):
        b += blob(rng, rng.uniform(100, 1500), rng.uniform(80, 800), rng.uniform(30, 120), rng.uniform(20, 70), rng.choice(['#ff8ad8', '#8ab8ff', '#9affe8', '#c8a0ff']), rng.uniform(.04, .12), 20)
    b += stars(rng, 380, 0, 0, 1600, 900, .4, 1.5, '#fff', .2, .9)
    for k in range(9):
        b += flare(rng.uniform(80, 1520), rng.uniform(60, 760), rng.uniform(1.6, 3.2), rng.choice(['#fff', '#dff0ff', '#ffe8f6']), .85)
    # galaxie lointaine
    b += '<g transform="translate(1320 640) rotate(-24)"><ellipse rx="120" ry="34" fill="url(#gal)"/><ellipse rx="40" ry="14" fill="#fff6e8" opacity=".7"/></g>'
    # planète à anneaux
    b += '<g transform="translate(250 760)"><ellipse rx="330" ry="62" fill="none" stroke="url(#ring)" stroke-width="16" transform="rotate(-12)" opacity=".75"/>'
    b += '<circle r="190" fill="url(#planet)"/><path d="M-190,0 A190,190 0 0 0 190,0" fill="#000" opacity=".28"/>'
    b += '<path d="M-330,-14 A330,62 0 0 0 330,14" fill="none" stroke="url(#ring)" stroke-width="16" transform="rotate(-12)"/></g>'
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_nebula():
    rng = random.Random(102)
    b = ''
    for k in range(18):
        b += blob(rng, rng.uniform(0, 2000), rng.uniform(0, 900), rng.uniform(120, 320), rng.uniform(60, 160),
                  rng.choice(['#e04ac0', '#4a7aff', '#4ff0dc', '#9a5cff', '#ff7ab0']), rng.uniform(.12, .26))
    return transparent(2000, 900, '', b)


def tempest():
    rng = random.Random(111)
    defs = lin('sky', [(0, '#03060b', None), (.45, '#0b1824', None), (.62, '#14303a', None)]) + VIGNETTE
    defs += lin('sea', [(0, '#0d2a33', None), (1, '#02080b', None)])
    defs += lin('tent', [(0, '#3a1a30', None), (1, '#12060e', None)], x2=1, y2=0)
    defs += rad('lamp', [(0, '#fff3c0', 1), (.4, '#ffd27a', .5), (1, '#ffd27a', 0)])
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    for k in range(50):
        x, y = rng.uniform(-100, 1700), rng.uniform(-40, 360)
        b += blob(rng, x, y, rng.uniform(120, 320), rng.uniform(40, 110), rng.choice(['#1a2a36', '#0a141c', '#26404c']), rng.uniform(.5, .9), 20)
        b += blob(rng, x, y + 30, rng.uniform(80, 200), rng.uniform(16, 40), '#4a6a7a', rng.uniform(.08, .2), 10)
    # phare
    b += '<path d="M1380,600 L1400,430 L1430,430 L1450,600 Z" fill="#0a1014"/><rect x="1396" y="410" width="38" height="24" fill="#141c22"/>'
    b += '<path d="M1392,410 L1415,384 L1438,410 Z" fill="#0a1014"/><circle cx="1415" cy="422" r="40" fill="url(#lamp)"/>'
    b += '<path d="M1340,600 L1500,600 L1520,640 L1320,640 Z" fill="#05090c"/>'
    # mer agitée
    for i, (base, amp, col) in enumerate([(560, 16, '#123440'), (610, 22, '#0e2a34'), (680, 28, '#0a2028'), (770, 34, '#061418')]):
        b += f'<path d="{wave_line(-20, 1620, base, amp, .012 + i * .003, i * 1.3, step=12, bottom=900)}" fill="{col}"/>'
        for k in range(26):
            x = rng.uniform(0, 1600)
            b += f'<path d="M{f(x)},{f(base - amp * .6)} q{f(rng.uniform(10, 30))},{f(-rng.uniform(6, 14))} {f(rng.uniform(30, 70))},0" stroke="#bfe0e8" stroke-width="2" fill="none" opacity="{rng.uniform(.15, .4):.2f}"/>'
    # navire penché
    b += '<g transform="translate(520 610) rotate(-9)"><path d="M-120,0 L120,0 L90,40 L-90,40 Z" fill="#05090c"/>'
    b += '<rect x="-6" y="-200" width="8" height="200" fill="#05090c"/><rect x="60" y="-150" width="6" height="150" fill="#05090c"/>'
    b += '<path d="M2,-190 Q60,-130 2,-60 Z" fill="#1a2630"/><path d="M66,-140 Q110,-100 66,-50 Z" fill="#1a2630"/></g>'
    # tentacules du kraken
    for x0, h, lean, w in [(820, 380, 1, 34), (930, 300, -1, 28), (1100, 420, -1, 38), (700, 240, 1, 22)]:
        y0 = 720
        d = f'M{x0 - w},{y0} C{x0 - w + lean * 80},{y0 - h * .4} {x0 + lean * 140},{y0 - h * .7} {x0 + lean * 60},{y0 - h} '
        d += f'C{x0 + lean * 20},{y0 - h * 1.05} {x0 + lean * 110},{y0 - h * .72} {x0 + w * .3 + lean * 30},{y0 - h * .45} '
        d += f'C{x0 + w},{y0 - h * .2} {x0 + w},{y0 - 40} {x0 + w},{y0} Z'
        b += f'<path d="{d}" fill="url(#tent)"/>'
        for k in range(7):
            t = .15 + k * .1
            yy = y0 - h * t
            xx = x0 + lean * (40 + 60 * t) - w * .1
            b += f'<circle cx="{f(xx)}" cy="{f(yy)}" r="{f(w * .18 * (1 - t * .5))}" fill="#c87aa8" opacity=".45"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_bolt():
    rng = random.Random(112)
    b = ''
    for x0, scale in [(300, 1), (1100, .8)]:
        pts = [(x0, 0)]
        x, y = x0, 0
        while y < 520 * scale:
            x += rng.uniform(-50, 50)
            y += rng.uniform(30, 60)
            pts.append((x, y))
        d = 'M' + ' L'.join(f'{f(px)},{f(py)}' for px, py in pts)
        b += f'<path d="{d}" stroke="#bfe6ff" stroke-width="16" fill="none" opacity=".35" filter="url(#b10)"/>'
        b += f'<path d="{d}" stroke="#ffffff" stroke-width="4" fill="none" stroke-linejoin="bevel"/>'
        for k in range(3):
            i = rng.randrange(2, len(pts) - 2)
            bx, by = pts[i]
            d2 = f'M{f(bx)},{f(by)} l{f(rng.uniform(-90, 90))},{f(rng.uniform(40, 90))} l{f(rng.uniform(-40, 40))},{f(rng.uniform(30, 60))}'
            b += f'<path d="{d2}" stroke="#e8f6ff" stroke-width="2.2" fill="none"/>'
    return transparent(1600, 900, '', b)


def fx_beam():
    """Faisceau du phare, tourné autour de son extrémité gauche (le phare)."""
    defs = lin('bm', [(0, '#fff3c0', .75), (1, '#fff3c0', 0)], x2=1, y2=0)
    return transparent(1000, 200, defs, '<path d="M0,100 L1000,30 L1000,170 Z" fill="url(#bm)" filter="url(#b6)"/>')


def spirits():
    rng = random.Random(121)
    defs = lin('sky', [(0, '#020806', None), (.6, '#06140f', None), (1, '#0a1e16', None)]) + VIGNETTE
    defs += lin('trunk', [(0, '#0e1a14', None), (.5, '#1a2a20', None), (1, '#08100c', None)], x2=1, y2=0)
    defs += rad('glow', [(0, '#8affd8', .7), (1, '#8affd8', 0)])
    defs += rad('moon', [(0, '#f4fff6', 1), (.5, '#c8f4dc', .5), (1, '#c8f4dc', 0)])
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    b += '<circle cx="800" cy="210" r="150" fill="url(#moon)" opacity=".7"/><circle cx="800" cy="210" r="62" fill="#eafff2" opacity=".9"/>'
    b += stars(rng, 80, 0, 0, 1600, 360, .4, 1.2, '#dfffee', .2, .7)
    # brume
    for k in range(10):
        b += blob(rng, rng.uniform(0, 1600), rng.uniform(420, 760), rng.uniform(200, 420), rng.uniform(30, 70), '#9affd8', rng.uniform(.04, .1))
    # arbres lointains
    for k in range(40):
        x = rng.uniform(-40, 1640)
        b += pine(x, 700, rng.uniform(160, 320), '#061410')
    # sanctuaire : arche de pierre et runes
    b += '<path d="M640,760 L660,430 L700,430 L712,760 Z" fill="#0c1a14"/><path d="M888,760 L900,430 L940,430 L960,760 Z" fill="#0c1a14"/>'
    b += '<path d="M600,440 Q800,330 1000,440 L1000,470 Q800,370 600,470 Z" fill="#12241c"/>'
    for k, (x, y) in enumerate([(680, 520), (680, 600), (920, 520), (920, 600), (800, 410)]):
        b += f'<circle cx="{x}" cy="{y}" r="22" fill="url(#glow)"/><path d="M{x},{y - 10} l7,10 l-7,10 l-7,-10 Z" fill="#c8ffe8"/>'
    b += '<ellipse cx="800" cy="700" rx="120" ry="40" fill="url(#glow)" opacity=".7"/>'
    # grands arbres
    for x, w, lean in [(140, 120, -1), (330, 70, 1), (1270, 80, -1), (1470, 130, 1)]:
        b += f'<path d="M{x - w},{900} C{x - w * .6},700 {x - w * .4 + lean * 40},400 {x - w * .2 + lean * 60},-20 L{x + w * .3 + lean * 60},-20 C{x + w * .4 + lean * 40},400 {x + w * .6},700 {x + w},{900} Z" fill="url(#trunk)"/>'
        for k in range(6):
            yy = rng.uniform(150, 800)
            b += f'<path d="M{f(x - w * .3)},{f(yy)} q{f(w * .3)},{f(-20)} {f(w * .6)},0" stroke="#2a4a38" stroke-width="3" fill="none" opacity=".6"/>'
    # sol, mousse et champignons lumineux
    b += f'<path d="{ridge(rng, -40, 1640, 770, 18, step=16, smooth=3, bottom=900)}" fill="#04100b"/>'
    for k in range(40):
        x = rng.uniform(0, 1600)
        y = rng.uniform(780, 880)
        s = rng.uniform(6, 16)
        col = rng.choice(['#7affd0', '#a8ff8a', '#7ad8ff'])
        b += f'<ellipse cx="{f(x)}" cy="{f(y - s)}" rx="{f(s)}" ry="{f(s * .55)}" fill="{col}" opacity=".75"/><rect x="{f(x - 1.5)}" y="{f(y - s)}" width="3" height="{f(s)}" fill="#d8ffe8" opacity=".5"/>'
        b += f'<circle cx="{f(x)}" cy="{f(y - s)}" r="{f(s * 2.4)}" fill="{col}" opacity=".12" filter="url(#b6)"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def crystal():
    rng = random.Random(131)
    defs = lin('cave', [(0, '#05030e', None), (.6, '#0d0a26', None), (1, '#120c30', None)]) + VIGNETTE
    defs += lin('pool', [(0, '#3a6aff', .5), (1, '#0a0a30', .9)])
    cols = [('#c8b8ff', '#5a3cff'), ('#9ae8ff', '#2a6aff'), ('#ffb8f0', '#a83cd8')]
    for i, (a, c) in enumerate(cols):
        defs += lin(f'cr{i}', [(0, a, .95), (.5, c, .8), (1, '#0a0620', .9)], x2=1, y2=1)
        defs += lin(f'cs{i}', [(0, '#ffffff', .7), (1, a, .1)], x2=1, y2=1)
    defs += rad('gl', [(0, '#b8a8ff', .55), (1, '#b8a8ff', 0)])
    b = '<rect width="1600" height="900" fill="url(#cave)"/>'
    b += '<ellipse cx="800" cy="520" rx="700" ry="380" fill="url(#gl)" opacity=".6"/>'

    def crystal_at(x, y, h, w, ang, ci):
        a = math.radians(ang)
        dx, dy = math.sin(a), -math.cos(a)
        px, py = -dy, dx
        tip = (x + dx * h, y + dy * h)
        s1 = (x + px * w, y + py * w)
        s2 = (x - px * w, y - py * w)
        m1 = (x + px * w + dx * h * .8, y + py * w + dy * h * .8)
        m2 = (x - px * w + dx * h * .8, y - py * w + dy * h * .8)
        out = f'<path d="{poly([s1, m1, tip, m2, s2])}" fill="url(#cr{ci})"/>'
        out += f'<path d="{poly([(x, y), (x + dx * h * .8, y + dy * h * .8), tip, m1, s1])}" fill="url(#cs{ci})" opacity=".55"/>'
        out += f'<path d="M{f(x)},{f(y)} L{f(tip[0])},{f(tip[1])}" stroke="#fff" stroke-width="1.4" opacity=".5"/>'
        return out
    # plafond
    for k in range(26):
        x = rng.uniform(-40, 1640)
        b += crystal_at(x, -10, rng.uniform(80, 220), rng.uniform(16, 40), 180 + rng.uniform(-20, 20), rng.randrange(3))
    # amas du sol
    for cx, n, sc in [(300, 9, 1.2), (800, 12, 1.6), (1320, 9, 1.2), (560, 5, .8), (1060, 5, .8)]:
        for k in range(n):
            b += crystal_at(cx + rng.uniform(-110, 110) * sc, 760 + rng.uniform(-10, 20), rng.uniform(120, 320) * sc, rng.uniform(20, 46) * sc, rng.uniform(-35, 35), rng.randrange(3))
    b += f'<path d="{ridge(rng, -40, 1640, 770, 20, step=16, bottom=900)}" fill="#07051a"/>'
    b += '<ellipse cx="800" cy="830" rx="520" ry="46" fill="url(#pool)"/>'
    for k in range(20):
        b += f'<rect x="{f(rng.uniform(320, 1280))}" y="{f(rng.uniform(800, 860))}" width="{f(rng.uniform(20, 80))}" height="1.6" fill="#cfe0ff" opacity="{rng.uniform(.15, .4):.2f}"/>'
    b += stars(rng, 120, 0, 0, 1600, 900, .6, 1.8, '#e8e0ff', .2, .8)
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_shards():
    rng = random.Random(132)
    defs = lin('sh', [(0, '#ffffff', .95), (.5, '#b8a8ff', .8), (1, '#5a3cff', .6)], x2=1, y2=1)
    b = ''
    for k in range(14):
        x, y = rng.uniform(60, 1540), rng.uniform(100, 640)
        s = rng.uniform(10, 26)
        a = rng.uniform(0, 360)
        b += f'<g transform="translate({f(x)} {f(y)}) rotate({f(a)})"><path d="M0,{f(-s * 2)} L{f(s * .6)},0 L0,{f(s * 1.4)} L{f(-s * .6)},0 Z" fill="url(#sh)"/>'
        b += f'<circle r="{f(s * 2.2)}" fill="#b8a8ff" opacity=".18" filter="url(#b6)"/></g>'
    return transparent(1600, 900, defs, b)


def inferno():
    rng = random.Random(141)
    defs = lin('sky', [(0, '#070102', None), (.5, '#1c0504', None), (.8, '#3a0a04', None)]) + VIGNETTE
    defs += lin('lava', [(0, '#fff2a8', None), (.3, '#ffb02e', None), (.7, '#e0461a', None), (1, '#5a0c04', None)])
    defs += rad('eye', [(0, '#fff2a8', 1), (.4, '#ff6a1a', .8), (1, '#ff3a0a', 0)])
    defs += rad('heat', [(0, '#ff7a2a', .55), (1, '#ff3a0a', 0)], cy=.8)
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    b += '<ellipse cx="800" cy="900" rx="1000" ry="520" fill="url(#heat)"/>'
    for k in range(30):
        b += blob(rng, rng.uniform(0, 1600), rng.uniform(0, 400), rng.uniform(140, 300), rng.uniform(40, 90), rng.choice(['#2a0806', '#140404', '#4a1208']), rng.uniform(.4, .8), 20)
    # porte démoniaque
    b += '<path d="M520,700 L560,260 Q800,120 1040,260 L1080,700 Z" fill="#0a0303"/>'
    b += '<path d="M600,700 L630,320 Q800,210 970,320 L1000,700 Z" fill="#1a0404"/>'
    b += '<path d="M660,700 L680,380 Q800,300 920,380 L940,700 Z" fill="url(#lava)" opacity=".35"/>'
    b += '<circle cx="740" cy="300" r="26" fill="url(#eye)"/><circle cx="860" cy="300" r="26" fill="url(#eye)"/>'
    b += '<path d="M540,270 Q470,160 520,60 Q540,170 600,230 Z" fill="#0a0303"/><path d="M1060,270 Q1130,160 1080,60 Q1060,170 1000,230 Z" fill="#0a0303"/>'
    # pics d'obsidienne
    for k in range(18):
        x = rng.uniform(-40, 1640)
        if 480 < x < 1120:
            continue
        h = rng.uniform(160, 420)
        w = rng.uniform(30, 70)
        b += f'<path d="M{f(x - w)},760 L{f(x + rng.uniform(-20, 20))},{f(760 - h)} L{f(x + w)},760 Z" fill="#070202"/>'
        b += f'<path d="M{f(x - w * .2)},760 L{f(x)},{f(760 - h)} L{f(x + w * .1)},760 Z" fill="#ff5a1a" opacity=".12"/>'
    # mer de lave
    b += '<rect y="740" width="1600" height="160" fill="url(#lava)"/>'
    for k in range(60):
        x = rng.uniform(0, 1600)
        y = rng.uniform(750, 890)
        b += f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rng.uniform(20, 90))}" ry="{f(rng.uniform(3, 8))}" fill="#2a0604" opacity="{rng.uniform(.3, .7):.2f}"/>'
    for k in range(30):
        b += f'<circle cx="{f(rng.uniform(0, 1600))}" cy="{f(rng.uniform(750, 890))}" r="{f(rng.uniform(2, 6))}" fill="#fff2a8" opacity=".8"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_flames():
    rng = random.Random(142)
    defs = lin('fl', [(0, '#fff2a8', 0), (.3, '#ffd27a', .7), (.7, '#ff6a1a', .8), (1, '#e0261a', .9)])
    b = ''
    for k in range(46):
        x = rng.uniform(-20, 1620)
        h = rng.uniform(60, 180)
        w = rng.uniform(16, 44)
        b += f'<path d="M{f(x - w)},300 Q{f(x - w * .8)},{f(300 - h * .5)} {f(x + rng.uniform(-10, 10))},{f(300 - h)} Q{f(x + w * .8)},{f(300 - h * .5)} {f(x + w)},300 Z" fill="url(#fl)" opacity="{rng.uniform(.5, .9):.2f}"/>'
    return transparent(1600, 300, defs, b)


def chrono():
    rng = random.Random(151)
    defs = lin('sky', [(0, '#02080a', None), (.6, '#06161a', None), (1, '#0a2024', None)]) + VIGNETTE
    defs += rad('dial', [(0, '#f4ead0', None), (.7, '#d8c89a', None), (1, '#9a8458', None)])
    defs += lin('brass', [(0, '#f6d78f', None), (.5, '#c8963c', None), (1, '#6a4a1a', None)], x2=1, y2=1)
    defs += rad('halo', [(0, '#7affe8', .5), (1, '#7affe8', 0)])
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    b += stars(rng, 200, 0, 0, 1600, 900, .4, 1.4, '#dffff8', .2, .7)
    b += '<circle cx="800" cy="450" r="420" fill="url(#halo)"/>'
    # rouages fixes de fond
    for x, y, r in [(220, 220, 140), (1380, 260, 170), (260, 700, 120), (1360, 720, 150), (520, 120, 70), (1100, 110, 80)]:
        b += gear(x, y, r, '#0e2428', '#1c3a3e', 18)
    # cadran
    b += '<circle cx="800" cy="450" r="250" fill="url(#brass)"/><circle cx="800" cy="450" r="226" fill="url(#dial)"/>'
    b += '<circle cx="800" cy="450" r="214" fill="none" stroke="#6a4a1a" stroke-width="2"/>'
    numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    for k in range(60):
        a = k / 60 * TAU - math.pi / 2
        r0 = 196 if k % 5 else 186
        b += f'<path d="M{f(800 + r0 * math.cos(a))},{f(450 + r0 * math.sin(a))} L{f(800 + 210 * math.cos(a))},{f(450 + 210 * math.sin(a))}" stroke="#3a2a10" stroke-width="{3 if k % 5 == 0 else 1.2}"/>'
    for k, n in enumerate(numerals):
        a = k / 12 * TAU - math.pi / 2
        b += f'<text x="{f(800 + 160 * math.cos(a))}" y="{f(450 + 160 * math.sin(a) + 9)}" font-family="Georgia, serif" font-size="28" font-weight="700" text-anchor="middle" fill="#3a2a10">{n}</text>'
    b += '<circle cx="800" cy="450" r="70" fill="none" stroke="#8a6a3a" stroke-width="2" opacity=".6"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def gear(x, y, r, fill, stroke, teeth):
    pts = []
    for k in range(teeth * 2):
        a0 = k / (teeth * 2) * TAU
        a1 = (k + 1) / (teeth * 2) * TAU
        rr = r if k % 2 == 0 else r * .86
        pts += [(x + rr * math.cos(a0), y + rr * math.sin(a0)), (x + rr * math.cos(a1), y + rr * math.sin(a1))]
    s = f'<path d="{poly(pts)}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
    s += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * .62)}" fill="none" stroke="{stroke}" stroke-width="{f(max(2, r * .05))}"/>'
    for k in range(5):
        a = k / 5 * TAU
        s += f'<path d="M{f(x + r * .18 * math.cos(a))},{f(y + r * .18 * math.sin(a))} L{f(x + r * .6 * math.cos(a))},{f(y + r * .6 * math.sin(a))}" stroke="{stroke}" stroke-width="{f(max(3, r * .08))}"/>'
    s += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * .16)}" fill="{stroke}"/>'
    return s


def fx_gear(color='#c8963c', edge='#f6d78f'):
    return transparent(400, 400, '', gear(200, 200, 190, color, edge, 16).replace('<path d="M', '<path opacity=".95" d="M', 1))


def fx_hands():
    b = '<path d="M500,500 L500,300" stroke="#2a1a08" stroke-width="10" stroke-linecap="round"/>'
    b += '<path d="M500,500 L500,520" stroke="#2a1a08" stroke-width="10" stroke-linecap="round"/>'
    b += '<path d="M500,300 l-12,24 l24,0 Z" fill="#2a1a08"/><circle cx="500" cy="500" r="14" fill="#c8963c" stroke="#2a1a08" stroke-width="3"/>'
    return transparent(1000, 1000, '', b)


def fx_hourhand():
    b = '<path d="M500,500 L500,370" stroke="#2a1a08" stroke-width="16" stroke-linecap="round"/><path d="M500,370 l-16,28 l32,0 Z" fill="#2a1a08"/>'
    return transparent(1000, 1000, '', b)


def leyline():
    rng = random.Random(161)
    defs = lin('sky', [(0, '#05030e', None), (.55, '#120a2a', None), (.75, '#1a1036', None)]) + VIGNETTE
    defs += lin('ground', [(0, '#0e0a1e', None), (1, '#04020a', None)])
    defs += rad('core', [(0, '#c8fff8', 1), (.3, '#5affe8', .7), (1, '#5affe8', 0)])
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    b += stars(rng, 260, 0, 0, 1600, 520, .4, 1.5, '#e8f4ff', .2, .8)
    b += f'<path d="{ridge(rng, -40, 1640, 520, 50, step=18, bottom=900)}" fill="#0a0818"/>'
    b += '<rect y="560" width="1600" height="340" fill="url(#ground)"/>'
    # lignes telluriques qui convergent vers le menhir
    for k in range(16):
        a = math.pi + k / 15 * math.pi
        x1, y1 = 800 + 1100 * math.cos(a), 640 - 300 * math.sin(a) * -1
        pts = []
        for t in range(13):
            tt = t / 12
            px = 800 + (x1 - 800) * tt + rng.uniform(-14, 14)
            py = 640 + (min(900, 640 + abs(y1 - 640)) - 640) * tt * .9 + rng.uniform(-8, 8)
            pts.append((px, py))
        d = 'M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in pts)
        b += f'<path d="{d}" stroke="#5affe8" stroke-width="6" fill="none" opacity=".18" filter="url(#b6)"/><path d="{d}" stroke="#bffff6" stroke-width="1.6" fill="none" opacity=".7"/>'
    # pierres levées
    for k in range(9):
        a = k / 9 * TAU
        x, y = 800 + 380 * math.cos(a), 640 + 90 * math.sin(a)
        h = 120 if y > 640 else 90
        w = 26 if y > 640 else 20
        b += f'<path d="M{f(x - w)},{f(y)} L{f(x - w * .7)},{f(y - h)} L{f(x + w * .6)},{f(y - h * 1.05)} L{f(x + w)},{f(y)} Z" fill="#141028"/>'
        b += f'<path d="M{f(x - w * .2)},{f(y - h * .3)} l6,-14 l6,14 Z" fill="#7affee" opacity=".8"/>'
    # menhir central
    b += '<circle cx="800" cy="470" r="160" fill="url(#core)" opacity=".55"/>'
    b += '<path d="M760,650 L772,330 L800,300 L830,332 L842,650 Z" fill="#100c22"/>'
    for k in range(5):
        b += f'<path d="M{790 + k % 2 * 10},{560 - k * 50} l10,-16 l10,16 l-10,16 Z" fill="#9affee"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_leyring():
    c = 500
    b = ''
    for r, w, op in [(480, 3, .7), (462, 1.2, .5), (360, 2.4, .6), (200, 1.6, .5)]:
        b += f'<circle cx="{c}" cy="{c}" r="{r}" fill="none" stroke="#7affee" stroke-width="{w}" opacity="{op}"/>'
    glyphs = ['M0,-14 L0,14 M-8,-6 L8,6', 'M-8,-14 L8,0 L-8,14', 'M0,-14 L-9,0 L0,14 L9,0 Z', 'M-8,-14 L-8,14 M-8,-14 L8,-4 L-8,6', 'M-9,-12 L9,12 M9,-12 L-9,12']
    for k in range(32):
        a = k / 32 * TAU
        b += f'<path d="{glyphs[k % 5]}" transform="translate({f(c + 412 * math.cos(a))} {f(c + 412 * math.sin(a))}) rotate({f(math.degrees(a) + 90)}) scale(1.5)" stroke="#c8fff8" stroke-width="2" fill="none" stroke-linecap="round"/>'
    for k in range(6):
        a = k / 6 * TAU
        b += f'<path d="M{f(c + 200 * math.cos(a))},{f(c + 200 * math.sin(a))} L{f(c + 360 * math.cos(a + TAU / 12))},{f(c + 360 * math.sin(a + TAU / 12))}" stroke="#7affee" stroke-width="1.6" opacity=".6"/>'
    return transparent(1000, 1000, '', b)


def reef():
    rng = random.Random(171)
    defs = lin('sea', [(0, '#0a4a6a', None), (.4, '#06283e', None), (1, '#020a14', None)]) + VIGNETTE
    defs += lin('ray', [(0, '#bff6ff', .35), (1, '#bff6ff', 0)])
    defs += lin('sand', [(0, '#1a2a2a', None), (1, '#060c0e', None)])
    b = '<rect width="1600" height="900" fill="url(#sea)"/>'
    for k in range(9):
        x = rng.uniform(100, 1500)
        w = rng.uniform(30, 90)
        b += f'<path d="M{f(x - w)},0 L{f(x + w)},0 L{f(x + w * 3 + 120)},900 L{f(x + w + 120)},900 Z" fill="url(#ray)" opacity="{rng.uniform(.3, .7):.2f}" filter="url(#b10)"/>'
    for k in range(40):
        b += f'<circle cx="{f(rng.uniform(0, 1600))}" cy="{f(rng.uniform(0, 700))}" r="{f(rng.uniform(1, 3))}" fill="#bff6ff" opacity="{rng.uniform(.1, .4):.2f}"/>'
    b += f'<path d="{ridge(rng, -40, 1640, 760, 30, step=16, bottom=900)}" fill="url(#sand)"/>'
    # algues
    for k in range(36):
        x = rng.uniform(0, 1600)
        h = rng.uniform(120, 360)
        sway = rng.uniform(-40, 40)
        b += f'<path d="M{f(x)},800 C{f(x + sway)},{f(800 - h * .4)} {f(x - sway)},{f(800 - h * .7)} {f(x + sway * .5)},{f(800 - h)}" stroke="#0e3a30" stroke-width="{f(rng.uniform(4, 10))}" fill="none" stroke-linecap="round"/>'
    # coraux lumineux
    def coral(x, y, s, col, depth=0):
        out = ''
        if depth > 3:
            return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(3 + s * .04)}" fill="{col}"/><circle cx="{f(x)}" cy="{f(y)}" r="{f(10 + s * .1)}" fill="{col}" opacity=".25" filter="url(#b6)"/>'
        for k in range(2 + (depth < 2)):
            a = -math.pi / 2 + rng.uniform(-.7, .7)
            l = s * rng.uniform(.5, .8)
            x2, y2 = x + l * math.cos(a), y + l * math.sin(a)
            out += f'<path d="M{f(x)},{f(y)} L{f(x2)},{f(y2)}" stroke="#2a0e2a" stroke-width="{f(max(2, 12 - depth * 3))}" stroke-linecap="round"/>'
            out += coral(x2, y2, s * .7, col, depth + 1)
        return out
    for x, col in [(180, '#ff7ad8'), (420, '#7affd0'), (700, '#ffd27a'), (980, '#7ad8ff'), (1240, '#ff9a7a'), (1460, '#c8a0ff')]:
        b += coral(x + rng.uniform(-40, 40), 800, rng.uniform(120, 180), col)
    # rochers
    for k in range(14):
        x = rng.uniform(0, 1600)
        b += f'<ellipse cx="{f(x)}" cy="{f(rng.uniform(820, 880))}" rx="{f(rng.uniform(40, 120))}" ry="{f(rng.uniform(20, 50))}" fill="#081416"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_jelly():
    defs = rad('bell', [(0, '#ffd8ff', .85), (.6, '#d07aff', .5), (1, '#7a5aff', .15)], cy=.35)
    b = '<path d="M50,80 Q50,10 100,10 Q150,10 150,80 Q125,72 100,80 Q75,72 50,80 Z" fill="url(#bell)"/>'
    b += '<circle cx="100" cy="50" r="70" fill="#e8a8ff" opacity=".18" filter="url(#b10)"/>'
    for k, x in enumerate([62, 78, 92, 108, 122, 138]):
        b += f'<path d="M{x},78 C{x - 8},{120} {x + 10},{150} {x - 4},{190 + k % 2 * 20}" stroke="#f0c8ff" stroke-width="2.4" fill="none" opacity=".75" stroke-linecap="round"/>'
    return transparent(200, 240, defs, b)


def fx_caustics():
    rng = random.Random(172)
    b = ''
    for k in range(60):
        x, y = rng.uniform(0, 1600), rng.uniform(0, 500)
        r = rng.uniform(30, 90)
        pts = [(x + r * math.cos(a) * rng.uniform(.7, 1.2), y + r * .5 * math.sin(a) * rng.uniform(.7, 1.2)) for a in [i / 6 * TAU for i in range(6)]]
        b += f'<path d="{poly(pts)}" fill="none" stroke="#bff6ff" stroke-width="2" opacity="{rng.uniform(.15, .35):.2f}" stroke-linejoin="round"/>'
    return transparent(1600, 500, '', b)


def eclipse():
    rng = random.Random(181)
    defs = lin('sky', [(0, '#030206', None), (.5, '#0e0712', None), (.8, '#2a1208', None), (1, '#3a1a08', None)]) + VIGNETTE
    defs += rad('cor', [(0, '#fff6dc', 1), (.42, '#ffe2a0', .9), (.5, '#ffb04a', .55), (.7, '#ff7a2a', .15), (1, '#ff7a2a', 0)])
    defs += lin('dune', [(0, '#1a0c06', None), (1, '#060302', None)])
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    b += stars(rng, 300, 0, 0, 1600, 620, .4, 1.5, '#fff4e8', .2, .85)
    b += '<circle cx="800" cy="330" r="300" fill="url(#cor)" opacity=".85"/>'
    b += '<circle cx="800" cy="330" r="128" fill="#020102"/><circle cx="800" cy="330" r="128" fill="none" stroke="#fff3d0" stroke-width="3" opacity=".9"/>'
    b += '<circle cx="912" cy="282" r="7" fill="#fff8e8"/><circle cx="912" cy="282" r="20" fill="#fff8e8" opacity=".35" filter="url(#b6)"/>'
    # plateau et temple
    b += f'<path d="{ridge(rng, -40, 1640, 640, 40, step=18, bottom=900)}" fill="#120806"/>'
    b += '<path d="M560,640 L600,520 L1000,520 L1040,640 Z" fill="#0c0504"/>'
    for k in range(8):
        x = 620 + k * 52
        b += f'<rect x="{x}" y="440" width="22" height="84" fill="#0a0403"/>'
    b += '<path d="M590,440 L800,370 L1010,440 Z" fill="#0a0403"/><rect x="590" y="432" width="420" height="12" fill="#0a0403"/>'
    b += '<path d="M800,640 L800,900" stroke="#ffb04a" stroke-width="2" opacity=".2"/>'
    b += f'<path d="{wave_line(-20, 1620, 760, 30, .006, 1, step=16, bottom=900)}" fill="url(#dune)"/>'
    b += vignette()
    return svg(1600, 900, defs, b)


def fx_corona():
    rng = random.Random(182)
    c = 500
    b = ''
    for k in range(48):
        a = k / 48 * TAU + rng.uniform(-.03, .03)
        r1 = rng.uniform(300, 480)
        w = rng.uniform(.02, .05)
        b += f'<path d="M{f(c + 150 * math.cos(a - w))},{f(c + 150 * math.sin(a - w))} L{f(c + r1 * math.cos(a))},{f(c + r1 * math.sin(a))} L{f(c + 150 * math.cos(a + w))},{f(c + 150 * math.sin(a + w))} Z" fill="#ffe2a0" opacity="{rng.uniform(.15, .45):.2f}"/>'
    return transparent(1000, 1000, '', f'<g filter="url(#b3)">{b}</g>')


def blizzard():
    rng = random.Random(191)
    defs = lin('sky', [(0, '#060a14', None), (.5, '#122036', None), (.75, '#2a3e5a', None)]) + VIGNETTE
    defs += lin('snow', [(0, '#e8f2ff', None), (1, '#9ab0cc', None)])
    defs += lin('ice', [(0, '#cfe8ff', None), (1, '#4a6a9a', None)], x2=1, y2=1)
    b = '<rect width="1600" height="900" fill="url(#sky)"/>'
    b += stars(rng, 140, 0, 0, 1600, 360, .4, 1.3, '#e8f4ff', .15, .6)
    b += '<circle cx="1260" cy="160" r="54" fill="#eef6ff" opacity=".85"/><circle cx="1260" cy="160" r="140" fill="#cfe8ff" opacity=".12" filter="url(#b20)"/>'
    b += f'<path d="{ridge(rng, -40, 1640, 430, 120, step=20, rough=.9, smooth=2, bottom=900)}" fill="#33496a"/>'
    b += f'<path d="{ridge(rng, -40, 1640, 520, 90, step=16, rough=.8, smooth=2, bottom=900)}" fill="#22344e"/>'
    # forteresse de glace
    for x, h, w in [(700, 300, 50), (800, 380, 60), (900, 300, 50), (620, 200, 36), (980, 200, 36)]:
        b += f'<path d="M{x - w},640 L{x - w},{640 - h} L{x},{640 - h - w * 1.6} L{x + w},{640 - h} L{x + w},640 Z" fill="url(#ice)"/>'
        b += f'<rect x="{x - 8}" y="{640 - h + 40}" width="16" height="30" rx="8" fill="#9ae8ff" opacity=".8"/>'
    b += '<rect x="580" y="560" width="440" height="80" fill="url(#ice)"/>'
    b += f'<path d="{ridge(rng, -40, 1640, 650, 26, step=14, bottom=900)}" fill="url(#snow)"/>'
    for k in range(46):
        x = rng.uniform(-20, 1620)
        if 520 < x < 1080:
            continue
        b += pine(x, rng.uniform(700, 860), rng.uniform(110, 240), '#0e1a2a', '#e8f2ff')
    b += vignette()
    return svg(1600, 900, defs, b)


# ================================================================ DOS DE CARTES

W, H = 630, 880
CX, CY = 315, 440
GOLD = lin('gold', [(0, '#f6d78f', None), (.55, '#d9a441', None), (1, '#8a5f22', None)], x2=1, y2=1)
CLIP = '<clipPath id="fc"><rect x="22" y="22" width="586" height="836" rx="18"/></clipPath>'


def frame(field):
    return f'<rect width="{W}" height="{H}" rx="34" fill="#0b0910"/><rect x="22" y="22" width="586" height="836" rx="18" fill="url(#{field})"/>'


def border(ink='#e6c06a', grad='gold'):
    b = f'<rect x="44" y="44" width="542" height="792" rx="12" fill="none" stroke="url(#{grad})" stroke-width="5"/>'
    b += f'<rect x="60" y="60" width="510" height="760" rx="8" fill="none" stroke="{ink}" stroke-width="1.6" opacity=".6"/>'
    corner = f'<path d="M58,128 L58,58 L128,58" fill="none" stroke="url(#{grad})" stroke-width="4"/><circle cx="88" cy="88" r="5" fill="{ink}"/>'
    for t in ['', f'translate({W} 0) scale(-1 1)', f'translate(0 {H}) scale(1 -1)', f'translate({W} {H}) scale(-1 -1)']:
        b += f'<g transform="{t}">{corner}</g>'
    return b


def back(defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><defs>{FILTERS}{GOLD}{CLIP}{defs}</defs>{body}</svg>'


def fx_card(defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}"><defs>{FILTERS}{CLIP}{defs}</defs><g clip-path="url(#fc)">{body}</g></svg>'


def b_rune():
    rng = random.Random(201)
    defs = rad('fld', [(0, '#0e3a3a', None), (.6, '#06201f', None), (1, '#020c0c', None)], r=.75)
    defs += lin('jade', [(0, '#bfffe8', None), (.5, '#3ad8a8', None), (1, '#0e5a48', None)], x2=1, y2=1)
    b = frame('fld') + stars(rng, 90, 60, 60, 570, 820, .5, 1.6, '#cffff0', .2, .7)
    b += f'<circle cx="{CX}" cy="{CY}" r="230" fill="none" stroke="url(#jade)" stroke-width="6"/>'
    b += f'<circle cx="{CX}" cy="{CY}" r="120" fill="#0a2a28" stroke="url(#jade)" stroke-width="4"/>'
    pts = []
    for k in range(10):
        a = k / 10 * TAU - math.pi / 2
        r = 110 if k % 2 == 0 else 46
        pts.append((CX + r * math.cos(a), CY + r * math.sin(a)))
    b += f'<path d="{poly(pts)}" fill="url(#jade)" opacity=".85"/><circle cx="{CX}" cy="{CY}" r="20" fill="#e8fff6"/>'
    b += border('#9affd8')
    return back(defs, b)


def fx_b_rune():
    glyphs = ['M0,-14 L0,14 M-8,-6 L8,6', 'M-8,-14 L8,0 L-8,14', 'M0,-14 L-9,0 L0,14 L9,0 Z', 'M-8,-14 L-8,14 M-8,-14 L8,-4 L-8,6', 'M-9,-12 L9,12 M9,-12 L-9,12']
    b = f'<circle cx="{CX}" cy="{CY}" r="205" fill="none" stroke="#9affd8" stroke-width="1.4" opacity=".6"/>'
    for k in range(20):
        a = k / 20 * TAU
        b += f'<path d="{glyphs[k % 5]}" transform="translate({f(CX + 176 * math.cos(a))} {f(CY + 176 * math.sin(a))}) rotate({f(math.degrees(a) + 90)}) scale(1.3)" stroke="#d8fff0" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    b += f'<circle cx="{CX}" cy="{CY}" r="150" fill="none" stroke="#9affd8" stroke-width="2" stroke-dasharray="6 14" opacity=".8"/>'
    return fx_card('', b)


def b_galaxy():
    rng = random.Random(211)
    defs = rad('fld', [(0, '#1a0e3a', None), (.6, '#0a0620', None), (1, '#04020c', None)], r=.75)
    defs += rad('core', [(0, '#fff6e8', 1), (.25, '#ffd8a0', .7), (.6, '#c07cff', .25), (1, '#c07cff', 0)])
    b = frame('fld') + '<g clip-path="url(#fc)">' + stars(rng, 220, 22, 22, 608, 858, .4, 1.6, '#fff', .2, .9)
    for k in range(30):
        b += blob(rng, rng.uniform(60, 570), rng.uniform(60, 820), rng.uniform(30, 90), rng.uniform(20, 60), rng.choice(['#7a5aff', '#ff6ac8', '#5ad8ff']), rng.uniform(.06, .16), 20)
    b += '</g>' + f'<circle cx="{CX}" cy="{CY}" r="160" fill="url(#core)"/>'
    b += border()
    return back(defs, b)


def fx_b_galaxy():
    rng = random.Random(212)
    b = ''
    for arm in range(3):
        for k in range(160):
            t = k / 160
            a = arm / 3 * TAU + t * 3.4
            r = 20 + t * 250
            x, y = CX + r * math.cos(a) + rng.uniform(-10, 10), CY + r * math.sin(a) * .92 + rng.uniform(-10, 10)
            b += f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rng.uniform(.8, 2.6) * (1.2 - t))}" fill="{rng.choice(["#fff", "#ffe8c8", "#d8c8ff", "#b8e8ff"])}" opacity="{rng.uniform(.4, .95) * (1.1 - t * .6):.2f}"/>'
        pts = [(CX + (20 + t * 250) * math.cos(arm / 3 * TAU + t * 3.4), CY + (20 + t * 250) * .92 * math.sin(arm / 3 * TAU + t * 3.4)) for t in [i / 30 for i in range(31)]]
        b += f'<path d="M' + ' L'.join(f'{f(x)},{f(y)}' for x, y in pts) + '" stroke="#c8a8ff" stroke-width="28" fill="none" opacity=".16" filter="url(#b10)" stroke-linecap="round"/>'
    return fx_card('', b)


def b_eye():
    rng = random.Random(221)
    defs = rad('fld', [(0, '#2a0a10', None), (.6, '#14040a', None), (1, '#060104', None)], r=.75)
    defs += rad('iris', [(0, '#000', None), (.18, '#000', None), (.22, '#ffd27a', None), (.55, '#e0461a', None), (.85, '#5a0c04', None), (1, '#2a0402', None)])
    defs += lin('lid', [(0, '#3a1a18', None), (1, '#120606', None)])
    b = frame('fld')
    for k in range(60):
        x, y = rng.uniform(60, 570), rng.uniform(60, 820)
        b += f'<path d="M{f(x)},{f(y)} q10,-12 20,0 q-10,12 -20,0" fill="#3a1010" opacity=".5"/>'
    b += f'<path d="M95,{CY} Q{CX},{CY - 230} 535,{CY} Q{CX},{CY + 230} 95,{CY} Z" fill="url(#lid)" stroke="url(#gold)" stroke-width="5"/>'
    b += f'<path d="M125,{CY} Q{CX},{CY - 190} 505,{CY} Q{CX},{CY + 190} 125,{CY} Z" fill="#f4e6d0"/>'
    b += f'<circle cx="{CX}" cy="{CY}" r="120" fill="url(#iris)"/>'
    b += f'<ellipse cx="{CX}" cy="{CY}" rx="16" ry="70" fill="#000"/>'
    b += f'<circle cx="{CX + 40}" cy="{CY - 50}" r="14" fill="#fff" opacity=".85"/>'
    b += border('#ff9a6a')
    return back(defs, b)


def fx_b_eye():
    defs = rad('g', [(0, '#ffd27a', .9), (.4, '#ff6a1a', .45), (1, '#ff3a0a', 0)])
    return fx_card(defs, f'<circle cx="{CX}" cy="{CY}" r="170" fill="url(#g)"/>')


def b_lava():
    rng = random.Random(231)
    defs = rad('fld', [(0, '#1a0a06', None), (1, '#050202', None)], r=.75)
    defs += rad('core', [(0, '#fff2a8', 1), (.3, '#ffb02e', .8), (.7, '#e0461a', .4), (1, '#e0461a', 0)])
    b = frame('fld') + '<g clip-path="url(#fc)">'
    for k in range(40):
        x, y = rng.uniform(20, 610), rng.uniform(20, 860)
        r = rng.uniform(30, 90)
        pts = [(x + r * math.cos(a) * rng.uniform(.7, 1.1), y + r * math.sin(a) * rng.uniform(.7, 1.1)) for a in [i / 7 * TAU for i in range(7)]]
        b += f'<path d="{poly(pts)}" fill="#120806" stroke="#2a1008" stroke-width="2"/>'
    b += '</g>' + f'<circle cx="{CX}" cy="{CY}" r="110" fill="url(#core)"/>'
    b += border('#ffb04a')
    return back(defs, b)


def fx_b_cracks():
    rng = random.Random(232)
    b = ''
    for k in range(14):
        a = k / 14 * TAU + rng.uniform(-.1, .1)
        x, y = CX, CY
        d = f'M{f(x)},{f(y)}'
        for s in range(8):
            a += rng.uniform(-.4, .4)
            step = rng.uniform(30, 60)
            x, y = x + step * math.cos(a), y + step * math.sin(a)
            d += f' L{f(x)},{f(y)}'
        b += f'<path d="{d}" stroke="#ff8a2a" stroke-width="9" fill="none" opacity=".5" filter="url(#b6)"/><path d="{d}" stroke="#ffd27a" stroke-width="2.6" fill="none" stroke-linejoin="round"/>'
    return fx_card('', b)


def b_storm():
    rng = random.Random(241)
    defs = lin('fld', [(0, '#0a1420', None), (.6, '#142a3a', None), (1, '#060c14', None)])
    defs += lin('silv', [(0, '#e8f4ff', None), (.5, '#9ab8d8', None), (1, '#4a6a8a', None)], x2=1, y2=1)
    b = frame('fld') + '<g clip-path="url(#fc)">'
    for k in range(40):
        b += blob(rng, rng.uniform(0, 630), rng.uniform(0, 500), rng.uniform(60, 160), rng.uniform(30, 70), rng.choice(['#1a2a3a', '#2a3e52', '#0e1a26']), rng.uniform(.6, .95), 20)
    for k in range(80):
        x = rng.uniform(20, 610)
        y = rng.uniform(300, 860)
        b += f'<path d="M{f(x)},{f(y)} l-6,22" stroke="#9ab8d8" stroke-width="1.4" opacity="{rng.uniform(.2, .5):.2f}"/>'
    b += '</g>'
    b += f'<path d="M340,160 L250,470 L330,470 L270,740 L420,380 L335,380 L400,160 Z" fill="url(#silv)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>'
    b += border('#bfe0ff', 'silv')
    return back(defs, b)


def fx_b_flash():
    defs = rad('f', [(0, '#ffffff', .95), (.4, '#bfe6ff', .55), (1, '#bfe6ff', 0)], cy=.4, r=.7)
    b = f'<rect width="{W}" height="{H}" fill="url(#f)"/>'
    b += '<path d="M340,160 L250,470 L330,470 L270,740 L420,380 L335,380 L400,160 Z" fill="#ffffff" filter="url(#b6)"/>'
    return fx_card(defs, b)


def b_hourglass():
    rng = random.Random(251)
    defs = rad('fld', [(0, '#2a1e3a', None), (.6, '#140e22', None), (1, '#06040c', None)], r=.75)
    defs += lin('glass', [(0, '#cfe8ff', .35), (1, '#cfe8ff', .1)], x2=1, y2=0)
    defs += lin('sandg', [(0, '#ffe2a0', None), (1, '#c8903a', None)])
    b = frame('fld') + stars(rng, 80, 60, 60, 570, 820, .5, 1.5, '#f2e8ff', .2, .7)
    b += f'<rect x="150" y="130" width="330" height="34" rx="8" fill="url(#gold)"/><rect x="150" y="716" width="330" height="34" rx="8" fill="url(#gold)"/>'
    for x in (178, 452):
        b += f'<rect x="{x - 8}" y="164" width="16" height="552" fill="url(#gold)"/>'
    b += f'<path d="M200,164 L430,164 Q430,330 330,430 Q430,530 430,716 L200,716 Q200,530 300,430 Q200,330 200,164 Z" fill="url(#glass)" stroke="#e8f4ff" stroke-width="3" opacity=".9"/>'
    b += f'<path d="M232,250 L398,250 Q380,350 315,410 Q250,350 232,250 Z" fill="url(#sandg)"/>'
    b += f'<path d="M222,716 Q230,610 315,580 Q400,610 408,716 Z" fill="url(#sandg)"/>'
    b += border()
    return back(defs, b)


def fx_b_sand():
    b = ''
    for k in range(14):
        b += f'<circle cx="{315 + (k % 3 - 1) * 1.6}" cy="{410 + k * 12}" r="{2.6 - (k % 2) * .8}" fill="#ffe2a0"/>'
    return fx_card('', b)


def b_bloodmoon():
    rng = random.Random(261)
    defs = lin('fld', [(0, '#12040a', None), (.6, '#2a0a12', None), (1, '#060204', None)])
    defs += rad('moon', [(0, '#ff8a6a', None), (.6, '#c82a2a', None), (1, '#5a0a10', None)], cx=.4, cy=.4)
    defs += rad('glow', [(0, '#ff4a3a', .5), (1, '#ff4a3a', 0)])
    b = frame('fld') + stars(rng, 100, 60, 60, 570, 600, .5, 1.4, '#ffe8e0', .2, .7)
    b += f'<circle cx="{CX}" cy="360" r="240" fill="url(#glow)"/><circle cx="{CX}" cy="360" r="150" fill="url(#moon)"/>'
    for k in range(8):
        b += f'<circle cx="{f(CX + rng.uniform(-90, 90))}" cy="{f(360 + rng.uniform(-90, 90))}" r="{f(rng.uniform(8, 24))}" fill="#7a1418" opacity=".45"/>'
    b += f'<path d="{ridge(rng, 22, 608, 700, 40, step=12, bottom=858)}" fill="#060204" clip-path="url(#fc)"/>'
    for x in (120, 470):
        b += f'<path d="M{x},700 L{x + 10},600 L{x + 22},700 Z" fill="#060204"/>'
    b += border('#ff8a7a')
    return back(defs, b)


def fx_b_clouds():
    rng = random.Random(262)
    b = ''
    for k in range(10):
        b += blob(rng, rng.uniform(-200, 830), rng.uniform(260, 470), rng.uniform(80, 160), rng.uniform(16, 34), '#2a0608', rng.uniform(.55, .85), 10)
    return fx_card('', b)


def b_vitrail():
    rng = random.Random(271)
    defs = rad('fld', [(0, '#1a1428', None), (1, '#06040c', None)], r=.75)
    cols = ['#d83a4a', '#3a6ad8', '#e8b83a', '#3ab87a', '#a83ad8', '#3ac8d8']
    b = frame('fld')
    R = 230
    for ring, (r0, r1, n) in enumerate([(40, 110, 8), (110, 180, 12), (180, R, 16)]):
        for k in range(n):
            a0, a1 = k / n * TAU, (k + 1) / n * TAU
            pts = [(CX + r0 * math.cos(a0), CY + r0 * math.sin(a0)), (CX + r1 * math.cos(a0), CY + r1 * math.sin(a0)),
                   (CX + r1 * math.cos(a1), CY + r1 * math.sin(a1)), (CX + r0 * math.cos(a1), CY + r0 * math.sin(a1))]
            b += f'<path d="{poly(pts)}" fill="{cols[(k + ring) % 6]}" opacity=".85" stroke="#1a1208" stroke-width="5"/>'
    b += f'<circle cx="{CX}" cy="{CY}" r="40" fill="#fff2c8" stroke="#1a1208" stroke-width="5"/>'
    b += f'<circle cx="{CX}" cy="{CY}" r="{R + 8}" fill="none" stroke="url(#gold)" stroke-width="10"/>'
    for y0, y1 in [(70, 190), (690, 810)]:
        for k in range(5):
            x = 92 + k * 92
            b += f'<path d="M{x},{y1} L{x},{y0 + 30} Q{x + 38},{y0} {x + 76},{y0 + 30} L{x + 76},{y1} Z" fill="{cols[k % 6]}" opacity=".75" stroke="#1a1208" stroke-width="4"/>'
    b += border()
    return back(defs, b)


def fx_b_lightsweep():
    # Bande de lumière en diagonale, au milieu ; le CSS la fait passer d'un bord à l'autre.
    defs = lin('sw', [(0, '#fff6dc', 0), (.4, '#fff6dc', 0), (.5, '#fff6dc', .6), (.6, '#fff6dc', 0), (1, '#fff6dc', 0)], x2=1, y2=.35)
    defs += lin('sw2', [(0, '#ffb0e0', 0), (.44, '#ffb0e0', 0), (.52, '#9ad8ff', .35), (.6, '#9ad8ff', 0), (1, '#9ad8ff', 0)], x2=1, y2=.35)
    return fx_card(defs, f'<rect width="{W}" height="{H}" fill="url(#sw2)"/><rect width="{W}" height="{H}" fill="url(#sw)"/>')


def b_ghostflame():
    rng = random.Random(281)
    defs = rad('fld', [(0, '#0a1a2a', None), (1, '#02060c', None)], r=.75)
    defs += lin('iron', [(0, '#5a6a7a', None), (1, '#1a222a', None)], x2=1, y2=1)
    defs += lin('flame', [(0, '#ffffff', None), (.3, '#bff6ff', None), (.7, '#3ab8ff', None), (1, '#1a4aff', .3)])
    b = frame('fld') + stars(rng, 70, 60, 60, 570, 820, .5, 1.4, '#cfefff', .2, .6)
    b += f'<path d="M190,560 L440,560 L400,640 L230,640 Z" fill="url(#iron)" stroke="#9ab8d8" stroke-width="3"/>'
    b += f'<rect x="300" y="640" width="30" height="120" fill="url(#iron)"/><path d="M230,770 L400,770 L370,740 L260,740 Z" fill="url(#iron)"/>'
    b += f'<path d="M230,560 Q200,420 270,330 Q270,420 300,440 Q290,320 330,220 Q360,340 370,420 Q390,380 380,320 Q450,420 400,560 Z" fill="url(#flame)" opacity=".85"/>'
    b += border('#9ad8ff')
    return back(defs, b)


def fx_b_flame():
    defs = lin('fl', [(0, '#ffffff', .9), (.4, '#9ae8ff', .7), (1, '#3a8aff', 0)])
    b = f'<path d="M250,560 Q220,450 280,370 Q285,450 310,465 Q305,360 335,270 Q360,370 365,440 Q380,410 375,360 Q430,450 385,560 Z" fill="url(#fl)" filter="url(#b3)"/>'
    b += f'<ellipse cx="315" cy="470" rx="160" ry="200" fill="#5ac8ff" opacity=".2" filter="url(#b20)"/>'
    return fx_card(defs, b)


def b_aurora():
    rng = random.Random(291)
    defs = lin('fld', [(0, '#02060e', None), (.6, '#06182a', None), (1, '#0a2a3a', None)])
    defs += lin('silv', [(0, '#e8fff6', None), (.5, '#8ad8c8', None), (1, '#2a6a7a', None)], x2=1, y2=1)
    b = frame('fld') + '<g clip-path="url(#fc)">' + stars(rng, 160, 22, 22, 608, 600, .4, 1.5, '#fff', .2, .9)
    b += f'<path d="{ridge(rng, 0, 630, 620, 70, step=12, rough=.8, smooth=2, bottom=880)}" fill="#0a1a2a"/>'
    b += f'<path d="{ridge(rng, 0, 630, 700, 40, step=10, bottom=880)}" fill="#04101a"/></g>'
    b += f'<circle cx="{CX}" cy="250" r="60" fill="none" stroke="url(#silv)" stroke-width="4"/><path d="M{CX},200 l10,40 l40,10 l-40,10 l-10,40 l-10,-40 l-40,-10 l40,-10 Z" fill="#e8fff6"/>'
    b += border('#9affd8', 'silv')
    return back(defs, b)


def fx_b_aurora():
    defs = lin('a1', [(0, '#59f5b0', 0), (.5, '#59f5b0', .55), (1, '#3fd6c8', 0)])
    defs += lin('a2', [(0, '#b48cff', 0), (.5, '#9a7cff', .45), (1, '#5fd0ff', 0)])
    b = ''
    for y, amp, ph, g in [(330, 40, .5, 'a1'), (400, 50, 2.2, 'a2'), (450, 36, 4, 'a1')]:
        top = wave_line(-60, 690, y, amp, .012, ph, step=15)
        pts = top[1:].split(' L')
        bot = ' L'.join(f'{p.split(",")[0]},{float(p.split(",")[1]) + 150}' for p in reversed(pts))
        b += f'<path d="M{pts[0]} L{" L".join(pts[1:])} L{bot} Z" fill="url(#{g})" filter="url(#b10)"/>'
    return fx_card(defs, b)


ITEMS = [
    ('themes', 'bg-nebula', nebula), ('themes', 'fx-nebula', fx_nebula),
    ('themes', 'bg-tempest', tempest), ('themes', 'fx-bolt', fx_bolt), ('themes', 'fx-beam', fx_beam),
    ('themes', 'bg-spirits', spirits),
    ('themes', 'bg-crystal', crystal), ('themes', 'fx-shards', fx_shards),
    ('themes', 'bg-inferno', inferno), ('themes', 'fx-flames', fx_flames),
    ('themes', 'bg-chrono', chrono), ('themes', 'fx-gear', fx_gear), ('themes', 'fx-hands', fx_hands), ('themes', 'fx-hourhand', fx_hourhand),
    ('themes', 'bg-leyline', leyline), ('themes', 'fx-leyring', fx_leyring),
    ('themes', 'bg-reef', reef), ('themes', 'fx-jelly', fx_jelly), ('themes', 'fx-caustics', fx_caustics),
    ('themes', 'bg-eclipse', eclipse), ('themes', 'fx-corona', fx_corona),
    ('themes', 'bg-blizzard', blizzard),
    ('backs', 'back-rune', b_rune), ('backs', 'fxb-rune', fx_b_rune),
    ('backs', 'back-galaxy', b_galaxy), ('backs', 'fxb-galaxy', fx_b_galaxy),
    ('backs', 'back-eye', b_eye), ('backs', 'fxb-eye', fx_b_eye),
    ('backs', 'back-lava', b_lava), ('backs', 'fxb-lava', fx_b_cracks),
    ('backs', 'back-storm', b_storm), ('backs', 'fxb-storm', fx_b_flash),
    ('backs', 'back-hourglass', b_hourglass), ('backs', 'fxb-hourglass', fx_b_sand),
    ('backs', 'back-bloodmoon', b_bloodmoon), ('backs', 'fxb-bloodmoon', fx_b_clouds),
    ('backs', 'back-vitrail', b_vitrail), ('backs', 'fxb-vitrail', fx_b_lightsweep),
    ('backs', 'back-ghostflame', b_ghostflame), ('backs', 'fxb-ghostflame', fx_b_flame),
    ('backs', 'back-aurora', b_aurora), ('backs', 'fxb-aurora', fx_b_aurora),
]

if __name__ == '__main__':
    only = sys.argv[2:]
    for folder, name, fn in ITEMS:
        if only and name not in only:
            continue
        path = f'{OUT}/{folder}/{name}.svg'
        data = fn()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'w').write(data)
        print(name, len(data))
