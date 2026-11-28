#!/usr/bin/env python3
"""
Generates the original soundtrack and sound effects for the chess video.

Everything is synthesised from scratch (no samples), so it is royalty-free.
Output:
  public/ajedrez/audio/musica/cinematica.wav   65.5 s cinematic score
  public/ajedrez/audio/sfx/*.wav               move, capture, whoosh, impact, check, shimmer

The chord changes follow the scene starts in src/ajedrez/timeline.ts
(0, 5, 12, 32, 47, 60 s). Usage:  python3 scripts/generate_audio.py
Requires: numpy, scipy
"""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
ROOT = Path(__file__).resolve().parent.parent / "public" / "ajedrez" / "audio"
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_axis(seconds):
    return np.arange(int(seconds * SR)) / SR


def lowpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "high", fs=SR, output="sos"), x)


def reverb_ir(seconds=2.6, decay=0.75, seed=1):
    r = np.random.default_rng(seed)
    t = t_axis(seconds)
    ir = r.standard_normal(len(t)) * np.exp(-t / decay)
    ir = lowpass(ir, 6000)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.sqrt(np.sum(ir ** 2))


def stereo_reverb(mono, wet=0.35, seconds=2.6, decay=0.75):
    l = fftconvolve(mono, reverb_ir(seconds, decay, 1))[: len(mono)]
    r = fftconvolve(mono, reverb_ir(seconds, decay, 2))[: len(mono)]
    return np.stack([mono * (1 - wet) + l * wet, mono * (1 - wet) + r * wet], axis=1)


def save(path, stereo, peak_db=-1.0):
    stereo = np.asarray(stereo, dtype=np.float64)
    if stereo.ndim == 1:
        stereo = np.stack([stereo, stereo], axis=1)
    peak = np.max(np.abs(stereo)) or 1.0
    stereo = stereo / peak * (10 ** (peak_db / 20))
    path.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(path, SR, (stereo * 32767).astype(np.int16))
    print(f"wrote {path.relative_to(ROOT.parent.parent.parent)}  {len(stereo) / SR:.2f}s")


# ---------------------------------------------------------------- music ----
DUR = 65.5
BPM = 96
BEAT = 60 / BPM

# (start s, bass midi, pad midi notes) — D minor, ending on D major (Picardy third)
CHORDS = [
    (0.0, 38, [50, 53, 57, 62]),   # Dm      intro
    (5.0, 34, [46, 50, 53, 58]),   # Bb      objetivo
    (8.5, 41, [48, 53, 57, 60]),   # F
    (12.0, 38, [50, 53, 57, 62]),  # Dm      piezas
    (17.0, 34, [46, 50, 53, 58]),  # Bb
    (22.0, 41, [48, 53, 57, 60]),  # F
    (27.0, 36, [48, 52, 55, 60]),  # C
    (32.0, 43, [50, 55, 58, 62]),  # Gm      reglas
    (37.0, 34, [46, 50, 53, 58]),  # Bb
    (42.0, 45, [49, 52, 57, 61]),  # A
    (47.0, 38, [50, 53, 57, 62]),  # Dm      partida
    (51.0, 34, [46, 50, 53, 58]),  # Bb
    (55.0, 41, [48, 53, 57, 60]),  # F
    (58.0, 45, [49, 52, 57, 64]),  # A
    (60.0, 38, [50, 54, 57, 62]),  # D major final
]


def chord_env(t, start, end, attack=1.2, release=1.6):
    up = np.clip((t - start) / attack, 0, 1)
    down = np.clip((end + release - t) / release, 0, 1)
    return np.sin(up * np.pi / 2) ** 2 * np.sin(down * np.pi / 2) ** 2


def pad_voice(t, f):
    out = np.zeros_like(t)
    for det, ph in ((-0.0035, 0.0), (0.0035, 1.3), (0.0, 2.1)):
        ff = f * (1 + det)
        for k in range(1, 9):
            out += (1 / k) * np.exp(-0.38 * k) * np.sin(2 * np.pi * k * ff * t + ph * k)
    return out


def pluck(f, seconds=1.2):
    t = t_axis(seconds)
    env = np.exp(-t / 0.35) * np.clip(t / 0.004, 0, 1)
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.12)
    tone += 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.06)
    return tone * env


def build_music():
    t = t_axis(DUR)
    n = len(t)
    pad = np.zeros(n)
    bass = np.zeros(n)
    arp = np.zeros(n)
    ticks = np.zeros(n)

    for i, (start, b, notes) in enumerate(CHORDS):
        end = CHORDS[i + 1][0] if i + 1 < len(CHORDS) else DUR
        lo, hi = max(0, int((start - 0.1) * SR)), min(n, int((end + 1.8) * SR))
        seg = t[lo:hi]
        env = chord_env(seg, start, end)
        pad[lo:hi] += env * sum(pad_voice(seg, midi(m)) for m in notes) * 0.11
        bass[lo:hi] += env * (np.sin(2 * np.pi * midi(b) * seg) + 0.25 * np.sin(2 * np.pi * midi(b + 12) * seg))

        # Arpeggio: quarter notes from 5 s, eighths from 12 s, stops for the finale.
        if 5.0 <= start < 60.0:
            step = BEAT / 2 if start >= 12.0 else BEAT
            pattern = [0, 2, 1, 3, 2, 1]
            k = 0
            beat_t = np.ceil(start / step) * step
            while beat_t < end - 0.05:
                note = notes[pattern[k % len(pattern)]] + 12
                p = pluck(midi(note)) * (0.9 if k % 4 == 0 else 0.6)
                s = int(beat_t * SR)
                e = min(n, s + len(p))
                arp[s:e] += p[: e - s]
                beat_t += step
                k += 1

    # Slow "breathing" filter movement on the pad
    pad *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.08 * t)
    pad = lowpass(pad, 2400)

    # Heartbeat-like sub pulse on each beat after the intro title
    pulse = np.zeros(n)
    beat = 5.0
    while beat < 60.0:
        s = int(beat * SR)
        tt = t_axis(0.45)
        e = min(n, s + len(tt))
        pulse[s:e] += np.exp(-tt / 0.16)[: e - s]
        beat += BEAT
    bass = lowpass(bass, 220) * (0.55 + 0.45 * pulse.clip(0, 1))

    # Soft off-beat ticks (12-60 s), like a clock: keeps the lesson moving
    beat = 12.0 + BEAT / 2
    while beat < 59.5:
        s = int(beat * SR)
        tt = t_axis(0.06)
        e = min(n, s + len(tt))
        ticks[s:e] += rng.standard_normal(len(tt))[: e - s] * np.exp(-tt / 0.012)[: e - s]
        beat += BEAT
    ticks = highpass(ticks, 6000) * 0.08

    # Intro riser into the title and a swell into the finale
    riser = np.zeros(n)
    for a, b in ((0.0, 0.5), (57.5, 60.0)):
        s, e = int(a * SR), int(b * SR)
        seg = rng.standard_normal(e - s) * np.linspace(0, 1, e - s) ** 2
        riser[s:e] += highpass(lowpass(seg, 5000), 400) * 0.18

    # Ending: let the final D major ring out with a bell melody
    for k, (when, m) in enumerate(((60.4, 74), (60.9, 78), (61.4, 81), (62.2, 86))):
        p = pluck(midi(m), 3.0) * (0.7 - 0.08 * k)
        s = int(when * SR)
        arp[s : s + len(p)] += p[: n - s]

    dry = pad + bass * 0.55 + ticks
    wet_src = pad * 0.6 + arp * 0.32 + riser
    mix = stereo_reverb(wet_src, wet=0.45, seconds=3.2, decay=1.0)
    mix[:, 0] += dry + arp * 0.15
    mix[:, 1] += dry + arp * 0.15
    # Gentle stereo widening of the arpeggio
    delay = int(0.011 * SR)
    mix[delay:, 1] += arp[:-delay] * 0.08

    fade_in = np.clip(t / 0.8, 0, 1)
    fade_out = np.clip((DUR - t) / 3.0, 0, 1)
    mix *= (fade_in * fade_out)[:, None]
    mix = highpass(mix.T, 30).T
    mix = np.tanh(mix / np.max(np.abs(mix)) * 1.4)  # soft limiter
    save(ROOT / "musica" / "cinematica.wav", mix, peak_db=-1.5)


# ------------------------------------------------------------------ SFX ----
def sfx_move():
    t = t_axis(0.35)
    tock = (
        np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.022)
        + 0.5 * np.sin(2 * np.pi * 1650 * t) * np.exp(-t / 0.010)
        + 0.8 * np.sin(2 * np.pi * 310 * t) * np.exp(-t / 0.045)
    )
    click = highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.003) * 0.6
    return stereo_reverb((tock + click) * np.clip(t / 0.0008, 0, 1), wet=0.18, seconds=0.5, decay=0.12)


def sfx_capture():
    a = sfx_move()[:, 0]
    out = a.copy()
    d = int(0.055 * SR)
    out[d:] += a[:-d] * 0.8
    t = t_axis(len(out) / SR)
    out += lowpass(rng.standard_normal(len(out)), 900) * np.exp(-t / 0.05) * 0.3
    return stereo_reverb(out, wet=0.2, seconds=0.6, decay=0.15)


def sfx_whoosh():
    dur = 0.75
    n = int(dur * SR)
    t = t_axis(dur)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    block = 256
    zi = None
    for s in range(0, n, block):
        x = s / n
        cutoff = 350 + 3800 * np.sin(np.pi * min(1, x * 1.15)) ** 2
        sos = butter(2, cutoff, "low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        out[s : s + block], zi = sosfilt(sos, noise[s : s + block], zi=zi)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1) ** 0.8) ** 2
    out *= env
    pan = np.linspace(0.2, 0.8, n)
    st = np.stack([out * (1 - pan), out * pan], axis=1)
    return st


def sfx_impact():
    dur = 3.0
    t = t_axis(dur)
    f = 38 + 52 * np.exp(-t / 0.18)
    phase = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(phase) * np.exp(-t / 0.7)
    body = lowpass(rng.standard_normal(len(t)), 260) * np.exp(-t / 0.12) * 1.6
    crack = highpass(rng.standard_normal(len(t)), 1800) * np.exp(-t / 0.02) * 0.25
    return stereo_reverb(sub + body + crack, wet=0.4, seconds=2.8, decay=0.9)


def bell(f, dur=1.6, decay=0.6):
    t = t_axis(dur)
    out = np.zeros_like(t)
    for ratio, amp, dk in ((1.0, 1.0, 1.0), (2.76, 0.45, 0.5), (5.4, 0.2, 0.25), (8.93, 0.08, 0.15)):
        out += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (decay * dk))
    return out * np.clip(t / 0.002, 0, 1)


def sfx_check():
    a = bell(midi(81), 1.4, 0.5)
    b = bell(midi(82), 1.4, 0.5)  # semitone rub = tension
    out = a + 0.7 * b
    return stereo_reverb(out, wet=0.35, seconds=1.8, decay=0.5)


def sfx_shimmer():
    dur = 2.0
    out = np.zeros(int(dur * SR))
    for k, m in enumerate((74, 78, 81, 86, 90)):
        b = bell(midi(m), 1.5, 0.45) * (0.9 - 0.1 * k)
        s = int(k * 0.055 * SR)
        out[s : s + len(b)] += b[: len(out) - s]
    return stereo_reverb(out, wet=0.5, seconds=2.0, decay=0.7)


if __name__ == "__main__":
    build_music()
    for name, fn, peak in (
        ("move", sfx_move, -3),
        ("capture", sfx_capture, -3),
        ("whoosh", sfx_whoosh, -4),
        ("impact", sfx_impact, -1.5),
        ("check", sfx_check, -5),
        ("shimmer", sfx_shimmer, -5),
    ):
        save(ROOT / "sfx" / f"{name}.wav", fn(), peak_db=peak)
