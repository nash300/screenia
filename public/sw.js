const CACHE_NAME = "screenia-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      try {
        const networkResponse = await fetch(request);

        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();

          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, responseClone);
        }

        return networkResponse;
      } catch (error) {
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
