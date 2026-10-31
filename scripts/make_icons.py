#!/usr/bin/env python3
"""Render AMAD's PWA icons from the brand mark (site/assets/amad-mark.svg) with Pillow.

Writes site/assets/icons/:
  icon-{96,192,512}.png       rounded-square icons ("any" purpose)
  maskable-{192,512}.png      full-bleed icons with the mark inside the 80% safe zone (Android adaptive icons)
  apple-touch-icon.png        180px, full-bleed (iOS rounds the corners itself)

Usage: python scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "site" / "assets" / "icons"
NAVY_TOP, NAVY_BOTTOM = (0x1B, 0x25, 0x50), (0x0D, 0x11, 0x24)
GOLD_TOP, GOLD_BOTTOM = (0xF1, 0xD9, 0xA0), (0xC9, 0xA2, 0x5A)
# The mark's geometry on its 64-unit grid (same as amad-mark.svg).
OUTER = [(32, 13), (49, 51), (41.5, 51), (37.8, 42.5), (26.2, 42.5), (22.5, 51), (15, 51)]
HOLE = [(28.8, 36.3), (35.2, 36.3), (32, 28.6)]
DOT, DOT_R = (47, 17), 3.2
SS = 4  # supersampling factor for smooth edges


def gradient(size, top, bottom, diagonal=False):
    g = Image.new("RGB", (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = ((x + y) / (2 * size)) if diagonal else y / size
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return g


def render(size, glyph_scale, rounded):
    big = size * SS
    bg = gradient(big // 8, NAVY_TOP, NAVY_BOTTOM, diagonal=True).resize((big, big), Image.BICUBIC)
    gold = gradient(big // 8, GOLD_TOP, GOLD_BOTTOM).resize((big, big), Image.BICUBIC)
    unit = big * glyph_scale / 64
    off = (big - 64 * unit) / 2
    pt = lambda p: (off + p[0] * unit, off + p[1] * unit)  # noqa: E731
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([pt(p) for p in OUTER], fill=255)
    d.polygon([pt(p) for p in HOLE], fill=0)
    cx, cy = pt(DOT)
    r = DOT_R * unit
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    img = Image.composite(gold, bg, mask)
    if rounded:
        shape = Image.new("L", (big, big), 0)
        ImageDraw.Draw(shape).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.25, fill=255)
        img = img.convert("RGBA")
        img.putalpha(shape)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for s in (96, 192, 512):
        render(s, 1.0, rounded=True).save(OUT / f"icon-{s}.png", optimize=True)
    for s in (192, 512):
        render(s, 0.78, rounded=False).save(OUT / f"maskable-{s}.png", optimize=True)
    render(180, 0.8, rounded=False).save(OUT / "apple-touch-icon.png", optimize=True)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
