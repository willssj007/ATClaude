"""Synthétiseur des musiques et bruitages d'Arcane Table (rendu hors ligne, en numpy).

Instruments acoustiques imités par modèles physiques ou additifs : cordes pincées (Karplus-Strong : luth,
harpe, tympanon), flûte et flûte à bec, vièle, chœur, cordes tenues, bourdon, cloches et célesta, cuivres,
percussions (tambour sur cadre, tambourin, cymbalettes). La salle est une réverbération par convolution.
Tout est déterministe : chaque rendu part d'une graine.
"""
import math

import numba
import numpy as np
from scipy import signal

SR = 44100
NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    """« C4 », « F#3 », « Bb5 » → numéro MIDI."""
    letter = name[0].upper()
    rest = name[1:]
    acc = 0
    while rest and rest[0] in '#b':
        acc += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + NOTES[letter] + acc


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def seconds(x):
    return int(round(x * SR))


def env_adsr(n, a, d, s, r, sustain_len=None):
    """Enveloppe attaque-déclin-maintien-relâche sur n échantillons (le relâchement occupe la fin)."""
    a_n, d_n, r_n = seconds(a), seconds(d), seconds(r)
    hold = max(0, n - a_n - d_n - r_n) if sustain_len is None else max(0, seconds(sustain_len) - a_n - d_n)
    parts = [np.linspace(0, 1, max(1, a_n), endpoint=False) ** 1.5,
             np.linspace(1, s, max(1, d_n), endpoint=False),
             np.full(hold, s),
             s * np.linspace(1, 0, max(1, r_n)) ** 2]
    e = np.concatenate(parts)
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def fade(x, fin=0.004, fout=0.02):
    n = len(x)
    i, o = min(n, seconds(fin)), min(n, seconds(fout))
    if i:
        x[:i] *= np.linspace(0, 1, i)
    if o:
        x[n - o:] *= np.linspace(1, 0, o)
    return x


def lowpass(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def highpass(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def peak(x, f0, q, gain_db):
    """Égaliseur en cloche (biquad RBJ)."""
    a = 10 ** (gain_db / 40)
    w = 2 * math.pi * f0 / SR
    alpha = math.sin(w) / (2 * q)
    b = [1 + alpha * a, -2 * math.cos(w), 1 - alpha * a]
    den = [1 + alpha / a, -2 * math.cos(w), 1 - alpha / a]
    return signal.lfilter(b, den, x)


def high_shelf(x, f0, gain_db, slope=0.8):
    """Plateau dans les aigus (biquad RBJ)."""
    a = 10 ** (gain_db / 40)
    w = 2 * math.pi * f0 / SR
    alpha = math.sin(w) / 2 * math.sqrt((a + 1 / a) * (1 / slope - 1) + 2)
    cw = math.cos(w)
    sa = 2 * math.sqrt(a) * alpha
    b = [a * ((a + 1) + (a - 1) * cw + sa), -2 * a * ((a - 1) + (a + 1) * cw), a * ((a + 1) + (a - 1) * cw - sa)]
    den = [(a + 1) - (a - 1) * cw + sa, 2 * ((a - 1) - (a + 1) * cw), (a + 1) - (a - 1) * cw - sa]
    return signal.lfilter(b, den, x)


# ---------------------------------------------------------------- cordes pincées (Karplus-Strong)

@numba.njit(cache=True)
def _ks(excite, n, delay, damp, gain, c):
    """Ligne à retard bouclée : retard fractionnaire par passe-tout (coefficient c), filtre d'amortissement
    à un zéro (damp), gain de boucle par passage."""
    buf_len = int(delay) + 4
    buf = np.zeros(buf_len)
    out = np.zeros(n)
    m = len(excite)
    w = 0
    ap_x1 = 0.0
    ap_y1 = 0.0
    lp_x1 = 0.0
    d = int(delay)
    for i in range(n):
        r = w - d
        if r < 0:
            r += buf_len
        x = buf[r]
        # amortissement : moyenne pondérée de deux échantillons successifs
        lp = (1.0 - damp) * x + damp * lp_x1
        lp_x1 = x
        # retard fractionnaire
        ap = c * lp + ap_x1 - c * ap_y1
        ap_x1 = lp
        ap_y1 = ap
        y = gain * ap
        if i < m:
            y += excite[i]
        buf[w] = y
        out[i] = y
        w += 1
        if w >= buf_len:
            w = 0
    return out


def pluck(f, length, rng, decay=3.0, bright=0.5, pos=0.18, attack_noise=0.6):
    """Corde pincée : f en Hz, length en secondes, decay = temps (s) pour perdre 60 dB, bright 0..1."""
    n = seconds(length)
    damp = 0.5 - 0.42 * bright      # 0.5 : sombre (moyenne), proche de 0 : brillant
    period = SR / f
    loop_delay = period - damp      # le filtre à un zéro retarde de « damp » échantillon
    d = int(math.floor(loop_delay - 0.1))
    frac = loop_delay - d
    c = (1 - frac) / (1 + frac)
    gain = 10 ** (-3 / (f * decay))
    p = max(2, int(period))
    ex = rng.uniform(-1, 1, p)
    # pincement plus ou moins sec : bruit adouci, puis creusé à la position du doigt sur la corde
    k = max(1, int(p * (0.3 - 0.25 * bright)))
    ex = np.convolve(ex, np.ones(k) / k, mode='same')
    shift = max(1, int(p * pos))
    ex = ex - np.concatenate([np.zeros(shift), ex[:-shift]])
    ex = (ex - ex.mean()) * attack_noise
    y = _ks(ex, n, float(d), damp, gain, c)
    # la boucle garde aussi le continu du bruit d'excitation : on le retire
    y = highpass(y, max(18.0, f * 0.35), order=1)
    return y / (np.max(np.abs(y)) + 1e-9)


def lute(f, length, rng, vel=1.0):
    """Luth : deux cordes accordées à l'unisson (chœur), légèrement désaccordées, corps de bois."""
    detune = 2 ** (rng.uniform(1.5, 3.5) / 1200)
    a = pluck(f * detune, length, rng, decay=2.4, bright=0.55 + 0.15 * vel, pos=0.14)
    b = pluck(f / detune, length, rng, decay=2.1, bright=0.5 + 0.15 * vel, pos=0.2)
    y = 0.55 * a + 0.45 * b
    return fade(y * vel, 0.001, 0.08)


def harp(f, length, rng, vel=1.0):
    y = pluck(f, length, rng, decay=3.8 if f < 400 else 2.6, bright=0.62, pos=0.5, attack_noise=0.5)
    # un peu de fondamentale pure : la rondeur des cordes en boyau
    n = len(y)
    t = np.arange(n) / SR
    y = y + 0.25 * np.sin(2 * math.pi * f * t) * np.exp(-t * 1.6)
    return fade(y * vel, 0.002, 0.1)


def dulcimer(f, length, rng, vel=1.0):
    """Tympanon : trois cordes frappées, brillantes, qui battent entre elles."""
    out = 0
    for cents in (-4, 0, 3.5):
        out = out + pluck(f * 2 ** (cents / 1200), length, rng, decay=3.2, bright=0.85, pos=0.11, attack_noise=0.8)
    return fade(out / 3 * vel, 0.0005, 0.12)


# ---------------------------------------------------------------- vents, archets, voix

def _phase(f, n, vib_depth=0.0, vib_rate=5.0, vib_delay=0.3, drift=0.0, rng=None):
    t = np.arange(n) / SR
    ramp = np.clip((t - vib_delay) / 0.4, 0, 1)
    inst = f * (1 + vib_depth * ramp * np.sin(2 * math.pi * vib_rate * t))
    if drift and rng is not None:
        slow = np.interp(t, np.linspace(0, t[-1] + 1e-9, 8), rng.uniform(-1, 1, 8))
        inst = inst * (1 + drift * slow)
    return 2 * math.pi * np.cumsum(inst) / SR


def flute(f, length, rng, vel=1.0, release=0.18, kind='flute'):
    """Flûte (traversière en bois) ou flûte à bec (« recorder ») : souffle, attaque soufflée, vibrato."""
    n = seconds(length + release)
    ph = _phase(f, n, vib_depth=0.0045 if kind == 'flute' else 0.0025, vib_rate=5.2, vib_delay=0.25, drift=0.0015, rng=rng)
    if kind == 'flute':
        tone = np.sin(ph) + 0.22 * np.sin(2 * ph) + 0.09 * np.sin(3 * ph) + 0.03 * np.sin(4 * ph)
    else:
        tone = np.sin(ph) + 0.06 * np.sin(2 * ph) + 0.16 * np.sin(3 * ph) + 0.05 * np.sin(5 * ph)
    env = env_adsr(n, 0.07 if kind == 'flute' else 0.035, 0.12, 0.85, release, sustain_len=length)
    breath = bandpass(rng.normal(0, 1, n), f * 0.9, f * 5) * 0.05
    chiff = bandpass(rng.normal(0, 1, n), 1500, 6000) * np.exp(-np.arange(n) / (SR * 0.025)) * (0.25 if kind == 'recorder' else 0.12)
    y = (tone + breath) * env + chiff * env.clip(0, 1) ** 0.2
    return fade(y * vel * 0.6, 0.001, 0.03)


def additive(ph, amps):
    out = np.zeros_like(ph)
    top = max(amps) if amps else 0
    for k, a in enumerate(amps, 1):
        if a > top * 2e-3:
            out += a * np.sin(k * ph)
    return out


def _formants(f, nharm, formants):
    amps = []
    for k in range(1, nharm + 1):
        fk = k * f
        if fk > SR * 0.45:
            amps.append(0)
            continue
        a = 0.0
        for fc, bw, g in formants:
            a += g * math.exp(-0.5 * ((fk - fc) / bw) ** 2)
        amps.append(a / k ** 0.6)
    return amps


def fiddle(f, length, rng, vel=1.0, release=0.25):
    """Vièle à archet : dent de scie adoucie, formants du corps, vibrato et bruit d'archet."""
    n = seconds(length + release)
    ph = _phase(f, n, vib_depth=0.006, vib_rate=5.6, vib_delay=0.18, drift=0.002, rng=rng)
    amps = _formants(f, 30, [(500, 220, 1.0), (1700, 500, 0.55), (3100, 700, 0.3), (250, 120, 0.4)])
    tone = additive(ph, amps)
    tone /= max(1e-9, np.max(np.abs(tone)))
    env = env_adsr(n, 0.12, 0.2, 0.8, release, sustain_len=length)
    bow = bandpass(rng.normal(0, 1, n), 2000, 7000) * 0.025
    return fade((tone + bow) * env * vel * 0.55, 0.002, 0.04)


def choir(f, length, rng, vel=1.0, vowel='a', release=1.2, voices=4):
    """Chœur : plusieurs voix légèrement désaccordées sur la voyelle « a » ou « ou »."""
    n = seconds(length + release)
    forms = {'a': [(750, 120, 1.0), (1150, 140, 0.55), (2600, 220, 0.25), (3300, 300, 0.1)],
             'o': [(450, 100, 1.0), (800, 120, 0.45), (2700, 250, 0.12)],
             'u': [(330, 80, 1.0), (700, 120, 0.2), (2500, 250, 0.06)]}[vowel]
    out = np.zeros(n)
    for v in range(voices):
        cents = rng.uniform(-9, 9)
        fv = f * 2 ** (cents / 1200)
        ph = _phase(fv, n, vib_depth=0.004, vib_rate=rng.uniform(4.5, 5.8), vib_delay=0.4, drift=0.003, rng=rng)
        amps = _formants(fv, 40, forms)
        out += additive(ph + rng.uniform(0, 6.28), amps)
    out /= max(1e-9, np.max(np.abs(out)))
    breath = bandpass(rng.normal(0, 1, n), 3000, 9000) * 0.015
    env = env_adsr(n, 0.5, 0.3, 0.85, release, sustain_len=length)
    return fade((out + breath) * env * vel * 0.5, 0.01, 0.1)


def strings(f, length, rng, vel=1.0, release=1.0):
    """Cordes tenues (nappe) : trois voix en dents de scie adoucies, filtrées."""
    n = seconds(length + release)
    nh = int(min(40, 5000 / f))
    amps = [1 / k for k in range(1, nh + 1)]
    out = np.zeros(n)
    for cents in (-7, 0, 6):
        ph = _phase(f * 2 ** (cents / 1200), n, vib_depth=0.003, vib_rate=rng.uniform(4.8, 5.6), vib_delay=0.5)
        out += additive(ph + rng.uniform(0, 6.28), amps)
    out = lowpass(out / 3, 2600)
    out /= max(1e-9, np.max(np.abs(out)))
    env = env_adsr(n, 0.7, 0.4, 0.9, release, sustain_len=length)
    return fade(out * env * vel * 0.45, 0.01, 0.1)


def drone(f, length, rng, vel=1.0):
    """Bourdon de vielle à roue : son nasal et continu, qui ondule doucement."""
    n = seconds(length)
    ph = _phase(f, n, drift=0.001, rng=rng)
    amps = _formants(f, 30, [(650, 260, 1.0), (1400, 350, 0.6), (2700, 500, 0.25)])
    tone = additive(ph, amps)
    tone /= max(1e-9, np.max(np.abs(tone)))
    t = np.arange(n) / SR
    wobble = 1 + 0.08 * np.sin(2 * math.pi * 0.23 * t + rng.uniform(0, 6))
    env = np.clip(t / 2.5, 0, 1) * np.clip((t[-1] - t) / 2.5, 0, 1)
    return tone * wobble * env * vel * 0.4


def horn(f, length, rng, vel=1.0, release=0.3):
    """Cor : les harmoniques s'ouvrent avec le souffle (cuivre doux)."""
    n = seconds(length + release)
    ph = _phase(f, n, vib_depth=0.003, vib_rate=5, vib_delay=0.35)
    env = env_adsr(n, 0.06, 0.15, 0.8, release, sustain_len=length)
    out = np.zeros(n)
    nh = int(min(24, 6000 / f))
    for k in range(1, nh + 1):
        out += np.sin(k * ph) * (1 / k ** 1.1) * env ** (0.6 + 0.35 * k)
    return fade(out * vel * 0.4, 0.002, 0.05)


# ---------------------------------------------------------------- percussions mélodiques

def bell(f, length, rng, vel=1.0, kind='bell'):
    """Cloche d'église (partiels inharmoniques), célesta ou glockenspiel."""
    n = seconds(length)
    t = np.arange(n) / SR
    if kind == 'bell':
        parts = [(0.5, 0.35, 0.9), (1.0, 1.0, 1.6), (1.19, 0.5, 2.4), (1.5, 0.35, 2.0), (2.0, 0.45, 3.0),
                 (2.51, 0.25, 4.5), (2.66, 0.2, 5.0), (3.01, 0.15, 6.0), (4.17, 0.1, 8.0)]
    elif kind == 'celesta':
        parts = [(1.0, 1.0, 1.2), (2.0, 0.15, 3.0), (3.98, 0.12, 5.0), (8.05, 0.03, 9.0)]
    else:  # glockenspiel
        parts = [(1.0, 1.0, 1.0), (2.76, 0.35, 3.5), (5.4, 0.12, 6.0), (8.93, 0.05, 9.0)]
    out = np.zeros(n)
    for ratio, amp, dec in parts:
        fr = f * ratio * 2 ** (rng.uniform(-2, 2) / 1200)
        if fr < SR * 0.45:
            out += amp * np.sin(2 * math.pi * fr * t + rng.uniform(0, 6)) * np.exp(-t * dec * (1 + f / 2000))
    strike = highpass(rng.normal(0, 1, n), 3000) * np.exp(-t / 0.004) * 0.15
    return fade((out + strike) * vel * 0.4, 0.0005, 0.05)


# ---------------------------------------------------------------- percussions

def frame_drum(length=0.6, rng=None, vel=1.0, pitch=78, slap=0.3):
    """Tambour sur cadre (bodhrán) : membrane grave qui descend, frappe de la baguette."""
    n = seconds(length)
    t = np.arange(n) / SR
    f = pitch * (1 + 0.6 * np.exp(-t / 0.03))
    ph = 2 * math.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22) + 0.35 * np.sin(1.59 * ph) * np.exp(-t / 0.12) + 0.2 * np.sin(2.14 * ph) * np.exp(-t / 0.08)
    hit = bandpass(rng.normal(0, 1, n), 300, 2500) * np.exp(-t / 0.018) * slap
    return fade((body + hit) * vel * 0.8, 0.0005, 0.05)


def tambourine(length=0.25, rng=None, vel=1.0):
    n = seconds(length)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for delay in (0, 0.006, 0.013):
        d = seconds(delay)
        nn = n - d
        tt = t[:nn]
        jingle = highpass(rng.normal(0, 1, nn), 5500) * np.exp(-tt / 0.06)
        for fr in (6200, 7400, 8900, 10300):
            jingle += 0.25 * np.sin(2 * math.pi * fr * 2 ** (rng.uniform(-30, 30) / 1200) * tt) * np.exp(-tt / 0.05)
        out[d:] += jingle * (1 - 0.3 * (delay > 0))
    return fade(out * vel * 0.18, 0.0005, 0.03)


def finger_cymbal(length=1.8, rng=None, vel=1.0):
    n = seconds(length)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for fr, a, d in ((3180, 1.0, 1.6), (4690, 0.7, 2.2), (6120, 0.5, 2.8), (8040, 0.3, 3.5)):
        out += a * np.sin(2 * math.pi * fr * t + rng.uniform(0, 6)) * np.exp(-t * d)
    return fade(out * vel * 0.12, 0.0005, 0.1)


def shaker(length=0.12, rng=None, vel=1.0):
    n = seconds(length)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 2
    return bandpass(rng.normal(0, 1, n), 4000, 11000) * env * vel * 0.12


def boom(length=1.2, rng=None, vel=1.0):
    """Grand tambour grave (veillée d'armes)."""
    n = seconds(length)
    t = np.arange(n) / SR
    f = 52 * (1 + 0.5 * np.exp(-t / 0.05))
    ph = 2 * math.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.45)
    hit = lowpass(rng.normal(0, 1, n), 900) * np.exp(-t / 0.03) * 0.5
    return fade((body + hit) * vel, 0.0005, 0.1)


# ---------------------------------------------------------------- salle, mixage

def impulse(decay, rng, predelay=0.02, bright=0.5, length=None):
    """Réponse de salle stéréo : réflexions précoces puis queue de bruit qui s'assombrit en s'éteignant."""
    length = length or decay * 1.3
    n = seconds(length)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for ch in range(2):
        noise = rng.normal(0, 1, n)
        lo = lowpass(noise, 900) * np.exp(-6.9 * t / decay)
        mid = bandpass(noise, 900, 4000) * np.exp(-6.9 * t / (decay * 0.75))
        hi = highpass(noise, 4000) * np.exp(-6.9 * t / (decay * 0.45)) * bright
        tail = lo + 0.8 * mid + 0.6 * hi
        tail *= np.clip(t / 0.06, 0, 1)
        er = np.zeros(n)
        for k in range(12):
            pos = seconds(rng.uniform(0.004, 0.07))
            er[pos] += rng.uniform(0.2, 0.6) * (1 if rng.uniform() > 0.5 else -1)
        ir[:, ch] = np.concatenate([np.zeros(seconds(predelay)), (tail * 0.25 + er)])[:n]
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


class Mix:
    """Pistes stéréo par groupe d'instruments, chacune avec son envoi vers la réverbération."""

    def __init__(self, length, seed=1):
        self.n = seconds(length)
        self.rng = np.random.default_rng(seed)
        self.dry = np.zeros((self.n, 2))
        self.send = np.zeros((self.n, 2))

    def add(self, sig, start, pan=0.0, gain=1.0, rev=0.3):
        """Ajoute un son mono (ou stéréo) à start secondes ; pan -1 (gauche) à 1 (droite)."""
        i = seconds(start)
        if i >= self.n or len(sig) == 0:
            return
        sig = sig[: self.n - i]
        if sig.ndim == 1:
            angle = (pan + 1) * math.pi / 4
            st = np.stack([sig * math.cos(angle), sig * math.sin(angle)], axis=1) * math.sqrt(2)
        else:
            st = sig
        st = st * gain
        self.dry[i:i + len(st)] += st * (1 - rev * 0.5)
        self.send[i:i + len(st)] += st * rev

    def render(self, decay=2.4, bright=0.5, wet=0.35, target_rms=0.12):
        ir = impulse(decay, self.rng, bright=bright)
        wet_sig = np.zeros((self.n + len(ir), 2))
        for ch in range(2):
            conv = signal.fftconvolve(self.send[:, ch], ir[:, ch])
            wet_sig[: len(conv), ch] = conv
        out = np.zeros((self.n + len(ir), 2))
        out[: self.n] += self.dry
        out += wet_sig * wet
        out = highpass(out.T, 28).T
        # égalisation du mixage : moins de boue dans le bas-médium, de l'air dans les aigus
        out = peak(out.T, 300, 0.8, -3).T
        out = peak(out.T, 2600, 0.9, 3).T
        out = high_shelf(out.T, 4200, 7).T
        # niveau homogène entre les morceaux, crêtes adoucies
        rms = math.sqrt(np.mean(out ** 2)) + 1e-9
        out *= target_rms / rms
        out = np.tanh(out * 1.1) / 1.1
        peakv = np.max(np.abs(out))
        if peakv > 0.97:
            out *= 0.97 / peakv
        # silence final rogné (la réverbération s'éteint)
        mag = np.max(np.abs(out), axis=1)
        last = np.nonzero(mag > 1e-4)[0]
        end = (last[-1] + seconds(0.2)) if len(last) else len(out)
        out = out[: min(len(out), end)]
        f = min(len(out), seconds(1.5))
        out[-f:] *= np.linspace(1, 0, f)[:, None]
        return out


def write_wav(path, data):
    from scipy.io import wavfile
    pcm = np.clip(data, -1, 1)
    wavfile.write(path, SR, (pcm * 32767).astype(np.int16))
