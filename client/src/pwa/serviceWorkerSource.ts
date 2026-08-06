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
  "./characters/generated/guests/world/feminine-long-wave-dress__walk.png",
  "./characters/puppets/bride/rig.json",
  "./characters/puppets/bride/body.webp",
  "./characters/puppets/bride/head-open.webp",
  "./characters/puppets/bride/head-blink.webp",
  "./characters/puppets/bride/preview.webp",
  "./characters/puppets/groom/rig.json",
  "./characters/puppets/groom/body.webp",
  "./characters/puppets/groom/head-open.webp",
  "./characters/puppets/groom/head-blink.webp",
  "./characters/puppets/groom/preview.webp"
] as const;

function relativeAssetPath(fileName: string): string {
  return fileName.startsWith("./") ? fileName : `./${fileName.replace(/^\/+/, "")}`;
}

const adminOnlyBundlePattern = /(?:AdminPage|AdminNotificationInbox|papaparse|inviteLinkAdminTokens|attendanceOperations)/i;
const gameFeatureBundlePattern = /(?:WeddingPhotoBooth|WeddingPhotoAlbum|GameMemoryAlbum|CelebrationCollectionGuide|CompanionDestinationSheet|CompanionWaitingRoom|JourneyRouteSheet)/i;

export function resolvePwaPrecachePaths(bundleFileNames: readonly string[]): string[] {
  const buildAssets = bundleFileNames
    .filter((fileName) => (
      /\.(?:css|js)$/i.test(fileName)
      && !adminOnlyBundlePattern.test(fileName)
      && !gameFeatureBundlePattern.test(fileName)
    ))
    .map(relativeAssetPath);
  return [...new Set([...pwaCorePrecachePaths, ...buildAssets])];
}

export function resolvePwaFeaturePrecachePaths(bundleFileNames: readonly string[]): string[] {
  return [...new Set(bundleFileNames
    .filter((fileName) => /\.(?:css|js)$/i.test(fileName) && gameFeatureBundlePattern.test(fileName))
    .map(relativeAssetPath))];
}

export function createPwaServiceWorkerSource(
  version: string,
  precachePaths: readonly string[],
  featurePaths: readonly string[] = []
): string {
  return `const VERSION = ${JSON.stringify(version)};
const CACHE_PREFIX = "wedding-garden";
const PRECACHE_NAME = \`${"${CACHE_PREFIX}"}-precache-${"${VERSION}"}\`;
const RUNTIME_NAME = \`${"${CACHE_PREFIX}"}-runtime-${"${VERSION}"}\`;
const ZONE_NAME = \`${"${CACHE_PREFIX}"}-zones-v1\`;
const PRECACHE_URLS = ${JSON.stringify(precachePaths)};
const FEATURE_URLS = ${JSON.stringify(featurePaths)};
const RUNTIME_LIMIT = 120;
const pausedZoneIds = new Set();

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

function validZoneId(value) {
  return typeof value === "string" && /^[a-z0-9-]{2,40}$/.test(value);
}

function sameOriginRequests(urls) {
  if (!Array.isArray(urls)) return [];
  return [...new Set(urls.map((value) => {
    try {
      const url = new URL(String(value), self.registration.scope);
      return url.origin === self.location.origin ? url.href : null;
    } catch {
      return null;
    }
  }).filter(Boolean))].map((url) => new Request(url, { cache: "reload" }));
}

function zoneMetaRequest(zoneId) {
  return new Request(scopedUrl(\`./__offline-zone-version__/${"${zoneId}"}\`));
}

async function zoneCacheMetadata(cache, zoneId) {
  const response = await cache.match(zoneMetaRequest(zoneId));
  if (!response) return { version: "", cachedAt: 0 };
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return {
      version: typeof parsed?.version === "string" ? parsed.version : "",
      cachedAt: Number.isFinite(parsed?.cachedAt) ? Math.max(0, parsed.cachedAt) : 0
    };
  } catch {
    return { version: text, cachedAt: 0 };
  }
}

async function zoneCacheIsCurrent(cache, zoneId) {
  return (await zoneCacheMetadata(cache, zoneId)).version === VERSION;
}

async function responseBytes(response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 0) return contentLength;
  try { return (await response.clone().arrayBuffer()).byteLength; } catch { return 0; }
}

async function prepareZoneCache(zoneId, urls) {
  if (!validZoneId(zoneId)) return;
  const requests = sameOriginRequests(urls);
  const cache = await caches.open(ZONE_NAME);
  const currentVersion = await zoneCacheIsCurrent(cache, zoneId);
  if (!currentVersion) await Promise.all(requests.map((request) => cache.delete(request)));
  let completed = 0;
  let bytes = 0;
  await broadcast({ type: "PWA_ZONE_CACHE_PROGRESS", zoneId, completed, total: requests.length, bytes });
  try {
    for (const request of requests) {
      if (pausedZoneIds.has(zoneId)) {
        await cache.put(zoneMetaRequest(zoneId), new Response(JSON.stringify({ version: VERSION, cachedAt: 0, partial: true }), {
          headers: { "Content-Type": "application/json; charset=utf-8" }
        }));
        await broadcast({ type: "PWA_ZONE_CACHE_PAUSED", zoneId, completed, total: requests.length, bytes });
        return;
      }
      let response = currentVersion ? await cache.match(request) : null;
      if (!response) response = await cache.match(request);
      if (!response) {
        response = await fetch(request);
        if (!response.ok) throw new Error(\`HTTP ${"${response.status}"}\`);
        await cache.put(request, response.clone());
      }
      completed += 1;
      bytes += await responseBytes(response);
      await broadcast({ type: "PWA_ZONE_CACHE_PROGRESS", zoneId, completed, total: requests.length, bytes });
    }
    const cachedAt = Date.now();
    await cache.put(zoneMetaRequest(zoneId), new Response(JSON.stringify({ version: VERSION, cachedAt }), {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    }));
    await broadcast({ type: "PWA_ZONE_CACHE_READY", zoneId, completed, total: requests.length, bytes, cachedAt });
  } catch {
    await broadcast({ type: "PWA_ZONE_CACHE_ERROR", zoneId, completed, total: requests.length, bytes });
  }
}

async function removeZoneCache(zoneId, urls) {
  if (!validZoneId(zoneId)) return;
  const cache = await caches.open(ZONE_NAME);
  await Promise.all(sameOriginRequests(urls).map((request) => cache.delete(request)));
  await cache.delete(zoneMetaRequest(zoneId));
  await broadcast({ type: "PWA_ZONE_CACHE_REMOVED", zoneId, completed: 0, total: 0, bytes: 0 });
}

async function reportZoneCaches(groups) {
  if (!groups || typeof groups !== "object") return;
  const cache = await caches.open(ZONE_NAME);
  for (const [zoneId, urls] of Object.entries(groups)) {
    if (!validZoneId(zoneId)) continue;
    const requests = sameOriginRequests(urls);
    const responses = await Promise.all(requests.map((request) => cache.match(request)));
    const completed = responses.filter(Boolean).length;
    const metadata = await zoneCacheMetadata(cache, zoneId);
    const currentVersion = metadata.version === VERSION;
    const bytes = (await Promise.all(responses.filter(Boolean).map(responseBytes)))
      .reduce((sum, value) => sum + value, 0);
    await broadcast({
      type: "PWA_ZONE_CACHE_STATE",
      zoneId,
      state: requests.length > 0 && completed === requests.length
        ? currentVersion ? "ready" : "outdated"
        : "idle",
      completed,
      total: requests.length,
      bytes,
      cachedAt: metadata.cachedAt
    });
  }
}

async function prepareZoneGroups(groups) {
  if (!groups || typeof groups !== "object") return;
  for (const [zoneId, urls] of Object.entries(groups)) {
    await prepareZoneCache(zoneId, urls);
  }
}

async function removeZoneGroups(groups) {
  if (!groups || typeof groups !== "object") return;
  for (const [zoneId, urls] of Object.entries(groups)) {
    await removeZoneCache(zoneId, urls);
  }
}

async function prepareOfflineCache() {
  const cache = await caches.open(PRECACHE_NAME);
  let completed = 0;
  let failed = 0;
  await broadcast({ type: "PWA_CACHE_PROGRESS", completed, total: PRECACHE_URLS.length });

  for (const path of PRECACHE_URLS) {
    const request = new Request(scopedUrl(path), { cache: "reload" });
    try {
      const response = await fetch(request);
      if (!response.ok) throw new Error(\`HTTP ${"${response.status}"}\`);
      await cache.put(request, response);
      completed += 1;
      await broadcast({ type: "PWA_CACHE_PROGRESS", completed, total: PRECACHE_URLS.length });
    } catch {
      failed += 1;
    }
  }

  await broadcast({
    type: failed > 0 ? "PWA_CACHE_ERROR" : "PWA_CACHE_READY",
    completed,
    total: PRECACHE_URLS.length,
    failed
  });
}

async function reportOfflineCacheState() {
  const matches = await Promise.all(PRECACHE_URLS.map((path) => caches.match(scopedUrl(path))));
  const completed = matches.filter(Boolean).length;
  await broadcast({
    type: completed === PRECACHE_URLS.length ? "PWA_CACHE_READY" : "PWA_CACHE_ERROR",
    completed,
    total: PRECACHE_URLS.length,
    failed: PRECACHE_URLS.length - completed
  });
}

async function prepareFeatureCache() {
  const cache = await caches.open(PRECACHE_NAME);
  let completed = 0;
  let failed = 0;
  await broadcast({ type: "PWA_FEATURE_CACHE_PROGRESS", completed, total: FEATURE_URLS.length });
  for (const path of FEATURE_URLS) {
    const request = new Request(scopedUrl(path), { cache: "reload" });
    try {
      const response = await fetch(request);
      if (!response.ok) throw new Error(\`HTTP ${"${response.status}"}\`);
      await cache.put(request, response);
      completed += 1;
      await broadcast({ type: "PWA_FEATURE_CACHE_PROGRESS", completed, total: FEATURE_URLS.length });
    } catch {
      failed += 1;
    }
  }
  await broadcast({
    type: failed > 0 ? "PWA_FEATURE_CACHE_ERROR" : "PWA_FEATURE_CACHE_READY",
    completed,
    total: FEATURE_URLS.length
  });
}

async function reportFeatureCacheState() {
  const matches = await Promise.all(FEATURE_URLS.map((path) => caches.match(scopedUrl(path))));
  const completed = matches.filter(Boolean).length;
  await broadcast({
    type: completed === FEATURE_URLS.length ? "PWA_FEATURE_CACHE_READY" : "PWA_FEATURE_CACHE_ERROR",
    completed,
    total: FEATURE_URLS.length
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await prepareOfflineCache();
    await prepareFeatureCache();
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const currentCaches = new Set([PRECACHE_NAME, RUNTIME_NAME, ZONE_NAME]);
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && !currentCaches.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
    await reportOfflineCacheState();
    await reportFeatureCacheState();
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
  if (event.data?.type === "CACHE_GAME_FEATURES") {
    event.waitUntil(prepareFeatureCache());
    return;
  }
  if (event.data?.type === "CACHE_CORE") {
    event.waitUntil(prepareOfflineCache());
    return;
  }
  if (event.data?.type === "CACHE_ZONE_ASSETS") {
    pausedZoneIds.delete(event.data.zoneId);
    event.waitUntil(prepareZoneCache(event.data.zoneId, event.data.urls));
    return;
  }
  if (event.data?.type === "PAUSE_ZONE_ASSETS") {
    if (validZoneId(event.data.zoneId)) pausedZoneIds.add(event.data.zoneId);
    return;
  }
  if (event.data?.type === "REMOVE_ZONE_ASSETS") {
    event.waitUntil(removeZoneCache(event.data.zoneId, event.data.urls));
    return;
  }
  if (event.data?.type === "REPORT_ZONE_ASSETS") {
    event.waitUntil(reportZoneCaches(event.data.groups));
    return;
  }
  if (event.data?.type === "CACHE_ZONE_GROUPS") {
    if (event.data.groups && typeof event.data.groups === "object") {
      Object.keys(event.data.groups).filter(validZoneId).forEach((zoneId) => pausedZoneIds.delete(zoneId));
    }
    event.waitUntil(prepareZoneGroups(event.data.groups));
    return;
  }
  if (event.data?.type === "PAUSE_ZONE_GROUPS") {
    if (event.data.groups && typeof event.data.groups === "object") {
      Object.keys(event.data.groups).filter(validZoneId).forEach((zoneId) => pausedZoneIds.add(zoneId));
    }
    return;
  }
  if (event.data?.type === "REMOVE_ZONE_GROUPS") {
    event.waitUntil(removeZoneGroups(event.data.groups));
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
