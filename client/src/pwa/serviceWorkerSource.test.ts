import { describe, expect, it } from "vitest";
import {
  createPwaServiceWorkerSource,
  pwaCorePrecachePaths,
  resolvePwaPrecachePaths
} from "./serviceWorkerSource";

describe("PWA service worker source", () => {
  it("combines required offline assets with generated scripts and styles once", () => {
    const paths = resolvePwaPrecachePaths([
      "assets/index-abc.js",
      "assets/index-abc.js",
      "assets/GameWorld-def.css",
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
  });

  it("emits valid JavaScript with navigation fallback, bounded runtime caching, and update messages", () => {
    const source = createPwaServiceWorkerSource("release-123", ["./", "./assets/index.js"]);

    expect(() => new Function(source)).not.toThrow();
    expect(source).toContain('const VERSION = "release-123"');
    expect(source).toContain('if (request.method !== "GET") return');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain('request.destination === "image"');
    expect(source).toContain('const RUNTIME_LIMIT = 120');
    expect(source).toContain('event.data?.type === "SKIP_WAITING"');
    expect(source).toContain('event.data?.type !== "CACHE_URLS"');
    expect(source).not.toContain("POST");
  });
});
