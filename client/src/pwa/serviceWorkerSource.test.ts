import { describe, expect, it } from "vitest";
import {
  createPwaServiceWorkerSource,
  pwaCorePrecachePaths,
  resolvePwaFeaturePrecachePaths,
  resolvePwaPrecachePaths
} from "./serviceWorkerSource";

describe("PWA service worker source", () => {
  it("combines required offline assets with generated scripts and styles once", () => {
    const paths = resolvePwaPrecachePaths([
      "assets/index-abc.js",
      "assets/index-abc.js",
      "assets/GameWorld-def.css",
      "assets/GameMemoryAlbum-feature.js",
      "assets/RsvpAdminPage-private.js",
      "assets/papaparse.min-private.js",
      "assets/cover.webp",
      "index.html"
    ]);

    expect(paths).toEqual([
      ...pwaCorePrecachePaths,
      "./assets/index-abc.js",
      "./assets/GameWorld-def.css"
    ]);
    expect(paths).toContain("./manifest.webmanifest");
    expect(paths).toContain("./assets/maps/v2/home/background.webp");
    expect(paths).toContain("./characters/puppets/bride/rig.json");
    expect(paths).toContain("./characters/puppets/groom/head-blink.webp");
    expect(paths).not.toContain("./assets/RsvpAdminPage-private.js");
    expect(paths).not.toContain("./assets/papaparse.min-private.js");
    expect(paths).not.toContain("./assets/GameMemoryAlbum-feature.js");
    expect(resolvePwaFeaturePrecachePaths([
      "assets/index-abc.js",
      "assets/GameMemoryAlbum-feature.js",
      "assets/CompanionDestinationSheet-feature.js"
    ])).toEqual([
      "./assets/GameMemoryAlbum-feature.js",
      "./assets/CompanionDestinationSheet-feature.js"
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
    expect(source).toContain('"PWA_FEATURE_CACHE_PROGRESS"');
    expect(source).not.toContain("POST");
  });
});
