export const pwaCorePrecachePaths = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/wedding-garden-192.png",
  "./icons/wedding-garden-512.png",
  "./images/wedding-gallery/01-cover-640.webp",
  "./images/wedding-gallery/01-cover-640.avif",
  "./assets/maps/v2/home/background.webp",
  "./assets/ui/joystick-wedding-compass-base.png",
  "./assets/ui/joystick-wedding-compass-thumb.png",
  "./characters/generated/guests/world/feminine-long-wave-dress__idle.png",
  "./characters/generated/guests/world/feminine-long-wave-dress__walk.png"
] as const;

function relativeAssetPath(fileName: string): string {
  return fileName.startsWith("./") ? fileName : `./${fileName.replace(/^\/+/, "")}`;
}

const adminOnlyBundlePattern = /(?:AdminPage|AdminNotificationInbox|papaparse|inviteLinkAdminTokens|attendanceOperations)/i;

export function resolvePwaPrecachePaths(bundleFileNames: readonly string[]): string[] {
  const buildAssets = bundleFileNames
    .filter((fileName) => /\.(?:css|js)$/i.test(fileName) && !adminOnlyBundlePattern.test(fileName))
    .map(relativeAssetPath);
  return [...new Set([...pwaCorePrecachePaths, ...buildAssets])];
}

export function createPwaServiceWorkerSource(version: string, precachePaths: readonly string[]): string {
  return `const VERSION = ${JSON.stringify(version)};
const CACHE_PREFIX = "wedding-garden";
const PRECACHE_NAME = \`${"${CACHE_PREFIX}"}-precache-${"${VERSION}"}\`;
const RUNTIME_NAME = \`${"${CACHE_PREFIX}"}-runtime-${"${VERSION}"}\`;
const PRECACHE_URLS = ${JSON.stringify(precachePaths)};
const RUNTIME_LIMIT = 120;

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function broadcast(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage(message));
}

async function trimRuntimeCache(cache) {
  const requests = await cache.keys();
  const overflow = requests.length - RUNTIME_LIMIT;
  if (overflow > 0) {
    await Promise.all(requests.slice(0, overflow).map((request) => cache.delete(request)));
  }
}

async function fetchAndCache(cache, request) {
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
  }
  return response;
}

async function prepareOfflineCache() {
  const cache = await caches.open(PRECACHE_NAME);
  let completed = 0;
  await broadcast({ type: "PWA_CACHE_PROGRESS", completed, total: PRECACHE_URLS.length });

  for (const path of PRECACHE_URLS) {
    const request = new Request(scopedUrl(path), { cache: "reload" });
    try {
      const response = await fetch(request);
      if (!response.ok) throw new Error(\`HTTP ${"${response.status}"}\`);
      await cache.put(request, response);
      completed += 1;
      await broadcast({ type: "PWA_CACHE_PROGRESS", completed, total: PRECACHE_URLS.length });
    } catch (error) {
      await broadcast({ type: "PWA_CACHE_ERROR", path });
      throw error;
    }
  }

  await broadcast({ type: "PWA_CACHE_READY", total: PRECACHE_URLS.length });
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await prepareOfflineCache();
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const currentCaches = new Set([PRECACHE_NAME, RUNTIME_NAME]);
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && !currentCaches.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
    await broadcast({ type: "PWA_CACHE_READY", total: PRECACHE_URLS.length });
  })());
});

async function navigationResponse(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    return await fetch(request, { signal: controller.signal });
  } catch {
    return await caches.match(scopedUrl("./index.html"))
      || await caches.match(scopedUrl("./"))
      || new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>웨딩 가든</title><body><p>오프라인 초대장을 준비하지 못했습니다. 연결 후 다시 열어주세요.</p></body></html>', {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 503
      });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldCacheRequest(request, url) {
  if (request.headers.has("range") || url.pathname.endsWith("/service-worker.js")) return false;
  if (url.origin === self.location.origin) {
    return ["script", "style", "image", "font", "manifest"].includes(request.destination);
  }
  return request.destination === "image";
}

async function staticResponse(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(RUNTIME_NAME);
  const response = await fetchAndCache(cache, request);
  await trimRuntimeCache(cache);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (shouldCacheRequest(request, url)) event.respondWith(staticResponse(request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(RUNTIME_NAME);
    const urls = event.data.urls
      .map((value) => {
        try { return new URL(String(value), self.registration.scope); } catch { return null; }
      })
      .filter((url) => url && url.origin === self.location.origin)
      .map((url) => new Request(url.href, { cache: "reload" }));
    for (const request of urls) {
      try {
        const cached = await caches.match(request);
        if (!cached) await fetchAndCache(cache, request);
      } catch {
        // Opportunistic warmup must not affect the active invitation.
      }
    }
    await trimRuntimeCache(cache);
  })());
});
`;
}
