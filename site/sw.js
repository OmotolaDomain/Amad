/* AMAD service worker.
   Scope: the folder this file is served from (e.g. /Amad/ on GitHub Pages), so every path here is relative.
   Strategy:
   - App shell and learning data (HTML, JS, CSS, ideas, worlds, collections): network-first with a short timeout,
     falling back to the cache, so updates arrive as soon as you're online but the app still opens offline.
   - Daily feed (data/feed.json): always network-first (no timeout race), so a stale cache never hides new headlines.
   - Photos, icons and fonts: cache-first; photos you've seen stay available offline (capped).
   BUILD is replaced at deploy time with a hash of the app files, so a new release installs a fresh shell cache. */
const BUILD = "__BUILD__";
const SHELL = `amad-shell-${BUILD}`;
const RUNTIME = "amad-runtime-v1";
const IMAGES = "amad-images-v1";
const MAX_IMAGES = 160;
const NETWORK_TIMEOUT_MS = 3500;

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/styles.css",
  "assets/app.js",
  "assets/art.js",
  "assets/visuals.js",
  "assets/amad-mark.svg",
  "assets/fonts/fonts.css",
  "assets/fonts/bricolage-grotesque-normal-latin.woff2",
  "assets/fonts/newsreader-normal-latin.woff2",
  "assets/fonts/newsreader-italic-latin.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "data/topics.json",
  "data/ideas.json",
  "data/collections.json",
  "data/credits.json",
  "data/sources.json",
  "data/feed.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // Fetch each file fresh (bypassing the HTTP cache); one missing optional file must not block install.
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: "reload" }));
        if (res.ok) await cache.put(url, res);
      } catch { /* offline during install: the runtime cache fills in later */ }
    }));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, RUNTIME, IMAGES]);
    for (const key of await caches.keys()) if (key.startsWith("amad-") && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

// The page asks the waiting worker to take over when the person taps "Update".
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Self-hosted fonts live in assets/fonts; Google Fonts is only a fallback if a page still references it.
  if (url.origin === "https://fonts.gstatic.com" || url.origin === "https://fonts.googleapis.com") {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, { timeout: NETWORK_TIMEOUT_MS, fallback: "index.html" }));
  } else if (url.pathname.endsWith("/data/feed.json")) {
    event.respondWith(networkFirst(req, { timeout: 0 }));
  } else if (url.pathname.endsWith(".woff2")) {
    event.respondWith(cacheFirst(req, SHELL));
  } else if (/\/assets\/(img|icons)\//.test(url.pathname) || /\.(webp|png|jpg|svg)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, IMAGES, MAX_IMAGES));
  } else {
    event.respondWith(networkFirst(req, { timeout: NETWORK_TIMEOUT_MS }));
  }
});

/** Network first; on failure (or after `timeout` ms, if a cached copy exists) use the cache. */
async function networkFirst(req, { timeout = 0, fallback = null } = {}) {
  const key = cacheKey(req);
  const cached = await caches.match(key, { ignoreVary: true });
  const network = fetch(req).then(async (res) => {
    if (res.ok) {
      const copy = res.clone();
      const cache = await caches.open(isShellFile(key) ? SHELL : RUNTIME);
      await cache.put(key, copy);
    }
    return res;
  });
  network.catch(() => {}); // a late failure after the timeout already answered from cache is fine
  try {
    if (timeout && cached) {
      return await Promise.race([network, new Promise((resolve) => setTimeout(() => resolve(cached), timeout))]);
    }
    return await network;
  } catch {
    if (cached) return cached;
    if (fallback) {
      const shell = await caches.match(fallback);
      if (shell) return shell;
    }
    return new Response("You're offline and this page hasn't been saved yet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

/** Cache first; fetch and store on a miss. Keeps the image cache under `max` entries. */
async function cacheFirst(req, cacheName, max = 0) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === "opaque") {
      const cache = await caches.open(cacheName);
      await cache.put(req, res.clone());
      if (max) trim(cache, max);
    }
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Navigations to "./?source=pwa" or "./" share one cached copy of the shell.
function cacheKey(req) {
  const url = new URL(req.url);
  if (req.mode === "navigate") return new URL("index.html", self.registration.scope).href;
  url.search = "";
  return url.href;
}
function isShellFile(href) {
  const path = href.replace(self.registration.scope, "");
  return PRECACHE.includes(path) || path === "";
}
