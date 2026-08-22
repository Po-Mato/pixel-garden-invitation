import { describe, expect, it } from "vitest";
import { guest01AssetRevision } from "../character/assetRevisions";
import {
  createPwaServiceWorkerSource,
  pwaCorePrecachePaths,
  pwaDefaultGuestAssetRevision,
  pwaDefaultGuestSelectionIdlePath,
  resolvePwaFeaturePrecachePaths,
  resolvePwaPrecachePaths
} from "./serviceWorkerSource";

describe("PWA service worker source", () => {
  it("pre-caches the same revision used by the default guest preset", () => {
    expect(pwaDefaultGuestAssetRevision).toBe(guest01AssetRevision);
  });

  it("combines required offline assets with generated scripts and styles once", () => {
    const bundlePaths = [
      "assets/index-abc.js",
      "assets/index-abc.js",
      "assets/chunk-shared.js",
      "assets/GameWorld-def.css",
      "assets/GameMemoryAlbum-feature.js",
      "assets/RsvpAdminPage-private.js",
      "assets/papaparse.min-private.js",
      "assets/gowun-dodum-critical-hash.woff2",
      "assets/noto-sans-kr-119-wght-normal-hash.woff2",
      "assets/entry-wedding-garden-hero-hash.avif",
      "assets/cover.webp",
      "index.html"
    ];
    const paths = resolvePwaPrecachePaths(bundlePaths, [
      "assets/index-abc.js",
      "assets/chunk-shared.js",
      "assets/GameWorld-def.css"
    ]);

    expect(paths).toEqual([
      ...pwaCorePrecachePaths,
      "./assets/index-abc.js",
      "./assets/chunk-shared.js",
      "./assets/GameWorld-def.css",
      "./assets/gowun-dodum-critical-hash.woff2",
      "./assets/noto-sans-kr-119-wght-normal-hash.woff2",
      "./assets/entry-wedding-garden-hero-hash.avif"
    ]);
    expect(paths).toContain("./manifest.webmanifest");
    expect(paths).toContain("./assets/maps/v2/home/background.webp");
    expect(paths).toContain("./characters/puppets/bride/rig.json");
    expect(paths).toContain("./characters/puppets/groom/head-blink.webp");
    expect(paths).toContain(pwaDefaultGuestSelectionIdlePath);
    expect(paths.filter((path) => path === pwaDefaultGuestSelectionIdlePath)).toHaveLength(1);
    expect(pwaDefaultGuestSelectionIdlePath.endsWith(`?v=${pwaDefaultGuestAssetRevision}`)).toBe(true);
    expect(paths).toContain(
      `./characters/generated/guests/feminine-long-wave-dress__idle.png?v=${pwaDefaultGuestAssetRevision}`
    );
    expect(paths).toContain(
      `./characters/generated/guests/feminine-long-wave-dress__walk.png?v=${pwaDefaultGuestAssetRevision}`
    );
    expect(paths).toContain("./assets/gowun-dodum-critical-hash.woff2");
    expect(paths).toContain("./assets/noto-sans-kr-119-wght-normal-hash.woff2");
    expect(paths).toContain("./assets/entry-wedding-garden-hero-hash.avif");
    expect(paths).not.toContain("./assets/RsvpAdminPage-private.js");
    expect(paths).not.toContain("./assets/papaparse.min-private.js");
    expect(paths).not.toContain("./assets/GameMemoryAlbum-feature.js");
    expect(resolvePwaFeaturePrecachePaths([
      "assets/GameMemoryAlbum-feature.js",
      "assets/CompanionDestinationSheet-feature.js",
      "assets/CompanionWaitingRoom-feature.js",
      "assets/RsvpAdminPage-private.js"
    ])).toEqual([
      "./assets/GameMemoryAlbum-feature.js",
      "./assets/CompanionDestinationSheet-feature.js",
      "./assets/CompanionWaitingRoom-feature.js"
    ]);
  });

  it("emits valid JavaScript with navigation fallback, bounded runtime caching, and update messages", () => {
    const source = createPwaServiceWorkerSource(
      "release-123",
      ["./", "./assets/index.js"],
      ["./assets/GameMemoryAlbum.js"]
    );

    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('const VERSION = "release-123"');
    expect(source).toContain('if (request.method !== "GET") return');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain('request.destination === "image"');
    expect(source).toContain('const RUNTIME_LIMIT = 120');
    expect(source).toContain('event.data?.type === "SKIP_WAITING"');
    expect(source).toContain('event.data?.type !== "CACHE_URLS"');
    expect(source).toContain('event.data?.type === "CACHE_GAME_FEATURES"');
    expect(source).toContain('event.data?.type === "CACHE_CORE"');
    expect(source).toContain('event.data?.type === "CACHE_ZONE_ASSETS"');
    expect(source).toContain('event.data?.type === "PAUSE_ZONE_ASSETS"');
    expect(source).toContain('event.data?.type === "REMOVE_ZONE_ASSETS"');
    expect(source).toContain('event.data?.type === "CACHE_ZONE_GROUPS"');
    expect(source).toContain('event.data?.type === "PAUSE_ZONE_GROUPS"');
    expect(source).toContain('event.data?.type === "REMOVE_ZONE_GROUPS"');
    expect(source).toContain('"outdated"');
    expect(source).toContain("__offline-zone-version__");
    expect(source).toContain("cachedAt");
    expect(source).toContain('"PWA_FEATURE_CACHE_PROGRESS"');
    expect(source).toContain("reportOfflineCacheState");
    expect(source).toContain("ignoreVary: true");
    expect(source).toContain("prepareOfflineCache({ atomic: true })");
    expect(source).toContain("await caches.delete(PRECACHE_NAME)");
    expect(source).toContain("PWA core precache incomplete");
    expect(source).toContain('type: failed > 0 ? "PWA_CACHE_ERROR" : "PWA_CACHE_READY"');
    const installHandler = source.slice(
      source.indexOf('self.addEventListener("install"'),
      source.indexOf('self.addEventListener("activate"')
    );
    expect(installHandler).not.toContain("prepareFeatureCache");
    expect(source).not.toContain("POST");
  });
});
