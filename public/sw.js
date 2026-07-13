const CACHE_NAME = "screenia-static-cache-v2";
const STATIC_CACHE_EXTENSIONS = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i;
const NEVER_CACHE_PREFIXES = [
  "/api/",
  "/auth/",
  "/account",
  "/admin",
  "/display",
  "/onboarding",
  "/login",
];
const CACHEABLE_STATIC_PREFIXES = [
  "/_next/static/",
  "/brand/",
  "/icons/",
  "/favicon",
  "/icon",
  "/apple-icon",
];

function isNeverCachePath(pathname) {
  return NEVER_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isCacheableStaticPath(pathname) {
  return (
    CACHEABLE_STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    STATIC_CACHE_EXTENSIONS.test(pathname)
  );
}

function responseAllowsCaching(response) {
  const cacheControl = response.headers.get("Cache-Control") || "";

  return !/(?:no-store|no-cache|private)/i.test(cacheControl);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (request.mode === "navigate" || request.destination === "document") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (isNeverCachePath(url.pathname)) return;
  if (!isCacheableStaticPath(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      try {
        const networkResponse = await fetch(request);

        if (
          networkResponse &&
          networkResponse.status === 200 &&
          responseAllowsCaching(networkResponse)
        ) {
          const responseClone = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, responseClone);
        }

        return networkResponse;
      } catch {
        if (cachedResponse) {
          return cachedResponse;
        }

        return new Response("Offline and not cached", {
          status: 503,
          statusText: "Offline",
        });
      }
    }),
  );
});
