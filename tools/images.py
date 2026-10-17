#!/usr/bin/env python3
"""One-off image sourcing tool for AMAD (runs in GitHub Actions, which has internet access).

Phase 1 (no tools/picks.json): search Openverse + Wikimedia Commons for openly licensed photos
for every key in tools/image-queries.json, and write contact sheets + candidates.json for review.
Phase 2 (tools/picks.json present): download the chosen photos at up to 1800px into originals/.

Only CC0, Public Domain, CC BY and CC BY-SA images are accepted.
"""
import html
import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
UA = "AMADImageTool/1.0 (https://github.com/OmotolaDomain/Amad; open-source learning site)"
OK_COMMONS = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? \d(\.\d)?)", re.I)


def get(url, binary=False, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if binary else json.loads(data)
        except Exception as e:  # noqa: BLE001
            print(f"  retry {i + 1} {url[:90]}: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    return None


def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def openverse(q):
    params = urllib.parse.urlencode({"q": q, "license": "cc0,pdm,by,by-sa", "page_size": 20, "mature": "false"})
    data = get(f"https://api.openverse.org/v1/images/?{params}")
    time.sleep(3.5)  # anonymous rate limit
    out = []
    for r in (data or {}).get("results", []):
        w, h = r.get("width") or 0, r.get("height") or 0
        if w < 1200 or h < 700:
            continue
        out.append({
            "src": "openverse", "id": r["id"], "title": r.get("title") or "", "creator": r.get("creator") or "Unknown",
            "creator_url": r.get("creator_url"), "license": f"CC {r['license'].upper()} {r.get('license_version') or ''}".strip()
            if r["license"] not in ("cc0", "pdm") else ("CC0" if r["license"] == "cc0" else "Public domain"),
            "license_url": r.get("license_url"), "landing": r.get("foreign_landing_url"), "provider": r.get("provider"),
            "full": r["url"], "thumb": r.get("thumbnail") or r["url"], "w": w, "h": h,
        })
    return out


def commons(q):
    params = urllib.parse.urlencode({
        "action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap",
        "gsrnamespace": 6, "gsrlimit": 15, "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime", "iiurlwidth": 480,
    })
    data = get(f"https://commons.wikimedia.org/w/api.php?{params}")
    out = []
    for p in sorted(((data or {}).get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 0)):
        ii = (p.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        lic = strip(meta.get("LicenseShortName", {}).get("value"))
        if not OK_COMMONS.match(lic) or ii.get("mime") not in ("image/jpeg", "image/png"):
            continue
        if (ii.get("width") or 0) < 1200 or (ii.get("height") or 0) < 700:
            continue
        thumb = ii.get("thumburl")
        out.append({
            "src": "commons", "id": p["title"], "title": p["title"].removeprefix("File:"), "creator": strip(meta.get("Artist", {}).get("value")) or "Unknown",
            "creator_url": None, "license": lic, "license_url": strip(meta.get("LicenseUrl", {}).get("value")) or None,
            "landing": ii.get("descriptionurl"), "provider": "wikimedia",
            "full": thumb.replace("/480px-", "/1800px-") if thumb and ii["width"] > 1800 else ii["url"], "thumb": thumb, "w": ii["width"], "h": ii["height"],
        })
    return out


def candidates():
    queries = json.loads((ROOT / "tools/image-queries.json").read_text())
    allc = {}
    for item in queries:
        key, qs = item["key"], item["queries"]
        found = []
        for q in qs:
            found += [c for c in openverse(q) if c["id"] not in {f["id"] for f in found}]
            if len(found) >= 6:
                break
        found = found[:6]
        cm = []
        for q in qs:
            cm += [c for c in commons(q) if c["id"] not in {f["id"] for f in cm}]
            if len(cm) >= 3:
                break
        found += cm[:3]
        for i, c in enumerate(found):
            c["label"] = f"{'o' if c['src'] == 'openverse' else 'c'}{i}"
        allc[key] = found
        print(f"{key}: {len(found)} candidates")
    (ROOT / "tools/candidates.json").write_text(json.dumps(allc, indent=1))
    # contact sheets: 8 keys per sheet, 9 thumbs per row
    keys = list(allc)
    sheets = ROOT / "tools/sheets"
    sheets.mkdir(exist_ok=True)
    TW, TH = 200, 134
    for s in range(0, len(keys), 8):
        chunk = keys[s:s + 8]
        sheet = Image.new("RGB", (130 + 9 * (TW + 4), len(chunk) * (TH + 6)), "white")
        d = ImageDraw.Draw(sheet)
        for row, key in enumerate(chunk):
            y = row * (TH + 6)
            d.text((4, y + TH // 2 - 6), key, fill="black")
            for col, c in enumerate(allc[key]):
                raw = get(c["thumb"], binary=True) or (get(c["full"], binary=True) if c["src"] == "commons" else None)
                if not raw:
                    continue
                try:
                    im = Image.open(io.BytesIO(raw)).convert("RGB")
                except Exception:  # noqa: BLE001
                    continue
                im.thumbnail((TW * 2, TH * 2))
                im = im.resize((TW, TH))
                x = 130 + col * (TW + 4)
                sheet.paste(im, (x, y))
                d.rectangle((x, y, x + 26, y + 14), fill="black")
                d.text((x + 3, y + 2), c["label"], fill="white")
        sheet.save(sheets / f"sheet-{s // 8 + 1}.jpg", quality=80)
        print("wrote sheet", s // 8 + 1)


def fetch_picks():
    picks = json.loads((ROOT / "tools/picks.json").read_text())
    allc = json.loads((ROOT / "tools/candidates.json").read_text())
    out_dir = ROOT / "originals"
    out_dir.mkdir(exist_ok=True)
    credits = {}
    for key, label in picks.items():
        c = next(x for x in allc[key] if x["label"] == label)
        raw = get(c["full"], binary=True)
        if not raw:
            print("FAILED", key)
            continue
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        im.thumbnail((1800, 1800))
        im.save(out_dir / f"{key}.jpg", quality=88)
        credits[key] = {k: c[k] for k in ("title", "creator", "creator_url", "license", "license_url", "landing", "provider")}
        print("saved", key, im.size)
    (out_dir / "credits.json").write_text(json.dumps(credits, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    fetch_picks() if (ROOT / "tools/picks.json").exists() else candidates()
