# AMAD Visual Design System

**Concept:** AMAD publishes a daily edition. Each of the seven learning categories is a *world* with its own photography, colour and line-art motif. Opening AMAD should feel like opening a new magazine issue that has been composed for you. Reading an idea should feel like flicking through an illustrated story.

**The one memorable thing:** duotone cover photography in each world's colours, with that world's line-art motif drawn over it (contours on Territory, a chess path on Strategy, light beams on Branding). Everything else stays quiet and disciplined so the covers carry the story.

## 1. Brand

| Token | Hex | Role |
|---|---|---|
| Ink navy | `#141B3C` | Brand primary, text on light surfaces, dark surfaces |
| Gilt | `#D4A645` | Achievement only: streaks, completed goals, progress, saving. Never decoration. |
| Porcelain | `#EEF0F5` | Light-mode page (cool, not cream) |
| Paper | `#FFFFFF` | Reading surfaces |
| Graphite | `#2B3044` | Body text |
| Mist | `#6E7488` | Secondary text |
| Night | `#0A0E1F` | Dark-mode page |

The logo is the gilt "A" monogram on ink navy (`site/assets/amad-mark.svg`).

## 2. Seven worlds

Each world pairs a **shadow** and a **highlight** colour. Photos are converted into this duotone at build time, which gives a consistent art direction from mixed sources, small files and readable overlaid type. Each world also has a **line motif** (SVG, drawn with a stroke animation) and a **visual metaphor** that guides photo choice.

| World | Shadow | Highlight | Motif | Photographic metaphor |
|---|---|---|---|---|
| Strategy | `#1E1A5E` | `#D9D4FF` | Knight's path across a grid | Chess, compasses, open water, crossroads |
| Enterprise Commercial | `#0B3B33` | `#CFF1E4` | Network of connected nodes | Architecture, bridges, meeting rooms |
| Territory Mapping | `#5A2412` | `#F5D9B8` | Topographic contour lines | Aerial farmland, terraces, maps |
| Performance Optimization | `#3A2600` | `#FFC94D` | Rising velocity lines | Athletics, speed, gauges, practice |
| Account Management | `#0A2F4F` | `#BFE3FF` | Concentric growth rings | Gardens, tending, rowing together |
| Director-Level Engagement | `#4A0D1D` | `#FFD9DF` | Spotlight cone | Stages, conductors, boardrooms, pyramids |
| Branding | `#3B0F57` | `#FFB4A2` | Prism refraction beams | Neon, signage, doors, light |

## 3. Typography

- **Bricolage Grotesque** (display and UI). An expressive grotesque with optical sizing. Covers use tight tracking (−0.02em to −0.035em) and condensed width (`font-stretch: 75%`), so titles behave like magazine cover lines.
- **Newsreader** (reading). A serif designed for on-screen reading, used for idea text and takeaways in the reader at 1.2rem/1.6, with lines of 65 characters or fewer.

Scale (rem): 0.8 · 0.9 · 1 · 1.2 · 1.5 · 2 · 2.8 · 4 (cover display, clamped). Sentence case everywhere. No all-caps labels, no tracked-out eyebrows, and no arrow glyphs on buttons.

## 4. Layout

**Mobile (360–760px).** Imagery comes first:
```
┌ AMAD ···················· streak ┐
│▓▓▓▓▓▓ full-bleed duotone cover ▓▓▓│  today's lead idea; motif draws on load
│▓  Saturday 17 October          ▓▓│
│▓  BIG COVER LINE               ▓▓│
│▓  [ Start today's path ]       ▓▓│
└──────────────────────────────────┘
 Today's path   ◉──◉──○──○──○        a real sequence, so it is numbered
 [cover][cover][cover] ⟶  snap rail
 Collections    [stack][stack] ⟶
 Seven worlds   2-col mosaic of world covers
 From the web   list with world thumbnails
[ floating tab bar: Today Explore Fresh Library Progress ]
```

**Desktop (≥ 1024px).** Editorial composition on a 12-column grid with 24px gutters:
```
┌───────────── 7 cols ────────────┬──── 5 cols ────┐
│ lead cover (image, line, title) │ Today's path   │
│                                 │ 1 ● title      │
│                                 │ 2 ○ title      │
└─────────────────────────────────┴────────────────┘
 Collections: one wide feature + two stacked
 Worlds: 7-tile mosaic with varied spans
```

Left-aligned text throughout. Cards are not uniform. Explore and Library rotate through **cover**, **side cover** and **quote** layouts, so the grid reads like a magazine spread.

## 5. Components

- **Idea cover:** duotone photo + world motif + title in Bricolage. Its shape varies with context (tall story card, wide feature, square tile).
- **Reader:** full-screen on mobile with the cover on the top 40%, story-style progress segments, drag-to-swipe pages and an interactive *visual explanation* page where the idea benefits from one. Split screen on desktop, with a sticky cover on the left and text on the right.
- **Visual explanations:** small interactive SVG/HTML diagrams for 15 ideas: the strategy kernel, Playing to Win cascade, ERRC grid, pre-mortem timeline, buying group, MEDDICC scorer, mutual action plan, territory balancer, tiering matrix, whitespace grid, sales velocity calculator, constraint flow, NRR waterfall, relationship map, pyramid principle and brand/activation curves.
- **Collections:** curated paths through several ideas, shown as stacked covers.
- **Progress:** a 28-day streak calendar, seven world rings and milestones.

## 6. Motion

Motion either orchestrates one moment or answers an action.

| Moment | Motion | Duration / easing |
|---|---|---|
| Page load (once) | Cover motif strokes draw; cover line rises 16px and fades in | 900ms / `cubic-bezier(.2,.7,.2,1)` |
| Section reveal on scroll | Opacity 0→1, translateY 12px→0, once per section group | 500ms / same |
| Open idea | View Transition morphs the tapped cover into the reader cover | 350ms |
| Page swipe | Drag follows the finger; snaps with spring-like ease | 280ms / `cubic-bezier(.3,1.3,.5,1)` |
| Save | Bookmark scales 1→1.25→1 and gilt particles burst | 450ms |
| Daily goal complete | Gilt ring closes, then a confetti burst | 1.2s, once per day |
| Streak increase | Flame bumps and the number rolls | 400ms |

Only `transform` and `opacity` are animated. `prefers-reduced-motion: reduce` turns off all motion: motifs show fully drawn, transitions become instant and the confetti is skipped.

## 7. Imagery and performance

- Photos are openly licensed (CC0, public domain, CC BY, CC BY-SA) from Openverse and Wikimedia Commons. Credits are listed in `site/data/credits.json` and shown on the About page and inside the reader.
- Each photo is processed into duotone WebP at 480px and 960px wide, about 15–60 KB each. Images use `srcset`, `loading="lazy"` and `decoding="async"` (the lead cover is eager), and the world colour shows as a placeholder while they load.
- Line-art motifs are inline SVG, so they cost no extra requests.
- Mobile surfaces avoid `backdrop-filter` to protect low-end Android phones.

## 8. Accessibility

- Text over photos is checked against the duotone shadow colour (WCAG AA).
- Focus rings are visible.
- Every diagram has a text alternative, and its controls work by keyboard.
- Swipe always has button equivalents.
