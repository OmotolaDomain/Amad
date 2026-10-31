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

## Install AMAD as an app (Android)

AMAD is a Progressive Web App, so it installs straight from the website with no app store:

1. Open **https://omotoladomain.github.io/Amad/** in **Chrome** on your Android phone.
2. Either tap **Install** on the "Add AMAD to your home screen" card (it appears on Today after you've read your first idea, and in **Progress → AMAD on your phone**), or open Chrome's **⋮** menu and choose **Install app** (on some phones: **Add to Home screen → Install**).
3. Confirm. The AMAD icon appears on your home screen and in your app drawer.

When opened from that icon, AMAD runs full screen without browser controls, works offline for ideas you've already opened, and checks for the daily headlines whenever you come back to it. Long-press the icon for shortcuts to Today, Explore, Library and Progress.

### How the app works offline

- `site/sw.js` (service worker, scope `/Amad/`) precaches the app shell, fonts and learning data on first visit.
- App code and data are **network-first** (3.5 s timeout, then cache), so updates arrive as soon as you're online.
- The daily feed (`data/feed.json`) is **always network-first**, so a cached copy never hides new headlines.
- Photos are cached as you view them (up to 160), so ideas you've opened keep their imagery offline.
- Each deploy stamps the service worker with a hash of the app files (feed excluded). When a new version is ready, the app shows an **Update** button rather than reloading by itself.
- Icons: `python scripts/make_icons.py`. Typefaces are self-hosted (SIL Open Font License, see `site/assets/fonts/`).

## Design

AMAD's visual system is documented in [DESIGN.md](DESIGN.md). Each of the seven categories is a *world* with its own duotone photography, colours and an animated line-art motif. Ideas appear as magazine-style covers, and the reader is a swipeable, illustrated story. Sixteen ideas include an **interactive visual explanation**, such as the sales velocity calculator, NRR waterfall, ERRC grid, buying-group time split, territory balancer and Pyramid Principle. Motion is purposeful and switches off when the visitor's device asks for reduced motion.

Photos are openly licensed (CC0, public domain, CC BY, CC BY-SA) from Openverse and Wikimedia Commons. Credits are in `site/data/credits.json` and on the About page. To add or replace one, put `<key>.jpg` and a `credits.json` entry in a folder, then run `python scripts/process_images.py <folder>`.

## How it works

```
site/                     ← the website (deployed as-is to GitHub Pages)
  index.html              ← page shell
  assets/app.js           ← views, reader, onboarding, progress (vanilla JS, no build step)
  assets/art.js           ← seeded line-art motifs for each world
  assets/visuals.js       ← interactive visual explanations
  assets/img/             ← duotone WebP photos (480px and 960px)
  assets/icons/, assets/fonts/, assets/screenshots/  ← app icons, self-hosted fonts, install screenshots
  manifest.webmanifest    ← installable app definition (relative URLs, works under /Amad/)
  sw.js                   ← service worker: offline support and updates
  data/collections.json   ← curated learning paths
  data/credits.json       ← photo attribution
  data/topics.json        ← the 7 topics + keywords used to classify news
  data/ideas.json         ← the idea library (curated + community)
  data/sources.json       ← RSS/Atom feeds pulled every day
  data/feed.json          ← generated daily by the bot. Don't edit by hand.
scripts/
  fetch_feeds.py          ← pulls feeds into feed.json (Python stdlib only)
  add_idea_from_issue.py  ← turns an approved "Share an idea" issue into an idea
  validate.py             ← schema checks run on every PR
  process_images.py       ← turns photos into world duotone WebP files
  make_icons.py           ← renders the PWA icons from the AMAD mark
.github/workflows/
  daily-feed.yml          ← 05:17 UTC every day: fetch → validate → commit
  publish-idea.yml        ← label an idea issue `approved` → it's published
  deploy.yml              ← deploys site/ to GitHub Pages
  validate.yml            ← data validation + unit tests on PRs
  setup-labels.yml        ← creates the idea / approved / source labels
```

## Deployment

- **Repository:** https://github.com/OmotolaDomain/Amad
- **Live site:** https://omotoladomain.github.io/Amad/

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
