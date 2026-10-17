#!/usr/bin/env python3
"""Turn source photos into AMAD duotone WebP images (DESIGN.md §2 and §7).

Usage: python scripts/process_images.py <originals_dir>
  <originals_dir> holds <key>.jpg files plus credits.json ({key: {title, creator, license, ...}}).
  Keys: an idea id (e.g. strategy-001), world-<topic>, col-<collection id> or welcome.

Writes site/assets/img/<key>-480.webp and -960.webp, and merges the credits into site/data/credits.json.
Requires Pillow (pip install pillow).
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
OUT = ROOT / "site" / "assets" / "img"
BRAND = ("#141B3C", "#F1D9A0")  # ink navy -> gilt, for brand-level images such as "welcome"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def world_for(key, topics, collections, ideas):
    if key.startswith("world-"):
        return key[6:]
    if key.startswith("col-"):
        first = collections.get(key[4:], [None])[0]
        return ideas.get(first)
    return ideas.get(key)


def duotone(img, shadow, highlight):
    grey = ImageOps.autocontrast(ImageOps.grayscale(img), cutoff=1)
    s, h = hex_rgb(shadow), hex_rgb(highlight)
    # Gentle S-curve keeps midtones rich, then map black->shadow and white->highlight.
    lut = []
    for c in range(3):
        for v in range(256):
            t = v / 255
            t = t * t * (3 - 2 * t) * 0.35 + t * 0.65
            lut.append(round(s[c] + (h[c] - s[c]) * t))
    return Image.merge("RGB", [grey] * 3).point(lut)


def crop_extremes(img, max_ratio=2.0, min_ratio=0.75):
    w, h = img.size
    if w / h > max_ratio:
        nw = int(h * max_ratio)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    elif w / h < min_ratio:
        nh = int(w / min_ratio)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    return img


def main(src_dir):
    src = Path(src_dir)
    topics = {t["id"]: t for t in json.loads((DATA / "topics.json").read_text())["topics"]}
    ideas = {i["id"]: i["topic"] for i in json.loads((DATA / "ideas.json").read_text())["ideas"]}
    collections = {c["id"]: c["ideas"] for c in json.loads((DATA / "collections.json").read_text())["collections"]}
    new_credits = json.loads((src / "credits.json").read_text())
    credits_path = DATA / "credits.json"
    credits = json.loads(credits_path.read_text()) if credits_path.exists() else {}
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for key, credit in sorted(new_credits.items()):
        path = src / f"{key}.jpg"
        if not path.exists():
            print("skip (no file)", key)
            continue
        topic = world_for(key, topics, collections, ideas)
        shadow, highlight = (topics[topic]["shadow"], topics[topic]["highlight"]) if topic in topics else BRAND
        img = crop_extremes(Image.open(path).convert("RGB"))
        art = duotone(img, shadow, highlight)
        for w in (480, 960):
            out = art.resize((w, round(art.height * w / art.width)), Image.LANCZOS) if art.width > w else art
            dest = OUT / f"{key}-{w}.webp"
            out.save(dest, "WEBP", quality=70 if w == 960 else 66, method=6)
            total += dest.stat().st_size
        credits[key] = credit
        print(f"ok {key} ({topic or 'brand'})")
    credits_path.write_text(json.dumps(dict(sorted(credits.items())), indent=1, ensure_ascii=False) + "\n")
    print(f"done: {len(new_credits)} photos, {total / 1024:.0f} KB of WebP")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
