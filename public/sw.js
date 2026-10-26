// Wardrobe service worker: keeps the app shell available offline (Shop mode at markets),
// caches immutable assets, and falls back to cached data when there's no signal.
// Writes (POST/PATCH) are never cached; offline scans go through the IndexedDB queue instead.

const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const DATA = `data-${VERSION}`;
const SHELL = ["/today", "/wardrobe", "/shop", "/profile", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      // Individually, so one failure (e.g. not signed in yet) doesn't abort the install.
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { credentials: "include" });
            if (res.ok && !res.redirected) await cache.put(url, res);
          } catch {
            /* offline during install */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES, DATA]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page sends the asset URLs it loaded before the worker took control, so they are cached too.
self.addEventListener("message", (event) => {
  if (event.data?.type === "cache-urls" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(STATIC).then((cache) =>
        Promise.all(
          event.data.urls
            .filter((u) => new URL(u, self.location.origin).pathname.startsWith("/_next/static/"))
            .map((u) => cache.match(u).then((hit) => hit || cache.add(u).catch(() => undefined))),
        ),
      ),
    );
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(request, { ignoreSearch: request.mode === "navigate" })) ||
      (fallbackUrl && (await caches.match(fallbackUrl)));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
  } else if (url.pathname.startsWith("/api/img/")) {
    event.respondWith(cacheFirst(request, DATA));
  } else if (url.pathname.startsWith("/api/auth/") || url.pathname.startsWith("/auth/")) {
    return;
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, "/offline"));
  }
});
