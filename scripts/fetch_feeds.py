#!/usr/bin/env python3
"""Pull public RSS/Atom feeds listed in site/data/sources.json into site/data/feed.json.

Standard library only, so it runs on any GitHub Actions runner with no installs.
Only headlines, short excerpts and links are stored: readers go to the publisher
to read the full piece.

Usage: python scripts/fetch_feeds.py [--max-age-days 14] [--per-topic 40]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import email.utils
import hashlib
import html
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
USER_AGENT = "AMADFeedBot/1.0 (+https://github.com/OmotolaDomain/Amad)"
ATOM = "{http://www.w3.org/2005/Atom}"
SUMMARY_LEN = 280


def strip_html(text: str | None) -> str:
    if not text:
        return ""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def truncate(text: str, limit: int = SUMMARY_LEN) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(".,;:") + "…"


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    try:
        dt = email.utils.parsedate_to_datetime(value)  # RFC 822 (RSS)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))  # RFC 3339 (Atom)
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def safe_url(url: str | None) -> str | None:
    if url and re.match(r"^https?://", url.strip(), re.I):
        return url.strip()
    return None


def _text(el, tag: str) -> str | None:
    found = el.find(tag)
    return found.text if found is not None and found.text else None


def parse_feed(xml_bytes: bytes, feed_name: str) -> list[dict]:
    """Return raw entries (title, link, published, summary, source) from RSS 2.0 or Atom."""
    root = ET.fromstring(xml_bytes)
    entries = []
    if root.tag == f"{ATOM}feed":
        for e in root.findall(f"{ATOM}entry"):
            link = None
            for l in e.findall(f"{ATOM}link"):
                if l.get("rel", "alternate") == "alternate":
                    link = l.get("href")
                    break
            entries.append({
                "title": strip_html(_text(e, f"{ATOM}title")),
                "link": link,
                "published": _text(e, f"{ATOM}published") or _text(e, f"{ATOM}updated"),
                "summary": _text(e, f"{ATOM}summary") or _text(e, f"{ATOM}content"),
                "source": feed_name,
            })
    else:
        channel = root.find("channel")
        items = channel.findall("item") if channel is not None else root.iter("item")
        for it in items:
            source_el = it.find("source")
            source = source_el.text.strip() if source_el is not None and source_el.text else feed_name
            title = strip_html(_text(it, "title"))
            # Google News appends " - Publisher" to titles; drop it since we show the source.
            if source_el is not None and title.endswith(" - " + source):
                title = title[: -len(" - " + source)]
            entries.append({
                "title": title,
                "link": _text(it, "link"),
                "published": _text(it, "pubDate") or _text(it, "{http://purl.org/dc/elements/1.1/}date"),
                "summary": _text(it, "description"),
                "source": source,
            })
    return entries


def classify(text: str, candidate_topics: list[str], keywords: dict[str, list[str]]) -> str | None:
    lowered = f" {text.lower()} "
    best, best_hits = None, 0
    for topic in candidate_topics:
        hits = sum(1 for kw in keywords.get(topic, []) if re.search(r"(?<![a-z])" + re.escape(kw) + r"(?![a-z])", lowered))
        if hits > best_hits:
            best, best_hits = topic, hits
    return best


def item_id(link: str, title: str) -> str:
    return hashlib.sha1((link or title).encode("utf-8")).hexdigest()[:12]


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def build_items(feed: dict, entries: list[dict], keywords: dict[str, list[str]], cutoff: datetime) -> list[dict]:
    out = []
    for e in entries:
        link = safe_url(e["link"])
        title = e["title"]
        if not link or not title:
            continue
        published = parse_date(e["published"])
        if published and published < cutoff:
            continue
        summary = strip_html(e["summary"])
        if summary.lower().startswith(title.lower()[:40]):
            summary = ""  # Google News descriptions just repeat the headline
        if feed.get("classify"):
            topic = classify(f"{title} {summary}", feed["topics"], keywords)
            if not topic:
                continue
        else:
            topic = feed["topics"][0]
        out.append({
            "id": item_id(link, title),
            "topic": topic,
            "title": truncate(title, 200),
            "link": link,
            "source": truncate(e["source"] or feed["name"], 80),
            "published": (published or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "summary": truncate(summary),
        })
    return out


def fetch(url: str, timeout: int = 20) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(5_000_000)


def merge(new_items: list[dict], old_items: list[dict], cutoff: datetime, per_topic: int) -> list[dict]:
    """New items win; old ones are kept (until cutoff) so a flaky feed doesn't empty the page."""
    seen_ids, seen_titles, merged = set(), set(), []
    for it in new_items + old_items:
        key = normalize_title(it["title"])
        if it["id"] in seen_ids or key in seen_titles:
            continue
        published = parse_date(it.get("published"))
        if published and published < cutoff:
            continue
        seen_ids.add(it["id"])
        seen_titles.add(key)
        merged.append(it)
    merged.sort(key=lambda i: i["published"], reverse=True)
    counts: dict[str, int] = {}
    capped = []
    for it in merged:
        counts[it["topic"]] = counts.get(it["topic"], 0) + 1
        if counts[it["topic"]] <= per_topic:
            capped.append(it)
    return capped


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--max-age-days", type=int, default=14)
    ap.add_argument("--per-topic", type=int, default=40)
    args = ap.parse_args(argv)

    sources = json.loads((DATA / "sources.json").read_text())["feeds"]
    topics = json.loads((DATA / "topics.json").read_text())["topics"]
    keywords = {t["id"]: t["keywords"] for t in topics}
    feed_path = DATA / "feed.json"
    old = json.loads(feed_path.read_text()) if feed_path.exists() else {"items": []}
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.max_age_days)

    new_items, errors = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch, f["url"]): f for f in sources}
        for fut in concurrent.futures.as_completed(futures):
            feed = futures[fut]
            try:
                items = build_items(feed, parse_feed(fut.result(), feed["name"]), keywords, cutoff)
                new_items.extend(items)
                print(f"ok   {feed['name']}: {len(items)} items")
            except Exception as exc:  # one broken feed must not break the run
                errors.append({"source": feed["name"], "error": f"{type(exc).__name__}: {exc}"[:200]})
                print(f"FAIL {feed['name']}: {exc}", file=sys.stderr)

    items = merge(new_items, old.get("items", []), cutoff, args.per_topic)
    out = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "items": items,
        "errors": sorted(errors, key=lambda e: e["source"]),
    }
    feed_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(items)} items ({len(errors)} feed errors)")
    # Fail only if every source failed, so the workflow shows red when something is truly wrong.
    return 1 if sources and len(errors) == len(sources) else 0


if __name__ == "__main__":
    sys.exit(main())
