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
const worldEffects = [
  "window-light",
  "leaf-shadow",
  "station-glow",
  "city-motion",
  "garden-petals",
  "lobby-glint",
  "bridal-sparkle",
  "aisle-light",
  "mirror-glint",
  "banquet-light"
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

describe("wedding event access", () => {
  it("keeps the compact event summary stable and readable", () => {
    const entryRule = styles.match(/\.entry-screen\s*\{([^}]*)}/s)?.[1] ?? "";
    const rule = styles.match(/\.wedding-event-summary--compact\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(entryRule).toContain("grid-template-rows: auto auto minmax(0, 1fr) auto;");
    expect(rule).toContain("min-width: 0;");
    expect(styles).toMatch(/\.wedding-event-summary__venue\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(/\.wedding-event-summary--detail \.wedding-event-summary__venue span\s*\{[^}]*user-select:\s*text;/s);
    expect(styles).toMatch(/\.wedding-event-summary__calendar:focus-visible\s*\{/s);
  });

  it("uses fixed-size icons and non-overlapping calendar actions", () => {
    expect(styles).toMatch(/\.wedding-event-summary svg,\s*\.calendar-save-options svg\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s);
    expect(styles).toMatch(/\.calendar-save-options\s*\{[^}]*display:\s*grid;/s);
    expect(styles).toMatch(/\.calendar-save-options > (?:button|a)[^{]*\{[^}]*min-height:\s*48px;/s);
    expect(styles).toMatch(/\.sheet-backdrop\s*\{[^}]*z-index:\s*40;/s);
    expect(styles).toMatch(/\.bottom-sheet\s*\{[^}]*z-index:\s*41;/s);
  });

  it("adapts event content for short entry viewports", () => {
    expect(styles).toMatch(/@media \(max-height:\s*640px\)[\s\S]*\.wedding-event-summary--compact/);
  });

  it("keeps the complete entry flow visible in short landscape viewports", () => {
    const landscapeBlock = styles.match(
      /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{([\s\S]*?)\n}/
    )?.[1] ?? "";

    expect(landscapeBlock).toContain(".phone-frame:has(.entry-screen)");
    expect(landscapeBlock).toContain(".entry-screen");
    expect(landscapeBlock).toContain("grid-template-columns:");
    expect(landscapeBlock).toContain(".wedding-event-summary--compact");
    expect(landscapeBlock).toContain(".character-customizer");
    expect(landscapeBlock).toContain(".entry-screen__controls");
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

  it("lets zone subtitles wrap on narrow screens without relying on ellipsis", () => {
    const subtitleRule = [...styles.matchAll(/^\.world-zone-summary small\s*\{([^}]*)}/gm)]
      .map((match) => match[1])
      .find((rule) => rule.includes("grid-area: subtitle;")) ?? "";
    const landscapeBlock = styles.match(
      /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{([\s\S]*?)\n}/
    )?.[1] ?? "";

    expect(subtitleRule).toContain("overflow: visible;");
    expect(subtitleRule).toContain("white-space: normal;");
    expect(subtitleRule).not.toContain("text-overflow: ellipsis;");
    expect(subtitleRule).not.toContain("white-space: nowrap;");
    expect(landscapeBlock).toContain(".world-zone-summary small");
    expect(landscapeBlock).toContain("-webkit-line-clamp: 2;");
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
  it("uses pixelated image artwork as the map surface", () => {
    const artworkRule = styles.match(/\.world-map-artwork\s*\{([^}]*)}/s)?.[1] ?? "";
    const backgroundRule = [...styles.matchAll(/\.world-map-artwork__background\s*\{([^}]*)}/gs)]
      .map((match) => match[1])
      .find((rule) => rule.includes("object-fit")) ?? "";

    expect(styles).toContain(".world-map-artwork__background");
    expect(artworkRule).toContain("overflow: hidden;");
    expect(backgroundRule).toContain("object-fit: contain;");
    expect(backgroundRule).toContain("image-rendering: pixelated;");
    expect(backgroundRule).not.toContain("object-fit: fill;");
  });

  it("keeps route DOM transparent so image backgrounds stay visible", () => {
    expect(styles).toMatch(/\.world-path\s*\{[^}]*opacity:\s*0/s);
    expect(styles).toMatch(/\.world-path\s*\{[^}]*pointer-events:\s*none;/s);
    expect(styles).not.toContain("--world-ground:");
    expect(styles).not.toContain("background: var(--world-ground)");
  });

  it("keeps only asset foreground decorations in the map style layer", () => {
    expect(styles).toMatch(/\.world-decoration-layer\s*{[^}]*z-index:\s*1;/s);
    expect(styles).toMatch(/\.world-decoration--asset\s*\{[^}]*object-fit:\s*contain;[^}]*image-rendering:\s*pixelated;[^}]*pointer-events:\s*none;/s);
    expect(styles).not.toMatch(/\.world-decoration--(?!asset\b)[\w-]+/);
    expect(styles).not.toMatch(/\.world-decoration(?!--asset)[^{,]*(::before|::after|>\s*span)/);
  });
});

describe("world character separation", () => {
  it("downscales high-density sprites with transparent edges and a low ground shadow", () => {
    const worldSpriteRule = styles.match(/\.character-sprite--world\s*{([^}]*)}/s)?.[1] ?? "";
    const worldLayerRule = styles.match(
      /\.character-sprite--world \.character-layer\s*{([^}]*)}/s
    )?.[1] ?? "";

    expect(worldLayerRule).toContain("image-rendering: auto;");
    expect(worldSpriteRule).toContain("drop-shadow(1px 2px 1px rgba(36, 24, 18, 0.52))");
    expect(worldSpriteRule).not.toContain("drop-shadow(0 0 1px");
    expect(worldSpriteRule).not.toContain("rgba(255, 246, 224");
    expect(worldSpriteRule).not.toContain("drop-shadow(-1px 0 0");
    expect(worldSpriteRule).not.toContain("drop-shadow(1px 0 0");
  });

  it("keeps pixelated rendering on the base layer while limiting auto to world layers", () => {
    const baseLayerRule = styles.match(/(?:^|\n)\.character-layer\s*{([^}]*)}/m)?.[1] ?? "";
    const worldLayerRule = styles.match(
      /\.character-sprite--world \.character-layer\s*{([^}]*)}/s
    )?.[1] ?? "";

    expect(baseLayerRule).toContain("image-rendering: pixelated;");
    expect(baseLayerRule).not.toContain("image-rendering: auto;");
    expect(worldLayerRule).toContain("image-rendering: auto;");
  });
});

describe("world map image effects", () => {
  it("defines one bounded effect class for every map effect", () => {
    const baseRule = styles.match(/\.world-map-effect\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(baseRule).toContain("pointer-events: none;");

    for (const effect of worldEffects) {
      expect(styles).toContain(`.world-map-effect--${effect}`);
      expect(styles).not.toContain(`.world-map-effect--${effect}::before`);
      expect(styles).not.toContain(`.world-map-effect--${effect}::after`);
    }
  });

  it("limits each effect to subtle opacity, stepped pixel, glow, or window-band motion", () => {
    for (const effect of ["window-light", "lobby-glint", "mirror-glint"]) {
      const rule = styles.match(new RegExp(`\\.world-map-effect--${effect}\\s*\\{([^}]*)}`, "s"))?.[1] ?? "";
      expect(rule, effect).toMatch(/animation:\s*effect-opacity/);
    }

    for (const effect of ["leaf-shadow", "garden-petals", "bridal-sparkle"]) {
      const rule = styles.match(new RegExp(`\\.world-map-effect--${effect}\\s*\\{([^}]*)}`, "s"))?.[1] ?? "";
      expect(rule, effect).toMatch(/animation:\s*effect-pixel-(drift|sparkle)[^;]*steps\(2,\s*end\)/);
    }

    for (const effect of ["station-glow", "aisle-light", "banquet-light"]) {
      const rule = styles.match(new RegExp(`\\.world-map-effect--${effect}\\s*\\{([^}]*)}`, "s"))?.[1] ?? "";
      expect(rule, effect).toMatch(/animation:\s*effect-glow[^;]*steps\(2,\s*end\)/);
    }

    const cityRule = styles.match(/\.world-map-effect--city-motion\s*\{([^}]*)}/s)?.[1] ?? "";
    expect(cityRule).toContain("overflow: hidden;");
    expect(cityRule).toMatch(/animation:\s*effect-city-band[^;]*steps\(2,\s*end\)/);
    expect(styles).toContain("@keyframes effect-opacity");
    expect(styles).toContain("@keyframes effect-pixel-drift");
    expect(styles).toContain("@keyframes effect-pixel-sparkle");
    expect(styles).toContain("@keyframes effect-glow");
    expect(styles).toContain("@keyframes effect-city-band");
  });

  it("stops world map effects when reduced motion is requested", () => {
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.world-map-effect\s*\{[^}]*animation:\s*none !important;/
    );
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
    expect(styles).toContain('.world-journey li[aria-current="location"] .world-journey__button');
    expect(styles).toContain(".world-journey__button:focus-visible");
    expect(styles).toContain(".world-spot::before");
    expect(styles).toContain(".world-spot::after");
    expect(styles).toContain(".world-portal__effect");
    expect(styles).toContain(".world-spot:focus-visible");
    expect(styles).toContain(".world-portal:focus-visible");
  });

  it("draws the spot chevron without adding text to accessible names", () => {
    const spotArrowRule = styles.match(/\.world-spot::after\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(spotArrowRule).toContain('content: "";');
    expect(spotArrowRule).not.toContain('content: ">";');
  });

  it("renders three enhanced tiles with short local sparks and no trapezoid beam styles", () => {
    const effectRule = styles.match(/\.world-portal__effect\s*\{([^}]*)}/s)?.[1] ?? "";
    const tileRule = styles.match(/\.world-portal__tile\s*\{([^}]*)}/s)?.[1] ?? "";
    const runeRule = styles.match(/\.world-portal__tile::before\s*\{([^}]*)}/s)?.[1] ?? "";
    const sparkRule = styles.match(/\.world-portal__tile::after\s*\{([^}]*)}/s)?.[1] ?? "";
    const sparkFrames = styles.match(/@keyframes portal-tile-spark\s*\{([\s\S]*?)\n}/)?.[1] ?? "";

    expect(effectRule).toContain("drop-shadow(0 0 8px var(--portal-glow))");
    expect(tileRule).toContain("width: 30px;");
    expect(tileRule).toContain("height: 30px;");
    expect(tileRule).toContain("--portal-tile-delay: 0s;");
    expect(tileRule).toMatch(/animation:\s*portal-tile-pulse[^;]*var\(--portal-tile-delay\)/);
    expect(runeRule).toContain('content: "";');
    expect(sparkRule).toContain('content: "";');
    expect(sparkRule).toMatch(/animation:\s*portal-tile-spark[^;]*var\(--portal-tile-delay\)/);
    expect(sparkFrames).toContain("translate(-50%, -24px)");
    expect(styles).toMatch(/\.world-portal__tile:nth-child\(2\)\s*\{[^}]*--portal-tile-delay:\s*-0\.38s;/s);
    expect(styles).toMatch(/\.world-portal__tile:nth-child\(3\)\s*\{[^}]*--portal-tile-delay:\s*-0\.76s;/s);
    expect(styles).not.toContain(".world-portal__beam");
    expect(styles).not.toContain(".world-portal__particle");
    expect(styles).not.toContain("portal-beam-rise");
    expect(styles).not.toContain("portal-particle-rise");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.world-portal__tile,[\s\S]*\.world-portal__tile::after\s*\{[^}]*animation:\s*none !important;/
    );
  });

  it("uses the menu prism surface and approved J2 joystick contrast", () => {
    const menuButtonRule = styles.match(/\.world-menu-button\s*\{([^}]*)}/s)?.[1] ?? "";
    const menuSheetRule = styles.match(/\.world-menu-sheet\s*\{([^}]*)}/s)?.[1] ?? "";
    const joystickRule = styles.match(/\.virtual-joystick\s*\{([^}]*)}/s)?.[1] ?? "";
    const thumbRule = styles.match(/\.virtual-joystick__thumb\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(menuButtonRule).toContain("--control-accent:");
    expect(menuSheetRule).toContain("--menu-prism:");
    expect(joystickRule).toContain("--joystick-travel: 26px;");
    expect(thumbRule).toContain("width: 38px;");
    expect(thumbRule).toContain("height: 38px;");
    expect(thumbRule).toContain("saturate(1.16)");
    expect(thumbRule).toContain("drop-shadow(0 2px 0 #743e52)");
    expect(styles).toContain(".world-menu-button:focus-visible");
    expect(styles).toContain(".world-menu-grid button:focus-visible");
    expect(styles).toContain(".virtual-joystick__base");
    expect(styles).toContain(".virtual-joystick__thumb");
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.virtual-joystick\s*\{[^}]*--joystick-travel:\s*21px;/
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.virtual-joystick__thumb\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/
    );
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
