import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("mobile world controls", () => {
  it("uses a viewport-locked game shell with a flexible map", () => {
    const gameWorldRule = styles.match(/\.game-world\s*{([^}]*)}/s)?.[1] ?? "";
    const mapShellRule = styles.match(/\.world-map-shell\s*{([^}]*)}/s)?.[1] ?? "";

    expect(styles).toContain(".app-shell--playing");
    expect(styles).toContain("height: 100dvh;");
    expect(gameWorldRule).toContain("height: 100%;");
    expect(gameWorldRule).toContain("overflow: hidden;");
    expect(mapShellRule).toContain("min-height: 0;");
    expect(mapShellRule).toContain("flex: 1 1 auto;");
  });

  it("overlays controls on the map and respects mobile safe areas", () => {
    const controlRule = styles.match(/\.world-control-dock\s*{([^}]*)}/s)?.[1] ?? "";

    expect(controlRule).toContain("position: absolute;");
    expect(controlRule).toContain("pointer-events: none;");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain(".world-menu-sheet");
  });

  it("keeps the 390 by 720 stage proportional when short screens shrink the map", () => {
    const mapShellRule = styles.match(/\.world-map-shell\s*{([^}]*)}/s)?.[1] ?? "";
    const mapRule = styles.match(/\.world-map\s*{([^}]*)}/s)?.[1] ?? "";
    const stageRule = styles.match(/\.world-map__stage\s*{([^}]*)}/s)?.[1] ?? "";

    expect(mapShellRule).toContain("container-type: size;");
    expect(mapRule).toContain("width: min(100%, calc(100cqh * 13 / 24));");
    expect(stageRule).toContain("width: 390px;");
    expect(stageRule).toContain("height: 720px;");
    expect(stageRule).toContain("scale: calc(100cqw / 390px);");
  });
});

describe("pixel wedding festival map", () => {
  it("gives every zone its own ground and path treatment", () => {
    for (const zone of ["entrance", "ceremony", "gallery", "lounge"]) {
      expect(styles).toContain(`.world-map--${zone} {`);
      expect(styles).toContain(`.world-map--${zone} .world-path`);
    }
  });

  it("styles every festival decoration kind", () => {
    for (const kind of [
      "flower-arch",
      "petal-scatter",
      "butterfly",
      "topiary",
      "string-lights",
      "rose-pillar",
      "gift-stack",
      "dessert-cart",
      "star-garland",
      "flower-fence",
      "lily-cluster",
      "ribbon-post",
      "aisle-bouquet",
      "mosaic-star",
      "tea-chair",
      "party-flag"
    ]) {
      expect(styles).toContain(`.world-decoration--${kind}`);
    }
  });

  it("builds the map from ground, edge, decoration, path, and foreground depth layers", () => {
    expect(styles).toContain(".world-map::before");
    expect(styles).toContain(".world-map::after");
    expect(styles).toMatch(/\.world-decoration-layer\s*{[^}]*z-index:\s*1;/s);
    expect(styles).toMatch(/\.world-path\s*{[^}]*z-index:\s*2;/s);
  });

  it("does not duplicate the whole flower arch as oversized flower blocks", () => {
    const flowerArchRule = styles.match(/\.world-decoration--flower-arch > span\s*{([^}]*)}/s)?.[1] ?? "";

    expect(flowerArchRule).not.toContain("box-shadow");
    expect(flowerArchRule).toContain("background:");
  });

  it("uses stepped ambience and disables it for reduced motion", () => {
    expect(styles).toContain("@keyframes pixel-twinkle");
    expect(styles).toContain("@keyframes pixel-flutter");
    expect(styles).toContain("@keyframes pixel-petals");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.world-decoration--butterfly[\s\S]*animation:\s*none;/
    );
  });
});

describe("world character separation", () => {
  it("adds a crisp light rim and dark pixel shadow only to world sprites", () => {
    const worldSpriteRule = styles.match(/\.character-sprite--world\s*{([^}]*)}/s)?.[1] ?? "";

    expect(worldSpriteRule).toContain("drop-shadow(-1px 0 0");
    expect(worldSpriteRule).toContain("drop-shadow(1px 0 0");
    expect(worldSpriteRule).toContain("drop-shadow(2px 2px 0");
  });
});
