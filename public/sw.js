const STATIC_CACHE = "torneio360-app-shell-v3";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/torneio360-app-icon-192.png",
  "/torneio360-app-icon-512.png",
  "/torneio360-apple-touch-icon.png",
  "/torneio360-favicon-96.png",
];

async function cacheApplicationShell() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(STATIC_ASSETS);

  const indexResponse = await cache.match("/");
  if (!indexResponse) return;

  const indexHtml = await indexResponse.text();
  const buildAssets = [...indexHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((path) => path.startsWith("/assets/"));

  if (buildAssets.length) await cache.addAll([...new Set(buildAssets)]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheApplicationShell()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(STATIC_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (
          await caches.match(event.request, { ignoreSearch: true })
          || await caches.match("/")
          || Response.error()
        ))
    );
    return;
  }

  const isStaticAsset = STATIC_ASSETS.includes(url.pathname)
    || ["script", "style", "font", "image"].includes(event.request.destination);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkRequest = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });

      if (cached) {
        void networkRequest.catch(() => undefined);
        return cached;
      }
      return networkRequest;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
