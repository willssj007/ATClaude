"""Musiques d'Arcane Table : huit morceaux médiévaux et féeriques, composés ici (mélodies, accords,
arrangements) et rendus par synth.py. Quatre pour les menus, quatre pour les parties (plus discrets).

Usage : python3 music.py DOSSIER_SORTIE [nom...]
"""
import os
import sys

import numpy as np

import synth as s

QUALITY = {'': [0, 4, 7], 'm': [0, 3, 7], '5': [0, 7, 12], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7],
           '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11]}
MODES = {'ionian': [0, 2, 4, 5, 7, 9, 11], 'dorian': [0, 2, 3, 5, 7, 9, 10], 'phrygian': [0, 1, 3, 5, 7, 8, 10],
         'lydian': [0, 2, 4, 6, 7, 9, 11], 'mixolydian': [0, 2, 4, 5, 7, 9, 10], 'aeolian': [0, 2, 3, 5, 7, 8, 10]}


def chord(name):
    """« Dm » → (classe de hauteur de la fondamentale, intervalles)."""
    root = name[0]
    rest = name[1:]
    acc = 0
    while rest and rest[0] in '#b':
        acc += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return (s.NOTES[root] + acc) % 12, QUALITY[rest]


def tone(name, idx, octave):
    """Note idx de l'accord (0 fondamentale, 1 tierce, 2 quinte, 3 octave...) à partir de l'octave donnée."""
    pc, ivs = chord(name)
    n = len(ivs)
    return 12 * (octave + 1) + pc + ivs[idx % n] + 12 * (idx // n)


def parse(text, beats):
    """Mélodie « D5:1.5 E5:0.5 | ... » → [(midi ou None, début en temps, durée)], mesures vérifiées."""
    notes = []
    t = 0.0
    for b, bar in enumerate(text.split('|')):
        start = t
        for tok in bar.split():
            name, dur = tok.split(':')
            d = float(dur)
            notes.append((None if name == 'r' else s.midi(name), t, d))
            t += d
        if abs(t - start - beats) > 1e-6:
            raise ValueError(f'mesure {b + 1} : {t - start} temps au lieu de {beats} ({bar.strip()})')
    return notes


def diatonic(m, steps, tonic, mode):
    """Décale une note de « steps » degrés dans la gamme (tierce en dessous : -2)."""
    scale = [(tonic + i) % 12 for i in MODES[mode]]
    pcs = sorted(scale)
    pc = m % 12
    if pc not in pcs:
        return m + (-3 if steps < 0 else 3)
    octave = m // 12
    idx = pcs.index(pc) + steps
    return 12 * (octave + idx // 7) + pcs[idx % 7]


class Song:
    def __init__(self, bpm, beats, bars, seed, lead=0.6):
        self.spb = 60.0 / bpm
        self.beats = beats
        self.lead = lead
        self.rng = np.random.default_rng(seed)
        self.mix = s.Mix(lead + bars * beats * self.spb + 8, seed)

    def at(self, bar, beat=0.0):
        return self.lead + (bar * self.beats + beat) * self.spb

    def play(self, instr, m, bar, beat, dur, vel=0.8, pan=0.0, gain=1.0, rev=0.3, ring=0.0, swing=0.006, **kw):
        if m is None:
            return
        start = self.at(bar, beat) + self.rng.normal(0, swing)
        vel = vel * self.rng.uniform(0.9, 1.05)
        sig = instr(s.hz(m), dur * self.spb + ring, self.rng, vel=vel, **kw)
        self.mix.add(sig, max(0.0, start), pan, gain, rev)

    def melody(self, instr, text, bar0, transpose=0, harmony=None, **kw):
        for m, t, d in parse(text, self.beats):
            if m is None:
                continue
            if harmony:
                m = diatonic(m, *harmony)
            self.play(instr, m + transpose, bar0, t, d, **kw)

    def pattern(self, instr, chords, bar0, pattern, octave, bass_octave=None, **kw):
        """Accompagnement : pattern = [(temps, (indice, octave relative) ou 'b' pour la basse, durée)]."""
        for i, ch in enumerate(chords):
            for beat, what, dur in pattern:
                if what == 'b':
                    m = tone(ch, 0, bass_octave if bass_octave is not None else octave - 1)
                else:
                    idx, rel = what
                    m = tone(ch, idx, octave + rel)
                self.play(instr, m, bar0 + i, beat, dur, **kw)

    def strum(self, instr, chords, bar0, hits, octave, spread=0.018, **kw):
        """Accords grattés : hits = [(temps, durée, force)] ; les cordes sonnent l'une après l'autre."""
        for i, ch in enumerate(chords):
            for beat, dur, vel in hits:
                notes = [tone(ch, 0, octave - 1), tone(ch, 2, octave - 1), tone(ch, 0, octave), tone(ch, 1, octave), tone(ch, 2, octave)]
                for k, m in enumerate(notes):
                    self.play(instr, m, bar0 + i, beat + k * spread / self.spb, dur, vel=vel * (0.8 + 0.05 * k), swing=0.002, **kw)

    def pad(self, instr, chords, bar0, octave, bars_per=1, pans=(-0.55, 0.0, 0.55), **kw):
        i = 0
        while i < len(chords):
            ch = chords[i]
            span = 1
            while i + span < len(chords) and chords[i + span] == ch and span < 4:
                span += 1
            for idx, pan in zip((0, 2, 1 + 3), pans):
                m = tone(ch, idx, octave)
                self.play(instr, m, bar0 + i, 0, span * self.beats, pan=pan, swing=0.0, **kw)
            i += span

    def drone(self, notes, bar0, bars, gain=0.2, rev=0.25):
        start = self.at(bar0)
        length = bars * self.beats * self.spb
        for k, n in enumerate(notes):
            sig = s.drone(s.hz(s.midi(n)), length, self.rng)
            self.mix.add(sig, start, (-0.3, 0.3)[k % 2], gain, rev)

    def hit(self, fn, bar, beat, gain=0.5, pan=0.0, rev=0.2, **kw):
        sig = fn(rng=self.rng, **kw)
        self.mix.add(sig, max(0.0, self.at(bar, beat) + self.rng.normal(0, 0.004)), pan, gain, rev)

    def render(self, **kw):
        return self.mix.render(**kw)


# ======================================================================== menus

def repos():
    """Le Repos du Voyageur — ré dorien, 3/4. Luth, flûte à bec, cordes, tambour léger."""
    A1 = 'D5:1.5 E5:0.5 F5:1 | E5:1 D5:1 C5:1 | D5:1 A4:1 B4:1 | A4:3 | F5:1.5 G5:0.5 A5:1 | G5:1 F5:1 E5:1 | F5:1 E5:1 C5:1 | D5:3'
    A2 = 'A5:1.5 G5:0.5 F5:1 | G5:1 E5:1 C5:1 | D5:1 B4:1 G4:1 | A4:2 r:1 | F4:1 A4:1 C5:1 | B4:1 A4:1 G4:1 | A4:1.5 B4:0.5 C5:1 | D5:3'
    B = 'C5:1 F5:1 A5:1 | G5:2 F5:0.5 E5:0.5 | F5:1 D5:1 A4:1 | C5:3 | A4:1 C5:1 F5:1 | E5:1 G5:1 C6:1 | B5:1 A5:1 G5:1 | A5:3'
    cA1 = 'Dm C G Am F C C Dm'.split()
    cA2 = 'Dm C G Am F G Am Dm'.split()
    cB = 'F C Dm C F C G Am'.split()
    intro = 'Dm Dm C Dm'.split()
    outro = 'Dm C Dm Dm'.split()
    form = [('intro', intro), ('A1', cA1), ('A2', cA2), ('B', cB), ('A1b', cA1), ('A2b', cA2), ('outro', outro)]
    bars = sum(len(c) for _, c in form)
    song = Song(84, 3, bars, seed=11)
    lute = [(0, 'b', 3), (1, (2, -1), 1.5), (1.5, (0, 0), 1.5), (2, (1, 0), 1), (2.5, (2, -1), 1)]
    bar = 0
    for name, chords in form:
        song.pattern(s.lute, chords, bar, lute, 4, bass_octave=2, gain=0.55, pan=-0.3, rev=0.25, ring=0.8)
        if name != 'intro' or True:
            song.pad(s.strings, chords, bar, 3, gain=0.16 if name in ('A1', 'A2') else 0.24, rev=0.5)
        if name == 'A1':
            song.melody(s.flute, A1, bar, kind='recorder', gain=0.8, pan=0.1, rev=0.3)
        elif name == 'A2':
            song.melody(s.flute, A2, bar, kind='recorder', gain=0.8, pan=0.1, rev=0.3)
        elif name == 'B':
            song.melody(s.flute, B, bar, kind='recorder', gain=0.8, pan=0.1, rev=0.3)
            for i in (3, 7):
                song.play(s.bell, s.midi('A6') if i == 7 else s.midi('C6'), bar + i, 0, 3, gain=0.18, pan=0.5, rev=0.5, kind='celesta')
        elif name == 'A1b':
            song.melody(s.fiddle, A1, bar, gain=0.55, pan=-0.05, rev=0.32)
            song.melody(s.bell, A1, bar, transpose=12, gain=0.12, pan=0.45, rev=0.5, kind='celesta')
        elif name == 'A2b':
            song.melody(s.flute, A2, bar, kind='recorder', gain=0.75, pan=0.1, rev=0.3)
            song.melody(s.fiddle, A2, bar, harmony=(-2, 2, 'dorian'), gain=0.35, pan=-0.25, rev=0.32)
        if name in ('A1b', 'A2b', 'B'):
            for i in range(len(chords)):
                song.hit(s.frame_drum, bar + i, 0, gain=0.4, pan=0.15, vel=0.9)
                song.hit(s.frame_drum, bar + i, 2, gain=0.22, pan=0.15, vel=0.6, slap=0.5)
        if name == 'outro':
            song.play(s.lute, s.midi('D3'), bar + 3, 0, 3, gain=0.6, ring=2)
            song.play(s.bell, s.midi('D6'), bar + 3, 0, 3, gain=0.15, kind='celesta', rev=0.6)
        bar += len(chords)
    return song.render(decay=2.2, wet=0.32)


def clairiere():
    """La Clairière aux Fées — fa lydien, 4/4. Harpe, célesta, cordes, flûte, carillons."""
    A1 = 'C6:1 A5:1 B5:1 C6:1 | D6:2 B5:1 G5:1 | A5:1 C6:1 F6:2 | E6:1.5 D6:0.5 C6:2 | A5:1 F5:1 A5:1 D6:1 | B5:2 G5:1 A5:1 | G5:1 E5:1 C5:1 E5:1 | F5:4'
    A2 = 'A5:1 C6:1 B5:1 A5:1 | G5:1 B5:1 D6:2 | C6:1 E6:1 D6:1 C6:1 | B5:3 r:1 | D6:1 C6:1 A5:1 F5:1 | G5:1.5 A5:0.5 B5:1 D6:1 | E6:2 D6:1 B5:1 | A5:4'
    B = 'F5:2 A5:2 | B5:3 A5:1 | G5:2 E5:2 | A5:4 | D5:2 F5:2 | G5:2 B5:2 | C6:3 B5:1 | G5:4'
    cA1 = 'F G F Am Dm G C F'.split()
    cA2 = 'F G Am Em Dm G C F'.split()
    cB = 'Dm G Em Am Dm G C C'.split()
    form = [('intro', 'F G F G'.split()), ('A1', cA1), ('A2', cA2), ('B', cB), ('A1b', cA1), ('outro', 'F G F F'.split())]
    bars = sum(len(c) for _, c in form)
    song = Song(72, 4, bars, seed=23)
    harp = [(0, 'b', 4), (0.5, (2, -1), 2), (1, (0, 0), 2), (1.5, (1, 0), 2), (2, (2, 0), 2), (2.5, (1, 0), 1.5), (3, (0, 0), 1.5), (3.5, (2, -1), 1.5)]
    bar = 0
    for name, chords in form:
        song.pattern(s.harp, chords, bar, harp, 4, bass_octave=2, gain=0.42, pan=0.3, rev=0.4, ring=1.2)
        song.pad(s.strings, chords, bar, 3, gain=0.2, rev=0.6)
        if name == 'A1':
            song.melody(s.bell, A1, bar, gain=0.5, pan=-0.15, rev=0.45, kind='celesta', ring=1.0)
        elif name == 'A2':
            song.melody(s.bell, A2, bar, gain=0.5, pan=-0.15, rev=0.45, kind='celesta', ring=1.0)
        elif name == 'B':
            song.melody(s.flute, B, bar, gain=0.7, pan=-0.1, rev=0.4)
            song.pad(s.choir, chords, bar, 3, gain=0.16, rev=0.6, vowel='u')
        elif name == 'A1b':
            song.melody(s.bell, A1, bar, gain=0.42, pan=-0.2, rev=0.45, kind='celesta', ring=1.0)
            song.melody(s.flute, A1, bar, transpose=-12, gain=0.55, pan=0.05, rev=0.4)
        elif name == 'outro':
            for k, n in enumerate(['C6', 'A5', 'F5', 'C5']):
                song.play(s.bell, s.midi(n), bar + 2, k * 0.5, 2, gain=0.3, kind='glock', rev=0.6, pan=0.4 - 0.25 * k)
            song.play(s.bell, s.midi('F6'), bar + 3, 0, 4, gain=0.25, kind='celesta', rev=0.7)
        if name in ('A2', 'A1b'):
            for i in range(0, len(chords), 2):
                song.hit(s.finger_cymbal, bar + i, 0, gain=0.35, pan=0.6, rev=0.5)
        bar += len(chords)
    return song.render(decay=3.2, wet=0.42, bright=0.6)


def cloitre():
    """Le Cloître — la éolien, 4/4 lent. Chœur, bourdon, flûte, cloches."""
    A1 = 'A4:2 C5:1 B4:1 | A4:2 G4:1 A4:1 | E5:2 D5:1 C5:1 | D5:3 r:1 | E5:1.5 D5:0.5 C5:1 B4:1 | A4:2 F4:1 A4:1 | B4:2 G4:1 E4:1 | A4:4'
    A2 = 'C5:2 F5:2 | E5:2 G5:2 | F5:1 E5:1 D5:1 F5:1 | E5:4 | A5:2 G5:1 F5:1 | E5:1 D5:1 E5:1 G5:1 | E5:2 D5:1 B4:1 | A4:4'
    cA1 = 'Am F C G Am Dm Em Am'.split()
    cA2 = 'F C Dm Am F G Em Am'.split()
    form = [('intro', 'Am Am F Am'.split()), ('A1', cA1), ('A2', cA2), ('bells', 'F G Am Am'.split()), ('A1c', cA1), ('outro', 'F G Am Am'.split())]
    bars = sum(len(c) for _, c in form)
    song = Song(58, 4, bars, seed=37)
    song.drone(['A2', 'E3'], 0, bars, gain=0.16, rev=0.4)
    bar = 0
    for name, chords in form:
        song.pad(s.choir, chords, bar, 3, gain=0.3 if name != 'A1c' else 0.2, rev=0.6, vowel='o')
        if name == 'A1':
            song.melody(s.flute, A1, bar, gain=0.75, rev=0.45)
        elif name == 'A2':
            song.melody(s.flute, A2, bar, gain=0.75, rev=0.45)
            song.pattern(s.harp, chords, bar, [(0, 'b', 4), (2, (2, 0), 2), (3, (1, 0), 1)], 4, bass_octave=2, gain=0.3, pan=0.35, rev=0.5, ring=1.5)
        elif name == 'bells':
            for i, ch in enumerate(chords):
                for k in range(3):
                    song.play(s.bell, tone(ch, 2 - k, 5), bar + i, k * 1.2, 3, gain=0.22, kind='bell', rev=0.6, pan=0.5 - 0.5 * k)
        elif name == 'A1c':
            song.melody(s.choir, A1, bar, gain=0.55, rev=0.55, vowel='a', voices=3, release=0.6)
            song.melody(s.bell, A1, bar, transpose=12, gain=0.08, rev=0.6, kind='celesta', pan=0.4)
        elif name == 'outro':
            song.play(s.bell, s.midi('A4'), bar + 2, 0, 8, gain=0.3, kind='bell', rev=0.7)
            song.play(s.flute, s.midi('E5'), bar + 2, 0, 4, gain=0.5, rev=0.5)
            song.play(s.flute, s.midi('A4'), bar + 3, 0, 3.5, gain=0.5, rev=0.5)
        bar += len(chords)
    return song.render(decay=4.2, wet=0.5, bright=0.4)


def fete():
    """La Fête du Village — sol mixolydien, 6/8 dansant. Flûte à bec, vièle, luth gratté, tambourin, tambour."""
    A = 'D5:2 B4:1 G4:2 B4:1 | C5:2 A4:1 F4:2 A4:1 | B4:1 C5:1 D5:1 G5:2 D5:1 | E5:1 D5:1 C5:1 A4:3 | D5:2 B4:1 G4:2 B4:1 | C5:2 A4:1 F5:2 E5:1 | D5:1 C5:1 B4:1 C5:1 A4:1 F#4:1 | G4:6'
    B = 'E5:2 G5:1 E5:2 C5:1 | D5:2 B4:1 G4:3 | F5:2 E5:1 D5:2 C5:1 | D5:3 B4:3 | E5:1 F5:1 G5:1 E5:2 C5:1 | F5:1 E5:1 D5:1 C5:2 A4:1 | B4:2 C5:1 D5:2 A4:1 | G4:6'
    cA = 'G F G D G F D G'.split()
    cB = 'C G F G C F D G'.split()
    form = [('intro', ['G', 'G']), ('A', cA), ('A2', cA), ('B', cB), ('B2', cB), ('A3', cA), ('outro', ['G', 'G'])]
    bars = sum(len(c) for _, c in form)
    song = Song(186, 6, bars, seed=41)
    song.drone(['G2', 'D3'], 0, bars, gain=0.12, rev=0.2)
    bar = 0
    for name, chords in form:
        song.strum(s.lute, chords, bar, [(0, 3, 0.8), (3, 2, 0.6), (5, 1, 0.35)], 4, gain=0.42, pan=-0.35, rev=0.2, ring=0.4)
        for i in range(len(chords)):
            song.hit(s.frame_drum, bar + i, 0, gain=0.5, vel=1.0)
            song.hit(s.frame_drum, bar + i, 3, gain=0.32, vel=0.8, slap=0.5)
            if name != 'intro':
                song.hit(s.tambourine, bar + i, 2, gain=0.55, pan=0.45)
                song.hit(s.tambourine, bar + i, 5, gain=0.4, pan=0.45)
            for e in (1, 4):
                song.hit(s.shaker, bar + i, e, gain=0.4, pan=0.6)
        if name == 'A':
            song.melody(s.flute, A, bar, kind='recorder', gain=0.75, pan=0.1, rev=0.22)
        elif name == 'A2':
            song.melody(s.flute, A, bar, kind='recorder', gain=0.7, pan=0.1, rev=0.22)
            song.melody(s.fiddle, A, bar, transpose=-12, gain=0.4, pan=-0.15, rev=0.25)
        elif name == 'B':
            song.melody(s.flute, B, bar, kind='recorder', gain=0.75, pan=0.1, rev=0.22)
        elif name == 'B2':
            song.melody(s.fiddle, B, bar, gain=0.5, pan=-0.1, rev=0.25)
            song.melody(s.flute, B, bar, kind='recorder', harmony=(-2, 7, 'mixolydian'), gain=0.45, pan=0.25, rev=0.22)
        elif name == 'A3':
            song.melody(s.flute, A, bar, kind='recorder', gain=0.7, pan=0.1, rev=0.22)
            song.melody(s.fiddle, A, bar, harmony=(-2, 7, 'mixolydian'), gain=0.38, pan=-0.2, rev=0.25)
            song.melody(s.bell, A, bar, transpose=12, gain=0.08, pan=0.5, kind='glock', rev=0.3)
        elif name == 'outro':
            song.play(s.flute, s.midi('G5'), bar + 1, 0, 4, kind='recorder', gain=0.6)
        bar += len(chords)
    return song.render(decay=1.6, wet=0.28, bright=0.5)


# ======================================================================== parties

def veillee():
    """Veillée d'Armes — ré éolien, 4/4. Harpe en ostinato, bourdon, grand tambour, vièle, chœur."""
    A1 = 'A4:3 F4:1 | D5:2 C5:1 Bb4:1 | C5:2 E5:2 | D5:4 | F5:2 E5:1 D5:1 | G5:3 F5:1 | F5:1 E5:1 D5:1 Bb4:1 | A4:2 C#5:2'
    A2 = 'D5:2 A5:2 | Bb5:2 A5:1 G5:1 | G5:2 E5:1 C5:1 | F5:2 E5:1 D5:1 | D5:2 Bb4:1 G4:1 | F5:2 D5:2 | E5:2 C#5:1 E5:1 | D5:4'
    cA1 = 'Dm Bb C Dm Dm Gm Bb A'.split()
    cA2 = 'Dm Bb C Dm Gm Bb A Dm'.split()
    form = [('intro', 'Dm Dm Bb C'.split()), ('A1', cA1), ('A2', cA2), ('inter', 'Dm Bb C A'.split()), ('A1b', cA1), ('A2b', cA2), ('outro', 'Dm Bb A Dm'.split())]
    bars = sum(len(c) for _, c in form)
    song = Song(70, 4, bars, seed=53)
    song.drone(['D2', 'A2'], 0, bars, gain=0.14, rev=0.3)
    ost = [(0, 'b', 2), (0.5, (2, -1), 1), (1, (0, 0), 1), (1.5, (1, 0), 1), (2, (2, 0), 1), (2.5, (1, 0), 1), (3, (0, 0), 1), (3.5, (2, -1), 1)]
    bar = 0
    for name, chords in form:
        song.pattern(s.harp, chords, bar, ost, 4, bass_octave=2, gain=0.36, pan=0.3, rev=0.35, ring=0.6)
        for i in range(len(chords)):
            if (bar + i) % 2 == 0:
                song.hit(s.boom, bar + i, 0, gain=0.24, rev=0.35)
            if name not in ('intro', 'outro'):
                song.hit(s.frame_drum, bar + i, 2, gain=0.22, pan=-0.2, vel=0.7, pitch=95)
        if name == 'A1':
            song.melody(s.fiddle, A1, bar, gain=0.55, pan=-0.1, rev=0.35)
        elif name == 'A2':
            song.melody(s.fiddle, A2, bar, gain=0.55, pan=-0.1, rev=0.35)
            song.pad(s.strings, chords, bar, 3, gain=0.15, rev=0.5)
        elif name == 'inter':
            song.pad(s.choir, chords, bar, 3, gain=0.3, rev=0.6, vowel='a')
        elif name == 'A1b':
            song.melody(s.flute, A1, bar, gain=0.6, rev=0.4)
            song.pad(s.choir, chords, bar, 3, gain=0.18, rev=0.6, vowel='o')
        elif name == 'A2b':
            song.melody(s.flute, A2, bar, gain=0.6, rev=0.4)
            song.melody(s.fiddle, A2, bar, transpose=-12, gain=0.3, pan=-0.3, rev=0.4)
            song.pad(s.choir, chords, bar, 3, gain=0.18, rev=0.6, vowel='o')
        elif name == 'outro':
            song.play(s.bell, s.midi('D5'), bar + 3, 0, 6, gain=0.22, kind='bell', rev=0.7)
        bar += len(chords)
    return song.render(decay=3.0, wet=0.4, bright=0.45)


def duel_mages():
    """Le Duel des Mages — mi éolien, 6/8. Tympanon en ostinato, flûte, vièle, chœur, célesta."""
    A = 'E5:3 G5:2 F#5:1 | E5:2 B4:1 E5:3 | G5:3 A5:2 G5:1 | F#5:3 D5:3 | E5:2 F#5:1 G5:2 A5:1 | B5:3 A5:2 G5:1 | F#5:2 E5:1 D#5:3 | E5:6'
    B = 'C6:3 B5:2 A5:1 | B5:3 G5:3 | A5:2 G5:1 E5:2 G5:1 | E5:3 B4:3 | G5:2 A5:1 B5:3 | A5:2 F#5:1 D5:3 | D#5:2 E5:1 F#5:3 | E5:6'
    cA = 'Em Em C D Em Am B Em'.split()
    cB = 'C G Am Em C D B Em'.split()
    form = [('intro', 'Em Em C B'.split()), ('A', cA), ('A2', cA), ('B', cB), ('B2', cB), ('A3', cA), ('outro', 'Em C B Em'.split())]
    bars = sum(len(c) for _, c in form)
    song = Song(168, 6, bars, seed=67)
    song.drone(['E2', 'B2'], 0, bars, gain=0.12, rev=0.3)
    ost = [(0, 'b', 3), (1, (2, -1), 1), (2, (0, 0), 1), (3, (1, 0), 1), (4, (2, 0), 1), (5, (0, 0), 1)]
    bar = 0
    for name, chords in form:
        song.pattern(s.dulcimer, chords, bar, ost, 4, bass_octave=2, gain=0.32, pan=-0.3, rev=0.3, ring=0.5)
        for i in range(len(chords)):
            if name != 'intro':
                song.hit(s.frame_drum, bar + i, 0, gain=0.35, vel=0.9, pitch=85)
                song.hit(s.frame_drum, bar + i, 3, gain=0.2, vel=0.7, pitch=85, slap=0.5)
        if name == 'A':
            song.melody(s.flute, A, bar, gain=0.65, pan=0.1, rev=0.35)
        elif name == 'A2':
            song.melody(s.flute, A, bar, gain=0.6, pan=0.1, rev=0.35)
            song.melody(s.bell, A, bar, transpose=12, gain=0.12, pan=0.45, kind='celesta', rev=0.5)
        elif name == 'B':
            song.melody(s.fiddle, B, bar, gain=0.5, pan=-0.05, rev=0.35)
            song.pad(s.choir, chords, bar, 3, gain=0.2, rev=0.6, vowel='a')
        elif name == 'B2':
            song.melody(s.flute, B, bar, gain=0.6, pan=0.1, rev=0.35)
            song.melody(s.fiddle, B, bar, harmony=(-2, 4, 'aeolian'), gain=0.35, pan=-0.25, rev=0.35)
            song.pad(s.choir, chords, bar, 3, gain=0.2, rev=0.6, vowel='a')
        elif name == 'A3':
            song.melody(s.flute, A, bar, gain=0.6, pan=0.1, rev=0.35)
            song.pad(s.strings, chords, bar, 3, gain=0.18, rev=0.5)
        elif name == 'outro':
            song.play(s.bell, s.midi('E5'), bar + 3, 0, 6, gain=0.2, kind='bell', rev=0.7)
        bar += len(chords)
    return song.render(decay=2.6, wet=0.38)


def brumes():
    """Les Brumes d'Avalon — do dorien, 3/4 très calme. Nappe de cordes, harpe, flûte, cloches, chœur."""
    A1 = 'G4:2 C5:1 | A4:2 F4:1 | G4:1 Bb4:1 Eb5:1 | D5:3 | Eb5:1.5 D5:0.5 C5:1 | A4:2 C5:1 | Bb4:1 A4:1 G4:1 | C5:3'
    A2 = 'C5:1 Eb5:1 G5:1 | F5:2 A5:1 | G5:1 F5:1 Eb5:1 | D5:3 | Eb5:1 D5:1 C5:1 | A4:1.5 Bb4:0.5 C5:1 | D5:1 Bb4:1 G4:1 | C5:3'
    cA = 'Cm F Eb Bb Cm F Gm Cm'.split()
    inter = 'Eb Bb F Cm Eb Bb F G'.split()
    form = [('intro', 'Cm F Cm F'.split()), ('A1', cA), ('A2', cA), ('inter', inter), ('A1b', cA), ('outro', 'Cm F Cm Cm'.split())]
    bars = sum(len(c) for _, c in form)
    song = Song(64, 3, bars, seed=79)
    harp = [(0, 'b', 3), (1, (2, 0), 2), (1.5, (0, 1), 1.5), (2, (1, 1), 1)]
    bar = 0
    for name, chords in form:
        song.pad(s.strings, chords, bar, 3, gain=0.26, rev=0.6)
        song.pattern(s.harp, chords, bar, harp, 4, bass_octave=2, gain=0.3, pan=0.35, rev=0.45, ring=1.5)
        if name == 'A1':
            song.melody(s.flute, A1, bar, gain=0.7, rev=0.45)
        elif name == 'A2':
            song.melody(s.flute, A2, bar, gain=0.7, rev=0.45)
        elif name == 'inter':
            song.pad(s.choir, chords, bar, 3, gain=0.22, rev=0.65, vowel='u')
            for i, ch in enumerate(chords):
                song.play(s.bell, tone(ch, 2, 5), bar + i, 0, 3, gain=0.18, kind='celesta', rev=0.6, pan=-0.4)
                song.play(s.bell, tone(ch, 0, 6), bar + i, 1.5, 2, gain=0.12, kind='celesta', rev=0.6, pan=0.4)
        elif name == 'A1b':
            song.melody(s.choir, A1, bar, gain=0.45, rev=0.6, vowel='u', voices=3, release=0.5)
            song.melody(s.flute, A1, bar, transpose=12, gain=0.3, rev=0.5, pan=0.2)
        elif name == 'outro':
            song.play(s.bell, s.midi('C6'), bar + 2, 0, 6, gain=0.15, kind='celesta', rev=0.7)
        bar += len(chords)
    return song.render(decay=3.6, wet=0.48, bright=0.45)


def marche():
    """La Marche des Bannières — la dorien, 4/4. Tambour en marche, luth, flûte à bec, vièle, cors doux."""
    A = 'A4:1 C5:1 E5:1.5 D5:0.5 | D5:1 B4:1 G4:2 | F#4:1 A4:1 D5:1 C5:0.5 B4:0.5 | A4:3 r:1 | E5:1 E5:0.5 F#5:0.5 G5:1 E5:1 | G5:1.5 F#5:0.5 E5:1 C5:1 | D5:1 B4:1 G4:1 B4:1 | A4:4'
    B = 'C5:1 E5:1 G5:2 | B4:1 D5:1 G5:2 | F#5:1 E5:1 D5:1 A4:1 | C5:2 E5:2 | B4:1 E5:1 G5:1 E5:1 | F#5:2 D5:2 | G5:1 F#5:1 E5:1 D5:1 | E5:4'
    cA = 'Am G D Am Am C G Am'.split()
    cB = 'C G D Am Em D G Em'.split()
    form = [('intro', ['Am', 'Am']), ('A', cA), ('A2', cA), ('B', cB), ('A3', cA), ('outro', ['Am', 'Am'])]
    bars = sum(len(c) for _, c in form)
    song = Song(92, 4, bars, seed=89)
    song.drone(['A2', 'E3'], 0, bars, gain=0.1, rev=0.25)
    bar = 0
    for name, chords in form:
        song.strum(s.lute, chords, bar, [(0, 1, 0.75), (1, 1, 0.45), (2, 1, 0.65), (3, 1, 0.45)], 4, gain=0.34, pan=-0.35, rev=0.2, ring=0.3)
        for i in range(len(chords)):
            song.hit(s.frame_drum, bar + i, 0, gain=0.5, vel=1.0, pitch=88)
            song.hit(s.frame_drum, bar + i, 2, gain=0.36, vel=0.85, pitch=88)
            song.hit(s.frame_drum, bar + i, 3.5, gain=0.18, vel=0.6, pitch=88, slap=0.6)
            if name not in ('intro',):
                song.hit(s.tambourine, bar + i, 1, gain=0.4, pan=0.4)
                song.hit(s.tambourine, bar + i, 3, gain=0.4, pan=0.4)
            if i == len(chords) - 1 and name != 'outro':
                for k in range(8):
                    song.hit(s.shaker, bar + i, 2 + k * 0.25, gain=0.5 + 0.05 * k, pan=0.5)
        if name == 'A':
            song.melody(s.flute, A, bar, kind='recorder', gain=0.72, pan=0.1, rev=0.25)
        elif name == 'A2':
            song.melody(s.flute, A, bar, kind='recorder', gain=0.68, pan=0.1, rev=0.25)
            song.melody(s.fiddle, A, bar, harmony=(-2, 9, 'dorian'), gain=0.38, pan=-0.2, rev=0.3)
        elif name == 'B':
            song.melody(s.flute, B, bar, kind='recorder', gain=0.68, pan=0.1, rev=0.25)
            song.pad(s.horn, chords, bar, 3, gain=0.18, rev=0.4, release=0.4)
        elif name == 'A3':
            song.melody(s.fiddle, A, bar, gain=0.5, pan=-0.05, rev=0.3)
            song.melody(s.flute, A, bar, kind='recorder', transpose=12, gain=0.32, pan=0.2, rev=0.25)
        elif name == 'outro':
            song.play(s.horn, s.midi('A3'), bar + 1, 0, 3, gain=0.3, rev=0.4)
            song.play(s.horn, s.midi('E4'), bar + 1, 0, 3, gain=0.22, rev=0.4)
        bar += len(chords)
    return song.render(decay=1.9, wet=0.3)


TRACKS = {
    # menus
    'repos': ('Le Repos du Voyageur', repos),
    'clairiere': ('La Clairière aux Fées', clairiere),
    'cloitre': ('Le Cloître', cloitre),
    'fete': ('La Fête du Village', fete),
    # parties
    'veillee': ("Veillée d'Armes", veillee),
    'mages': ('Le Duel des Mages', duel_mages),
    'brumes': ("Les Brumes d'Avalon", brumes),
    'marche': ('La Marche des Bannières', marche),
}

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or list(TRACKS)
    for n in names:
        title, fn = TRACKS[n]
        data = fn()
        s.write_wav(os.path.join(out, n + '.wav'), data)
        print(f'{n} ({title}) : {len(data) / s.SR:.1f} s')
