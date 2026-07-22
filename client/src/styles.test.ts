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

describe("private RSVP administration layout", () => {
  it("uses a viewport-safe operational layout without horizontal overflow", () => {
    const pageRule = styles.match(/\.rsvp-admin-page\s*\{([^}]*)}/s)?.[1] ?? "";
    const shellRule = styles.match(/\.rsvp-admin-shell\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(pageRule).toContain("min-height: 100dvh;");
    expect(pageRule).toContain("overflow-x: hidden;");
    expect(shellRule).toContain("min-width: 0;");
    expect(styles).toMatch(/\.rsvp-admin-table-wrap\s*\{[^}]*max-width:\s*100%;/s);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.rsvp-admin-table thead/);
    expect(styles).toMatch(/@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*\.rsvp-admin-page/);
  });

  it("keeps all administrator controls accessible by touch and keyboard", () => {
    expect(styles).toMatch(/\.rsvp-admin-page button,[\s\S]*\.rsvp-admin-page input,[\s\S]*\.rsvp-admin-page select\s*\{[^}]*min-height:\s*44px;/s);
    expect(styles).toContain(".rsvp-admin-page button:focus-visible");
    expect(styles).toContain(".rsvp-admin-page input:focus-visible");
    expect(styles).toContain(".rsvp-admin-page select:focus-visible");
  });

  it("respects every safe-area inset on portrait and short landscape screens", () => {
    const pageRule = styles.match(/\.rsvp-admin-page\s*\{([^}]*)}/s)?.[1] ?? "";
    const narrowBlock = styles.match(/@media \(max-width:\s*390px\)\s*\{([\s\S]*?)\n}/)?.[1] ?? "";
    const landscapeBlock = styles.match(/@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{([\s\S]*?)\n}/)?.[1] ?? "";

    for (const inset of ["top", "right", "bottom", "left"]) {
      expect(pageRule).toContain(`env(safe-area-inset-${inset})`);
      expect(narrowBlock).toContain(`env(safe-area-inset-${inset})`);
      expect(landscapeBlock).toContain(`env(safe-area-inset-${inset})`);
    }
  });
});

describe("entry screen layout", () => {
  it("provides keyboard skip navigation and a visible focus treatment", () => {
    expect(styles).toMatch(/\.skip-link\s*\{[^}]*min-height:\s*44px;/s);
    expect(styles).toMatch(/\.skip-link:focus-visible\s*\{[^}]*transform:\s*translateY\(0\);/s);
    expect(styles).toContain("@media (forced-colors: active)");
  });

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

  it("keeps high-density entry characters clear without clipping or fractional final sizes", () => {
    expect(styles).toMatch(
      /\.character-sprite--preview,[\s\S]*?\.character-sprite--thumbnail \.character-layer\s*\{[^}]*image-rendering:\s*auto;/s
    );
    expect(styles).toMatch(
      /\.character-sprite--preview,\s*\.character-sprite--thumbnail\s*\{[^}]*transform:\s*none;/s
    );
    expect(styles).toMatch(
      /@media \(max-height:\s*640px\)[\s\S]*?\.customizer-option__sprite\s*\{[^}]*height:\s*72px;/s
    );
    expect(styles).toContain("scale(0.75)");
    expect(styles).toContain("scale(0.625)");
    expect(styles).toContain("scale(0.8333333333)");
    expect(styles).not.toContain("scale(0.74)");
    expect(styles).not.toContain("scale(0.62)");
  });

  it("adapts the entry composition for short mobile viewports", () => {
    expect(styles).toMatch(/@media \(max-height:\s*640px\)[\s\S]*\.character-customizer/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*entry-prism/);
  });
});

describe("고령 하객 보기 설정", () => {
  it("아주 큰 글씨와 편한 터치 영역을 앱 콘텐츠에만 적용한다", () => {
    expect(styles).toContain('html[data-text-scale="xlarge"]');
    expect(styles).toMatch(/html\[data-comfortable-controls="true"\][\s\S]*min-height:\s*48px;/);
    expect(styles).not.toMatch(/html\[data-comfortable-controls="true"\][^{]*\.world-portal/);
  });

  it("사용자와 시스템의 모션 감소 및 대비 선호를 모두 지원한다", () => {
    expect(styles).toContain('html[data-reduce-motion="true"] *');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toContain('html[data-high-contrast="true"]');
    expect(styles).toContain('@media (prefers-contrast: more)');
  });

  it("간편 초대장 핵심 탐색 요소를 기본 44px 이상으로 유지한다", () => {
    expect(styles).toMatch(/\.quick-invitation__topbar > button,[\s\S]*?min-height:\s*44px;/);
    expect(styles).toMatch(/\.quick-invitation__nav a\s*\{[^}]*min-height:\s*44px;/s);
    expect(styles).toMatch(/\.view-settings-trigger--icon\s*\{[^}]*min-height:\s*44px;/s);
  });
});

describe("wedding event access", () => {
  it("keeps the compact event summary stable and readable", () => {
    const entryRule = styles.match(/\.entry-screen\s*\{([^}]*)}/s)?.[1] ?? "";
    const rule = styles.match(/\.wedding-event-summary--compact\s*\{([^}]*)}/s)?.[1] ?? "";
    const actionsRule = styles.match(
      /\.wedding-event-summary--compact \.wedding-event-summary__actions\s*\{([^}]*)}/s
    )?.[1] ?? "";

    expect(entryRule).toContain("grid-template-rows: auto auto auto minmax(0, 1fr) auto;");
    expect(rule).toContain("min-width: 0;");
    expect(rule).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(rule).toContain("grid-template-rows: auto auto auto;");
    expect(actionsRule).toContain("grid-column: 1;");
    expect(actionsRule).toContain("grid-row: 3;");
    expect(actionsRule).toContain("width: 100%;");
    expect(styles).toMatch(/\.wedding-event-summary__venue\s*\{[^}]*grid-template-columns:/s);
    expect(styles).toMatch(/\.wedding-event-summary--detail \.wedding-event-summary__venue span\s*\{[^}]*user-select:\s*text;/s);
    expect(styles).toMatch(/\.wedding-event-summary__actions > button:focus-visible\s*\{/s);
  });

  it("uses fixed-size icons and non-overlapping calendar actions", () => {
    expect(styles).toMatch(/\.wedding-event-summary__actions svg,\s*\.calendar-save-options svg\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;/s);
    expect(styles).toMatch(/\.calendar-save-options\s*\{[^}]*display:\s*grid;/s);
    expect(styles).toMatch(/\.calendar-save-options > (?:button|a)[^{]*\{[^}]*min-height:\s*48px;/s);
    expect(styles).toMatch(/\.sheet-backdrop\s*\{[^}]*z-index:\s*40;/s);
    expect(styles).toMatch(/\.bottom-sheet\s*\{[^}]*z-index:\s*41;/s);
  });

  it("adapts event content for short entry viewports", () => {
    expect(styles).toMatch(/@media \(max-height:\s*640px\)[\s\S]*\.wedding-event-summary--compact/);
  });

  it("예식 당일에는 캘린더 대신 터치 가능한 당일 안내를 우선 배치한다", () => {
    expect(styles).toMatch(
      /\.wedding-event-summary__actions:has\(\.wedding-day-trigger\)[^{]*\{[^}]*display:\s*none;/s
    );
    expect(styles).toMatch(
      /\.wedding-day-trigger--world\s*\{[^}]*min-height:\s*52px;/s
    );
    expect(styles).toMatch(
      /\.world-control-actions\s*\{[^}]*display:\s*flex;[^}]*gap:\s*8px;/s
    );
  });

  it("당일 안내의 지도와 연락 수단을 작은 화면에서도 접근 가능하게 유지한다", () => {
    expect(styles).toMatch(
      /\.wedding-day-sheet__maps > a,[\s\S]*?\.wedding-day-sheet__actions > button\s*\{[^}]*min-height:\s*48px;/s
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*360px\)[\s\S]*?\.wedding-day-sheet__maps\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s
    );
    expect(styles).toContain(".wedding-day-sheet a:focus-visible");
  });

  it("공유 진입점과 공유 시트에 안정적인 터치 영역을 제공한다", () => {
    expect(styles).toMatch(
      /\.invitation-share-trigger--icon\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;/s
    );
    expect(styles).toMatch(
      /\.world-menu-grid \.invitation-share-trigger--menu\s*\{[^}]*display:\s*inline-flex;/s
    );
    expect(styles).toMatch(
      /\.invitation-share-sheet__actions > button\s*\{[^}]*min-height:\s*48px;/s
    );
    expect(styles).toContain(".invitation-share-sheet button:focus-visible");
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

  it("bounds short landscape entry columns below the 768px three-column threshold", () => {
    const narrowLandscapeBlock = styles.match(
      /@media \(orientation: landscape\) and \(max-height: 500px\) and \(max-width: 767px\)\s*\{([\s\S]*?)\n}/
    )?.[1] ?? "";

    expect(narrowLandscapeBlock).toContain(".entry-screen");
    expect(narrowLandscapeBlock).toContain(
      "grid-template-columns: minmax(128px, 0.9fr) minmax(300px, 1.6fr) minmax(128px, 0.9fr);"
    );
    expect(narrowLandscapeBlock).toContain(".character-customizer");
    expect(narrowLandscapeBlock).toContain("grid-template-rows: minmax(82px, 1fr) 28px 92px;");
    expect(narrowLandscapeBlock).toContain(".entry-screen__controls");
    expect(narrowLandscapeBlock).toContain(".wedding-event-summary--compact .wedding-event-summary__actions");
    expect(narrowLandscapeBlock).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("keeps directions actions stable and accessible on narrow screens", () => {
    expect(styles).toMatch(/\.wedding-event-summary__actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
    expect(styles).toMatch(/\.wedding-event-summary__actions > button\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*48px;/s);
    expect(styles).toMatch(/\.directions-sheet__maps\s*\{[^}]*display:\s*grid;/s);
    expect(styles).toMatch(/\.directions-sheet__maps > (?:a|button)[^{]*\{[^}]*min-height:\s*48px;/s);
    expect(styles).toMatch(/\.directions-sheet__venue > button,\s*\.directions-sheet__phone > a\s*\{[^}]*min-height:\s*48px;/s);
    expect(styles).toMatch(/\.directions-sheet__venue span\s*\{[^}]*user-select:\s*text;/s);
    expect(styles).toMatch(/\.directions-sheet a:focus-visible,\s*\.directions-sheet button:focus-visible\s*\{/s);
  });

  it("keeps compact actions in a full-width portrait row", () => {
    expect(styles).toMatch(/\.wedding-event-summary--compact \.wedding-event-summary__actions\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*3;[^}]*width:\s*100%;/s);
    expect(styles).toMatch(/\.wedding-event-summary--compact \.wedding-event-summary__date time,[\s\S]*?\.wedding-event-summary--compact \.wedding-event-summary__venue strong\s*\{[^}]*white-space:\s*nowrap;/s);
  });

  it("adapts the directions sheet for narrow and short landscape viewports", () => {
    expect(styles).toMatch(/@media \(max-width:\s*360px\)[\s\S]*\.directions-sheet__maps/);
    expect(styles).toMatch(/@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*\.bottom-sheet/);
    expect(styles).toMatch(/@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*\.directions-sheet/);
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
    expect(styles).toContain(".rsvp-segmented");
    expect(styles).toContain(".rsvp-segmented input:focus-visible + span");
    expect(styles).toContain(".rsvp-summary");
    expect(styles).toMatch(/@media \(max-width:\s*390px\)[\s\S]*\.rsvp-panel/);
    expect(styles).toMatch(/@media \(orientation:\s*landscape\) and \(max-height:\s*500px\)[\s\S]*\.rsvp-panel/);
  });
});

describe("wedding editorial content", () => {
  it("keeps couple profiles as unframed vertical sections with stable portraits", () => {
    const panelRule = styles.match(/\.couple-profile-panel\s*\{([^}]*)}/s)?.[1] ?? "";
    const personRule = styles.match(/\.couple-profile-panel__person\s*\{([^}]*)}/s)?.[1] ?? "";
    const imageRule = styles.match(/\.couple-profile-panel__image\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(panelRule).toContain("display: grid;");
    expect(panelRule).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(personRule).toContain("display: grid;");
    expect(personRule).not.toMatch(/background|box-shadow/);
    expect(imageRule).toContain("width: min(100%, 220px);");
    expect(imageRule).toContain("aspect-ratio: 4 / 5;");
    expect(imageRule).toContain("object-fit: cover;");
  });

  it("renders a four-step vertical story with stable one-line step markers", () => {
    const timelineRule = styles.match(/\.wedding-story-timeline\s*\{([^}]*)}/s)?.[1] ?? "";
    const markerRule = styles.match(/\.wedding-story-timeline__number\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(timelineRule).toContain("display: grid;");
    expect(timelineRule).toContain("grid-template-columns: minmax(0, 1fr);");
    expect(timelineRule).toContain("border-inline-start: 2px solid");
    expect(markerRule).toContain("width: 44px;");
    expect(markerRule).toContain("height: 44px;");
    expect(markerRule).toContain("white-space: nowrap;");
    expect(markerRule).toContain("letter-spacing: 0;");
  });

  it("uses a bounded two-column editorial gallery with full-width hero and wide items", () => {
    const galleryRule = styles.match(/\.wedding-gallery\s*\{([^}]*)}/s)?.[1] ?? "";
    const itemRule = styles.match(/\.wedding-gallery__item\s*\{([^}]*)}/s)?.[1] ?? "";
    const triggerRule = styles.match(/\.wedding-gallery__photo-button\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(galleryRule).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(galleryRule).toContain("max-width: 100%;");
    expect(galleryRule).toContain("box-sizing: border-box;");
    expect(galleryRule).toContain("padding: 5px;");
    expect(galleryRule).toContain("overflow: visible;");
    expect(itemRule).toContain("min-width: 0;");
    expect(styles).toMatch(/\.wedding-gallery__item--hero,\s*\.wedding-gallery__item--wide\s*\{[^}]*grid-column:\s*1 \/ -1;/s);
    expect(styles).toMatch(/\.wedding-gallery__item--half\s*\{[^}]*grid-column:\s*span 1;/s);
    expect(triggerRule).toContain("border: 1px solid");
    expect(triggerRule).toContain("border-radius: 6px;");
    expect(triggerRule).toContain("overflow: hidden;");
    expect(styles).toContain(".wedding-gallery__photo-button:focus-visible");
  });

  it("isolates gallery button visuals and focus halos from the bottom sheet cascade", () => {
    const sheetTriggerRule = styles.match(
      /\.bottom-sheet \.wedding-gallery__photo-button\s*\{([^}]*)}/s
    )?.[1] ?? "";
    const sheetFocusRule = styles.match(
      /\.bottom-sheet \.wedding-gallery__photo-button:focus-visible\s*\{([^}]*)}/s
    )?.[1] ?? "";

    expect(sheetTriggerRule).toContain("border: 1px solid");
    expect(sheetTriggerRule).toContain("border-radius: 6px;");
    expect(sheetTriggerRule).toContain("background: var(--paper);");
    expect(sheetTriggerRule).toContain("color: var(--ink);");
    expect(sheetTriggerRule).toContain("font-weight: 400;");
    expect(sheetFocusRule).toContain("outline: 3px solid var(--camellia);");
    expect(sheetFocusRule).toContain("outline-offset: 2px;");
  });

  it("preserves image and fallback geometry without overflowing the gallery", () => {
    const imageRule = styles.match(/\.responsive-gallery-image\s*\{([^}]*)}/s)?.[1] ?? "";
    const fallbackRule = styles.match(/\.responsive-gallery-image--fallback\s*\{([^}]*)}/s)?.[1] ?? "";

    expect(imageRule).toContain("display: block;");
    expect(imageRule).toContain("width: 100%;");
    expect(imageRule).toContain("max-width: 100%;");
    expect(imageRule).toContain("height: auto;");
    expect(fallbackRule).toContain("width: 100%;");
    expect(fallbackRule).toContain("overflow: hidden;");
  });

  it("keeps the lightbox above the world in a safe full-viewport grid", () => {
    const lightboxRule = styles.match(/\.photo-lightbox\s*\{([^}]*)}/s)?.[1] ?? "";
    const stageRule = styles.match(/\.photo-lightbox__stage\s*\{([^}]*)}/s)?.[1] ?? "";
    const mediaRule = styles.match(/\.photo-lightbox__media\s*\{([^}]*)}/s)?.[1] ?? "";
    const mediaImageRule = styles.match(
      /\.photo-lightbox__media img\.responsive-gallery-image\s*\{([^}]*)}/s
    )?.[1] ?? "";
    const mediaFallbackRule = styles.match(
      /\.photo-lightbox__media \.responsive-gallery-image--fallback\s*\{([^}]*)}/s
    )?.[1] ?? "";

    expect(lightboxRule).toContain("position: fixed;");
    expect(lightboxRule).toContain("inset: 0;");
    expect(lightboxRule).toContain("z-index: 10000;");
    expect(lightboxRule).toContain("min-height: 100dvh;");
    expect(lightboxRule).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(lightboxRule).toContain("background: #11100f;");
    for (const inset of ["top", "right", "bottom", "left"]) {
      expect(lightboxRule).toContain(`env(safe-area-inset-${inset})`);
    }
    expect(stageRule).toContain("min-height: 0;");
    expect(stageRule).toContain("grid-template-columns: 48px minmax(0, 1fr) 48px;");
    expect(mediaRule).toContain("position: relative;");
    expect(mediaImageRule).toContain("position: absolute;");
    expect(mediaImageRule).toContain("inset: 0;");
    expect(mediaImageRule).toContain("width: 100%;");
    expect(mediaImageRule).toContain("height: 100%;");
    expect(mediaImageRule).toContain("max-width: 100%;");
    expect(mediaImageRule).toContain("max-height: 100%;");
    expect(mediaImageRule).toContain("object-fit: contain;");
    expect(mediaFallbackRule).toContain("width: min(100%, 640px);");
    expect(mediaFallbackRule).toContain("height: auto;");
    expect(mediaFallbackRule).toContain("max-height: 100%;");
  });

  it("keeps narrow portrait and landscape viewer content non-overlapping", () => {
    const narrowBlock = styles.match(/@media \(max-width: 520px\)\s*\{([\s\S]*?)\n}/)?.[1] ?? "";
    const landscapeBlock = styles.match(
      /@media \(orientation: landscape\) and \(max-height: 500px\)\s*\{([\s\S]*?)\n}/
    )?.[1] ?? "";

    expect(narrowBlock).toContain(".wedding-gallery");
    expect(narrowBlock).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(narrowBlock).toContain(".photo-lightbox__stage");
    expect(landscapeBlock).toContain(".photo-lightbox");
    expect(landscapeBlock).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(landscapeBlock).toContain(".photo-lightbox__footer");
  });

  it("removes viewer transitions when reduced motion is requested", () => {
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.photo-lightbox,\s*[\s\S]*\.photo-lightbox \*\s*\{[^}]*transition:\s*none !important;/
    );
  });
});
