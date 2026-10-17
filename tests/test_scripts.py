"""Offline tests for the data scripts. Run: python -m unittest discover tests"""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import add_idea_from_issue as issue  # noqa: E402
import fetch_feeds as ff  # noqa: E402
import validate  # noqa: E402

NOW = datetime.now(timezone.utc)
RFC822 = NOW.strftime("%a, %d %b %Y %H:%M:%S +0000")

RSS = f"""<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
<item><title>How to fix sales territory imbalance - Acme News</title><link>https://example.com/a</link>
<pubDate>{RFC822}</pubDate><description>&lt;a href="x"&gt;How to fix sales territory imbalance&lt;/a&gt;</description>
<source url="https://acme.example">Acme News</source></item>
<item><title>Old story</title><link>https://example.com/old</link><pubDate>Mon, 01 Jan 2001 00:00:00 +0000</pubDate></item>
<item><title>Bad link</title><link>javascript:alert(1)</link><pubDate>{RFC822}</pubDate></item>
</channel></rss>""".encode()

ATOM = f"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>t</title>
<entry><title>Why brand building pays off</title><link rel="alternate" href="https://example.com/b"/>
<updated>{NOW.strftime('%Y-%m-%dT%H:%M:%SZ')}</updated><summary>&lt;p&gt;Long-term brand investment and &lt;b&gt;positioning&lt;/b&gt;.&lt;/p&gt;</summary></entry>
<entry><title>Cooking pasta</title><link href="https://example.com/c"/><updated>{NOW.strftime('%Y-%m-%dT%H:%M:%SZ')}</updated></entry>
</feed>""".encode()

KEYWORDS = {t["id"]: t["keywords"] for t in validate.load("topics.json")["topics"]}
CUTOFF = NOW - timedelta(days=14)


class FetchFeedsTest(unittest.TestCase):
    def test_rss_google_news_style(self):
        feed = {"name": "GN", "topics": ["territory"], "classify": False}
        items = ff.build_items(feed, ff.parse_feed(RSS, "GN"), KEYWORDS, CUTOFF)
        self.assertEqual(len(items), 1)  # old item and javascript: link dropped
        it = items[0]
        self.assertEqual(it["title"], "How to fix sales territory imbalance")
        self.assertEqual(it["source"], "Acme News")
        self.assertEqual(it["summary"], "")  # headline-echo description removed
        self.assertEqual(it["topic"], "territory")

    def test_atom_with_classification(self):
        feed = {"name": "Mag", "topics": ["strategy", "branding"], "classify": True}
        items = ff.build_items(feed, ff.parse_feed(ATOM, "Mag"), KEYWORDS, CUTOFF)
        self.assertEqual([i["link"] for i in items], ["https://example.com/b"])  # pasta unclassified
        self.assertEqual(items[0]["topic"], "branding")
        self.assertNotIn("<", items[0]["summary"])

    def test_merge_dedupes_and_caps(self):
        a = {"id": "1", "topic": "strategy", "title": "Hello World", "published": NOW.isoformat()}
        b = {"id": "2", "topic": "strategy", "title": "hello, world!", "published": NOW.isoformat()}
        old = {"id": "3", "topic": "strategy", "title": "Ancient", "published": "2001-01-01T00:00:00Z"}
        self.assertEqual([i["id"] for i in ff.merge([a], [b, old], CUTOFF, 40)], ["1"])

    def test_truncate(self):
        self.assertTrue(ff.truncate("word " * 100, 50).endswith("…"))


ISSUE_BODY = """### Topic

Account Management

### Title

Ask for the second meeting in the first

### The idea

End every first meeting by booking the next one.

It keeps momentum and shows commitment.

### One-line takeaway

Never leave a meeting without the next date.

### Original source

My own experience

### Source link

_No response_

### Confirmation

- [X] I wrote this summary in my own words
"""


class IssueTest(unittest.TestCase):
    def test_issue_to_idea_is_valid(self):
        topics = validate.load("topics.json")["topics"]
        idea = issue.idea_from_issue(ISSUE_BODY, 42, "octocat", topics, "2026-10-16")
        self.assertEqual(idea["id"], "accounts-c42")
        self.assertEqual(len(idea["pages"]), 2)
        self.assertNotIn("url", idea["source"])
        self.assertEqual(validate.validate_idea(idea, validate.topic_ids()), [])

    def test_bad_link_rejected(self):
        topics = validate.load("topics.json")["topics"]
        body = ISSUE_BODY.replace("### Source link\n\n_No response_", "### Source link\n\njavascript:alert(1)")
        idea = issue.idea_from_issue(body, 1, "x", topics, "2026-10-16")
        self.assertTrue(any("url" in e for e in validate.validate_idea(idea, validate.topic_ids())))


class DataTest(unittest.TestCase):
    def test_repository_data_is_valid(self):
        self.assertEqual(validate.validate_all(), [])


if __name__ == "__main__":
    unittest.main()
