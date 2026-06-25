#!/usr/bin/env python3
"""tts.py - synthesize per-slide narration audio + word timings.

Usage:
  python3 scripts/tts.py <slides.json> --out <dir> [--voice en-US-AriaNeural]

Writes, under <dir>/audio/:
  sNNN.mp3            per-slide narration audio
  sNNN.words.json     [{ "text", "start", "end" }]  (seconds, within the slide)
  index.json          { voice, slides: [{ index, id, mp3, words, duration, narration }] }

Default provider is edge-tts (free, emits word boundaries natively). Slides with
no narration get a short silent hold so every slide still appears in the video.
"""
import argparse
import asyncio
import json
import os
import subprocess
import sys

try:
    import edge_tts
except ImportError:
    sys.stderr.write("tts: edge-tts not installed. Run: pip install edge-tts\n")
    sys.exit(1)


def ffprobe_duration(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "default=nk=1:nw=1", path],
            capture_output=True, text=True, check=True,
        )
        return float(out.stdout.strip())
    except Exception:
        return None


async def synth_slide(text, voice, mp3_path):
    """Stream TTS audio to mp3 and collect word boundaries (100ns ticks)."""
    comm = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    words = []
    with open(mp3_path, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                start = ch["offset"] / 1e7
                dur = ch["duration"] / 1e7
                words.append({"text": ch["text"], "start": round(start, 3), "end": round(start + dur, 3)})
    return words


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slides")
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="en-US-AriaNeural")
    ap.add_argument("--default-hold", type=float, default=3.0,
                    help="seconds to hold a slide that has no narration")
    args = ap.parse_args()

    spec = json.load(open(args.slides))
    slides = spec["slides"] if isinstance(spec, dict) else spec
    audio_dir = os.path.join(args.out, "audio")
    os.makedirs(audio_dir, exist_ok=True)

    index = []
    for i, s in enumerate(slides):
        narr = (s.get("narration") or "").strip()
        sid = f"s{i:03d}"
        entry = {"index": i, "id": s.get("id", sid), "narration": narr}
        if narr:
            mp3 = os.path.join(audio_dir, sid + ".mp3")
            words = await synth_slide(narr, args.voice, mp3)
            dur = ffprobe_duration(mp3) or (words[-1]["end"] if words else args.default_hold)
            wf = os.path.join(audio_dir, sid + ".words.json")
            json.dump(words, open(wf, "w"), indent=2)
            entry.update({
                "mp3": os.path.relpath(mp3, args.out),
                "words": os.path.relpath(wf, args.out),
                "duration": round(dur, 3),
            })
            print(f"  {sid}: {len(words)} words, {dur:.1f}s")
        else:
            entry.update({"mp3": None, "words": None, "duration": args.default_hold})
            print(f"  {sid}: (no narration) hold {args.default_hold}s")
        index.append(entry)

    json.dump({"voice": args.voice, "slides": index},
              open(os.path.join(audio_dir, "index.json"), "w"), indent=2)
    total = sum(e["duration"] for e in index)
    print(f"\u2713 tts done: {len(index)} slides, ~{total:.0f}s total -> {audio_dir}")


if __name__ == "__main__":
    asyncio.run(main())
