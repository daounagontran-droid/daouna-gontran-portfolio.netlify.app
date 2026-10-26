"""Génère la voix off des vidéos à partir de narration.json (synthèse vocale Kokoro, voix française ff_siwis).

Usage : python3 tools/wifi-videos/voice.py <dossier-modele> <dossier-sortie> [id ...]
  <dossier-modele> contient kokoro-v1.0.onnx et voices-v1.0.bin
  (https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0)
Écrit un WAV par segment (intro, scene-1…, outro) et timings.json avec leur durée en secondes,
que render.js utilise pour caler la durée des scènes et mixer la piste audio.
"""
import json
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE, SPEED = "ff_siwis", 0.95


def main():
    model_dir, out_dir, *ids = sys.argv[1:]
    narration = json.load(open(os.path.join(HERE, "narration.json"), encoding="utf-8"))
    ids = ids or [k for k in narration if not k.startswith("_")]
    kokoro = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))

    timings_path = os.path.join(out_dir, "timings.json")
    timings = json.load(open(timings_path)) if os.path.exists(timings_path) else {}
    for vid in ids:
        n = narration[vid]
        segments = [("intro", n["intro"])] + [(f"scene-{i + 1}", s) for i, s in enumerate(n["scenes"])] + [("outro", n["outro"])]
        os.makedirs(os.path.join(out_dir, vid), exist_ok=True)
        timings[vid] = {}
        for name, text in segments:
            samples, rate = kokoro.create(text, voice=VOICE, speed=SPEED, lang="fr-fr")
            sf.write(os.path.join(out_dir, vid, f"{name}.wav"), samples, rate)
            timings[vid][name] = round(len(samples) / rate, 3)
            print(f"{vid}/{name}: {timings[vid][name]:.1f} s")
    json.dump(timings, open(timings_path, "w"), indent=2)


if __name__ == "__main__":
    main()
