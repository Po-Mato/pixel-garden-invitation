import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");
const worldZones = [
  "home",
  "neighborhood",
  "subway-station",
  "subway-train",
  "venue-exterior",
  "lobby",
  "bridal-room",
  "ceremony-hall",
  "restroom",
  "banquet"
];

describe("entry screen layout", () => {
  it("locks the entry document to the dynamic viewport", () => {
    const documentRule = styles.match(
      /html:has\(\.app-shell:not\(\.app-shell--playing\)\),\s*body:has\(\.app-shell:not\(\.app-shell--playing\)\)\s*\{([^}]*)}/s
    )?.[1] ?? "";
    const entryRule = styles.match(/\.entry-screen\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(documentRule).toContain("height: 100dvh;");
    expect(documentRule).toContain("overflow: hidden;");
    expect(entryRule).toContain("height: 100%;");
    expect(entryRule).toContain("overflow: hidden;");
    expect(styles).toMatch(/\.app-shell:not\(\.app-shell--playing\)\s*\{[^}]*position:\s*fixed;/s);
  });

  it("uses one horizontally scrollable snapping row for character choices", () => {
    const optionsRule = styles.match(/\.customizer-options--images\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(optionsRule).toContain("grid-auto-flow: column;");
    expect(optionsRule).toContain("overflow-x: auto;");
    expect(optionsRule).toContain("overflow-y: hidden;");
    expect(optionsRule).toContain("scroll-snap-type: x mandatory;");
  });

  it("keeps readable entry content above decorative layers", () => {
    expect(styles).toMatch(/\.entry-screen__ambient\s*\{[^}]*z-index:\s*0;[^}]*pointer-events:\s*none;/s);
    expect(styles).toMatch(/\.entry-screen__header\s*\{[^}]*z-index:\s*2;/s);
    expect(styles).toMatch(/\.character-customizer__selected-name\s*\{[^}]*z-index:\s*5;[^}]*background:/s);
    expect(styles).toMatch(/\.entry-screen__controls\s*\{[^}]*z-index:\s*3;/s);
  });

  it("keeps Korean preset names readable in at most two lines", () => {
    const labelRule = styles.match(/\.customizer-option__label\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(labelRule).toContain("word-break: keep-all;");
    expect(labelRule).toContain("-webkit-line-clamp: 2;");
  });

  it("adapts the entry composition for short mobile viewports", () => {
    expect(styles).toMatch(/@media \(max-height:\s*640px\)[\s\S]*\.character-customizer/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*entry-prism/);
  });
});

describe("wedding invitation palette", () => {
  it("defines restrained paper, camellia, sage, ink and gold tokens", () => {
    for (const token of ["--paper", "--camellia", "--sage", "--ink", "--gold"]) {
      expect(styles).toContain(token);
    }
  });

  it("removes the candy-colored map and rainbow path palette", () => {
    for (const color of ["#c9eca9", "#99d18b", "#d8c9ee", "#f6d6ba", "#e4daf0", "#e8d9ed"]) {
      expect(styles).not.toContain(color);
    }

    expect(styles).toContain("--aisle-ivory");
    expect(styles).toContain("--garden-deep");
  });
});

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

  it("uses a fixed viewport with an actual-size camera stage", () => {
    const mapRule = styles.match(/\.world-map\s*{([^}]*)}/s)?.[1] ?? "";
    const stageRule = styles.match(/\.world-map__stage\s*{([^}]*)}/s)?.[1] ?? "";

    expect(mapRule).toContain("width: 100%;");
    expect(mapRule).toContain("height: 100%;");
    expect(mapRule).toContain("overflow: hidden;");
    expect(stageRule).toContain("transform-origin: 0 0;");
    expect(stageRule).toContain("will-change: transform;");
    expect(stageRule).not.toContain("width: 390px;");
    expect(stageRule).not.toContain("height: 720px;");
    expect(stageRule).not.toContain("scale: calc(");
  });

  it("pins a display-only minimap to the upper-right map corner", () => {
    const minimapRule = styles.match(/\.world-minimap\s*{([^}]*)}/s)?.[1] ?? "";

    expect(minimapRule).toContain("position: absolute;");
    expect(minimapRule).toContain("top: 10px;");
    expect(minimapRule).toContain("right: 10px;");
    expect(minimapRule).toContain("pointer-events: auto;");
    expect(styles).toContain(".world-minimap__viewport");
    expect(styles).toContain(".world-minimap__portal--target");
  });
});

describe("responsive play viewport", () => {
  it("locks the document and playing shell to the dynamic viewport", () => {
    const playingDocumentRule = styles.match(
      /html:has\(\.app-shell--playing\),\s*body:has\(\.app-shell--playing\)\s*\{([^}]*)}/s
    )?.[1] ?? "";
    const playingShellRule = styles.match(/\.app-shell--playing\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(playingDocumentRule).toContain("height: 100dvh;");
    expect(playingDocumentRule).toContain("min-height: 0;");
    expect(playingDocumentRule).toContain("overflow: hidden;");
    expect(playingDocumentRule).toContain("overscroll-behavior: none;");
    expect(playingShellRule).toContain("position: fixed;");
    expect(playingShellRule).toContain("inset: 0;");
  });

  it("uses a side HUD so short landscape screens keep the map readable", () => {
    const landscapeBlock = styles.match(
      /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{([\s\S]*?)\n}/
    )?.[1] ?? "";

    expect(landscapeBlock).toContain(".phone-frame--playing");
    expect(landscapeBlock).toContain(".game-world");
    expect(landscapeBlock).toContain("grid-template-columns:");
    expect(landscapeBlock).toContain(".world-hud");
    expect(landscapeBlock).toContain(".world-map-shell");
  });
});

describe("pixel wedding festival map", () => {
  it("preserves map artwork aspect ratios while retaining a fallback background", () => {
    const artworkRule = styles.match(/\.world-map-artwork\s*\{([^}]*)}/s)?.[1] ?? "";
    const backgroundRule = [...styles.matchAll(/\.world-map-artwork__background\s*\{([^}]*)}/gs)]
      .map((match) => match[1])
      .find((rule) => rule.includes("object-fit")) ?? "";

    expect(artworkRule).toContain("overflow: hidden;");
    expect(backgroundRule).toContain("object-fit: contain;");
    expect(backgroundRule).not.toContain("object-fit: fill;");
  });

  it("gives every zone its own ground and path treatment", () => {
    for (const zone of worldZones) {
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
      "party-flag",
      "sofa",
      "door",
      "window",
      "shoe-rack",
      "crosswalk-sign",
      "station-sign",
      "ticket-gate",
      "train-seat",
      "train-window",
      "venue-sign",
      "reception-desk",
      "photo-wall",
      "vanity",
      "mirror",
      "restroom-sink",
      "stall",
      "ceremony-seat",
      "altar",
      "banquet-table",
      "buffet"
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

describe("dawn prism fine pixel map", () => {
  it("uses fine ground texture variables instead of 30px visual tiles", () => {
    for (const zone of worldZones) {
      const rule = styles.match(new RegExp(`\\.world-map--${zone}\\s*\\{([^}]*)}`, "s"))?.[1] ?? "";

      expect(rule).toMatch(/--ground-pixel:\s*(6px|8px);/);
      expect(rule).not.toContain("30px");
    }
  });

  it("adds pearl light and drifting prism dust behind interactive elements", () => {
    expect(styles).toContain(".world-map__stage::before");
    expect(styles).toContain(".world-map__stage::after");
    expect(styles).toContain("@keyframes prism-drift");
  });

  it("uses four-pixel mosaics and thin colored edging on every zone path", () => {
    for (const zone of worldZones) {
      const rule = styles.match(new RegExp(`\\.world-map--${zone} \\.world-path\\s*\\{([^}]*)}`, "s"))?.[1] ?? "";

      expect(rule).toContain("--path-pixel: 4px;");
      expect(rule).toMatch(/inset 0 0 0 (1px|2px) var\(--path-edge\)/);
      expect(rule).not.toMatch(/12px|15px/);
    }
  });

  it("animates fine water highlights and disables new ambience for reduced motion", () => {
    expect(styles).toContain("@keyframes water-shimmer");
    expect(styles).toMatch(/\.world-decoration--pond > span[\s\S]*animation:\s*water-shimmer/);
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.world-map__stage::after[\s\S]*animation:\s*none;/
    );
  });

  it("uses thin colored outlines and shared highlight tones on decorative objects", () => {
    const decorationRule = styles.match(/\.world-decoration\s*{([^}]*)}/s)?.[1] ?? "";
    expect(decorationRule).toContain("--ornament-outline:");
    expect(decorationRule).toContain("--ornament-highlight:");
    expect(decorationRule).toContain("--ornament-glow:");

    for (const kind of ["flower-bed", "pond", "fountain", "photo-frame", "mosaic-star"]) {
      const rule = styles.match(new RegExp(`\\.world-decoration--${kind}\\s*\\{([^}]*)}`, "s"))?.[1] ?? "";
      expect(rule, kind).toMatch(/border:\s*(1px|2px) solid/);
      expect(rule, kind).not.toMatch(/border:\s*[3-5]px/);
    }

    for (const kind of ["banner", "string-lights", "star-garland", "party-flag"]) {
      const rule = styles.match(new RegExp(`\\.world-decoration--${kind}[^}]*\\{([^}]*)}`, "s"))?.[1] ?? "";
      expect(rule, kind).toMatch(/border-top:\s*(1px|2px) solid var\(--ornament-outline\)/);
    }

    const fenceRule = styles.match(/\.world-decoration--flower-fence\s*\{([^}]*)}/s)?.[1] ?? "";
    expect(fenceRule).toMatch(/border-bottom:\s*2px solid var\(--ornament-outline\)/);
  });
});

describe("prism map interactions", () => {
  it("gives the journey, spots, and portals distinct prism accents and keyboard focus", () => {
    const journeyRule = styles.match(/\.world-journey\s*\{([^}]*)}/s)?.[1] ?? "";
    const spotRule = styles.match(/\.world-spot\s*\{([^}]*)}/s)?.[1] ?? "";
    const portalRule = styles.match(/\.world-portal\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(journeyRule).toContain("overflow-x: auto;");
    expect(spotRule).toContain("--spot-accent:");
    expect(portalRule).toContain("--portal-accent:");
    expect(styles).toContain('.world-journey li[aria-current="location"]');
    expect(styles).toContain(".world-spot::before");
    expect(styles).toContain(".world-spot::after");
    expect(styles).toContain(".world-portal::after");
    expect(styles).toContain(".world-spot:focus-visible");
    expect(styles).toContain(".world-portal:focus-visible");
  });

  it("draws decorative chevrons without adding text to accessible names", () => {
    const spotArrowRule = styles.match(/\.world-spot::after\s*\{([^}]*)}/s)?.[1] ?? "";
    const portalArrowRule = styles.match(/\.world-portal::after\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(spotArrowRule).toContain('content: "";');
    expect(portalArrowRule).toContain('content: "";');
    expect(spotArrowRule).not.toContain('content: ">";');
    expect(portalArrowRule).not.toContain('content: ">";');
  });

  it("uses the same prism surface language for the menu and joystick", () => {
    const menuButtonRule = styles.match(/\.world-menu-button\s*\{([^}]*)}/s)?.[1] ?? "";
    const menuSheetRule = styles.match(/\.world-menu-sheet\s*\{([^}]*)}/s)?.[1] ?? "";
    const joystickRule = styles.match(/\.virtual-joystick\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(menuButtonRule).toContain("--control-accent:");
    expect(menuSheetRule).toContain("--menu-prism:");
    expect(joystickRule).toContain("--joystick-accent:");
    expect(styles).toContain(".world-menu-button:focus-visible");
    expect(styles).toContain(".world-menu-grid button:focus-visible");
    expect(styles).toContain(".virtual-joystick::before");
    expect(styles).toContain("@media (hover: hover) and (pointer: fine)");
  });

  it("keeps interaction sheets inside the viewport with prism form controls", () => {
    const sheetRule = styles.match(/\.bottom-sheet\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(sheetRule).toContain("--sheet-prism:");
    expect(sheetRule).toContain("max-height: calc(100dvh - 24px);");
    expect(sheetRule).toContain("overflow-y: auto;");
    expect(styles).toContain(".bottom-sheet .field input:focus-visible");
    expect(styles).toContain(".bottom-sheet__header button:focus-visible");
    expect(styles).toContain(".bottom-sheet .primary-button");
  });
});
