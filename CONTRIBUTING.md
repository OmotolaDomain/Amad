# Contributing to AMAD

Thanks for helping people get better at commercial work, one idea a day. 🌱

## The fastest way: the issue form

Open a new issue and choose **💡 Share an idea**. When a maintainer adds the `approved` label, a GitHub Action adds it to `site/data/ideas.json` and the site redeploys automatically. If something needs fixing, the bot comments on your issue and explains what.

## What makes a great idea

- **One idea per card.** A single framework, habit or insight, not a whole book.
- **Your own words.** Summarise; don't copy. Never paste paywalled text.
- **Credit the source** (book, article, author, or "My own experience") and link to it if you can.
- **Actionable takeaway.** Something the reader can do *today*, in one sentence.
- **Short.** 1–5 paragraphs, each up to 600 characters. Title up to 120 characters.

## Editing JSON directly (PRs)

Add an object to `site/data/ideas.json`:

```json
{
  "id": "accounts-042",
  "topic": "accounts",
  "title": "Headline, max 120 chars",
  "pages": ["Paragraph one.", "Paragraph two."],
  "takeaway": "What to do today.",
  "source": { "name": "Book or article, Author", "url": "https://optional.link" },
  "minutes": 2,
  "contributor": "your-github-username",
  "added": "2026-10-16"
}
```

`topic` must be one of: `strategy`, `enterprise`, `territory`, `performance`, `accounts`, `executive`, `branding`.

Before pushing, run:

```bash
python scripts/validate.py
python -m unittest discover tests
```

## Adding a feed source

Add an entry to `site/data/sources.json`. Set `"classify": true` for broad publications: items are then filtered and assigned to topics using the keywords in `topics.json`. Set `"classify": false` for feeds that are already focused on one topic, and every item goes to the first topic listed. Test it with `python scripts/fetch_feeds.py`.
