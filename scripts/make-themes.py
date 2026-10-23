#!/usr/bin/env python3
"""Illustrations des apparences (ui/img/themes/*.svg), dessinées en SVG.

Plateaux (board-*.svg, 1600x900) : l'horizon passe dans la moitié adverse, le sol sous mes cartes reste
sombre et peu chargé pour que les cartes restent lisibles ; le détail est sur l'horizon et dans les coins.
Menus (menu-*.svg, 1600x900) : le décor occupe le bas et les bords, le haut se fond dans la couleur du thème.

Le hasard est figé (graine par image) : relancer le script redonne les mêmes fichiers.
Usage : python3 scripts/make-themes.py
"""
import math
import os
import random

W, H = 1600, 900
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ui', 'img', 'themes')


def f(v):
    """Nombre court pour le SVG."""
    return ('%.1f' % v).rstrip('0').rstrip('.')


def pts(points):
    return ' '.join(f'{f(x)},{f(y)}' for x, y in points)


def ridge(rnd, y, disp, rough=0.55, iters=7, x0=-40, x1=W + 40):
    """Ligne de crête par déplacement du point milieu."""
    line = [(x0, y + rnd.uniform(-disp, disp) * 0.5), (x1, y + rnd.uniform(-disp, disp) * 0.5)]
    d = disp
    for _ in range(iters):
        out = []
        for a, b in zip(line, line[1:]):
            out += [a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + rnd.uniform(-d, d))]
        out.append(line[-1])
        line = out
        d *= rough
    return line


def ridge_path(line, bottom=H + 10):
    return f'M{f(line[0][0])},{f(bottom)} L' + pts(line) + f' L{f(line[-1][0])},{f(bottom)} Z'


def pine(x, base, h, w):
    """Sapin en silhouette : tronc et quatre étages."""
    d = f'M{f(x - w * 0.06)},{f(base)} L{f(x - w * 0.06)},{f(base - h * 0.12)} L{f(x + w * 0.06)},{f(base - h * 0.12)} L{f(x + w * 0.06)},{f(base)} Z'
    tiers = 4
    for i in range(tiers):
        t0 = base - h * 0.1 - i * h * 0.21
        tw = w * (1 - i * 0.2) / 2
        top = t0 - h * 0.34
        d += f' M{f(x - tw)},{f(t0)} L{f(x)},{f(top)} L{f(x + tw)},{f(t0)} Z'
    return d


def castle(x, y, s):
    """Château en silhouette (x, y : pied du donjon), créneaux compris."""
    parts = []

    def block(cx, w, h, merlons=True):
        x0, x1, top = cx - w / 2, cx + w / 2, y - h
        d = f'M{f(x0)},{f(y)} L{f(x0)},{f(top)}'
        if merlons:
            n = max(2, int(w / (7 * s)))
            step = w / (2 * n - 1)
            for i in range(2 * n - 1):
                xa = x0 + i * step
                if i % 2 == 0:
                    d += f' L{f(xa)},{f(top - 5 * s)} L{f(xa + step)},{f(top - 5 * s)} L{f(xa + step)},{f(top)}'
                else:
                    d += f' L{f(xa + step)},{f(top)}'
        d += f' L{f(x1)},{f(top)} L{f(x1)},{f(y)} Z'
        parts.append(d)

    def spire(cx, w, h, sh):
        top = y - h
        parts.append(f'M{f(cx - w / 2 - 2 * s)},{f(top)} L{f(cx)},{f(top - sh)} L{f(cx + w / 2 + 2 * s)},{f(top)} Z')

    block(x, 60 * s, 70 * s)
    block(x - 70 * s, 40 * s, 40 * s)
    block(x + 70 * s, 40 * s, 44 * s)
    block(x - 35 * s, 18 * s, 96 * s, merlons=False)
    spire(x - 35 * s, 18 * s, 96 * s, 34 * s)
    block(x + 30 * s, 22 * s, 112 * s, merlons=False)
    spire(x + 30 * s, 22 * s, 112 * s, 44 * s)
    block(x - 104 * s, 16 * s, 58 * s, merlons=False)
    spire(x - 104 * s, 16 * s, 58 * s, 24 * s)
    block(x + 106 * s, 18 * s, 64 * s, merlons=False)
    spire(x + 106 * s, 18 * s, 64 * s, 26 * s)
    # Fanion sur la plus haute tour.
    fx, fy = x + 30 * s, y - 156 * s
    parts.append(f'M{f(fx)},{f(fy)} L{f(fx)},{f(fy - 22 * s)} L{f(fx + 1.4 * s)},{f(fy - 22 * s)} L{f(fx + 1.4 * s)},{f(fy)} Z')
    flag = f'M{f(fx + 1.4 * s)},{f(fy - 22 * s)} L{f(fx + 16 * s)},{f(fy - 18 * s)} L{f(fx + 1.4 * s)},{f(fy - 13 * s)} Z'
    windows = []
    for wx, wy in [(-8, 40), (8, 40), (0, 22), (-35, 70), (30, 84), (-70, 24), (70, 28), (30, 60)]:
        windows.append(f'<rect x="{f(x + wx * s - 1.6 * s)}" y="{f(y - wy * s - 4 * s)}" width="{f(3.2 * s)}" height="{f(5 * s)}" rx="{f(1.4 * s)}"/>')
    return ' '.join(parts), flag, ''.join(windows)


def stars(rnd, n, y0, y1, rmax=1.6, color='#fff', x0=0, x1=W):
    out = []
    for _ in range(n):
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        r = rnd.uniform(0.4, rmax) if rnd.random() < 0.85 else rnd.uniform(rmax, rmax * 1.6)
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="{color}" opacity="{f(rnd.uniform(0.25, 0.95))}"/>')
    return ''.join(out)


def tufts(rnd, n, y0, y1, color, opacity, avoid=None):
    """Petites touffes d'herbe (traits), en dehors d'une zone à garder calme."""
    d = []
    for _ in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(y0, y1)
        if avoid and avoid(x, y):
            continue
        h = rnd.uniform(4, 11) * (0.6 + (y - y0) / (y1 - y0))
        d.append(f'M{f(x)},{f(y)} l{f(-2)},{f(-h)} M{f(x)},{f(y)} l{f(1)},{f(-h * 1.2)} M{f(x)},{f(y)} l{f(3)},{f(-h * 0.8)}')
    return f'<path d="{" ".join(d)}" stroke="{color}" stroke-width="1.3" stroke-linecap="round" fill="none" opacity="{opacity}"/>'


def svg(body, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<defs>{defs}</defs>{body}</svg>')


def vignette(id_, strength=0.65, color='#000'):
    defs = (f'<radialGradient id="{id_}" cx="50%" cy="50%" r="75%">'
            f'<stop offset="55%" stop-color="{color}" stop-opacity="0"/><stop offset="100%" stop-color="{color}" stop-opacity="{strength}"/></radialGradient>')
    return defs, f'<rect width="{W}" height="{H}" fill="url(#{id_})"/>'


BLUR = '<filter id="b{0}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{0}"/></filter>'


def blurs(*sizes):
    return ''.join(BLUR.format(s) for s in sizes)


# ---------------------------------------------------------------------------------------------- plateaux

def board_battlefield():
    rnd = random.Random(11)
    hz = 372
    defs = blurs(3, 8, 18, 40) + (
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#0d0b1c"/><stop offset=".25" stop-color="#1d1530"/>'
        '<stop offset=".36" stop-color="#4a2638"/><stop offset=".42" stop-color="#93503a"/></linearGradient>'
        '<radialGradient id="sun" cx="0.66" cy="0.41" r="0.32"><stop offset="0" stop-color="#ffc27a" stop-opacity=".75"/>'
        '<stop offset=".35" stop-color="#ff8a4a" stop-opacity=".28"/><stop offset="1" stop-color="#ff8a4a" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a20"/>'
        '<stop offset=".25" stop-color="#241a14"/><stop offset="1" stop-color="#0e0b09"/></linearGradient>'
        '<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8a070" stop-opacity="0"/>'
        '<stop offset=".5" stop-color="#e8a070" stop-opacity=".22"/><stop offset="1" stop-color="#e8a070" stop-opacity="0"/></linearGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>', f'<rect width="{W}" height="{H}" fill="url(#sun)"/>']
    b.append(stars(rnd, 70, 0, 160, 1.2))
    # Nuées sombres striées par le couchant.
    for _ in range(9):
        cx, cy = rnd.uniform(0, W), rnd.uniform(60, 280)
        b.append(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rnd.uniform(120, 320))}" ry="{f(rnd.uniform(10, 26))}" fill="#2a1a2c" opacity="{f(rnd.uniform(.45, .8))}" filter="url(#b8)"/>')
        b.append(f'<ellipse cx="{f(cx + 20)}" cy="{f(cy + 10)}" rx="{f(rnd.uniform(80, 200))}" ry="4" fill="#d9825a" opacity=".22" filter="url(#b3)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, hz - 70, 70))}" fill="#3a2a44" opacity=".85"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, hz - 34, 40))}" fill="#2a1e33"/>')
    # Château sur sa colline, fenêtres allumées.
    hill = f'M960,{hz + 4} C1040,{hz - 60} 1260,{hz - 64} 1380,{hz + 4} Z'
    b.append(f'<path d="{hill}" fill="#1d1424"/>')
    walls, flag, windows = castle(1170, hz - 40, 1.25)
    b.append(f'<path d="{walls}" fill="#160f1c"/><path d="{flag}" fill="#8a2a2a"/>')
    b.append(f'<g fill="#ffcf7a" opacity=".9">{windows}</g>')
    b.append(f'<g fill="#ffb050" opacity=".35" filter="url(#b8)">{windows}</g>')
    # Armée sur l'horizon à gauche : piques et bannières.
    pikes, banners = [], []
    for i in range(70):
        x = 90 + i * 11 + rnd.uniform(-4, 4)
        top = hz - rnd.uniform(26, 48)
        pikes.append(f'M{f(x)},{f(hz + 6)} L{f(x + rnd.uniform(-3, 3))},{f(top)}')
        if i % 7 == 3:
            banners.append(f'M{f(x)},{f(top)} l16,4 l-6,6 l6,6 l-16,2 Z')
    b.append(f'<path d="{" ".join(pikes)}" stroke="#140c14" stroke-width="1.6" fill="none"/>')
    b.append(f'<path d="{" ".join(banners)}" fill="#5c1c24"/>')
    b.append(f'<path d="M60,{hz + 8} Q420,{hz - 22} 900,{hz + 8} Z" fill="#170f17"/>')
    # Fumées des feux de camp.
    for x in (260, 610, 1460):
        for k in range(6):
            b.append(f'<circle cx="{f(x + k * k * 2.4 + rnd.uniform(-6, 6))}" cy="{f(hz - 8 - k * 30)}" r="{f(12 + k * 7)}" fill="#5a4a52" opacity="{f(.30 - k * .04)}" filter="url(#b8)"/>')
        b.append(f'<circle cx="{x}" cy="{hz + 2}" r="14" fill="#ff9a40" opacity=".55" filter="url(#b8)"/>')
    b.append(f'<rect y="{hz - 40}" width="{W}" height="90" fill="url(#haze)" filter="url(#b18)"/>')
    # Sol : la plaine piétinée, presque unie sous les cartes.
    ground = ridge(rnd, hz + 2, 6, iters=6)
    b.append(f'<path d="{ridge_path(ground)}" fill="url(#ground)"/>')
    b.append(f'<path d="M-20,{hz + 120} C400,{hz + 90} 900,{hz + 150} 1620,{hz + 110}" stroke="#4a3626" stroke-width="40" fill="none" opacity=".25" filter="url(#b18)"/>')
    calm = lambda x, y: 300 < x < 1300 and y > hz + 60
    b.append(tufts(rnd, 520, hz + 10, H, '#5a4632', '.45', calm))
    # Débris dans les coins : lances brisées, boucliers, épée plantée, bannière tombée.
    spears = []
    for _ in range(14):
        x = rnd.choice([rnd.uniform(0, 280), rnd.uniform(1320, W)])
        y = rnd.uniform(hz + 160, H)
        a = rnd.uniform(-1.2, 1.2)
        ln = rnd.uniform(60, 130)
        spears.append(f'M{f(x)},{f(y)} l{f(math.sin(a) * ln)},{f(-math.cos(a) * ln)}')
    b.append(f'<path d="{" ".join(spears)}" stroke="#0b0806" stroke-width="3" stroke-linecap="round" fill="none"/>')
    for x, y, r in [(120, 820, 34), (1480, 800, 30), (230, 700, 22)]:
        b.append(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{f(r * .55)}" fill="#120c09"/><ellipse cx="{x}" cy="{f(y - 2)}" rx="{f(r * .25)}" ry="{f(r * .14)}" fill="#6a5030" opacity=".6"/>')
    b.append('<path d="M1400,900 L1404,700 L1398,690 L1382,690 L1382,684 L1420,684 L1420,690 L1410,690 L1414,900 Z" fill="#0b0806"/>')
    b.append('<path d="M40,640 L300,600 L310,612 L60,660 Z" fill="#3a1418" opacity=".8"/>')
    vdefs, vrect = vignette('vig', .7)
    return svg(''.join(b) + vrect, defs + vdefs)


def board_forest():
    rnd = random.Random(23)
    hz = 420
    defs = blurs(2, 6, 14, 30) + (
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050d0b"/>'
        '<stop offset=".4" stop-color="#0d2620"/><stop offset=".5" stop-color="#18402f"/></linearGradient>'
        '<radialGradient id="moon" cx=".72" cy=".17" r=".25"><stop offset="0" stop-color="#e9f6d6" stop-opacity=".55"/>'
        '<stop offset="1" stop-color="#e9f6d6" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8f3c8" stop-opacity=".16"/>'
        '<stop offset="1" stop-color="#d8f3c8" stop-opacity="0"/></linearGradient>'
        '<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11281d"/><stop offset="1" stop-color="#040b08"/></linearGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#sky)"/>', f'<rect width="{W}" height="{H}" fill="url(#moon)"/>']
    b.append(stars(rnd, 60, 0, 220, 1.1, '#e8f5e0'))
    b.append('<circle cx="1150" cy="150" r="46" fill="#eef7dc" opacity=".9"/><circle cx="1166" cy="140" r="40" fill="#cfe2bd" opacity=".25"/>')
    for x0 in (1020, 1150, 1260):
        b.append(f'<path d="M{x0},0 L{x0 + 80},0 L{x0 - 160},{H} L{x0 - 380},{H} Z" fill="url(#ray)" filter="url(#b14)"/>')
    layers = [(hz - 10, 70, 110, '#143528', 70), (hz + 20, 110, 150, '#0e281e', 46), (hz + 70, 170, 210, '#091c15', 30)]
    for base, hmin, hmax, color, n in layers:
        d = []
        for i in range(n):
            x = rnd.uniform(-40, W + 40)
            h = rnd.uniform(hmin, hmax)
            d.append(pine(x, base + rnd.uniform(-8, 8), h, h * 0.42))
        b.append(f'<path d="{" ".join(d)}" fill="{color}"/>')
        b.append(f'<rect y="{base - 30}" width="{W}" height="60" fill="#9fd0a8" opacity=".05" filter="url(#b14)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, hz + 70, 10, iters=6))}" fill="url(#ground)"/>')
    calm = lambda x, y: 300 < x < 1300 and y > hz + 140
    b.append(tufts(rnd, 420, hz + 80, H, '#24503a', '.5', calm))
    # Grands troncs qui encadrent la scène.
    for x, w in [(-30, 130), (140, 54), (1470, 150), (1370, 60)]:
        b.append(f'<path d="M{x},0 C{x + 14},300 {x - 10},600 {x - 30},{H} L{x + w + 30},{H} C{x + w + 6},600 {x + w - 10},300 {x + w},0 Z" fill="#030907"/>')
    b.append('<path d="M0,120 C120,150 200,230 240,300 C190,250 90,200 0,190 Z M1600,80 C1470,130 1400,190 1360,260 C1420,210 1520,170 1600,160 Z" fill="#030907"/>')
    # Champignons lumineux et lucioles.
    for x, y in [(60, 860), (95, 872), (250, 845), (1500, 865), (1540, 850), (1330, 875)]:
        b.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#7ff0d0" opacity=".25" filter="url(#b6)"/><path d="M{x - 7},{y} q7,-12 14,0 Z" fill="#6fd8bc"/><rect x="{x - 1.5}" y="{y}" width="3" height="9" fill="#9ad6c4"/>')
    flies = []
    for _ in range(46):
        x, y = rnd.uniform(0, W), rnd.uniform(hz - 120, H - 60)
        if 380 < x < 1220 and y > hz + 100:
            continue
        flies.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(1.4, 2.6))}"/>')
    b.append(f'<g fill="#e6ff9a" opacity=".6" filter="url(#b6)">{"".join(flies)}</g><g fill="#f4ffc8">{"".join(flies)}</g>')
    vdefs, vrect = vignette('vig', .75)
    return svg(''.join(b) + vrect, defs + vdefs)


def board_throne():
    rnd = random.Random(37)
    vx, vy = 800, 350
    floor = 440
    defs = blurs(4, 10, 24, 50) + (
        '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0b12"/><stop offset="1" stop-color="#1e1824"/></linearGradient>'
        '<radialGradient id="glow" cx=".5" cy=".22" r=".35"><stop offset="0" stop-color="#ffd59a" stop-opacity=".42"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1620"/><stop offset="1" stop-color="#0a080c"/></linearGradient>'
        '<linearGradient id="carpet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a1c26"/><stop offset="1" stop-color="#2e0a10"/></linearGradient>'
        '<radialGradient id="torch"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".9"/><stop offset=".4" stop-color="#ff8a3a" stop-opacity=".35"/><stop offset="1" stop-color="#ff8a3a" stop-opacity="0"/></radialGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#wall)"/>']
    # Appareil de pierre du mur du fond.
    lines = []
    for row in range(0, floor, 34):
        lines.append(f'M0,{row} L{W},{row}')
        off = 0 if (row // 34) % 2 else 40
        for x in range(off, W, 80):
            lines.append(f'M{x},{row} L{x},{row + 34}')
    b.append(f'<path d="{" ".join(lines)}" stroke="#2a2330" stroke-width="1.2" opacity=".55"/>')
    b.append(f'<rect width="{W}" height="{H}" fill="url(#glow)"/>')
    # Vitrail gothique au fond.
    wx0, wx1, wtop, wbot = 690, 910, 40, 300
    arch = f'M{wx0},{wbot} L{wx0},{wtop + 110} Q{wx0},{wtop} 800,{wtop - 10} Q{wx1},{wtop} {wx1},{wtop + 110} L{wx1},{wbot} Z'
    b.append(f'<path d="{arch}" fill="#140f18" stroke="#3a3040" stroke-width="10"/>')
    panes = []
    colors = ['#3a62b8', '#b8323e', '#d9a441', '#2f8a6a', '#6a3ab8']
    for r in range(7):
        for c in range(5):
            x = wx0 + 12 + c * 40
            y = wtop + 40 + r * 36
            if y + 30 > wbot:
                continue
            panes.append(f'<rect x="{x}" y="{y}" width="34" height="30" fill="{rnd.choice(colors)}" opacity="{f(rnd.uniform(.55, .9))}"/>')
    b.append(f'<g clip-path="url(#archclip)">{"".join(panes)}<circle cx="800" cy="{wtop + 70}" r="44" fill="#f0c860" opacity=".75"/><circle cx="800" cy="{wtop + 70}" r="26" fill="#b8323e"/></g>')
    defs += f'<clipPath id="archclip"><path d="{arch}"/></clipPath>'
    b.append(f'<path d="{arch}" fill="#ffd59a" opacity=".22" filter="url(#b24)"/>')
    # Estrade à trois marches et trône à haut dossier.
    for k, (w, y) in enumerate([(300, floor - 6), (250, floor - 22), (200, floor - 38)]):
        b.append(f'<rect x="{800 - w / 2}" y="{y}" width="{w}" height="16" fill="#120e16"/><rect x="{800 - w / 2}" y="{y}" width="{w}" height="2.5" fill="#c99a48" opacity=".55"/>')
    seat = floor - 38
    throne = (f'M760,{seat} L760,{seat - 40} L746,{seat - 40} L746,{seat - 52} L766,{seat - 52} L770,{seat - 150} L784,{seat - 196} L800,{seat - 222} '
              f'L816,{seat - 196} L830,{seat - 150} L834,{seat - 52} L854,{seat - 52} L854,{seat - 40} L840,{seat - 40} L840,{seat} Z')
    b.append(f'<path d="{throne}" fill="#0b080e"/>')
    b.append(f'<path d="M736,{seat} L736,{seat - 96} M864,{seat} L864,{seat - 96}" stroke="#0b080e" stroke-width="10"/>')
    b.append(f'<circle cx="736" cy="{seat - 102}" r="8" fill="#c99a48" opacity=".8"/><circle cx="864" cy="{seat - 102}" r="8" fill="#c99a48" opacity=".8"/>')
    b.append(f'<path d="M778,{seat - 60} L822,{seat - 60} M770,{seat - 150} L830,{seat - 150} M746,{seat - 52} L854,{seat - 52}" stroke="#c99a48" stroke-width="2.6" opacity=".7"/>')
    b.append(f'<path d="M800,{seat - 210} L800,{seat - 176}" stroke="#c99a48" stroke-width="2" opacity=".7"/><circle cx="800" cy="{seat - 160}" r="8" fill="#e2b65c" opacity=".85"/>')
    # Sol en perspective et tapis rouge.
    b.append(f'<rect y="{floor}" width="{W}" height="{H - floor}" fill="url(#floor)"/>')
    persp = []
    for i in range(-14, 15):
        x = vx + i * 140
        persp.append(f'M{f(vx + (x - vx) * 0.12)},{floor} L{f(x * 1.0)},{H}')
    for k in range(1, 9):
        y = floor + (H - floor) * (k / 9) ** 1.6
        persp.append(f'M0,{f(y)} L{W},{f(y)}')
    b.append(f'<path d="{" ".join(persp)}" stroke="#2d2433" stroke-width="1.4" opacity=".6"/>')
    b.append(f'<path d="M770,{floor} L830,{floor} L1010,{H} L590,{H} Z" fill="url(#carpet)" opacity=".85"/>')
    b.append(f'<path d="M776,{floor} L606,{H} M824,{floor} L994,{H}" stroke="#d9a441" stroke-width="4" opacity=".55"/>')
    # Piliers, bannières et torches, plus grands vers les bords.
    for side in (-1, 1):
        for k, (dist, scale) in enumerate([(230, .55), (420, .8), (680, 1.25)]):
            x = vx + side * dist
            w = 46 * scale
            top = 0
            bot = floor + (H - floor) * (scale - .5) * .9
            b.append(f'<rect x="{f(x - w / 2)}" y="{top}" width="{f(w)}" height="{f(bot)}" fill="#18131d"/>')
            b.append(f'<rect x="{f(x - w / 2)}" y="{top}" width="{f(w * .18)}" height="{f(bot)}" fill="#2a2232"/>')
            b.append(f'<rect x="{f(x - w / 2 - 8 * scale)}" y="{f(bot - 26 * scale)}" width="{f(w + 16 * scale)}" height="{f(26 * scale)}" fill="#120e16"/>')
            if k < 2:
                bx = x + side * (dist * .45 if k == 0 else 120)
                bw, bh = 44 * scale, 260 * scale
                b.append(f'<path d="M{f(bx - bw / 2)},{f(40 * scale)} L{f(bx + bw / 2)},{f(40 * scale)} L{f(bx + bw / 2)},{f(40 * scale + bh)} L{f(bx)},{f(40 * scale + bh - 22 * scale)} L{f(bx - bw / 2)},{f(40 * scale + bh)} Z" fill="#5c1622"/>')
                b.append(f'<circle cx="{f(bx)}" cy="{f(40 * scale + bh * .35)}" r="{f(11 * scale)}" fill="none" stroke="#d9a441" stroke-width="{f(2.4 * scale)}" opacity=".8"/>')
            ty = 210 * scale + 60
            b.append(f'<circle cx="{f(x)}" cy="{f(ty)}" r="{f(70 * scale)}" fill="url(#torch)"/>')
            b.append(f'<path d="M{f(x - 6 * scale)},{f(ty + 10 * scale)} q{f(6 * scale)},{f(-26 * scale)} {f(12 * scale)},0 Z" fill="#ffd27a"/>')
            b.append(f'<rect x="{f(x - 3 * scale)}" y="{f(ty + 10 * scale)}" width="{f(6 * scale)}" height="{f(16 * scale)}" fill="#0b080e"/>')
    vdefs, vrect = vignette('vig', .78)
    return svg(''.join(b) + vrect, defs + vdefs)


DRAGON = ('M2,96 L30,84 L48,70 L80,46 L64,72 L72,80 C90,95 100,120 112,150 C150,150 200,150 240,165 '
          'C280,175 320,200 350,230 C365,245 375,250 392,248 L380,258 L398,262 L384,270 C360,262 330,240 300,222 '
          'C280,212 262,206 252,206 L258,240 L272,256 L236,256 L240,232 C220,216 190,214 160,214 L150,240 L162,256 '
          'L124,256 L132,232 C118,212 104,190 92,160 C84,140 72,118 56,108 L30,110 L6,104 Z')
DRAGON_WING_NEAR = 'M138,154 L192,44 L304,0 Q300,30 334,40 Q312,66 336,92 Q308,108 306,134 Q280,140 254,168 Z'
DRAGON_WING_FAR = 'M150,150 L176,52 L236,-14 Q238,14 266,14 Q250,40 278,56 Q252,70 258,96 Z'
DRAGON_BONES = 'M192,44 L334,40 M192,44 L336,92 M192,44 L306,134'


def board_dragon():
    rnd = random.Random(53)
    defs = blurs(3, 8, 20, 44) + (
        '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0504"/><stop offset=".55" stop-color="#2a0e07"/><stop offset="1" stop-color="#160705"/></linearGradient>'
        '<radialGradient id="mouth" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#ff9a4a"/><stop offset=".45" stop-color="#c2401a"/><stop offset="1" stop-color="#3a1008"/></radialGradient>'
        '<linearGradient id="lava" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c2310b"/><stop offset=".5" stop-color="#ff8a1e"/><stop offset="1" stop-color="#c2310b"/></linearGradient>'
        '<radialGradient id="heat" cx=".5" cy=".95" r=".6"><stop offset="0" stop-color="#ff6a1a" stop-opacity=".45"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>', f'<rect width="{W}" height="{H}" fill="url(#heat)"/>']
    # Ouverture de la caverne sur un ciel en feu : le dragon s'y découpe.
    mouth = 'M780,470 C760,330 820,170 960,120 C1060,84 1200,96 1290,150 C1390,212 1420,350 1400,470 Z'
    b.append(f'<path d="{mouth}" fill="url(#mouth)"/>')
    b.append(f'<path d="{mouth}" fill="#ffb060" opacity=".25" filter="url(#b44)"/>')
    for _ in range(7):
        b.append(f'<ellipse cx="{f(rnd.uniform(860, 1320))}" cy="{f(rnd.uniform(160, 300))}" rx="{f(rnd.uniform(60, 140))}" ry="{f(rnd.uniform(8, 18))}" fill="#5a1a10" opacity=".55" filter="url(#b8)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 430, 26, iters=6, x0=760, x1=1420))}" fill="#3a1408" opacity=".9"/>')
    # Voûte et parois déchiquetées.
    top = ridge(rnd, 70, 60, rough=.6)
    b.append('<path d="M-40,-10 L' + pts(top) + f' L{W + 40},-10 Z" fill="#070302"/>')
    stal = []
    for _ in range(30):
        x = rnd.uniform(0, W)
        y = 60 + rnd.uniform(-20, 40)
        ln = rnd.uniform(30, 130)
        w = rnd.uniform(10, 26)
        stal.append(f'M{f(x - w)},{f(y - 20)} L{f(x)},{f(y + ln)} L{f(x + w)},{f(y - 20)} Z')
    b.append(f'<path d="{" ".join(stal)}" fill="#070302"/>')
    b.append('<path d="M-20,-10 L-20,520 C200,500 420,480 640,470 C700,380 720,240 780,140 C700,90 600,60 500,40 Z" fill="#0a0403"/>')
    b.append('<path d="M1640,-10 L1640,520 C1560,500 1480,490 1420,480 C1440,360 1420,220 1330,130 C1400,80 1500,40 1640,30 Z" fill="#0a0403"/>')
    # Rocher et dragon perché, ailes levées, tourné vers la gauche.
    b.append('<path d="M900,480 L950,400 L1050,388 L1180,392 L1240,420 L1280,480 Z" fill="#080302"/>')
    dragon = f'<g transform="translate(905 146) scale(.95)"><path d="{DRAGON_WING_FAR}" fill="#120604"/><path d="{DRAGON}" fill="#080302"/><path d="{DRAGON_WING_NEAR}" fill="#0a0403"/><path d="{DRAGON_BONES}" stroke="#3a1208" stroke-width="2.4" fill="none"/>'
    dragon += '<circle cx="36" cy="88" r="3.4" fill="#ffd23a"/><circle cx="36" cy="88" r="9" fill="#ff9a1e" opacity=".55" filter="url(#b3)"/></g>'
    b.append(dragon)
    b.append(f'<path d="{ridge_path(ridge(rnd, 486, 14, iters=6))}" fill="#1a0906"/>')
    # Rivière de lave et sa lueur.
    river = 'M-20,610 C300,580 520,660 800,630 C1080,600 1300,650 1620,615 L1620,660 C1300,700 1080,650 800,680 C520,710 300,630 -20,660 Z'
    b.append(f'<path d="{river}" fill="#ff7a1a" opacity=".55" filter="url(#b20)"/><path d="{river}" fill="url(#lava)"/>')
    b.append('<path d="M-20,640 C300,610 520,690 800,656 C1080,624 1300,676 1620,640" stroke="#ffd27a" stroke-width="3" fill="none" opacity=".6"/>')
    b.append(f'<path d="M-40,{H + 10} L-40,690 C300,670 600,740 800,720 C1000,700 1300,690 1640,700 L1640,{H + 10} Z" fill="#0d0504"/>')
    # Trésor dans le coin gauche.
    coins = []
    for _ in range(90):
        x = rnd.gauss(230, 80)
        y = 820 - abs(rnd.gauss(0, 40)) + (abs(x - 230) / 4)
        coins.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(rnd.uniform(5, 9))}" ry="{f(rnd.uniform(2, 3.4))}"/>')
    b.append(f'<g fill="#d9a441" opacity=".55">{"".join(coins)}</g><ellipse cx="230" cy="820" rx="160" ry="40" fill="#ffcf6a" opacity=".12" filter="url(#b20)"/>')
    for _ in range(8):
        b.append(f'<ellipse cx="{f(rnd.uniform(0, W))}" cy="{f(rnd.uniform(520, 600))}" rx="{f(rnd.uniform(80, 200))}" ry="{f(rnd.uniform(16, 30))}" fill="#1e0d0a" opacity=".45" filter="url(#b20)"/>')
    embers = []
    for _ in range(110):
        x, y = rnd.uniform(0, W), rnd.uniform(140, 700)
        if 350 < x < 1150 and y > 500:
            continue
        embers.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(.8, 2.4))}" opacity="{f(rnd.uniform(.3, .95))}"/>')
    b.append(f'<g fill="#ffb04a">{"".join(embers)}</g>')
    vdefs, vrect = vignette('vig', .72)
    return svg(''.join(b) + vrect, defs + vdefs)


def board_ether():
    rnd = random.Random(71)
    defs = blurs(2, 30, 60) + (
        '<radialGradient id="bg" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#140f36"/><stop offset=".6" stop-color="#0a0820"/><stop offset="1" stop-color="#030209"/></radialGradient>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#bg)"/>']
    for cx, cy, rx, ry, col, op in [(380, 260, 420, 160, '#5b2a9a', .38), (1180, 300, 380, 190, '#1f5f9a', .32), (900, 620, 520, 150, '#8a2a6a', .22),
                                    (200, 700, 300, 120, '#2a7a8a', .18), (1400, 720, 260, 140, '#6a3ab8', .2)]:
        b.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{col}" opacity="{op}" filter="url(#b60)"/>')
    b.append(stars(rnd, 260, 0, H, 1.5))
    sparkle = []
    for _ in range(14):
        x, y, s = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(6, 14)
        sparkle.append(f'M{f(x - s)},{f(y)} L{f(x + s)},{f(y)} M{f(x)},{f(y - s)} L{f(x)},{f(y + s)}')
    b.append(f'<path d="{" ".join(sparkle)}" stroke="#fff" stroke-width="1" opacity=".55"/>')
    # Cercle arcanique, très discret.
    c = ['<g fill="none" stroke="#e2b65c" opacity=".13">']
    for r, w in [(330, 2), (300, 1), (210, 1.5), (120, 1)]:
        c.append(f'<circle cx="800" cy="450" r="{r}" stroke-width="{w}"/>')
    runes = []
    for i in range(48):
        a = i / 48 * math.tau
        x, y = 800 + math.cos(a) * 315, 450 + math.sin(a) * 315
        k = i % 4
        dx, dy = math.cos(a + 1.2) * 7, math.sin(a + 1.2) * 7
        runes.append(f'M{f(x - dx)},{f(y - dy)} L{f(x + dx)},{f(y + dy)}')
        if k == 1:
            runes.append(f'M{f(x)},{f(y)} L{f(x + math.cos(a) * 8)},{f(y + math.sin(a) * 8)}')
    c.append(f'<path d="{" ".join(runes)}" stroke-width="1.6"/>')
    star = [(800 + math.cos(-math.pi / 2 + i * 4 * math.pi / 5) * 300, 450 + math.sin(-math.pi / 2 + i * 4 * math.pi / 5) * 300) for i in range(5)]
    c.append(f'<path d="M{pts(star)} Z" stroke-width="1"/></g>')
    b.append(''.join(c))
    # Îles flottantes.
    for x, y, s in [(240, 300, 1.0), (1390, 210, .8), (1250, 660, .55), (120, 640, .5)]:
        top = f'M{f(x - 120 * s)},{f(y)} C{f(x - 60 * s)},{f(y - 16 * s)} {f(x + 60 * s)},{f(y - 18 * s)} {f(x + 120 * s)},{f(y)}'
        rock = top + f' L{f(x + 70 * s)},{f(y + 50 * s)} L{f(x + 20 * s)},{f(y + 120 * s)} L{f(x - 30 * s)},{f(y + 60 * s)} L{f(x - 80 * s)},{f(y + 40 * s)} Z'
        b.append(f'<path d="{rock}" fill="#0c0a1e"/><path d="{top}" stroke="#8fb8ff" stroke-width="{f(2.4 * s)}" fill="none" opacity=".45"/>')
        trees = ' '.join(pine(x + dx * s, y - 8 * s, 46 * s * hh, 20 * s * hh) for dx, hh in [(-60, .8), (-30, 1.1), (10, .7), (50, 1)])
        b.append(f'<path d="{trees}" fill="#0c0a1e"/>')
        b.append(f'<path d="M{f(x + 20 * s)},{f(y + 120 * s)} l0,{f(40 * s)}" stroke="#8fb8ff" stroke-width="1.2" opacity=".25"/>')
    vdefs, vrect = vignette('vig', .6)
    return svg(''.join(b) + vrect, defs + vdefs)


# ---------------------------------------------------------------------------------------------- menus

def menu(base, sky_top, sky_mid, body, extra_defs='', vig=.5):
    """Fond de menu : ciel qui se fond dans la couleur du thème en haut, décor en bas."""
    defs = blurs(3, 8, 20, 50) + (
        f'<linearGradient id="msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{base}"/>'
        f'<stop offset=".45" stop-color="{sky_top}"/><stop offset=".78" stop-color="{sky_mid}"/></linearGradient>') + extra_defs
    vdefs, vrect = vignette('mvig', vig)
    return svg(f'<rect width="{W}" height="{H}" fill="url(#msky)"/>' + body + vrect, defs + vdefs)


def menu_citadel():
    rnd = random.Random(101)
    b = [stars(rnd, 50, 260, 520, 1.1, '#dfe8ff')]
    b.append('<circle cx="1240" cy="430" r="54" fill="#e8eefc" opacity=".85"/><circle cx="1240" cy="430" r="140" fill="#b8c8f0" opacity=".12" filter="url(#b20)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 600, 150))}" fill="#2a3752" opacity=".8"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 650, 90))}" fill="#222d45" opacity=".95"/>')
    b.append(f'<rect y="640" width="{W}" height="80" fill="#c8d4f0" opacity=".07" filter="url(#b20)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 700, 50))}" fill="#1a2336"/>')
    # Falaise et citadelle à gauche.
    b.append('<path d="M-20,900 L-20,640 C80,610 200,600 300,640 C340,660 360,720 380,900 Z" fill="#111827"/>')
    walls, flag, windows = castle(170, 628, 1.15)
    b.append(f'<path d="{walls}" fill="#111827"/><path d="{flag}" fill="#c9a44e"/><g fill="#ffd98a" opacity=".85">{windows}</g>')
    b.append(f'<g fill="#ffcf7a" opacity=".35" filter="url(#b8)">{windows}</g>')
    birds = []
    for i in range(7):
        x, y = 820 + i * 38 + rnd.uniform(-10, 10), 430 + rnd.uniform(-30, 30)
        birds.append(f'M{f(x - 7)},{f(y)} q7,-6 7,0 q0,-6 7,0')
    b.append(f'<path d="{" ".join(birds)}" stroke="#2a3654" stroke-width="1.6" fill="none"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 790, 24))}" fill="#0c111c"/>')
    return menu('#0c1018', '#101a2c', '#2c3b5c', ''.join(b))


def menu_sylvan():
    rnd = random.Random(103)
    b = ['<circle cx="1300" cy="470" r="200" fill="#d8f0c0" opacity=".08" filter="url(#b50)"/>']
    for base, hmin, hmax, color, n in [(680, 90, 140, '#173a2a', 50), (740, 140, 200, '#0f2a1e', 34), (830, 200, 280, '#081a12', 22)]:
        d = ' '.join(pine(rnd.uniform(-40, W + 40), base + rnd.uniform(-10, 10), h, h * .42) for h in [rnd.uniform(hmin, hmax) for _ in range(n)])
        b.append(f'<path d="{d}" fill="{color}"/><rect y="{base - 40}" width="{W}" height="70" fill="#a8e0b8" opacity=".05" filter="url(#b20)"/>')
    b.append(f'<rect y="820" width="{W}" height="90" fill="#06120c"/>')
    flies = ''.join(f'<circle cx="{f(rnd.uniform(0, W))}" cy="{f(rnd.uniform(520, 860))}" r="{f(rnd.uniform(1.4, 2.4))}"/>' for _ in range(40))
    b.append(f'<g fill="#e6ff9a" opacity=".6" filter="url(#b3)">{flies}</g><g fill="#f4ffc8">{flies}</g>')
    return menu('#08110d', '#0b1d15', '#1d4a34', ''.join(b))


def menu_ember():
    rnd = random.Random(107)
    b = ['<ellipse cx="1100" cy="640" rx="420" ry="160" fill="#ff6a1a" opacity=".22" filter="url(#b50)"/>']
    b.append(f'<path d="{ridge_path(ridge(rnd, 680, 70))}" fill="#2e130d"/>')
    cone = 'M700,900 C860,780 960,660 1036,574 L1064,560 L1112,562 L1140,574 C1220,660 1320,780 1500,900 Z'
    b.append(f'<path d="{cone}" fill="#1c0b08"/>')
    b.append('<path d="M1036,574 C1000,640 940,720 860,800 C930,740 990,680 1040,610 Z M1140,574 C1180,650 1250,730 1340,800 C1270,740 1210,680 1150,610 Z" fill="#2a120c"/>')
    b.append('<ellipse cx="1088" cy="566" rx="54" ry="10" fill="#ffb04a"/><ellipse cx="1088" cy="540" rx="120" ry="70" fill="#ff7a1a" opacity=".35" filter="url(#b20)"/>')
    streams = 'M1070,570 C1060,620 1030,660 1000,720 C980,760 960,800 940,860 M1100,572 C1110,630 1140,690 1160,740 C1170,780 1190,820 1220,880 M1086,572 C1084,610 1090,650 1080,690'
    b.append(f'<path d="{streams}" stroke="#ff7a1a" stroke-width="10" fill="none" opacity=".5" filter="url(#b8)"/><path d="{streams}" stroke="#ffb04a" stroke-width="3.2" fill="none" stroke-linecap="round"/>')
    for k in range(9):
        b.append(f'<circle cx="{f(1088 + k * k * 4)}" cy="{f(520 - k * 42)}" r="{f(24 + k * 13)}" fill="#3a1a14" opacity="{f(.55 - k * .05)}" filter="url(#b20)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 780, 40))}" fill="#140806"/>')
    embers = ''.join(f'<circle cx="{f(rnd.uniform(0, W))}" cy="{f(rnd.uniform(300, 880))}" r="{f(rnd.uniform(.8, 2.2))}" opacity="{f(rnd.uniform(.3, .9))}"/>' for _ in range(90))
    b.append(f'<g fill="#ffb04a">{embers}</g>')
    return menu('#140a08', '#1c0d0a', '#4a1c10', ''.join(b))


def menu_frost():
    rnd = random.Random(109)
    defs = ('<linearGradient id="snowcap" x1="0" y1="440" x2="0" y2="690" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#e6f0fa"/>'
            '<stop offset=".35" stop-color="#9fb6cc"/><stop offset=".6" stop-color="#3a4c62"/><stop offset="1" stop-color="#26364a"/></linearGradient>'
            '<linearGradient id="aur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cf0c8" stop-opacity="0"/>'
            '<stop offset=".6" stop-color="#7cf0c8" stop-opacity=".35"/><stop offset="1" stop-color="#7cc6ff" stop-opacity="0"/></linearGradient>')
    b = [stars(rnd, 80, 200, 560, 1.2, '#e8f4ff')]
    for y0, amp, op in [(300, 50, .55), (360, 40, .4)]:
        line = ridge(rnd, y0, amp, rough=.5, iters=5)
        top = 'M' + pts(line)
        bottom = ' L' + pts([(x, y + 120) for x, y in reversed(line)]) + ' Z'
        b.append(f'<path d="{top}{bottom}" fill="url(#aur)" opacity="{op}" filter="url(#b8)"/>')
    peaks = ridge(rnd, 590, 170, rough=.52)
    b.append(f'<path d="{ridge_path(peaks)}" fill="url(#snowcap)"/>')
    b.append(f'<path d="{ridge_path(ridge(rnd, 730, 50))}" fill="#1a2634"/>')
    d = ' '.join(pine(rnd.uniform(-20, W + 20), 800 + rnd.uniform(-8, 8), h, h * .4) for h in [rnd.uniform(70, 130) for _ in range(40)])
    b.append(f'<path d="{d}" fill="#101a24"/><rect y="800" width="{W}" height="110" fill="#5a7088"/>')
    b.append(f'<rect y="792" width="{W}" height="26" fill="#a8c0d6" opacity=".45" filter="url(#b8)"/>')
    flakes = ''.join(f'<circle cx="{f(rnd.uniform(0, W))}" cy="{f(rnd.uniform(0, 880))}" r="{f(rnd.uniform(.8, 2.2))}" opacity="{f(rnd.uniform(.2, .7))}"/>' for _ in range(120))
    b.append(f'<g fill="#fff">{flakes}</g>')
    return menu('#0a1016', '#0e1a26', '#2a4660', ''.join(b), defs)


def menu_royal():
    rnd = random.Random(113)
    defs = ('<pattern id="fleur" width="90" height="90" patternUnits="userSpaceOnUse">'
            '<path d="M45,22 C50,30 52,38 45,50 C38,38 40,30 45,22 Z M45,50 C36,46 28,48 26,56 C32,52 38,52 45,56 Z '
            'M45,50 C54,46 62,48 64,56 C58,52 52,52 45,56 Z M38,58 L52,58 L52,61 L38,61 Z M45,61 L42,70 L48,70 Z" fill="#e6c06a"/></pattern>')
    b = [f'<rect width="{W}" height="{H}" fill="url(#fleur)" opacity=".05"/>']
    # Tentures qui descendent du haut, bordées d'or.
    for x, w, h in [(40, 150, 620), (230, 110, 460), (1390, 170, 640), (1250, 110, 440)]:
        d = f'M{x},0 L{x + w},0 L{x + w},{h} L{x + w / 2},{h - 46} L{x},{h} Z'
        b.append(f'<path d="{d}" fill="#5c1622"/><path d="{d}" fill="url(#fleur)" opacity=".25"/>')
        b.append(f'<path d="M{x + 8},0 L{x + 8},{h - 10} M{x + w - 8},0 L{x + w - 8},{h - 10}" stroke="#d9a441" stroke-width="3" opacity=".7"/>')
        b.append(f'<circle cx="{x + w / 2}" cy="{h * .45}" r="{w * .22}" fill="none" stroke="#e6c06a" stroke-width="4" opacity=".75"/>')
    b.append(f'<path d="M0,820 L{W},820 L{W},{H} L0,{H} Z" fill="#1a0a10"/><path d="M0,820 L{W},820" stroke="#d9a441" stroke-width="3" opacity=".5"/>')
    for x in range(0, W, 120):
        b.append(f'<rect x="{x + 20}" y="790" width="80" height="30" fill="#24101a"/><rect x="{x + 20}" y="786" width="80" height="6" fill="#3a1a26"/>')
    b.append('<ellipse cx="800" cy="600" rx="520" ry="220" fill="#e6c06a" opacity=".06" filter="url(#b50)"/>')
    return menu('#12080c', '#180a10', '#3a1420', ''.join(b), defs, .55)


def menu_astral():
    rnd = random.Random(127)
    b = []
    for cx, cy, rx, ry, col, op in [(400, 620, 460, 180, '#5b2a9a', .35), (1200, 560, 420, 200, '#1f5f9a', .3), (800, 820, 600, 160, '#8a2a6a', .25)]:
        b.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{col}" opacity="{op}" filter="url(#b50)"/>')
    b.append(stars(rnd, 260, 120, H, 1.5))
    b.append('<circle cx="1260" cy="980" r="420" fill="#1a1440"/><circle cx="1260" cy="980" r="420" fill="none" stroke="#9b7cf2" stroke-width="3" opacity=".5"/>')
    b.append('<ellipse cx="1260" cy="980" rx="620" ry="90" fill="none" stroke="#e2b65c" stroke-width="2" opacity=".35" transform="rotate(-8 1260 980)"/>')
    b.append('<circle cx="320" cy="520" r="28" fill="#d8d0f8" opacity=".85"/><circle cx="312" cy="512" r="28" fill="#140f36" opacity=".55"/>')
    return menu('#070616', '#0b0a22', '#1c1648', ''.join(b))


FILES = {
    'board-battlefield.svg': board_battlefield,
    'board-forest.svg': board_forest,
    'board-throne.svg': board_throne,
    'board-dragon.svg': board_dragon,
    'board-ether.svg': board_ether,
    'menu-citadel.svg': menu_citadel,
    'menu-sylvan.svg': menu_sylvan,
    'menu-ember.svg': menu_ember,
    'menu-frost.svg': menu_frost,
    'menu-royal.svg': menu_royal,
    'menu-astral.svg': menu_astral,
}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in FILES.items():
        data = fn()
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
            fh.write(data)
        print(f'{name}: {len(data) // 1024} Ko')
