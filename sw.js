// FORGE service worker.
// Strategy: network-first for HTML/JS/CSS so live updates ship without manual
// cache-busting; cache-first for the icon and manifest. Falls back to cached
// app shell entirely when offline.

const CACHE_NAME = "forge-cache-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./exercises.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Use no-cache to avoid stuffing a stale browser cache entry into the SW cache.
      cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "no-cache" })))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let cross-origin (YouTube, etc.) pass through.
  if (url.origin !== self.location.origin) return;

  const isShellAsset = /\.(html|js|css|json|svg)$/.test(url.pathname) || url.pathname.endsWith("/");

  if (isShellAsset) {
    // Network-first: try live, fall back to cache if offline.
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Stash a fresh copy for offline.
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Default: cache-first for everything else (icons, fonts, etc.)
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
