<p align="center"><img src="site/assets/amad-mark.svg" width="72" alt="AMAD logo"></p>

# AMAD

**A personalised daily learning and knowledge discovery platform for business growth, strategy, leadership and professional development.**

**Free, open source and no sign-up.** AMAD is a daily learning feed, in the style of Deepstash, covering seven categories:

♟️ Strategy · 🏢 Enterprise Commercial · 🗺️ Territory Mapping · 📈 Performance Optimization · 🤝 Account Management · 🎯 Director-Level Engagement · ✨ Branding

It runs entirely on GitHub: **GitHub Pages** hosts it, **GitHub Actions** refreshes it daily, and the community adds ideas through **GitHub Issues and PRs**. There are no servers, no database and no accounts.

## Features

| | |
|---|---|
| **Growth plan** | A 3-question onboarding (role → focus areas → minutes per day) builds a personalised plan, similar to Deepstash's growth plan. |
| **Daily stash** | A fresh set of 3–7 bite-sized ideas every day from your focus topics, preferring ideas you haven't read yet. |
| **Swipeable idea cards** | Each idea is a few short pages ending in a *"Try this today"* takeaway, with credit and a link to the original source. |
| **Fresh from the web** | Headlines from public business feeds (MIT Sloan, McKinsey, Wharton, HBR, Google News topic searches and more), sorted by topic and refreshed every morning. |
| **Streaks, progress and saved ideas** | Stored only in the visitor's browser (`localStorage`). |
| **Share and discuss** | Share any idea by link, or discuss it in a GitHub issue. |
| **Mobile-first and dark mode** | Plain HTML/CSS/JS with no build step and no frameworks. |

## How it works

```
site/                     ← the website (deployed as-is to GitHub Pages)
  index.html, assets/     ← UI (vanilla JS)
  data/topics.json        ← the 7 topics + keywords used to classify news
  data/ideas.json         ← the idea library (curated + community)
  data/sources.json       ← RSS/Atom feeds pulled every day
  data/feed.json          ← generated daily by the bot. Don't edit by hand.
scripts/
  fetch_feeds.py          ← pulls feeds into feed.json (Python stdlib only)
  add_idea_from_issue.py  ← turns an approved "Share an idea" issue into an idea
  validate.py             ← schema checks run on every PR
.github/workflows/
  daily-feed.yml          ← 05:17 UTC every day: fetch → validate → commit
  publish-idea.yml        ← label an idea issue `approved` → it's published
  deploy.yml              ← deploys site/ to GitHub Pages
  validate.yml            ← data validation + unit tests on PRs
  setup-labels.yml        ← creates the idea / approved / source labels
```

## Deployment

- **Repository:** https://github.com/OmotolaDomain/amad
- **Live site:** https://omotoladomain.github.io/amad/

Every push to `main` that changes `site/` deploys through `.github/workflows/deploy.yml`. Each workflow declares its own `permissions:`, so the repository's default token setting doesn't need changing.

### One-time setup

1. **Enable Pages:** *Settings → Pages → Build and deployment → Source: **GitHub Actions***. Then run **Actions → Deploy site to GitHub Pages → Run workflow** once.
2. **Labels** (`idea`, `approved`, `source`) are created automatically by `.github/workflows/setup-labels.yml`. To recreate them, re-run it from the Actions tab.
3. To fill the Fresh feed straight away instead of waiting for 05:17 UTC, run **Actions → Daily feed refresh → Run workflow**.

Forks work the same way: the site detects its own repository for the "Share an idea" links.

> Run it locally with `cd site && python3 -m http.server 8000`, then open http://localhost:8000.

## Contributing daily updates

- **No code:** open an issue with the **💡 Share an idea** form. A maintainer reviews it and adds the `approved` label. A bot then publishes it, credits you, closes the issue and redeploys the site.
- **Suggest a news source:** use the **📰 Suggest a feed source** form, or add it to `site/data/sources.json` in a PR.
- **Pull requests:** edit `site/data/ideas.json` directly. CI validates every change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the style guide.

## Content policy

AMAD shares **original summaries** of ideas and **links** to the original work. It never republishes full or paywalled articles. The Fresh feed stores only headlines, short publisher-provided excerpts and links. Always credit the original thinker.

## License

Code: [MIT](LICENSE). Idea summaries: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
