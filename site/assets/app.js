/* AMAD: a free, open-source daily idea feed. No accounts: all progress lives in localStorage. */
(() => {
  "use strict";

  // ---------- Config ----------
  // On GitHub Pages (owner.github.io/repo) the repo is detected automatically, so forks just work.
  const FALLBACK_REPO = "OmotolaDomain/amad";
  const REPO = (() => {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    const seg = location.pathname.split("/").filter(Boolean)[0];
    return m && seg ? `${m[1]}/${seg}` : FALLBACK_REPO;
  })();
  const GH = `https://github.com/${REPO}`;
  const ROLES = [
    { id: "seller", label: "Enterprise seller / AE", hint: "Win bigger, more complex deals", topics: ["enterprise", "executive", "territory"] },
    { id: "am", label: "Account / customer success manager", hint: "Retain and grow key accounts", topics: ["accounts", "executive", "enterprise"] },
    { id: "leader", label: "Sales or commercial director", hint: "Lead teams, coverage and performance", topics: ["performance", "territory", "strategy", "executive"] },
    { id: "strategy", label: "Strategy / BizOps / RevOps", hint: "Shape where to play and how to win", topics: ["strategy", "performance", "territory"] },
    { id: "brand", label: "Marketing / brand", hint: "Build a brand people remember", topics: ["branding", "strategy", "executive"] },
  ];
  const MINUTE_OPTIONS = [5, 10, 15];

  // ---------- Storage (safe in private mode) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("amad:" + key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem("amad:" + key, JSON.stringify(value)); } catch { /* ignore */ } },
  };

  // ---------- State ----------
  const state = {
    topics: [], topicById: {}, ideas: [], ideaById: {}, feed: { items: [], updated: null }, sources: [],
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
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const topicStyle = (id) => `--topic:${state.topicById[id]?.color || "var(--accent)"}`;

  function seededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }
  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function timeAgo(iso) {
    if (!iso) return "";
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  }
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  async function getJSON(path, fallback) {
    try { const r = await fetch(path, { cache: "no-cache" }); if (!r.ok) throw new Error(r.status); return await r.json(); }
    catch (e) { console.warn("Could not load", path, e); return fallback; }
  }

  // ---------- Daily stash ----------
  function planOrDefault() {
    return user.plan || { role: null, topics: state.topics.map((t) => t.id), minutes: 10 };
  }
  function todaysStash() {
    const today = dayKey();
    const cached = store.get("stash", null);
    if (cached && cached.day === today && cached.ids.every((id) => state.ideaById[id])) return cached.ids.map((id) => state.ideaById[id]);
    const plan = planOrDefault();
    const count = Math.min(7, Math.max(3, Math.round(plan.minutes / 2)));
    const read = user.read;
    const pool = state.ideas.filter((i) => plan.topics.includes(i.topic));
    const rand = seededRandom(today + plan.topics.join());
    // Prefer unread ideas, and rotate through topics so the stash is varied.
    const ordered = [...shuffle(pool.filter((i) => !read[i.id]), rand), ...shuffle(pool.filter((i) => read[i.id]), rand)];
    const picks = [], usedTopics = new Set();
    for (const idea of ordered) { if (picks.length < count && !usedTopics.has(idea.topic)) { picks.push(idea); usedTopics.add(idea.topic); } }
    for (const idea of ordered) { if (picks.length < count && !picks.includes(idea)) picks.push(idea); }
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
      if (s.count > 1) toast(`🔥 ${s.count}-day streak, keep it going!`);
    }
    renderStreak();
  }
  function toggleSave(id) {
    const saved = user.saved;
    const i = saved.indexOf(id);
    if (i >= 0) saved.splice(i, 1); else saved.unshift(id);
    store.set("saved", saved);
    toast(i >= 0 ? "Removed from Saved" : "Saved 🔖");
    return i < 0;
  }
  function renderStreak() {
    const s = user.streak;
    const alive = s.last === dayKey() || s.last === yesterdayKey();
    $("#streak b").textContent = alive ? s.count : 0;
  }

  // ---------- Components ----------
  function ideaCard(idea) {
    const t = state.topicById[idea.topic] || {};
    const read = user.read[idea.id];
    return `<button class="card" style="${topicStyle(idea.topic)}" data-open="${esc(idea.id)}">
      <span class="tag">${esc(t.emoji || "")} ${esc(t.name || idea.topic)}</span>
      <h3>${esc(idea.title)}</h3>
      <p>${esc(idea.pages[0])}</p>
      <span class="card-meta">${idea.minutes} min read · ${esc(idea.source?.name?.split(",")[0] || "")}
        ${read ? '<span class="badge">✓ Read</span>' : ""}</span>
    </button>`;
  }
  function chips(selected, attr) {
    const all = [{ id: "all", name: "All", emoji: "🌐" }, ...state.topics];
    return `<div class="chips" role="toolbar" aria-label="Filter by topic">${all
      .map((t) => `<button class="chip" ${attr}="${t.id}" aria-pressed="${t.id === selected}">${t.emoji} ${esc(t.name)}</button>`)
      .join("")}</div>`;
  }
  function newsItem(it) {
    const t = state.topicById[it.topic] || {};
    const url = safeUrl(it.link);
    if (!url) return "";
    return `<li style="${topicStyle(it.topic)}">
      <a class="title" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a>
      ${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
      <div class="meta"><span class="tag">${esc(t.emoji || "")} ${esc(t.name || "")}</span><span>${esc(it.source)}</span><span>${timeAgo(it.published)}</span></div>
    </li>`;
  }
  const emptyBox = (emoji, html) => `<div class="empty"><span class="big">${emoji}</span>${html}</div>`;

  // ---------- Views ----------
  const views = {
    today() {
      const stash = todaysStash();
      const read = user.read;
      const done = stash.filter((i) => read[i.id]).length;
      const pct = stash.length ? Math.round((done / stash.length) * 100) : 0;
      const plan = user.plan;
      const hour = new Date().getHours();
      const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      const mins = stash.reduce((n, i) => n + i.minutes, 0);
      const fresh = state.feed.items.filter((i) => planOrDefault().topics.includes(i.topic)).slice(0, 5);
      return `
        <section class="hero">
          <div>
            <span class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
            <h1>${greet}. Here's your daily stash.</h1>
            <p>${stash.length} ideas · about ${mins} min${plan ? "" : ' · <a href="#" data-action="onboard">Personalise your growth plan →</a>'}</p>
            <div class="progress" aria-label="Today's progress"><span style="width:${pct}%"></span></div>
            <p style="margin-top:8px">${done === stash.length && stash.length ? "🎉 All done for today! Come back tomorrow for a fresh stash." : `${done} of ${stash.length} read`}</p>
          </div>
          <div class="ring" style="--p:${pct}"><b>${pct}%</b></div>
        </section>
        <div class="section-head"><h2>Today's ideas</h2>${stash.length ? `<button class="btn btn-small" data-open="${esc((stash.find((i) => !read[i.id]) || stash[0]).id)}">▶ Start reading</button>` : ""}</div>
        ${stash.length ? `<div class="grid">${stash.map(ideaCard).join("")}</div>` : emptyBox("🌱", "<p>No ideas loaded yet.</p>")}
        <div class="section-head"><h2>Fresh from the web</h2><a href="#/fresh">See all →</a></div>
        ${fresh.length ? `<ul class="news">${fresh.map(newsItem).join("")}</ul>` : emptyBox("📰", "<p>The daily feed hasn't been fetched yet. It refreshes every morning via GitHub Actions.</p>")}`;
    },

    explore() {
      const { topic, q } = state.explore;
      const needle = q.trim().toLowerCase();
      const list = state.ideas.filter((i) => (topic === "all" || i.topic === topic) &&
        (!needle || [i.title, i.takeaway, i.source?.name, ...i.pages].join(" ").toLowerCase().includes(needle)));
      const t = state.topicById[topic];
      return `
        <h1>Explore</h1>
        <p class="muted">${t ? esc(t.blurb) : `${state.ideas.length} bite-sized ideas from the best thinking on commercial excellence.`}</p>
        <input class="search" type="search" placeholder="Search ideas, authors, books…" value="${esc(q)}" data-search aria-label="Search ideas">
        ${chips(topic, "data-explore-topic")}
        <div class="grid" style="margin-top:8px">${list.map(ideaCard).join("") || ""}</div>
        ${list.length ? "" : emptyBox("🔍", `<p>No ideas match. <a href="${GH}/issues/new?template=share-idea.yml" target="_blank" rel="noopener">Share one?</a></p>`)}`;
    },

    fresh() {
      const { topic } = state.fresh;
      const list = state.feed.items.filter((i) => topic === "all" || i.topic === topic);
      return `
        <h1>Fresh from the web</h1>
        <p class="muted">Headlines from public business publications, refreshed daily by an open GitHub Action.
          ${state.feed.updated ? `Last updated ${timeAgo(state.feed.updated)}.` : ""} Links open the original publisher.</p>
        ${chips(topic, "data-fresh-topic")}
        ${list.length ? `<ul class="news">${list.map(newsItem).join("")}</ul>`
          : emptyBox("📰", `<p>${state.feed.updated ? "Nothing new on this topic in the last two weeks." : "The first daily refresh hasn't run yet."}</p>
             <p><a href="${GH}/issues/new?template=suggest-source.yml" target="_blank" rel="noopener">Suggest a source</a></p>`)}`;
    },

    saved() {
      const list = user.saved.map((id) => state.ideaById[id]).filter(Boolean);
      return `<h1>Saved</h1><p class="muted">Your personal stash. Stored only in this browser.</p>
        ${list.length ? `<div class="grid">${list.map(ideaCard).join("")}</div>` : emptyBox("🔖", "<p>Tap <b>Save</b> on any idea to keep it here.</p>")}`;
    },

    plan() {
      const plan = user.plan, read = user.read, s = user.streak;
      const role = ROLES.find((r) => r.id === plan?.role);
      const totalRead = Object.keys(read).length;
      const rows = state.topics.map((t) => {
        const all = state.ideas.filter((i) => i.topic === t.id), done = all.filter((i) => read[i.id]).length;
        const pct = all.length ? Math.round((done / all.length) * 100) : 0;
        return `<div class="row" style="${topicStyle(t.id)}"><span>${t.emoji} ${esc(t.name)}${plan?.topics.includes(t.id) ? " ★" : ""}</span>
          <div class="progress"><span style="width:${pct}%"></span></div><span class="muted">${done}/${all.length}</span></div>`;
      }).join("");
      return `
        <h1>My growth plan</h1>
        <p class="muted">${plan ? `${esc(role?.label || "Custom plan")} · ${plan.minutes} min/day · ${plan.topics.length} focus topics` : "You haven't set a plan yet. You're seeing ideas from every topic."}</p>
        <p><button class="btn" data-action="onboard">${plan ? "Edit my plan" : "Build my growth plan"}</button></p>
        <div class="stats" style="margin-top:20px">
          <div class="stat"><b>🔥 ${s.last === dayKey() || s.last === yesterdayKey() ? s.count : 0}</b><span class="muted">day streak</span></div>
          <div class="stat"><b>${s.best || 0}</b><span class="muted">best streak</span></div>
          <div class="stat"><b>${totalRead}</b><span class="muted">ideas read</span></div>
          <div class="stat"><b>${user.saved.length}</b><span class="muted">saved</span></div>
        </div>
        <div class="section-head"><h2>Progress by topic</h2><span class="muted">★ = in your plan</span></div>
        <div class="topic-progress">${rows}</div>
        <div class="section-head"><h2>Your data</h2></div>
        <p class="muted">AMAD never asks you to sign up. Everything above is stored on this device only.</p>
        <button class="btn btn-ghost btn-small" data-action="reset">Reset my progress</button>`;
    },

    about() {
      const srcs = state.sources.map((s) => `<li>${esc(s.name)} <span class="muted">(${s.topics.map((t) => esc(state.topicById[t]?.name || t)).join(", ")})</span></li>`).join("");
      return `<div class="prose">
        <h1>About AMAD</h1>
        <p>AMAD is a free, open-source alternative to paid "daily learning" apps, focused on commercial excellence: strategy, enterprise commercial, territory mapping, performance optimization, account management, director-level engagement and branding.</p>
        <h2>How it works</h2>
        <ul>
          <li><b>Idea library</b>: short summaries of proven frameworks, written in plain language and always credited to the original thinkers, with links to read more.</li>
          <li><b>Daily stash</b>: every day you get a fresh set of ideas based on your growth plan.</li>
          <li><b>Fresh feed</b>: a GitHub Action collects headlines from public feeds every morning. We link to publishers and never republish full articles.</li>
          <li><b>No accounts</b>: your plan, streak and saved ideas stay in your browser.</li>
        </ul>
        <h2>Contribute</h2>
        <p>Anyone can add ideas. <a href="${GH}/issues/new?template=share-idea.yml" target="_blank" rel="noopener">Fill in the "Share an idea" form</a> (no code needed). Once a maintainer approves it, it's published automatically. Developers can also <a href="${GH}" target="_blank" rel="noopener">open a pull request</a>.</p>
        <h2>Feed sources</h2><ul>${srcs || "<li class='muted'>None loaded.</li>"}</ul>
        <p class="muted">Code is MIT licensed. Idea summaries are CC BY 4.0. Trademarks and linked articles belong to their owners.</p>
      </div>`;
    },
  };

  // ---------- Reader ----------
  const reader = { idea: null, page: 0, lastFocus: null, pushed: false };
  function openReader(id, push = true) {
    const idea = state.ideaById[id];
    if (!idea) return;
    reader.lastFocus = reader.idea ? reader.lastFocus : document.activeElement;
    reader.idea = idea; reader.page = 0;
    if (push && location.hash !== `#/idea/${id}`) { history.pushState(null, "", `#/idea/${id}`); reader.pushed = true; }
    renderReader();
    $("#reader").hidden = false;
    document.body.style.overflow = "hidden";
    $("#reader .sheet").focus();
  }
  function closeReader(fromRoute = false) {
    if ($("#reader").hidden) return;
    $("#reader").hidden = true;
    document.body.style.overflow = "";
    reader.idea = null;
    if (!fromRoute && location.hash.startsWith("#/idea/")) {
      // Go back if we added the history entry; otherwise (shared link) stay on the site.
      if (reader.pushed) { reader.pushed = false; history.back(); return; }
      history.replaceState(null, "", `#/${lastView}`);
    }
    reader.pushed = false;
    render();
    reader.lastFocus?.focus?.();
  }
  function renderReader() {
    const { idea, page } = reader;
    const t = state.topicById[idea.topic] || {};
    const total = idea.pages.length + 1; // last page = takeaway
    const isLast = page === total - 1;
    if (isLast) markRead(idea.id);
    const saved = user.saved.includes(idea.id);
    const srcUrl = safeUrl(idea.source?.url);
    const body = isLast
      ? `<h2 id="reader-title">${esc(idea.title)}</h2>
         <div class="takeaway"><b>Try this today</b>${esc(idea.takeaway)}</div>
         <p class="source">Source: ${srcUrl ? `<a href="${esc(srcUrl)}" target="_blank" rel="noopener noreferrer">${esc(idea.source.name)}</a>` : esc(idea.source?.name)}
           · shared by ${idea.contributor === "amad-team" ? "the AMAD team" : `<a href="https://github.com/${encodeURIComponent(idea.contributor)}" target="_blank" rel="noopener">@${esc(idea.contributor)}</a>`}</p>`
      : `${page === 0 ? `<h2 id="reader-title">${esc(idea.title)}</h2>` : `<span class="eyebrow" id="reader-title">${esc(idea.title)}</span>`}
         <p>${esc(idea.pages[page])}</p>`;
    $("#reader").innerHTML = `
      <div class="sheet" tabindex="-1" style="${topicStyle(idea.topic)}">
        <button class="icon-btn sheet-close" data-action="close-reader" aria-label="Close">✕</button>
        <div class="reader-top"><span class="tag">${esc(t.emoji || "")} ${esc(t.name || "")}</span>
          <span class="dots" aria-label="Page ${page + 1} of ${total}">${Array.from({ length: total }, (_, i) => `<i class="${i <= page ? "on" : ""}"></i>`).join("")}</span></div>
        <div class="reader-page">${body}</div>
        <div class="reader-nav">
          <button class="btn btn-ghost btn-small" data-action="prev" ${page === 0 ? "disabled" : ""}>← Back</button>
          ${isLast
            ? `<div class="reader-actions">
                 <button class="btn btn-ghost btn-small" data-action="save">${saved ? "🔖 Saved" : "🔖 Save"}</button>
                 <button class="btn btn-ghost btn-small" data-action="share">↗ Share</button>
                 <a class="btn btn-ghost btn-small" href="${GH}/issues/new?title=${encodeURIComponent(`[Discuss] ${idea.title}`)}&body=${encodeURIComponent(`Idea: ${idea.id}\n\n`)}" target="_blank" rel="noopener">💬 Discuss</a>
                 ${nextInStash() ? `<button class="btn btn-small" data-action="next-idea">Next idea →</button>` : `<button class="btn btn-small" data-action="close-reader">Done ✓</button>`}
               </div>`
            : `<button class="btn btn-small" data-action="next">Next →</button>`}
        </div>
      </div>`;
  }
  function nextInStash() {
    const stash = todaysStash(), read = user.read;
    return stash.find((i) => !read[i.id] && i.id !== reader.idea?.id) || null;
  }
  function turn(delta) {
    if (!reader.idea) return;
    const total = reader.idea.pages.length + 1;
    const p = Math.min(total - 1, Math.max(0, reader.page + delta));
    if (p !== reader.page) { reader.page = p; renderReader(); $("#reader .sheet").focus(); }
  }
  async function shareIdea(idea) {
    const url = `${location.origin}${location.pathname}#/idea/${idea.id}`;
    const text = `${idea.title}: ${idea.takeaway}`;
    try {
      if (navigator.share) { await navigator.share({ title: idea.title, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`); toast("Link copied 📋");
    } catch { /* user cancelled */ }
  }

  // ---------- Onboarding (growth plan quiz) ----------
  const ob = { step: 0, draft: null };
  function openOnboarding() {
    const p = user.plan;
    ob.step = 0;
    ob.draft = p ? { ...p, topics: [...p.topics] } : { role: null, topics: [], minutes: 10 };
    renderOnboarding();
    $("#onboarding").hidden = false;
    document.body.style.overflow = "hidden";
    $("#onboarding .sheet").focus();
  }
  function closeOnboarding() {
    $("#onboarding").hidden = true; document.body.style.overflow = "";
    store.set("onboarded", true);
  }
  function renderOnboarding() {
    const d = ob.draft;
    const steps = [
      {
        title: "What best describes your role?",
        sub: "We'll suggest the topics that matter most for you.",
        html: ROLES.map((r) => `<button class="ob-option" data-role="${r.id}" aria-pressed="${d.role === r.id}"><span>${esc(r.label)}<small>${esc(r.hint)}</small></span></button>`).join(""),
        ok: !!d.role,
      },
      {
        title: "Which areas do you want to grow in?",
        sub: "Pick at least one. You can change this any time.",
        html: state.topics.map((t) => `<button class="ob-option" data-ob-topic="${t.id}" aria-pressed="${d.topics.includes(t.id)}"><span style="font-size:1.3rem">${t.emoji}</span><span>${esc(t.name)}<small>${esc(t.blurb)}</small></span></button>`).join(""),
        ok: d.topics.length > 0,
      },
      {
        title: "How much time per day?",
        sub: "Small daily habits beat occasional binges.",
        html: MINUTE_OPTIONS.map((m) => `<button class="ob-option" data-minutes="${m}" aria-pressed="${d.minutes === m}"><span>${m} minutes<small>About ${Math.min(7, Math.max(3, Math.round(m / 2)))} ideas a day</small></span></button>`).join(""),
        ok: !!d.minutes,
      },
    ];
    const s = steps[ob.step];
    $("#onboarding").innerHTML = `
      <div class="sheet" tabindex="-1">
        <span class="eyebrow">Your growth plan · step ${ob.step + 1} of ${steps.length}</span>
        <h2 id="ob-title" style="margin-top:6px">${s.title}</h2>
        <p class="muted" style="margin:0">${s.sub}</p>
        <div class="ob-options">${s.html}</div>
        <div class="ob-foot">
          ${ob.step === 0 ? `<button class="linklike" data-action="ob-skip">Skip for now</button>` : `<button class="btn btn-ghost btn-small" data-action="ob-back">← Back</button>`}
          <button class="btn" data-action="ob-next" ${s.ok ? "" : "disabled"}>${ob.step === steps.length - 1 ? "Start my plan 🌱" : "Continue →"}</button>
        </div>
      </div>`;
  }

  // ---------- Routing & rendering ----------
  function currentRoute() {
    const [, name = "today", arg] = location.hash.match(/^#\/([^/]+)\/?(.*)$/) || [];
    return { name, arg: decodeURIComponent(arg || "") };
  }
  let lastView = "today";
  function render() {
    const { name, arg } = currentRoute();
    if (name === "idea") {
      if (!views[lastView]) lastView = "today";
      if (!reader.idea || reader.idea.id !== arg) openReader(arg, false);
    } else {
      if (!$("#reader").hidden) closeReader(true);
      lastView = views[name] ? name : "today";
    }
    const scrollY = window.scrollY;
    $("#main").innerHTML = views[lastView]();
    if (name !== "idea") window.scrollTo(0, 0); else window.scrollTo(0, scrollY);
    document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === lastView));
    renderStreak();
  }

  function rerenderKeepingSearchFocus() {
    const input = $("[data-search]");
    const pos = input?.selectionStart;
    $("#main").innerHTML = views.explore();
    const next = $("[data-search]");
    if (input && next) { next.focus(); next.setSelectionRange(pos, pos); }
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-open],[data-action],[data-explore-topic],[data-fresh-topic],[data-role],[data-ob-topic],[data-minutes]");
    if (!el) {
      if (e.target.id === "reader") closeReader();
      return;
    }
    const d = el.dataset;
    if (d.open) return openReader(d.open);
    if (d.exploreTopic) { state.explore.topic = d.exploreTopic; return rerenderKeepingSearchFocus(); }
    if (d.freshTopic) { state.fresh.topic = d.freshTopic; $("#main").innerHTML = views.fresh(); return; }
    if (d.role) {
      ob.draft.role = d.role;
      if (!ob.draft.topics.length) ob.draft.topics = [...ROLES.find((r) => r.id === d.role).topics];
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
      case "next-idea": { const n = nextInStash(); if (n) { history.replaceState(null, "", `#/idea/${n.id}`); openReader(n.id, false); } return; }
      case "save": toggleSave(reader.idea.id); return renderReader();
      case "share": return shareIdea(reader.idea);
      case "onboard": e.preventDefault(); return openOnboarding();
      case "ob-skip": closeOnboarding(); return render();
      case "ob-back": ob.step--; return renderOnboarding();
      case "ob-next":
        if (ob.step < 2) { ob.step++; return renderOnboarding(); }
        user.plan = ob.draft; store.set("stash", null); closeOnboarding(); toast("Your growth plan is ready 🌱");
        location.hash = "#/today"; return render();
      case "reset":
        if (confirm("Reset your streak, reading history, saved ideas and plan on this device?")) {
          try { ["plan", "read", "saved", "streak", "stash", "onboarded"].forEach((k) => localStorage.removeItem("amad:" + k)); } catch { /* ignore */ }
          toast("Progress reset"); render();
        }
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-search]")) { state.explore.q = e.target.value; rerenderKeepingSearchFocus(); }
  });
  document.addEventListener("keydown", (e) => {
    if (!$("#onboarding").hidden && e.key === "Escape") { closeOnboarding(); render(); return; }
    if ($("#reader").hidden) return;
    if (e.key === "Escape") closeReader();
    else if (e.key === "ArrowRight") turn(1);
    else if (e.key === "ArrowLeft") turn(-1);
  });
  // Swipe between pages on touch devices.
  let touchX = null;
  $("#reader").addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $("#reader").addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 50) turn(dx < 0 ? 1 : -1);
  });
  window.addEventListener("hashchange", render);

  // Theme toggle (remembers choice; defaults to system).
  function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
  applyTheme(store.get("theme", null));
  $("#theme-toggle").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    store.set("theme", next); applyTheme(next);
  });

  // ---------- Boot ----------
  (async () => {
    $("#share-idea-link").href = `${GH}/issues/new?template=share-idea.yml`;
    $("#repo-link").href = GH;
    $("#main").innerHTML = `<p class="muted">Loading ideas…</p>`;
    const [topics, ideas, feed, sources] = await Promise.all([
      getJSON("data/topics.json", { topics: [] }),
      getJSON("data/ideas.json", { ideas: [] }),
      getJSON("data/feed.json", { items: [], updated: null }),
      getJSON("data/sources.json", { feeds: [] }),
    ]);
    state.topics = topics.topics;
    state.topicById = Object.fromEntries(state.topics.map((t) => [t.id, t]));
    state.ideas = ideas.ideas.filter((i) => state.topicById[i.topic]).sort((a, b) => (b.added || "").localeCompare(a.added || ""));
    state.ideaById = Object.fromEntries(state.ideas.map((i) => [i.id, i]));
    state.feed = feed;
    state.sources = sources.feeds;
    render();
    if (!user.plan && !store.get("onboarded", false) && !location.hash.startsWith("#/idea/")) openOnboarding();
  })();
})();
