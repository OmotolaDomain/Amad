#!/usr/bin/env python3
"""Validate site/data/*.json. Runs in CI on every pull request.

Usage: python scripts/validate.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "site" / "data"
ID_RE = re.compile(r"^[a-z]+-[a-z0-9-]+$")
URL_RE = re.compile(r"^https?://\S+$", re.I)
LIMITS = {"title": 120, "page": 600, "takeaway": 240, "source": 160}


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text())


def topic_ids() -> set[str]:
    return {t["id"] for t in load("topics.json")["topics"]}


def validate_idea(idea: dict, topics: set[str]) -> list[str]:
    """Return a list of human-readable problems with one idea (empty list = valid)."""
    errs = []
    ref = idea.get("id", "<missing id>")
    if not isinstance(idea.get("id"), str) or not ID_RE.match(idea["id"]):
        errs.append(f"{ref}: id must look like 'topic-123'")
    if idea.get("topic") not in topics:
        errs.append(f"{ref}: unknown topic {idea.get('topic')!r} (one of {sorted(topics)})")
    title = idea.get("title")
    if not isinstance(title, str) or not title.strip() or len(title) > LIMITS["title"]:
        errs.append(f"{ref}: title is required, max {LIMITS['title']} characters")
    pages = idea.get("pages")
    if not isinstance(pages, list) or not 1 <= len(pages) <= 5:
        errs.append(f"{ref}: pages must be a list of 1-5 paragraphs")
    else:
        for i, p in enumerate(pages):
            if not isinstance(p, str) or not p.strip() or len(p) > LIMITS["page"]:
                errs.append(f"{ref}: page {i + 1} must be non-empty text, max {LIMITS['page']} characters")
    takeaway = idea.get("takeaway")
    if not isinstance(takeaway, str) or not takeaway.strip() or len(takeaway) > LIMITS["takeaway"]:
        errs.append(f"{ref}: takeaway is required, max {LIMITS['takeaway']} characters")
    src = idea.get("source")
    if not isinstance(src, dict) or not isinstance(src.get("name"), str) or not src["name"].strip():
        errs.append(f"{ref}: source.name is required (credit the original thinker or publication)")
    elif len(src["name"]) > LIMITS["source"]:
        errs.append(f"{ref}: source.name max {LIMITS['source']} characters")
    elif src.get("url") is not None and not (isinstance(src["url"], str) and URL_RE.match(src["url"])):
        errs.append(f"{ref}: source.url must be an http(s) link")
    if not isinstance(idea.get("minutes"), int) or not 1 <= idea["minutes"] <= 10:
        errs.append(f"{ref}: minutes must be an integer 1-10")
    if idea.get("visual") is not None and not (isinstance(idea["visual"], str) and re.match(r"^[a-z-]+$", idea["visual"])):
        errs.append(f"{ref}: visual must be the name of an explanation in site/assets/visuals.js")
    if not isinstance(idea.get("contributor"), str) or not idea["contributor"].strip():
        errs.append(f"{ref}: contributor is required (your GitHub username)")
    try:
        date.fromisoformat(idea.get("added", ""))
    except (TypeError, ValueError):
        errs.append(f"{ref}: added must be a YYYY-MM-DD date")
    return errs


def validate_all() -> list[str]:
    errs = []
    topics = topic_ids()
    ideas = load("ideas.json")["ideas"]
    seen = set()
    for idea in ideas:
        errs += validate_idea(idea, topics)
        if idea.get("id") in seen:
            errs.append(f"{idea.get('id')}: duplicate id")
        seen.add(idea.get("id"))
    for feed in load("sources.json")["feeds"]:
        if not URL_RE.match(feed.get("url", "")):
            errs.append(f"sources.json: {feed.get('name')}: bad url")
        bad = [t for t in feed.get("topics", []) if t not in topics]
        if not feed.get("topics") or bad:
            errs.append(f"sources.json: {feed.get('name')}: topics must be a non-empty list of known topics")
    for t in load("topics.json")["topics"]:
        for key in ("shadow", "highlight"):
            if not re.match(r"^#[0-9A-Fa-f]{6}$", t.get(key, "")):
                errs.append(f"topics.json: {t['id']}: {key} must be a #RRGGBB colour")
    visuals_js = (DATA.parent / "assets" / "visuals.js").read_text()
    for idea in ideas:
        if idea.get("visual") and f'"{idea["visual"]}"' not in visuals_js and f"\n    {idea['visual']}:" not in visuals_js:
            errs.append(f"{idea['id']}: visual {idea['visual']!r} is not defined in visuals.js")
    for c in load("collections.json")["collections"]:
        missing = [i for i in c.get("ideas", []) if i not in seen]
        if not c.get("title") or not c.get("ideas") or missing:
            errs.append(f"collections.json: {c.get('id')}: needs a title and existing idea ids (missing: {missing})")
    credits_path = DATA / "credits.json"
    if credits_path.exists():
        img_dir = DATA.parent / "assets" / "img"
        for key, c in json.loads(credits_path.read_text()).items():
            if not c.get("creator") or not c.get("license"):
                errs.append(f"credits.json: {key}: creator and license are required")
            for w in (480, 960):
                if not (img_dir / f"{key}-{w}.webp").exists():
                    errs.append(f"credits.json: {key}: missing assets/img/{key}-{w}.webp")
    errs += validate_pwa()
    load("feed.json")  # must at least parse
    return errs


def validate_pwa() -> list[str]:
    """The app must work from a project path like /Amad/: every PWA URL is relative and every file exists."""
    errs = []
    site = DATA.parent
    manifest = json.loads((site / "manifest.webmanifest").read_text())
    for key in ("start_url", "scope", "id"):
        if str(manifest.get(key, "")).startswith("/"):
            errs.append(f"manifest: {key} must be relative (GitHub Pages serves AMAD from a sub-path)")
    if manifest.get("display") != "standalone":
        errs.append("manifest: display must be standalone")
    sizes = {i.get("sizes") for i in manifest.get("icons", []) if i.get("purpose", "any") == "any"}
    if not {"192x192", "512x512"} <= sizes:
        errs.append("manifest: needs 192x192 and 512x512 icons")
    if not any(i.get("purpose") == "maskable" for i in manifest.get("icons", [])):
        errs.append("manifest: needs a maskable icon for Android")
    srcs = [i["src"] for i in manifest.get("icons", [])] + [i["src"] for sc in manifest.get("shortcuts", []) for i in sc.get("icons", [])]
    srcs += [sc["src"] for sc in manifest.get("screenshots", [])]
    for src in srcs:
        if src.startswith("/") or not (site / src).exists():
            errs.append(f"manifest: {src} must be a relative path to an existing file")
    sw = (site / "sw.js").read_text()
    block = re.search(r"const PRECACHE = \[(.*?)\];", sw, re.S)
    if not block or "__BUILD__" not in sw:
        errs.append("sw.js: PRECACHE list or __BUILD__ placeholder missing")
    else:
        for path in re.findall(r'"([^"]+)"', block.group(1)):
            if path.startswith("/"):
                errs.append(f"sw.js: precache path {path} must be relative")
            elif path != "./" and not (site / path).exists():
                errs.append(f"sw.js: precache file {path} does not exist")
    return errs


if __name__ == "__main__":
    problems = validate_all()
    for p in problems:
        print(f"::error::{p}")
    print(f"{len(problems)} problem(s) found" if problems else "All data files are valid ✔")
    sys.exit(1 if problems else 0)
