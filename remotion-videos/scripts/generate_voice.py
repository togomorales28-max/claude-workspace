#!/usr/bin/env python3
"""
Generates the Spanish (Latin American) voice-over with Kokoro, a free,
open-source neural TTS (Apache-2.0) whose model files are published on GitHub:
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

  pip install kokoro-onnx soundfile
  python3 scripts/generate_voice.py                 # voz por defecto: em_alex (masculina)
  python3 scripts/generate_voice.py --voice ef_dora # voz femenina

The model (~350 MB) is downloaded once into .tts-models/ (git-ignored).
Each line of src/ajedrez/data/narration.json becomes
public/ajedrez/audio/voz/<id>.wav, sped up slightly if needed so it fits its
window. Afterwards run `npm run ajedrez:voz` and render again.
"""
import argparse
import json
import re
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / ".tts-models"
OUT = ROOT / "public" / "ajedrez" / "audio" / "voz"
NARRATION = ROOT / "src" / "ajedrez" / "data" / "narration.json"
RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]

# How chess notation should be read aloud.
SAY = {
    r"\be4\b": "e cuatro",
    r"\be5\b": "e cinco",
    r"\bf3\b": "efe tres",
    r"\bc6\b": "ce seis",
    r"\bc4\b": "ce cuatro",
    r"\ben L\b": "en ele",
}


def ensure_models():
    MODELS.mkdir(exist_ok=True)
    for f in FILES:
        path = MODELS / f
        if not path.exists():
            print(f"descargando {f} desde GitHub…")
            urllib.request.urlretrieve(RELEASE + f, path)
    return Kokoro(str(MODELS / FILES[0]), str(MODELS / FILES[1]))


def spoken_text(line):
    text = line.get("tts") or line["text"]
    text = text.replace("*", "").replace(" | ", " ")
    for pattern, said in SAY.items():
        text = re.sub(pattern, said, text)
    return text


def latam_phonemes(kokoro, text):
    # espeak-ng "es-419": seseo (s instead of θ) and yeísmo (ll -> y).
    ph = kokoro.tokenizer.phonemize(text, "es-419")
    return ph.replace("jj", "ʝ" if "ʝ" in kokoro.tokenizer.vocab else "j")


def trim(audio, sr, threshold=0.01, pad=0.04):
    idx = np.where(np.abs(audio) > threshold)[0]
    if len(idx) == 0:
        return audio
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(audio), idx[-1] + int(pad * 2 * sr))
    return audio[a:b]


def finish(audio, sr, target_rms_db=-19.0):
    rms = np.sqrt(np.mean(audio**2)) or 1.0
    audio = audio * (10 ** (target_rms_db / 20) / rms)
    peak = np.max(np.abs(audio))
    if peak > 0.95:
        audio = audio * (0.95 / peak)
    fade = int(0.01 * sr)
    audio[:fade] *= np.linspace(0, 1, fade)
    audio[-fade:] *= np.linspace(1, 0, fade)
    return audio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="em_alex", help="ef_dora | em_alex | em_santa")
    ap.add_argument("--speed", type=float, default=1.05)
    ap.add_argument("--max-speed", type=float, default=1.35)
    args = ap.parse_args()

    data = json.loads(NARRATION.read_text())
    fps = data["fps"]
    lines = data["lines"]
    total = 1950
    kokoro = ensure_models()
    OUT.mkdir(parents=True, exist_ok=True)

    for i, line in enumerate(lines):
        window_end = lines[i + 1]["start"] if i + 1 < len(lines) else total
        max_s = (window_end - line["start"] - 3) / fps
        text = spoken_text(line)
        ph = latam_phonemes(kokoro, text)
        speed = args.speed
        audio, sr = kokoro.create(ph, voice=args.voice, speed=speed, is_phonemes=True)
        audio = trim(audio, sr)
        if len(audio) / sr > max_s:
            speed = min(args.max_speed, speed * (len(audio) / sr) / max_s * 1.03)
            audio, sr = kokoro.create(ph, voice=args.voice, speed=speed, is_phonemes=True)
            audio = trim(audio, sr)
        dur = len(audio) / sr
        flag = "" if dur <= max_s else f"  ⚠ excede la ventana ({max_s:.2f} s)"
        sf.write(OUT / f"{line['id']}.wav", finish(audio, sr), sr, subtype="PCM_16")
        print(f"{line['id']:<18} {dur:5.2f}s / {max_s:5.2f}s  vel {speed:.2f}  «{text}»{flag}")


if __name__ == "__main__":
    main()
