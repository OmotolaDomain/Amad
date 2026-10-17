/* AMAD: a free, open-source daily learning app. No accounts: all progress lives in localStorage.
   Visual system: see DESIGN.md. Art motifs: art.js. Interactive explanations: visuals.js. */
(() => {
  "use strict";

  // ---------- Config ----------
  // On GitHub Pages (owner.github.io/repo) the repo is detected automatically, so forks just work.
  const FALLBACK_REPO = "OmotolaDomain/Amad";
  const REPO = (() => {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return m && seg ? `${m[1]}/${seg}` : FALLBACK_REPO;
  })();
  const GH = `https://github.com/${REPO}`;
  const ROLES = [
    { id: "seller", label: "Enterprise seller", hint: "Win bigger, more complex deals", topics: ["enterprise", "executive", "territory"] },
    { id: "am", label: "Account or customer success manager", hint: "Keep and grow key accounts", topics: ["accounts", "executive", "enterprise"] },
    { id: "leader", label: "Sales or commercial director", hint: "Lead teams, coverage and performance", topics: ["performance", "territory", "strategy", "executive"] },
    { id: "strategy", label: "Strategy, BizOps or RevOps", hint: "Shape where to play and how to win", topics: ["strategy", "performance", "territory"] },
    { id: "brand", label: "Marketing or brand", hint: "Build a brand people remember", topics: ["branding", "strategy", "executive"] },
  ];
  const MINUTE_OPTIONS = [5, 10, 15];
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
  const Art = window.AMADArt, Viz = window.AMADVisuals;

  // ---------- Storage (safe in private mode) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("amad:" + key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem("amad:" + key, JSON.stringify(value)); } catch { /* ignore */ } },
    remove(key) { try { localStorage.removeItem("amad:" + key); } catch { /* ignore */ } },
  };

  // ---------- State ----------
  const state = {
    topics: [], topicById: {}, ideas: [], ideaById: {}, collections: [], collectionById: {},
    credits: {}, feed: { items: [], updated: null }, sources: [],
    explore: { topic: "all", q: "" }, fresh: { topic: "all" },
  };
  const user = {
    get plan() { return store.get("plan", null); },
    set plan(v) { store.set("plan", v); },
    get read() { return store.get("read", {}); },        // { ideaId: "YYYY-MM-DD" }
    get saved() { return store.get("saved", []); },
    get streak() { return store.get("streak", { count: 0, last: null, best: 0 }); },
  };

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const yesterdayKey = () => dayKey(daysAgo(1));
  const world = (id) => state.topicById[id] || {};
  const worldVars = (id) => { const t = world(id); return `--shadow:${t.shadow || "#141B3C"};--hi:${t.highlight || "#EEF0F5"};--topic:${t.color || "#141B3C"}`; };
  const motionOK = () => !REDUCED.matches;

  const ICON = {
    today: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    fresh: '<path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 0 2 0V9"/><path d="M5 4v14a2 2 0 0 0 2 2h13"/><path d="M8 8h6M8 12h6M8 16h4"/>',
    library: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
    left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
    check: '<path d="m5 12 5 5 9-10"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const icon = (name, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>`;

  function seededRandom(seedStr) { return Art.rng(seedStr); }
  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function timeAgo(iso) {
    if (!iso) return "";
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? "yesterday" : `${d} days ago`;
  }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  }
  async function getJSON(path, fallback) {
    try { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    catch (e) { console.warn("Could not load", path, e); return fallback; }
  }

  // ---------- Imagery ----------
  // Photos live at assets/img/<key>-480.webp and -960.webp (duotone, see DESIGN.md §7).
  // Keys: an idea id, "world-<topic>", "col-<collection>" or "welcome". Missing photos fall back to the world's.
  const photoKey = (key, topic) => (state.credits[key] ? key : state.credits[`world-${topic}`] ? `world-${topic}` : null);
  function photo(key, topic, { sizes = "(min-width: 1024px) 50vw, 100vw", eager = false, alt = "" } = {}) {
    const k = photoKey(key, topic);
    if (!k) return "";
    const base = `assets/img/${k}`;
    return `<img class="photo" src="${base}-960.webp" srcset="${base}-480.webp 480w, ${base}-960.webp 960w" sizes="${sizes}"
      alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onload="this.classList.add('ready')">`;
  }
  const media = (key, topic, seed, opts) => `<div class="media" style="${worldVars(topic)}">${photo(key, topic, opts)}${Art.motif(world(topic).motif, seed)}</div>`;

  // ---------- Daily path ----------
  function planOrDefault() {
    return user.plan || { role: null, topics: state.topics.map((t) => t.id), minutes: 10 };
  }
  function todaysStash() {
    const today = dayKey();
    const cached = store.get("stash", null);
    if (cached && cached.day === today && cached.ids.length && cached.ids.every((id) => state.ideaById[id])) return cached.ids.map((id) => state.ideaById[id]);
    const plan = planOrDefault();
    const count = Math.min(7, Math.max(3, Math.round(plan.minutes / 2)));
    const read = user.read;
    const pool = state.ideas.filter((i) => plan.topics.includes(i.topic));
    const rand = seededRandom(today + plan.topics.join());
    // Prefer unread ideas, and rotate through worlds so the path is varied.
    const ordered = [...shuffle(pool.filter((i) => !read[i.id]), rand), ...shuffle(pool.filter((i) => read[i.id]), rand)];
    const picks = [], used = new Set();
    for (const idea of ordered) if (picks.length < count && !used.has(idea.topic)) { picks.push(idea); used.add(idea.topic); }
    for (const idea of ordered) if (picks.length < count && !picks.includes(idea)) picks.push(idea);
    store.set("stash", { day: today, ids: picks.map((i) => i.id) });
    return picks;
  }

  function markRead(id) {
    const read = user.read;
    if (read[id]) return;
    read[id] = dayKey();
    store.set("read", read);
    const s = user.streak, today = dayKey();
    if (s.last !== today) {
      s.count = s.last === yesterdayKey() ? s.count + 1 : 1;
      s.last = today;
      s.best = Math.max(s.best || 0, s.count);
      store.set("streak", s);
      renderStreak(true);
      if (s.count > 1) toast(`${s.count}-day streak. Keep it going.`);
    }
    const stash = todaysStash();
    if (stash.length && stash.every((i) => read[i.id]) && store.get("celebrated", null) !== today) {
      store.set("celebrated", today);
      celebrate.pending = true;
    }
  }
  function toggleSave(id) {
    const saved = user.saved;
    const i = saved.indexOf(id);
    if (i >= 0) saved.splice(i, 1); else saved.unshift(id);
    store.set("saved", saved);
    toast(i >= 0 ? "Removed from your library" : "Saved to your library");
    return i < 0;
  }
  function streakAlive() { const s = user.streak; return s.last === dayKey() || s.last === yesterdayKey() ? s.count : 0; }
  function renderStreak(bump = false) {
    const el = $("#streak");
    el.querySelector("b").textContent = streakAlive();
    if (bump && motionOK()) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  }

  // ---------- Components ----------
  /** A cover is the main visual unit (DESIGN.md §5). Variants: story, feature, side, quote, tile. */
  function cover(idea, variant = "story", opts = {}) {
    const t = world(idea.topic);
    const done = user.read[idea.id];
    const metaLine = `<span class="cover-meta">${idea.minutes} min${idea.visual ? '<span class="has-viz">Interactive</span>' : ""}${done ? `<span class="done">${icon("check")}Read</span>` : ""}</span>`;
    const label = `<span class="world-tag">${esc(t.name || idea.topic)}</span>`;
    if (variant === "quote") {
      return `<button class="cover cover-quote" data-open="${esc(idea.id)}" style="${worldVars(idea.topic)}">
        ${Art.motif(t.motif, idea.id)}${label}<blockquote>${esc(idea.takeaway)}</blockquote><span class="quote-src">From “${esc(idea.title)}”</span>${metaLine}</button>`;
    }
    const sizes = variant === "feature" ? "(min-width: 1024px) 66vw, 100vw" : variant === "side" ? "(min-width: 1024px) 20vw, 40vw" : "(min-width: 1024px) 25vw, 75vw";
    return `<button class="cover cover-${variant}" data-open="${esc(idea.id)}" style="${worldVars(idea.topic)}">
      ${media(idea.id, idea.topic, idea.id, { sizes, eager: opts.eager })}
      <span class="cover-text">${label}<span class="cover-title">${esc(idea.title)}</span>${variant === "side" || variant === "feature" ? `<span class="cover-dek">${esc(idea.pages[0])}</span>` : ""}${metaLine}</span>
    </button>`;
  }
  // Explore and Library rotate layouts so the grid reads like a magazine spread, not a card kit.
  const RHYTHM = ["feature", "story", "story", "quote", "side", "side", "story", "quote", "story", "story"];
  const spread = (ideas) => `<div class="spread">${ideas.map((i, n) => cover(i, RHYTHM[n % RHYTHM.length])).join("")}</div>`;

  function worldChips(selected, attr) {
    const all = [{ id: "all", name: "All worlds" }, ...state.topics];
    return `<div class="world-chips" role="toolbar" aria-label="Filter by world">${all.map((t) =>
      `<button class="wchip" ${attr}="${t.id}" aria-pressed="${t.id === selected}" style="${t.id === "all" ? "" : worldVars(t.id)}"><i></i>${esc(t.name)}</button>`).join("")}</div>`;
  }
  function newsItem(it, lead = false) {
    const t = world(it.topic), url = safeUrl(it.link);
    if (!url) return "";
    return `<li class="news ${lead ? "news-lead" : ""}" style="${worldVars(it.topic)}">
      <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">
        <span class="news-thumb">${photo(`world-${it.topic}`, it.topic, { sizes: lead ? "(min-width:1024px) 40vw, 100vw" : "96px" })}${Art.motif(t.motif, it.id)}</span>
        <span class="news-body"><span class="world-tag">${esc(t.name || "")}</span><span class="news-title">${esc(it.title)}</span>
        ${it.summary ? `<span class="news-sum">${esc(it.summary)}</span>` : ""}
        <span class="news-src">${esc(it.source)}, ${timeAgo(it.published)}</span></span>
      </a></li>`;
  }
  const emptyState = (motifName, title, body) => `<div class="empty">${Art.motif(motifName, title)}<h3>${title}</h3>${body}</div>`;
  function ring(pctVal, size = 44, cls = "") {
    const r = size / 2 - 4, c = 2 * Math.PI * r;
    return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}"/><circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c}" style="--off:${c * (1 - pctVal)};--full:${c}"/></svg>`;
  }
  const collectionProgress = (c) => { const read = user.read; const n = c.ideas.filter((id) => read[id]).length; return [n, c.ideas.length]; };
  function collectionCard(c, big = false) {
    const [n, total] = collectionProgress(c);
    const first = state.ideaById[c.ideas[0]];
    const topic = first?.topic || "strategy";
    const stack = c.ideas.slice(1, 3).map((id, i) => { const idea = state.ideaById[id]; return idea ? `<span class="stack-card s${i}" style="${worldVars(idea.topic)}">${photo(idea.id, idea.topic, { sizes: "120px" })}</span>` : ""; }).join("");
    return `<a class="collection ${big ? "collection-big" : ""}" href="#/collection/${esc(c.id)}" style="${worldVars(topic)}">
      <span class="collection-art">${stack}<span class="collection-cover">${media(`col-${c.id}`, topic, c.id, { sizes: big ? "(min-width:1024px) 50vw, 85vw" : "(min-width:1024px) 25vw, 70vw" })}</span></span>
      <span class="collection-text"><span class="collection-title">${esc(c.title)}</span><span class="collection-blurb">${esc(c.blurb)}</span>
      <span class="collection-meta">${ring(n / total, 28)}${n ? `${n} of ${total} read` : `${total} ideas`}</span></span></a>`;
  }

  // ---------- Views ----------
  let firstPaint = true;
  const views = {
    today() {
      const stash = todaysStash(), read = user.read;
      const done = stash.filter((i) => read[i.id]).length;
      const lead = stash.find((i) => !read[i.id]) || stash[0];
      const plan = user.plan;
      const dateLine = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
      const allDone = stash.length && done === stash.length;
      const fresh = state.feed.items.filter((i) => planOrDefault().topics.includes(i.topic)).slice(0, 5);
      if (!lead) return emptyState("knight", "No ideas yet", "<p>The idea library hasn't loaded. Check your connection and refresh.</p>");
      return `
        <section class="edition ${firstPaint && motionOK() ? "play" : ""}" style="${worldVars(lead.topic)}">
          <button class="edition-cover" data-open="${esc(lead.id)}" aria-label="Read today's lead idea: ${esc(lead.title)}">
            ${media(lead.id, lead.topic, lead.id, { sizes: "(min-width: 1024px) 58vw, 100vw", eager: true })}
            <span class="edition-text">
              <span class="edition-date">${esc(dateLine)}</span>
              <span class="edition-title">${esc(allDone ? "You finished today's path" : lead.title)}</span>
              <span class="edition-dek">${allDone ? "Come back tomorrow for a new edition, or explore the seven worlds." : `${esc(world(lead.topic).name)}, ${lead.minutes} min read`}</span>
              <span class="edition-cta">${allDone ? "Read it again" : done ? "Continue today's path" : "Start today's path"}</span>
            </span>
          </button>
          <aside class="path" style="--done:${stash.length ? done / stash.length : 0}">
            <div class="path-head"><h2>Today's path</h2><span class="path-count">${ring(stash.length ? done / stash.length : 0, 40, "gilt")}<b>${done}/${stash.length}</b></span></div>
            ${plan ? "" : '<button class="linkbtn" data-action="onboard">Personalise your path</button>'}
            <ol class="path-list">${stash.map((i, n) => `
              <li class="${read[i.id] ? "is-done" : i === lead ? "is-now" : ""}" style="${worldVars(i.topic)}">
                <button data-open="${esc(i.id)}"><span class="path-thumb">${photo(i.id, i.topic, { sizes: "(min-width:1024px) 72px, 62vw" })}${Art.motif(world(i.topic).motif, i.id)}</span>
                <span class="path-n">${read[i.id] ? icon("check") : n + 1}</span>
                <span class="path-text"><span class="world-tag">${esc(world(i.topic).name)}</span><span class="path-title">${esc(i.title)}</span><span class="path-min">${i.minutes} min</span></span></button></li>`).join("")}
            </ol>
          </aside>
        </section>

        <section class="block" data-reveal>
          <div class="block-head"><h2>Collections</h2><p>Curated paths through several ideas.</p></div>
          <div class="collections">${state.collections.map((c, i) => collectionCard(c, i === 0)).join("")}</div>
        </section>

        <section class="block" data-reveal>
          <div class="block-head"><h2>Seven worlds</h2><p>Each area of commercial excellence has its own world.</p></div>
          <div class="worlds">${state.topics.map((t, i) => {
            const all = state.ideas.filter((x) => x.topic === t.id), n = all.filter((x) => read[x.id]).length;
            return `<a class="world w${i}" href="#/world/${t.id}" style="${worldVars(t.id)}">${media(`world-${t.id}`, t.id, t.id, { sizes: "(min-width:1024px) 33vw, 50vw" })}
              <span class="world-text"><span class="world-name">${esc(t.name)}</span><span class="world-line">${esc(t.tagline)}</span><span class="world-prog">${n}/${all.length} read</span></span></a>`;
          }).join("")}</div>
        </section>

        <section class="block" data-reveal>
          <div class="block-head"><h2>From the web</h2><a class="textlink" href="#/fresh">All headlines</a></div>
          ${fresh.length ? `<ul class="news-list">${fresh.map((x, i) => newsItem(x, i === 0)).join("")}</ul>` : emptyState("network", "Headlines arrive each morning", "<p>The daily refresh runs at 05:17 UTC on GitHub Actions.</p>")}
        </section>`;
    },

    explore() {
      const { topic, q } = state.explore;
      const needle = q.trim().toLowerCase();
      const list = state.ideas.filter((i) => (topic === "all" || i.topic === topic) &&
        (!needle || [i.title, i.takeaway, i.source?.name, ...i.pages].join(" ").toLowerCase().includes(needle)));
      const t = state.topicById[topic];
      const banner = t ? `<header class="world-banner" style="${worldVars(t.id)}">${media(`world-${t.id}`, t.id, t.id + "banner", { sizes: "100vw", eager: true })}
          <div class="world-banner-text"><h1>${esc(t.name)}</h1><p>${esc(t.tagline)} ${esc(t.blurb)}</p></div></header>`
        : `<header class="page-head"><h1>Explore</h1><p>${state.ideas.length} ideas across seven worlds.</p></header>`;
      const hl = (s) => (needle ? esc(s).replace(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`) : esc(s));
      const results = needle
        ? `<ul class="results">${list.map((i) => `<li style="${worldVars(i.topic)}"><button data-open="${esc(i.id)}"><span class="res-thumb">${photo(i.id, i.topic, { sizes: "88px" })}${Art.motif(world(i.topic).motif, i.id)}</span>
            <span><span class="world-tag">${esc(world(i.topic).name)}</span><span class="res-title">${hl(i.title)}</span><span class="res-take">${hl(i.takeaway)}</span></span></button></li>`).join("")}</ul>`
        : spread(list);
      return `${banner}
        <div class="explore-tools">
          <label class="search">${icon("search")}<input type="search" placeholder="Search ideas, authors and books" value="${esc(q)}" data-search aria-label="Search ideas"></label>
          ${worldChips(topic, "data-explore-topic")}
        </div>
        ${needle ? `<p class="results-count">${list.length} result${list.length === 1 ? "" : "s"} for “${esc(q)}”</p>` : ""}
        ${list.length ? results : emptyState("prism", "Nothing matches yet", `<p>Try another word, or <a href="${GH}/issues/new?template=share-idea.yml" target="_blank" rel="noopener">share an idea</a> about it.</p>`)}`;
    },

    collection(id) {
      const c = state.collectionById[id];
      if (!c) return emptyState("contour", "Collection not found", '<p><a href="#/today">Back to today</a></p>');
      const ideas = c.ideas.map((x) => state.ideaById[x]).filter(Boolean), read = user.read;
      const [n, total] = collectionProgress(c);
      const next = ideas.find((i) => !read[i.id]) || ideas[0];
      const topic = ideas[0]?.topic || "strategy";
      return `<header class="world-banner col-banner" style="${worldVars(topic)}">${media(`col-${c.id}`, topic, c.id, { sizes: "100vw", eager: true })}
          <div class="world-banner-text"><span class="world-tag">Collection</span><h1>${esc(c.title)}</h1><p>${esc(c.blurb)}</p>
          <span class="banner-actions"><button class="btn gilt" data-open="${esc(next.id)}">${n ? (n === total ? "Read it again" : "Continue") : "Start the collection"}</button><span class="collection-meta light">${ring(n / total, 28)}${n} of ${total} read</span></span></div></header>
        <ol class="sequence">${ideas.map((i, k) => `<li style="${worldVars(i.topic)}" class="${read[i.id] ? "is-done" : ""}"><span class="seq-n">${read[i.id] ? icon("check") : k + 1}</span>${cover(i, "side")}</li>`).join("")}</ol>`;
    },

    fresh() {
      const { topic } = state.fresh;
      const list = state.feed.items.filter((i) => topic === "all" || i.topic === topic);
      return `<header class="page-head"><h1>From the web</h1>
          <p>Headlines from public business publications, refreshed every morning by an open GitHub Action. ${state.feed.updated ? `Last updated ${timeAgo(state.feed.updated)}.` : ""} Links open the original publisher.</p></header>
        ${worldChips(topic, "data-fresh-topic")}
        ${list.length ? `<ul class="news-list wide">${list.map((x, i) => newsItem(x, i === 0)).join("")}</ul>`
          : emptyState("network", state.feed.updated ? "Nothing new in this world" : "Headlines arrive each morning", `<p>${state.feed.updated ? "No headlines from the last two weeks. Try another world." : "The first daily refresh hasn't run yet."}</p><p><a href="${GH}/issues/new?template=suggest-source.yml" target="_blank" rel="noopener">Suggest a source</a></p>`)}`;
    },

    saved() {
      const list = user.saved.map((id) => state.ideaById[id]).filter(Boolean);
      return `<header class="page-head"><h1>Your library</h1><p>Ideas you've saved. They're stored only in this browser.</p></header>
        ${list.length ? `<div class="shelf">${list.map((i) => cover(i, "story")).join("")}</div>`
          : emptyState("rings", "Your library is empty", '<p>Tap the bookmark at the end of any idea to keep it here.</p><a class="btn" href="#/explore">Explore ideas</a>')}`;
    },

    plan() {
      const plan = user.plan, read = user.read, s = user.streak;
      const role = ROLES.find((r) => r.id === plan?.role);
      const totalRead = Object.keys(read).length;
      const perDay = {};
      Object.values(read).forEach((d) => (perDay[d] = (perDay[d] || 0) + 1));
      const cal = Array.from({ length: 28 }, (_, i) => { const d = dayKey(daysAgo(27 - i)); return `<i class="cal-day l${Math.min(3, perDay[d] || 0)} ${i === 27 ? "today" : ""}" title="${d}: ${perDay[d] || 0} read"></i>`; }).join("");
      const worldsRead = state.topics.filter((t) => state.ideas.some((x) => x.topic === t.id && read[x.id])).length;
      const milestones = [
        ["First idea", totalRead >= 1], ["Three-day streak", (s.best || 0) >= 3], ["Ten ideas", totalRead >= 10],
        ["Seven-day streak", (s.best || 0) >= 7], ["Visited all seven worlds", worldsRead === 7], ["Finished a collection", state.collections.some((c) => collectionProgress(c)[0] === c.ideas.length)],
      ];
      return `<header class="page-head"><h1>Your progress</h1>
          <p>${plan ? `${esc(role?.label || "Custom plan")}, ${plan.minutes} minutes a day, ${plan.topics.length} focus worlds.` : "You haven't set a plan yet, so your path draws from every world."}</p>
          <button class="btn" data-action="onboard">${plan ? "Edit my plan" : "Build my plan"}</button></header>
        <section class="progress-hero" data-reveal>
          <div class="streak-big">${icon("flame")}<b>${streakAlive()}</b><span>day streak</span><em>Best ${s.best || 0}</em></div>
          <div class="calendar" aria-label="Ideas read in the last 28 days">${cal}</div>
          <div class="stat-row"><span><b>${totalRead}</b> ideas read</span><span><b>${user.saved.length}</b> saved</span><span><b>${worldsRead}</b> of 7 worlds</span></div>
        </section>
        <section class="block" data-reveal><div class="block-head"><h2>Worlds</h2><p>Highlighted worlds are in your plan.</p></div>
          <div class="world-rings">${state.topics.map((t) => {
            const all = state.ideas.filter((i) => i.topic === t.id), n = all.filter((i) => read[i.id]).length;
            return `<a href="#/world/${t.id}" class="wring ${plan?.topics.includes(t.id) ? "in-plan" : ""}" style="${worldVars(t.id)}">${ring(all.length ? n / all.length : 0, 84, "big")}<span class="wring-art">${Art.motif(t.motif, t.id)}</span><b>${esc(t.name)}</b><span>${n} of ${all.length}</span></a>`;
          }).join("")}</div></section>
        <section class="block" data-reveal><div class="block-head"><h2>Milestones</h2></div>
          <ul class="milestones">${milestones.map(([m, ok]) => `<li class="${ok ? "won" : ""}"><span class="medal">${ok ? icon("check") : ""}</span>${m}</li>`).join("")}</ul></section>
        <section class="block"><div class="block-head"><h2>Your data</h2></div>
          <p class="muted">AMAD never asks you to sign up. Everything on this page is stored on this device only.</p>
          <button class="btn ghost" data-action="reset">Reset my progress</button></section>`;
    },

    about() {
      const srcs = state.sources.map((s) => `<li>${esc(s.name)} <span class="muted">(${s.topics.map((t) => esc(world(t).name || t)).join(", ")})</span></li>`).join("");
      const credits = Object.entries(state.credits).map(([k, c]) => {
        const link = safeUrl(c.landing), lic = safeUrl(c.license_url);
        return `<li><span class="muted">${esc(k)}:</span> ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(c.title || "Photo")}</a>` : esc(c.title || "Photo")} by ${esc(c.creator)}, ${lic ? `<a href="${esc(lic)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}. Duotone treatment by AMAD.</li>`;
      }).join("");
      return `<article class="prose">
        <h1>About AMAD</h1>
        <p>AMAD is a personalised daily learning and knowledge discovery platform for business growth, strategy, leadership and professional development. It is free, open source and needs no account.</p>
        <h2>How it works</h2>
        <ul>
          <li><b>Idea library.</b> Short summaries of proven frameworks, in plain language, credited to the original thinkers.</li>
          <li><b>Today's path.</b> A new set of ideas each day, based on your plan.</li>
          <li><b>Interactive explanations.</b> Many ideas include a diagram you can play with.</li>
          <li><b>From the web.</b> A GitHub Action collects headlines from public feeds every morning. AMAD links to publishers and never republishes full articles.</li>
          <li><b>No accounts.</b> Your plan, streak and library stay in your browser.</li>
        </ul>
        <h2>Contribute</h2>
        <p>Anyone can add ideas. <a href="${GH}/issues/new?template=share-idea.yml" target="_blank" rel="noopener">Fill in the Share an idea form</a>; when a maintainer approves it, it's published automatically. Developers can also <a href="${GH}" target="_blank" rel="noopener">open a pull request</a>.</p>
        <h2>Photography</h2><p>All photos are openly licensed and shown with a duotone treatment.</p><ul class="credits">${credits || "<li class='muted'>No photos loaded.</li>"}</ul>
        <h2>Feed sources</h2><ul>${srcs || "<li class='muted'>None loaded.</li>"}</ul>
        <p class="muted">Code is MIT licensed. Idea summaries are CC BY 4.0. Trademarks and linked articles belong to their owners.</p>
      </article>`;
    },
  };

  // ---------- Reader ----------
  const reader = { idea: null, page: 0, pages: [], lastFocus: null, pushed: false };
  function buildPages(idea) {
    const p = idea.pages.map((text, i) => ({ type: "text", text, first: i === 0 }));
    if (idea.visual && Viz?.get(idea.visual)) p.splice(Math.max(1, p.length - 1), 0, { type: "visual" });
    p.push({ type: "takeaway" });
    return p;
  }
  function openReader(id, push = true) {
    const idea = state.ideaById[id];
    if (!idea) return;
    if (!reader.idea) reader.lastFocus = document.activeElement;
    const swap = () => {
      reader.idea = idea; reader.page = 0; reader.pages = buildPages(idea);
      if (push && location.hash !== `#/idea/${id}`) { history.pushState(null, "", `#/idea/${id}`); reader.pushed = true; }
      renderReader(true);
      $("#reader").hidden = false;
      document.documentElement.classList.add("reading");
    };
    // Morph the tapped cover into the reader's cover (View Transitions, where supported).
    const src = document.activeElement?.closest?.("[data-open]")?.querySelector(".media");
    if (document.startViewTransition && motionOK() && src && $("#reader").hidden) {
      src.style.viewTransitionName = "idea-media";
      const vt = document.startViewTransition(() => { src.style.viewTransitionName = ""; swap(); });
      vt.finished.finally(() => $("#reader .sheet")?.focus());
    } else { swap(); $("#reader .sheet")?.focus(); }
  }
  function closeReader(fromRoute = false) {
    if ($("#reader").hidden) return;
    const done = () => {
      $("#reader").hidden = true;
      document.documentElement.classList.remove("reading");
      reader.idea = null;
      render();
      reader.lastFocus?.focus?.({ preventScroll: true });
      if (celebrate.pending) celebrate();
    };
    if (!fromRoute && location.hash.startsWith("#/idea/")) {
      // Go back if we added the history entry; otherwise (shared link) stay on the site.
      if (reader.pushed) { reader.pushed = false; history.back(); return; }
      history.replaceState(null, "", `#/${lastRoute}`);
    }
    reader.pushed = false;
    if (motionOK()) { $("#reader").classList.add("leaving"); setTimeout(() => { $("#reader").classList.remove("leaving"); done(); }, 220); }
    else done();
  }
  function pageHTML(pg, idea, t) {
    if (pg.type === "text") {
      return pg.first ? `<span class="world-tag">${esc(t.name)}</span><h2 id="reader-title" class="r-title">${esc(idea.title)}</h2><p class="r-text">${esc(pg.text)}</p>`
        : `<p class="r-text">${esc(pg.text)}</p>`;
    }
    if (pg.type === "visual") return `<div class="viz-mount" data-visual="${esc(idea.visual)}"></div>`;
    const srcUrl = safeUrl(idea.source?.url), saved = user.saved.includes(idea.id);
    const cr = state.credits[photoKey(idea.id, idea.topic)];
    const next = nextInPath();
    return `<div class="takeaway"><span class="take-label">Try this today</span><p>${esc(idea.takeaway)}</p></div>
      <p class="r-source">Source: ${srcUrl ? `<a href="${esc(srcUrl)}" target="_blank" rel="noopener noreferrer">${esc(idea.source.name)}</a>` : esc(idea.source?.name)}.
        Shared by ${idea.contributor === "amad-team" ? "the AMAD team" : `<a href="https://github.com/${encodeURIComponent(idea.contributor)}" target="_blank" rel="noopener">@${esc(idea.contributor)}</a>`}.</p>
      <div class="r-actions">
        <button class="act save ${saved ? "on" : ""}" data-action="save" aria-pressed="${saved}">${icon("library")}<span>${saved ? "Saved" : "Save"}</span><i class="burst" aria-hidden="true">${"<b></b>".repeat(8)}</i></button>
        <button class="act" data-action="share">${icon("share")}<span>Share</span></button>
        <a class="act" href="${GH}/issues/new?title=${encodeURIComponent(`[Discuss] ${idea.title}`)}&body=${encodeURIComponent(`Idea: ${idea.id}\n\n`)}" target="_blank" rel="noopener">${icon("chat")}<span>Discuss</span></a>
      </div>
      ${next ? `<button class="next-idea" data-action="next-idea" style="${worldVars(next.topic)}"><span class="next-thumb">${photo(next.id, next.topic, { sizes: "80px" })}</span><span><span class="take-label">Next on today's path</span><b>${esc(next.title)}</b></span>${icon("right")}</button>`
        : `<button class="btn gilt wide" data-action="close-reader">Done</button>`}
      ${cr ? `<p class="r-credit">Photo: ${esc(cr.title || "")} by ${esc(cr.creator)}, ${esc(cr.license)}.</p>` : ""}`;
  }
  function renderReader(fresh = false) {
    const { idea, page, pages } = reader;
    const t = world(idea.topic), last = pages.length - 1;
    if (page === last) markRead(idea.id);
    if (fresh) {
      $("#reader").innerHTML = `
        <div class="sheet" tabindex="-1" style="${worldVars(idea.topic)}">
          <div class="r-media">${media(idea.id, idea.topic, idea.id, { sizes: "(min-width: 1024px) 45vw, 100vw", eager: true })}</div>
          <div class="r-panel">
            <div class="r-top"><div class="segments" aria-hidden="true">${pages.map(() => "<i><b></b></i>").join("")}</div>
              <button class="icon-btn r-close" data-action="close-reader" aria-label="Close">${icon("close")}</button></div>
            <div class="r-viewport"><div class="r-track">${pages.map((pg, i) => `<section class="r-page r-${pg.type}" aria-hidden="${i !== page}">${pageHTML(pg, idea, t)}</section>`).join("")}</div></div>
            <nav class="r-nav"><button class="icon-btn" data-action="prev" aria-label="Previous page">${icon("left")}</button><span class="r-count" aria-live="polite"></span><button class="icon-btn r-next" data-action="next" aria-label="Next page">${icon("right")}</button></nav>
          </div>
        </div>`;
      const vm = $("#reader [data-visual]");
      if (vm) Viz.mount(vm.dataset.visual, vm);
      bindSwipe();
    } else if (page === last) {
      // Refresh the takeaway page (read state, save state) without rebuilding the visual.
      $$("#reader .r-page")[last].innerHTML = pageHTML(pages[last], idea, t);
    }
    $("#reader .r-track").style.transform = `translateX(${-page * 100}%)`;
    $$("#reader .r-page").forEach((el, i) => { el.setAttribute("aria-hidden", i !== page); el.inert = i !== page; if (i === page) el.scrollTop = 0; });
    $$("#reader .segments i").forEach((s, i) => s.classList.toggle("on", i <= page));
    $("#reader .r-count").textContent = `${page + 1} of ${pages.length}`;
    $('#reader [data-action="prev"]').disabled = page === 0;
    $("#reader .r-next").disabled = page === last;
    $("#reader .sheet").classList.toggle("at-end", page === last);
  }
  function nextInPath() {
    const read = user.read;
    return todaysStash().find((i) => !read[i.id] && i.id !== reader.idea?.id) || null;
  }
  function turn(delta) {
    if (!reader.idea) return;
    const p = Math.min(reader.pages.length - 1, Math.max(0, reader.page + delta));
    if (p !== reader.page) { reader.page = p; renderReader(); }
    else nudge(delta);
  }
  function nudge(delta) {
    if (!motionOK()) return;
    const tr = $("#reader .r-track");
    tr.animate([{ transform: tr.style.transform }, { transform: `translateX(calc(${-reader.page * 100}% + ${-delta * 24}px))` }, { transform: tr.style.transform }], { duration: 260, easing: "ease-out" });
  }
  // Drag to swipe between pages; the track follows the finger, then snaps.
  function bindSwipe() {
    const vp = $("#reader .r-viewport"), tr = $("#reader .r-track");
    let x0 = null, y0 = 0, dx = 0, horiz = null;
    vp.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || e.target.closest("input, button, a, .viz svg, .matrix, .ws")) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; horiz = null;
    });
    vp.addEventListener("pointermove", (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      if (horiz === null && (Math.abs(dx) > 8 || Math.abs(e.clientY - y0) > 8)) horiz = Math.abs(dx) > Math.abs(e.clientY - y0);
      if (horiz) { tr.classList.add("dragging"); tr.style.transform = `translateX(calc(${-reader.page * 100}% + ${dx}px))`; }
    });
    const end = () => {
      if (x0 === null) return;
      tr.classList.remove("dragging");
      if (horiz && Math.abs(dx) > 60) turn(dx < 0 ? 1 : -1); else tr.style.transform = `translateX(${-reader.page * 100}%)`;
      x0 = null;
    };
    vp.addEventListener("pointerup", end); vp.addEventListener("pointercancel", end); vp.addEventListener("pointerleave", end);
  }
  async function shareIdea(idea) {
    const url = `${location.origin}${location.pathname}#/idea/${idea.id}`;
    const text = `${idea.title}: ${idea.takeaway}`;
    try {
      if (navigator.share) { await navigator.share({ title: idea.title, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`); toast("Link copied");
    } catch { /* cancelled */ }
  }

  // ---------- Celebration (daily goal complete) ----------
  function celebrate() {
    celebrate.pending = false;
    const el = $("#celebrate");
    el.innerHTML = `<div class="cel-card" role="status"><div class="cel-ring">${ring(1, 120, "gilt big")}${icon("check", "cel-check")}</div>
      <h2>Today's path is complete</h2><p>${streakAlive() > 1 ? `That's ${streakAlive()} days in a row.` : "A new edition arrives tomorrow."}</p>
      <button class="btn gilt" data-action="close-celebrate">Keep going</button></div><canvas aria-hidden="true"></canvas>`;
    el.hidden = false;
    $(".cel-card .btn", el).focus();
    if (motionOK()) confetti($("canvas", el));
  }
  function confetti(cv) {
    const ctx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
    const colours = ["#D4A645", "#F1D9A0", "#FFFFFF", "#B58A3C"];
    const ps = Array.from({ length: 90 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.42, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3, r: Math.random() * 6, s: 3 + Math.random() * 5, c: colours[Math.floor(Math.random() * 4)] }));
    const t0 = performance.now();
    const step = (t) => {
      const k = (t - t0) / 1400;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ps.forEach((p) => { p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.r += 0.15; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (k < 1) requestAnimationFrame(step); else ctx.clearRect(0, 0, innerWidth, innerHeight);
    };
    requestAnimationFrame(step);
  }

  // ---------- Onboarding (growth plan) ----------
  const ob = { step: 0, draft: null };
  function openOnboarding() {
    const p = user.plan;
    ob.step = 0;
    ob.draft = p ? { ...p, topics: [...p.topics] } : { role: null, topics: [], minutes: 10 };
    renderOnboarding();
    $("#onboarding").hidden = false;
    document.documentElement.classList.add("reading");
    $("#onboarding .ob-panel")?.focus();
  }
  function closeOnboarding() {
    $("#onboarding").hidden = true;
    document.documentElement.classList.remove("reading");
    store.set("onboarded", true);
  }
  function renderOnboarding() {
    const d = ob.draft;
    const steps = [
      { title: "What best describes your role?", sub: "We'll suggest the worlds that matter most to you.", ok: !!d.role,
        html: `<div class="ob-roles">${ROLES.map((r) => `<button class="ob-role" data-role="${r.id}" aria-pressed="${d.role === r.id}" style="${worldVars(r.topics[0])}">${media(`world-${r.topics[0]}`, r.topics[0], r.id, { sizes: "120px" })}<span><b>${esc(r.label)}</b><small>${esc(r.hint)}</small></span></button>`).join("")}</div>` },
      { title: "Which worlds do you want to grow in?", sub: "Pick at least one. You can change this any time.", ok: d.topics.length > 0,
        html: `<div class="ob-worlds">${state.topics.map((t) => `<button class="ob-world" data-ob-topic="${t.id}" aria-pressed="${d.topics.includes(t.id)}" style="${worldVars(t.id)}">${media(`world-${t.id}`, t.id, t.id, { sizes: "(min-width:760px) 200px, 45vw" })}<span class="ob-world-text"><b>${esc(t.name)}</b><small>${esc(t.tagline)}</small></span><span class="ob-tick">${icon("check")}</span></button>`).join("")}</div>` },
      { title: "How much time each day?", sub: "Small daily habits beat occasional binges.", ok: !!d.minutes,
        html: `<div class="ob-minutes">${MINUTE_OPTIONS.map((m) => { const n = Math.min(7, Math.max(3, Math.round(m / 2))); return `<button class="ob-min" data-minutes="${m}" aria-pressed="${d.minutes === m}"><b>${m}</b><span>minutes</span><span class="ob-dots">${"<i></i>".repeat(n)}</span><small>${n} ideas a day</small></button>`; }).join("")}</div>` },
    ];
    const s = steps[ob.step];
    $("#onboarding").innerHTML = `
      <div class="ob-backdrop">${photo("welcome", "strategy", { sizes: "100vw", eager: true })}</div>
      <div class="ob-panel" tabindex="-1">
        <div class="ob-progress" aria-label="Step ${ob.step + 1} of ${steps.length}">${steps.map((_, i) => `<i class="${i <= ob.step ? "on" : ""}"></i>`).join("")}</div>
        <img class="ob-mark" src="assets/amad-mark.svg" alt="" width="40" height="40">
        <h2 id="ob-title">${s.title}</h2><p class="ob-sub">${s.sub}</p>
        <div class="ob-body">${s.html}</div>
        <div class="ob-foot">
          ${ob.step === 0 ? '<button class="linkbtn" data-action="ob-skip">Skip for now</button>' : '<button class="btn ghost" data-action="ob-back">Back</button>'}
          <button class="btn gilt" data-action="ob-next" ${s.ok ? "" : "disabled"}>${ob.step === steps.length - 1 ? "Build my plan" : "Continue"}</button>
        </div>
      </div>`;
  }
  function finishOnboarding() {
    user.plan = ob.draft; store.remove("stash");
    const picks = todaysStash();
    if (!motionOK()) { closeOnboarding(); toast("Your plan is ready"); location.hash = "#/today"; render(); return; }
    $("#onboarding .ob-panel").innerHTML = `<div class="ob-done"><div class="ob-stack">${picks.slice(0, 5).map((i, k) => `<span class="ob-card" style="--k:${k};${worldVars(i.topic)}">${photo(i.id, i.topic, { sizes: "160px" })}${Art.motif(world(i.topic).motif, i.id)}</span>`).join("")}</div>
      <h2>Your plan is ready</h2><p class="ob-sub">${picks.length} ideas are waiting on today's path.</p></div>`;
    setTimeout(() => { closeOnboarding(); location.hash = "#/today"; render(); }, 1700);
  }

  // ---------- Routing & rendering ----------
  function currentRoute() {
    const [, name = "today", arg] = location.hash.match(/^#\/([^/]+)\/?(.*)$/) || [];
    return { name, arg: decodeURIComponent(arg || "") };
  }
  let lastRoute = "today";
  function render() {
    const { name, arg } = currentRoute();
    if (name === "idea") {
      if (!reader.idea || reader.idea.id !== arg) openReader(arg, false);
      if (!$("#main").innerHTML.trim()) paint(lastRoute);
      return;
    }
    if (!$("#reader").hidden) { closeReader(true); return; }
    if (name === "world" && state.topicById[arg]) { state.explore.topic = arg; state.explore.q = ""; }
    const key = name === "world" ? "explore" : name === "collection" ? `collection/${arg}` : views[name] ? name : "today";
    const changed = key !== lastRoute;
    lastRoute = key;
    paint(key);
    if (changed) window.scrollTo(0, 0);
  }
  function paint(key) {
    const [view, arg] = key.split("/");
    $("#main").innerHTML = views[view](arg);
    firstPaint = false;
    const tab = view === "collection" ? "today" : view;
    $$("[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    renderStreak();
    observeReveals();
  }
  // Scroll-triggered reveals: once per section, subtle, skipped under reduced motion.
  let io = null;
  function observeReveals() {
    const els = $$("[data-reveal]");
    if (!motionOK() || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
    io ??= new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
  }
  function rerenderExplore() {
    const input = $("[data-search]");
    const pos = input?.selectionStart;
    $("#main").innerHTML = views.explore();
    observeReveals();
    const next = $("[data-search]");
    if (next) { next.focus(); next.setSelectionRange(pos ?? next.value.length, pos ?? next.value.length); }
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-open],[data-action],[data-explore-topic],[data-fresh-topic],[data-role],[data-ob-topic],[data-minutes]");
    if (!el) { if (e.target.id === "reader") closeReader(); return; }
    const d = el.dataset;
    if (d.open) { e.preventDefault(); return openReader(d.open); }
    if (d.exploreTopic) {
      state.explore.topic = d.exploreTopic;
      history.replaceState(null, "", d.exploreTopic === "all" ? "#/explore" : `#/world/${d.exploreTopic}`);
      $("#main").innerHTML = views.explore(); observeReveals(); return;
    }
    if (d.freshTopic) { state.fresh.topic = d.freshTopic; $("#main").innerHTML = views.fresh(); return; }
    if (d.role) {
      ob.draft.role = d.role;
      ob.draft.topics = [...ROLES.find((r) => r.id === d.role).topics];
      return renderOnboarding();
    }
    if (d.obTopic) {
      const t = ob.draft.topics, i = t.indexOf(d.obTopic);
      if (i >= 0) t.splice(i, 1); else t.push(d.obTopic);
      return renderOnboarding();
    }
    if (d.minutes) { ob.draft.minutes = Number(d.minutes); return renderOnboarding(); }
    switch (d.action) {
      case "close-reader": return closeReader();
      case "prev": return turn(-1);
      case "next": return turn(1);
      case "next-idea": {
        const n = nextInPath();
        if (!n) return;
        history.replaceState(null, "", `#/idea/${n.id}`);
        const sheet = $("#reader .sheet");
        if (motionOK()) { sheet.classList.add("swap-out"); setTimeout(() => openReader(n.id, false), 240); }
        else openReader(n.id, false);
        return;
      }
      case "save": {
        const on = toggleSave(reader.idea.id);
        el.classList.toggle("on", on); el.setAttribute("aria-pressed", on);
        el.querySelector("span").textContent = on ? "Saved" : "Save";
        if (on && motionOK()) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
        return;
      }
      case "share": return shareIdea(reader.idea);
      case "close-celebrate": $("#celebrate").hidden = true; return render();
      case "onboard": e.preventDefault(); return openOnboarding();
      case "ob-skip": closeOnboarding(); return render();
      case "ob-back": ob.step--; return renderOnboarding();
      case "ob-next":
        if (ob.step < 2) { ob.step++; return renderOnboarding(); }
        return finishOnboarding();
      case "reset":
        if (confirm("Reset your streak, reading history, library and plan on this device?")) {
          ["plan", "read", "saved", "streak", "stash", "onboarded", "celebrated"].forEach((k) => store.remove(k));
          toast("Progress reset"); render();
        }
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-search]")) { state.explore.q = e.target.value; rerenderExplore(); }
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#celebrate").hidden && e.key === "Escape") { $("#celebrate").hidden = true; render(); return; }
    if (!$("#onboarding").hidden && e.key === "Escape") { closeOnboarding(); render(); return; }
    if ($("#reader").hidden || e.target.matches("input")) return;
    if (e.key === "Escape") closeReader();
    else if (e.key === "ArrowRight") turn(1);
    else if (e.key === "ArrowLeft") turn(-1);
  });
  window.addEventListener("hashchange", render);

  // Theme toggle (remembers choice; defaults to system).
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  applyTheme(store.get("theme", null));
  $("#theme-toggle").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    store.set("theme", next); applyTheme(next);
  });

  // ---------- Boot ----------
  (async () => {
    $("#share-idea-link").href = `${GH}/issues/new?template=share-idea.yml`;
    $("#repo-link").href = GH;
    $$("[data-icon]").forEach((el) => el.insertAdjacentHTML("afterbegin", icon(el.dataset.icon)));
    const [topics, ideas, feed, sources, collections, credits] = await Promise.all([
      getJSON("data/topics.json", { topics: [] }),
      getJSON("data/ideas.json", { ideas: [] }),
      getJSON("data/feed.json", { items: [], updated: null }),
      getJSON("data/sources.json", { feeds: [] }),
      getJSON("data/collections.json", { collections: [] }),
      getJSON("data/credits.json", {}),
    ]);
    state.topics = topics.topics;
    state.topicById = Object.fromEntries(state.topics.map((t) => [t.id, t]));
    state.ideas = ideas.ideas.filter((i) => state.topicById[i.topic]);
    state.ideaById = Object.fromEntries(state.ideas.map((i) => [i.id, i]));
    state.collections = collections.collections.map((c) => ({ ...c, ideas: c.ideas.filter((id) => state.ideaById[id]) })).filter((c) => c.ideas.length);
    state.collectionById = Object.fromEntries(state.collections.map((c) => [c.id, c]));
    state.credits = credits;
    state.feed = feed;
    state.sources = sources.feeds;
    document.documentElement.classList.remove("booting");
    render();
    if (!user.plan && !store.get("onboarded", false) && !location.hash.startsWith("#/idea/")) openOnboarding();
  })();
})();
