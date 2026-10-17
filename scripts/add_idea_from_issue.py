#!/usr/bin/env python3
"""Turn a 'Share an idea' issue (from .github/ISSUE_TEMPLATE/share-idea.yml) into an entry
in site/data/ideas.json. Run by .github/workflows/publish-idea.yml when a maintainer adds
the `approved` label.

Reads ISSUE_BODY, ISSUE_NUMBER and ISSUE_USER from the environment.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate import DATA, load, topic_ids, validate_idea  # noqa: E402

NO_RESPONSE = "_No response_"


def parse_issue_form(body: str) -> dict[str, str]:
    """Split a GitHub issue-form body ('### Label\\n\\nvalue') into {label: value}."""
    fields = {}
    for block in re.split(r"^### ", body.replace("\r\n", "\n"), flags=re.M)[1:]:
        label, _, value = block.partition("\n")
        value = value.strip()
        fields[label.strip()] = "" if value == NO_RESPONSE else value
    return fields


def idea_from_issue(body: str, number: int, user: str, topics_meta: list[dict], today: str) -> dict:
    f = parse_issue_form(body)
    by_name = {t["name"].lower(): t["id"] for t in topics_meta}
    topic_label = f.get("Topic", "").strip()
    topic = by_name.get(topic_label.lower(), topic_label.lower())
    pages = [p.strip() for p in re.split(r"\n\s*\n", f.get("The idea", "")) if p.strip()]
    words = sum(len(p.split()) for p in pages)
    source = {"name": f.get("Original source", "").strip()}
    if f.get("Source link", "").strip():
        source["url"] = f["Source link"].strip()
    return {
        "id": f"{topic}-c{number}",
        "topic": topic,
        "title": f.get("Title", "").strip(),
        "pages": pages,
        "takeaway": f.get("One-line takeaway", "").strip(),
        "source": source,
        "minutes": max(1, min(10, round(words / 200) or 1)),
        "contributor": user,
        "added": today,
    }


def main() -> int:
    body = os.environ.get("ISSUE_BODY", "")
    number = int(os.environ["ISSUE_NUMBER"])
    user = os.environ.get("ISSUE_USER", "community")
    today = datetime.now(timezone.utc).date().isoformat()
    idea = idea_from_issue(body, number, user, load("topics.json")["topics"], today)

    errs = validate_idea(idea, topic_ids())
    if errs:
        print("\n".join(errs))
        Path(os.environ.get("ERRORS_FILE", "/dev/null")).write_text("\n".join(f"- {e}" for e in errs))
        return 1

    path = DATA / "ideas.json"
    data = json.loads(path.read_text())
    data["ideas"] = [i for i in data["ideas"] if i["id"] != idea["id"]]  # re-approving updates in place
    data["ideas"].append(idea)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Added {idea['id']}: {idea['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
