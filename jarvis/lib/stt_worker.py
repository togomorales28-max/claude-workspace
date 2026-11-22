"""Whisper (faster-whisper) como proceso persistente: carga el modelo una vez y transcribe a demanda.

Protocolo: una línea JSON por petición en stdin  {"id": "...", "path": "audio.webm", "lang": "es"}
           una línea JSON por respuesta en stdout {"id": "...", "text": "..."} o {"id": "...", "error": "..."}
Instalar:  pip install faster-whisper
"""
import json
import os
import sys

from faster_whisper import WhisperModel

MODEL = os.environ.get("WHISPER_MODEL", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")  # "cuda" si tienes tarjeta NVIDIA
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8" if DEVICE == "cpu" else "float16")

model = WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE)
print(json.dumps({"ready": True, "model": MODEL}), flush=True)

for line in sys.stdin:
    try:
        req = json.loads(line)
    except ValueError:
        continue
    try:
        segments, _ = model.transcribe(req["path"], language=req.get("lang") or None, vad_filter=True, beam_size=1)
        text = "".join(s.text for s in segments).strip()
        print(json.dumps({"id": req["id"], "text": text}, ensure_ascii=False), flush=True)
    except Exception as e:  # noqa: BLE001 - se informa al servidor y se sigue
        print(json.dumps({"id": req.get("id"), "error": str(e)}), flush=True)
