#!/usr/bin/env python3
"""build_styles.py — fetch + process curated PD/CC0 raster for each style pack.

Reads assets/styles/<id>/_sources.json (list of {url, out, license, credit,
crop?, role}). Downloads each, optionally crops (fractional bbox [l,t,r,b]),
upscales small images (Lanczos) to a min target, downscales huge ones for bundle
size, optimizes, and writes to the style folder. Emits LICENSES.md per style.

Offline-safe: failures (403/404/timeout) are skipped with a warning; the pack
still builds from whatever downloaded + authored SVG motifs.
"""
import json
import sys
import pathlib
import urllib.request
from io import BytesIO
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
STYLES = ROOT / "assets" / "styles"
TARGET_MIN = 1400   # upscale anything smaller than this (longest edge)
TARGET_MAX = 2400   # downscale anything larger (bundle size)
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 Pitch-StyleBuilder/1.0"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*,*/*"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read()


def process(img: Image.Image, crop, out_path: pathlib.Path):
    if img.mode in ("P", "LA"):
        img = img.convert("RGBA")
    if crop and len(crop) == 4:
        w, h = img.size
        l, t, r, b = crop
        img = img.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    w, h = img.size
    longest = max(w, h)
    if longest < TARGET_MIN:
        s = TARGET_MIN / longest
        img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    elif longest > TARGET_MAX:
        s = TARGET_MAX / longest
        img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ext = out_path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        img.convert("RGB").save(out_path, "JPEG", quality=82, optimize=True, progressive=True)
    elif ext == ".webp":
        img.save(out_path, "WEBP", quality=82, method=6)
    else:
        img.save(out_path, "PNG", optimize=True)
    return img.size


def build_style(style_id: str):
    sdir = STYLES / style_id
    src = sdir / "_sources.json"
    if not src.exists():
        return None
    items = json.loads(src.read_text())
    licenses = []
    ok = 0
    for it in items:
        out = sdir / it["out"]
        try:
            data = fetch(it["url"])
            img = Image.open(BytesIO(data))
            size = process(img, it.get("crop"), out)
            ok += 1
            licenses.append(f"- `{it['out']}` ({size[0]}×{size[1]}) — {it.get('credit','')} — **{it['license']}** — {it['url']}")
            print(f"  \u2713 {style_id}/{it['out']} {size[0]}x{size[1]}")
        except Exception as e:  # noqa
            print(f"  \u2717 {style_id}/{it['out']} skipped: {e}", file=sys.stderr)
            licenses.append(f"- `{it['out']}` — {it.get('credit','')} — **{it['license']}** — {it['url']} — (download skipped, re-fetch from source)")
    (sdir / "LICENSES.md").write_text(
        f"# {style_id} — asset licenses (PD/CC0)\n\nEvery shipped raster element is public-domain or CC0.\n\n" + "\n".join(licenses) + "\n"
    )
    return ok


if __name__ == "__main__":
    only = sys.argv[1:] or [p.name for p in STYLES.iterdir() if p.is_dir() and not p.name.startswith("_")]
    total = 0
    for sid in only:
        n = build_style(sid)
        if n is not None:
            print(f"\u2713 {sid}: {n} assets processed")
            total += n
    print(f"done: {total} assets")
