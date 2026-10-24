"""Bruitages d'Arcane Table : un son par événement de jeu (les noms sont ceux de Forge), plus ceux de
l'interface (bouton, boosters). Bois, parchemin, métal, cloches et magie, dans l'esprit médiéval fantastique.

Usage : python3 sfx.py DOSSIER_SORTIE
"""
import math
import os
import sys

import numpy as np

import synth as s

SR = s.SR
rng = np.random.default_rng(2024)


def T(sec):
    return np.arange(s.seconds(sec)) / SR


def noise(sec):
    return rng.normal(0, 1, s.seconds(sec))


def expdec(sec, tau, attack=0.002):
    t = T(sec)
    return np.exp(-t / tau) * np.clip(t / max(attack, 1e-4), 0, 1)


def place(dst, src, at, gain=1.0):
    i = s.seconds(at)
    n = min(len(src), len(dst) - i)
    if n > 0:
        piece = src[:n] * gain
        if n < len(src):
            # son coupé par la fin du tampon : il s'éteint au lieu de claquer
            f = min(n, s.seconds(0.03))
            piece[n - f:] *= np.linspace(1, 0, f)
        dst[i:i + n] += piece
    return dst


def buf(sec):
    # de la marge : les sons s'éteignent d'eux-mêmes, finish() retire le silence final
    return np.zeros(s.seconds(sec + 2.5))


def sweep_tone(f0, f1, sec, shape='exp'):
    t = T(sec)
    if shape == 'exp':
        f = f0 * (f1 / f0) ** (t / sec)
    else:
        f = f0 + (f1 - f0) * t / sec
    return np.sin(2 * math.pi * np.cumsum(f) / SR)


def noise_sweep(lo0, hi0, lo1, hi1, sec, steps=12):
    """Bruit dont la bande passante glisse (morceaux filtrés enchaînés en fondu)."""
    out = np.zeros(s.seconds(sec))
    seg = sec / steps
    for k in range(steps):
        a = k / max(1, steps - 1)
        lo = lo0 + (lo1 - lo0) * a
        hi = hi0 + (hi1 - hi0) * a
        piece = s.bandpass(noise(seg * 2), lo, hi) * np.hanning(s.seconds(seg * 2))
        place(out, piece, k * seg - seg * 0.5 if k else 0)
    return out


def knock(f=180, sec=0.12, tau=0.025, bright=0.3):
    """Coup sur du bois."""
    t = T(sec)
    y = np.sin(2 * math.pi * f * t) * np.exp(-t / tau) + 0.5 * np.sin(2 * math.pi * f * 2.3 * t) * np.exp(-t / (tau * 0.6))
    y += s.bandpass(noise(sec), 600, 4000) * np.exp(-t / 0.006) * bright
    return y


def thud(f=70, sec=0.35, tau=0.09):
    t = T(sec)
    fr = f * (1 + 0.8 * np.exp(-t / 0.02))
    y = np.sin(2 * math.pi * np.cumsum(fr) / SR) * np.exp(-t / tau)
    y += s.lowpass(noise(sec), 700) * np.exp(-t / 0.015) * 0.4
    return y


def chime(notes, step=0.07, kind='celesta', sec=1.2, gain=1.0):
    sec = max(sec, 2.0)
    out = buf(sec + step * len(notes))
    for k, n in enumerate(notes):
        place(out, s.bell(s.hz(s.midi(n)), sec, rng, vel=1.0, kind=kind), k * step, gain)
    return out


def shimmer(sec=0.8, density=40, lo=3000, hi=9000, gain=0.25):
    """Poussière d'étoiles : petits tintements aigus au hasard."""
    out = buf(sec)
    for _ in range(int(density * sec)):
        f = rng.uniform(lo, hi)
        d = rng.uniform(0.04, 0.15)
        t = T(d)
        ping = np.sin(2 * math.pi * f * t) * np.exp(-t / (d / 4))
        place(out, ping, rng.uniform(0, sec - d), rng.uniform(0.3, 1.0) * gain)
    return out * np.linspace(1, 0.3, len(out))


def swell(y, attack, release=0.04):
    n = len(y)
    a = min(n, s.seconds(attack))
    r = min(n - a, s.seconds(release))
    env = np.ones(n)
    env[:a] = np.linspace(0, 1, a) ** 2
    if r > 0:
        env[n - r:] *= np.linspace(1, 0, r)
    return y * env


def reverb(y, decay=0.8, wet=0.3):
    y = s.fade(y.copy(), 0.0, 0.03)
    ir = s.impulse(decay, rng, predelay=0.01)[:, 0]
    w = np.convolve(y, ir)[: len(y) + len(ir) - 1]
    out = np.zeros(len(w))
    out[: len(y)] = y
    return out + w * wet * 0.15


def finish(y, peak=0.7, tail=0.03):
    y = s.highpass(y, 30)
    m = np.max(np.abs(y)) + 1e-9
    y = y / m * peak
    mag = np.abs(y)
    last = np.nonzero(mag > 1e-3)[0]
    if len(last):
        y = y[: min(len(y), last[-1] + s.seconds(0.02))]
    return s.fade(y, 0.0005, tail)


# ---------------------------------------------------------------- interface et cartes

def button_press():
    y = buf(0.07)
    place(y, knock(1500, 0.06, 0.006, bright=0.6), 0, 0.6)
    place(y, knock(2600, 0.05, 0.004, bright=0.2), 0, 0.3)
    return finish(y, 0.35)


def tap():
    y = buf(0.22)
    place(y, noise_sweep(1500, 5000, 900, 3500, 0.14) * 0.6, 0)
    place(y, knock(160, 0.12, 0.03, 0.15), 0.07, 0.7)
    return finish(y, 0.5)


def untap():
    y = noise_sweep(900, 3000, 2000, 7000, 0.13) * 0.7
    return finish(y, 0.4)


def draw():
    y = noise_sweep(800, 2500, 2500, 8000, 0.18)
    return finish(y, 0.45)


def shuffle():
    y = buf(0.8)
    t = 0.0
    k = 0
    while t < 0.62:
        click = s.bandpass(noise(0.012), 2000, 7000) * expdec(0.012, 0.003)
        place(y, click, t, rng.uniform(0.5, 1.0))
        t += 0.008 + 0.02 * (1 - k / 40) * rng.uniform(0.6, 1.2)
        k += 1
    place(y, knock(140, 0.15, 0.03, 0.2), 0.64, 1.2)
    return finish(y, 0.5)


def discard():
    y = buf(0.3)
    place(y, noise_sweep(3000, 8000, 1500, 5000, 0.09) * 0.6, 0)
    place(y, knock(120, 0.18, 0.04, 0.1), 0.08)
    return finish(y, 0.45)


def flip_card():
    y = buf(0.15)
    place(y, s.bandpass(noise(0.05), 2500, 9000) * expdec(0.05, 0.01), 0)
    place(y, knock(900, 0.05, 0.006, 0.4), 0.035, 0.5)
    return finish(y, 0.4)


def booster_open():
    """Le paquet se déchire, puis souffle de magie."""
    y = buf(0.9)
    t = 0.0
    while t < 0.32:
        g = s.bandpass(noise(0.01), 1500, 9000) * expdec(0.01, 0.003)
        place(y, g, t, rng.uniform(0.3, 1.0))
        t += rng.uniform(0.003, 0.012)
    place(y, swell(noise_sweep(300, 1200, 2000, 9000, 0.5), 0.2) * 0.4, 0.25)
    place(y, shimmer(0.5, 30), 0.35)
    return finish(reverb(y, 1.0, 0.3), 0.6)


def reveal_rare():
    y = chime(['E5', 'G#5', 'B5', 'E6', 'G#6'], 0.05, 'glock', 1.0)
    place(y, shimmer(1.0, 25, gain=0.2), 0.15)
    return finish(reverb(y, 1.5, 0.4), 0.6)


def reveal_mythic():
    y = buf(2.2)
    place(y, s.choir(s.hz(s.midi('A3')), 1.2, rng, vowel='a', release=0.8), 0, 0.6)
    place(y, s.choir(s.hz(s.midi('E4')), 1.2, rng, vowel='a', release=0.8), 0, 0.5)
    place(y, s.choir(s.hz(s.midi('C#5')), 1.2, rng, vowel='a', release=0.8), 0, 0.4)
    place(y, chime(['A5', 'C#6', 'E6', 'A6'], 0.06, 'glock', 1.2), 0.25, 0.7)
    place(y, s.bell(s.hz(s.midi('A4')), 2.0, rng, kind='bell'), 0.25, 0.5)
    place(y, shimmer(1.4, 40, gain=0.3), 0.2)
    return finish(reverb(y, 2.0, 0.45), 0.7)


# ---------------------------------------------------------------- sorts et permanents

def creature():
    y = buf(1.0)
    place(y, swell(s.lowpass(noise(0.45), 600), 0.3) * 0.5, 0)
    place(y, thud(65, 0.5, 0.12), 0.32, 0.9)
    for n in ('D3', 'A3', 'D4'):
        place(y, s.lute(s.hz(s.midi(n)), 0.7, rng), 0.33, 0.35)
    return finish(reverb(y, 1.0, 0.25), 0.65)


def artifact():
    y = buf(1.0)
    t = T(1.0)
    metal = sum(a * np.sin(2 * math.pi * f * t) * np.exp(-t / d) for f, a, d in
                ((523, 1.0, 0.25), (1347, 0.7, 0.15), (2263, 0.5, 0.1), (3517, 0.35, 0.07), (4889, 0.2, 0.05)))
    place(y, metal + s.bandpass(noise(1.0), 2000, 8000) * np.exp(-t / 0.01) * 0.8, 0)
    return finish(reverb(y, 0.8, 0.25), 0.55)


def artifact_creature():
    y = buf(0.9)
    place(y, artifact(), 0, 0.8)
    t = T(0.5)
    whirr = s.lowpass(np.sign(np.sin(2 * math.pi * 55 * t)) * (0.5 + 0.5 * np.sin(2 * math.pi * 18 * t)), 900) * np.exp(-t / 0.18)
    place(y, whirr * 0.5, 0.05)
    place(y, thud(70, 0.4, 0.1), 0.15, 0.6)
    return finish(y, 0.6)


def enchant():
    y = chime(['C6', 'E6', 'G6', 'C7', 'E7'], 0.055, 'celesta', 1.0)
    pad = s.strings(s.hz(s.midi('C4')), 0.6, rng, release=0.5) + s.strings(s.hz(s.midi('G4')), 0.6, rng, release=0.5)
    place(y, pad * 0.4, 0)
    place(y, shimmer(0.9, 30, gain=0.18), 0.05)
    return finish(reverb(y, 1.6, 0.4), 0.6)


def instant():
    y = buf(0.6)
    t = T(0.16)
    place(y, sweep_tone(600, 2600, 0.16) * np.exp(-t / 0.08) * 0.5, 0)
    place(y, noise_sweep(1000, 3000, 4000, 10000, 0.16) * 0.4, 0)
    place(y, shimmer(0.45, 50, 4000, 10000, 0.3), 0.08)
    return finish(reverb(y, 0.9, 0.3), 0.55)


def sorcery():
    y = buf(1.3)
    place(y, swell(noise_sweep(200, 800, 600, 3000, 0.5), 0.35) * 0.5, 0)
    for n, g in (('A3', 0.6), ('C4', 0.5), ('E4', 0.5), ('A4', 0.4)):
        place(y, s.bell(s.hz(s.midi(n)), 2.2, rng, kind='celesta'), 0.42, g)
    place(y, thud(55, 0.5, 0.15), 0.42, 0.6)
    return finish(reverb(y, 1.8, 0.4), 0.6)


def planeswalker():
    y = buf(2.4)
    for n, g in (('D3', 0.6), ('A3', 0.5), ('D4', 0.45), ('F#4', 0.4)):
        place(y, s.choir(s.hz(s.midi(n)), 1.0, rng, vowel='a', release=0.9), 0, g)
    place(y, s.horn(s.hz(s.midi('D4')), 0.8, rng), 0.25, 0.5)
    place(y, s.horn(s.hz(s.midi('A4')), 0.6, rng), 0.45, 0.4)
    place(y, s.bell(s.hz(s.midi('D5')), 1.8, rng, kind='bell'), 0.3, 0.4)
    place(y, shimmer(1.2, 30, gain=0.2), 0.3)
    return finish(reverb(y, 2.2, 0.45), 0.7)


def token():
    y = buf(0.5)
    t = T(0.08)
    place(y, sweep_tone(900, 300, 0.08) * np.exp(-t / 0.03), 0)
    place(y, s.bell(s.hz(s.midi('G6')), 0.4, rng, kind='glock'), 0.04, 0.4)
    return finish(reverb(y, 0.6, 0.2), 0.45)


def equip():
    y = buf(0.6)
    scrape = s.bandpass(noise(0.3), 3000, 9000) * (0.5 + 0.5 * np.sin(2 * math.pi * 40 * T(0.3))) * np.hanning(s.seconds(0.3))
    place(y, scrape * 0.5, 0)
    t = T(0.3)
    clink = sum(a * np.sin(2 * math.pi * f * t) * np.exp(-t / 0.06) for f, a in ((2400, 1), (3900, 0.6), (5300, 0.4)))
    place(y, clink * 0.6, 0.27)
    return finish(reverb(y, 0.7, 0.25), 0.5)


def add_counter():
    y = chime(['E6', 'B6'], 0.06, 'glock', 0.3)
    return finish(y, 0.4)


def remove_counter():
    y = chime(['B6', 'E6'], 0.06, 'glock', 0.3)
    return finish(y, 0.35)


def block():
    y = buf(0.5)
    place(y, thud(90, 0.4, 0.07), 0)
    place(y, knock(220, 0.2, 0.04, 0.5), 0, 0.6)
    t = T(0.4)
    ring = sum(a * np.sin(2 * math.pi * f * t) * np.exp(-t / 0.12) for f, a in ((680, 1), (1730, 0.5), (2810, 0.3)))
    place(y, ring * 0.35, 0.005)
    return finish(y, 0.6)


def damage():
    y = buf(0.35)
    t = T(0.3)
    place(y, sweep_tone(170, 45, 0.3) * np.exp(-t / 0.08), 0)
    place(y, s.lowpass(noise(0.1), 3000) * expdec(0.1, 0.015), 0, 0.6)
    return finish(y, 0.65)


def destroy():
    y = buf(1.0)
    place(y, s.lowpass(noise(0.6), 2500) * expdec(0.6, 0.12) * 0.6, 0)
    for _ in range(26):
        f = rng.uniform(2500, 7500)
        d = rng.uniform(0.05, 0.25)
        tt = T(d)
        shard = np.sin(2 * math.pi * f * tt) * np.exp(-tt / (d / 3)) + 0.5 * np.sin(2 * math.pi * f * 2.7 * tt) * np.exp(-tt / (d / 5))
        place(y, shard, rng.uniform(0, 0.35) ** 1.5, rng.uniform(0.1, 0.35))
    place(y, thud(60, 0.4, 0.1), 0, 0.6)
    return finish(reverb(y, 1.0, 0.3), 0.65)


def sacrifice():
    y = buf(1.2)
    place(y, noise_sweep(1500, 5000, 150, 600, 0.7) * 0.7, 0)
    place(y, s.choir(s.hz(s.midi('D3')), 0.6, rng, vowel='o', release=0.5), 0.1, 0.5)
    place(y, s.choir(s.hz(s.midi('Eb3')), 0.6, rng, vowel='o', release=0.5), 0.1, 0.35)
    place(y, thud(50, 0.5, 0.15), 0.55, 0.6)
    return finish(reverb(y, 1.6, 0.4), 0.6)


def exile():
    y = buf(1.2)
    rise = swell(noise_sweep(400, 2000, 3000, 12000, 0.6), 0.55) * 0.5
    place(y, rise, 0)
    for n in ('E5', 'B5', 'F#6'):
        tone = s.bell(s.hz(s.midi(n)), 0.6, rng, kind='celesta')[::-1]
        place(y, tone * 0.5, 0.0)
    place(y, shimmer(0.5, 50, 5000, 12000, 0.3), 0.6)
    return finish(reverb(y, 1.4, 0.4), 0.55)


def life_gain():
    y = chime(['G5', 'C6', 'E6', 'G6'], 0.07, 'celesta', 0.9)
    place(y, shimmer(0.7, 25, gain=0.15), 0.1)
    return finish(reverb(y, 1.2, 0.35), 0.5)


def life_loss():
    y = buf(0.6)
    t = T(0.45)
    place(y, sweep_tone(320, 170, 0.45) * np.exp(-t / 0.18) * 0.7, 0)
    place(y, thud(75, 0.3, 0.07), 0, 0.5)
    return finish(reverb(y, 0.8, 0.25), 0.55)


def poison():
    y = buf(0.8)
    for k in range(9):
        d = rng.uniform(0.04, 0.08)
        tt = T(d)
        f0 = rng.uniform(220, 520)
        bub = sweep_tone(f0, f0 * 2.2, d) * np.sin(np.pi * tt / d) ** 2
        place(y, bub, k * 0.07 + rng.uniform(0, 0.02), rng.uniform(0.4, 0.9))
    return finish(reverb(y, 0.6, 0.2), 0.5)


def mana_burn():
    y = buf(0.8)
    t = T(0.7)
    place(y, s.highpass(noise(0.7), 3000) * np.exp(-t / 0.3) * 0.3, 0)
    for _ in range(40):
        c = s.bandpass(noise(0.004), 2000, 9000)
        place(y, c, rng.uniform(0, 0.6), rng.uniform(0.3, 1))
    return finish(y, 0.5)


# ---------------------------------------------------------------- terrains

def land_base():
    y = buf(0.5)
    place(y, thud(68, 0.45, 0.1), 0)
    place(y, s.lowpass(noise(0.15), 1500) * expdec(0.15, 0.03) * 0.5, 0)
    return y


def white_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.8))])
    place(y, chime(['E5', 'G#5', 'B5'], 0.04, 'bell', 1.0), 0.03, 0.35)
    return finish(reverb(y, 1.4, 0.35), 0.55)


def blue_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.5))])
    for k, f in enumerate((700, 950, 1250)):
        d = 0.09
        tt = T(d)
        drop = sweep_tone(f, f * 2.6, d) * np.exp(-tt / 0.03)
        place(y, drop, 0.04 + k * 0.11, 0.45)
    return finish(reverb(y, 1.0, 0.35), 0.55)


def black_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.9))])
    place(y, s.bell(s.hz(s.midi('D3')), 1.2, rng, kind='bell'), 0.02, 0.5)
    place(y, s.choir(s.hz(s.midi('D3')), 0.5, rng, vowel='u', release=0.5), 0.02, 0.3)
    return finish(reverb(y, 1.5, 0.35), 0.55)


def red_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.6))])
    for _ in range(45):
        c = s.bandpass(noise(0.006), 1500, 7000) * expdec(0.006, 0.0015)
        place(y, c, rng.uniform(0.02, 0.7) ** 1.3, rng.uniform(0.2, 0.8))
    place(y, s.lowpass(noise(0.6), 400) * expdec(0.6, 0.2) * 0.5, 0.02)
    return finish(reverb(y, 0.9, 0.25), 0.55)


def green_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.5))])
    for _ in range(30):
        leaf = s.bandpass(noise(0.03), 2000, 6000) * np.hanning(s.seconds(0.03))
        place(y, leaf, rng.uniform(0.0, 0.5), rng.uniform(0.1, 0.4))
    place(y, knock(200, 0.15, 0.04, 0.2), 0.02, 0.5)
    return finish(reverb(y, 0.9, 0.3), 0.55)


def other_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.2))])
    place(y, s.bandpass(noise(0.2), 400, 2500) * expdec(0.2, 0.04) * 0.5, 0.01)
    return finish(reverb(y, 0.8, 0.25), 0.55)


def multi_land():
    y = land_base()
    y = np.concatenate([y, np.zeros(s.seconds(0.8))])
    place(y, chime(['D5', 'A5', 'D6'], 0.05, 'celesta', 1.0), 0.03, 0.35)
    return finish(reverb(y, 1.3, 0.35), 0.55)


# ---------------------------------------------------------------- partie

def end_of_turn():
    y = s.bell(s.hz(s.midi('A3')), 1.6, rng, kind='bell')
    return finish(reverb(y, 1.6, 0.35), 0.4)


def start_duel():
    y = buf(2.4)
    place(y, s.horn(s.hz(s.midi('D4')), 0.45, rng), 0, 0.7)
    place(y, s.horn(s.hz(s.midi('A4')), 0.9, rng), 0.5, 0.7)
    place(y, s.horn(s.hz(s.midi('D3')), 1.3, rng), 0.5, 0.45)
    place(y, s.frame_drum(0.6, rng), 0.0, 0.5)
    place(y, s.frame_drum(0.6, rng), 0.5, 0.6)
    return finish(reverb(y, 2.0, 0.4), 0.7)


def win_duel():
    y = buf(3.6)
    for k, n in enumerate(('D4', 'F#4', 'A4')):
        place(y, s.horn(s.hz(s.midi(n)), 0.22, rng), k * 0.2, 0.6)
    for n, g in (('D4', 0.55), ('F#4', 0.5), ('A4', 0.5), ('D5', 0.55)):
        place(y, s.horn(s.hz(s.midi(n)), 1.4, rng), 0.62, g)
    place(y, s.horn(s.hz(s.midi('D3')), 1.5, rng), 0.62, 0.4)
    place(y, chime(['D6', 'F#6', 'A6', 'D7'], 0.08, 'glock', 1.6), 0.62, 0.35)
    place(y, s.frame_drum(0.7, rng), 0.62, 0.6)
    place(y, shimmer(1.6, 25, gain=0.2), 0.7)
    return finish(reverb(y, 2.2, 0.4), 0.75)


def lose_duel():
    y = buf(3.6)
    for k, n in enumerate(('A3', 'G3', 'F3', 'E3')):
        place(y, s.strings(s.hz(s.midi(n)), 0.7, rng, release=0.6), k * 0.55, 0.6)
        place(y, s.choir(s.hz(s.midi(n) + 12), 0.7, rng, vowel='o', release=0.6), k * 0.55, 0.35)
    place(y, s.bell(s.hz(s.midi('E3')), 2.0, rng, kind='bell'), 1.65, 0.4)
    return finish(reverb(y, 2.4, 0.45), 0.65)


def coins_drop():
    y = buf(1.0)
    times = np.sort(rng.uniform(0, 0.55, 9))
    for tt0 in times:
        d = 0.25
        t = T(d)
        f = rng.uniform(3200, 5200)
        coin = sum(a * np.sin(2 * math.pi * f * r * t) * np.exp(-t / (0.06 / r)) for r, a in ((1, 1), (1.53, 0.5), (2.3, 0.3)))
        place(y, coin, tt0, rng.uniform(0.3, 0.8))
    return finish(reverb(y, 0.7, 0.2), 0.5)


def flip_coin():
    y = buf(1.0)
    t = T(0.25)
    place(y, np.sin(2 * math.pi * 4200 * t) * np.exp(-t / 0.08), 0, 0.6)
    t2 = T(0.5)
    spin = np.sin(2 * math.pi * 3300 * t2) * (0.5 + 0.5 * np.sin(2 * math.pi * (20 + 30 * t2) * t2)) * np.exp(-t2 / 0.3) * 0.25
    place(y, spin, 0.1)
    place(y, knock(2600, 0.15, 0.03, 0.5), 0.6, 0.5)
    return finish(y, 0.5)


def roll_die():
    y = buf(0.9)
    t = 0.0
    gap = 0.05
    for k in range(8):
        place(y, knock(rng.uniform(700, 1100), 0.06, 0.008, 0.6), t, 0.8 - 0.07 * k)
        t += gap
        gap *= 1.18
    return finish(y, 0.5)


def daytime():
    y = buf(2.0)
    for n, g in (('C4', 0.4), ('E4', 0.35), ('G4', 0.35)):
        place(y, s.strings(s.hz(s.midi(n)), 1.0, rng, release=0.7), 0, g)
    for k in range(4):
        d = 0.09
        f0 = rng.uniform(2500, 3500)
        chirp = sweep_tone(f0, f0 * 1.4, d) * np.sin(np.pi * T(d) / d)
        place(y, chirp, 0.5 + k * 0.17, 0.2)
    return finish(reverb(y, 1.6, 0.4), 0.5)


def nighttime():
    y = buf(2.0)
    for n, g in (('A3', 0.4), ('C4', 0.35), ('E4', 0.3)):
        place(y, s.strings(s.hz(s.midi(n)), 1.0, rng, release=0.7), 0, g)
    for k, at in enumerate((0.7, 1.0)):
        d = 0.25
        hoot = np.sin(2 * math.pi * (420 - 30 * k) * T(d)) * np.sin(np.pi * T(d) / d) ** 2
        place(y, hoot, at, 0.25)
    return finish(reverb(y, 1.8, 0.45), 0.45)


def phasing():
    t = T(0.8)
    y = np.sin(2 * math.pi * 600 * t + 4 * np.sin(2 * math.pi * 7 * t)) * np.sin(np.pi * t / 0.8)
    y += noise_sweep(500, 2000, 4000, 9000, 0.8) * 0.3
    return finish(reverb(y, 1.0, 0.35), 0.45)


def regeneration():
    notes = ['G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5', 'B5', 'D6']
    y = buf(1.4)
    for k, n in enumerate(notes):
        place(y, s.harp(s.hz(s.midi(n)), 0.8, rng), k * 0.045, 0.4)
    return finish(reverb(y, 1.4, 0.4), 0.55)


def rewind():
    y = swell(noise_sweep(4000, 9000, 500, 2000, 0.6), 0.5)
    return finish(reverb(y[::-1].copy(), 0.8, 0.3), 0.45)


def speedup():
    y = swell(noise_sweep(300, 900, 3000, 10000, 0.5), 0.3) * 0.7 + sweep_tone(300, 1200, 0.5) * np.sin(np.pi * T(0.5) / 0.5) * 0.3
    return finish(y, 0.45)


def sprocket():
    y = buf(0.4)
    for k in range(4):
        place(y, knock(rng.uniform(1800, 2600), 0.05, 0.005, 0.7), k * 0.07, 0.7)
    return finish(y, 0.4)


def take_shard():
    y = chime(['B6', 'F#7'], 0.05, 'glock', 0.6)
    place(y, shimmer(0.4, 40, 6000, 12000, 0.2), 0)
    return finish(reverb(y, 1.0, 0.35), 0.45)


EFFECTS = {f.__name__: f for f in [
    button_press, tap, untap, draw, shuffle, discard, flip_card, booster_open, reveal_rare, reveal_mythic,
    creature, artifact, artifact_creature, enchant, instant, sorcery, planeswalker, token, equip,
    add_counter, remove_counter, block, damage, destroy, sacrifice, exile, life_gain, life_loss, poison, mana_burn,
    white_land, blue_land, black_land, red_land, green_land, other_land, multi_land,
    end_of_turn, start_duel, win_duel, lose_duel, coins_drop, flip_coin, roll_die, daytime, nighttime,
    phasing, regeneration, rewind, speedup, sprocket, take_shard,
]}

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, fn in EFFECTS.items():
        y = fn()
        s.write_wav(os.path.join(out, name + '.wav'), y)
    print(f'{len(EFFECTS)} bruitages dans {out}')
