import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("mobile world controls", () => {
  it("uses a two-column action grid inside the fixed phone frame at every viewport", () => {
    const baseRule = styles.match(/\.world-actions\s*{([^}]*)}/s)?.[1] ?? "";

    expect(baseRule).toContain("display: grid;");
    expect(baseRule).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(baseRule).not.toContain("overflow-x: auto");
  });

  it("wraps invitation actions into two columns beside the joystick", () => {
    const mobileStart = styles.indexOf("@media (max-width: 420px)");
    const mobileEnd = styles.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
    const mobileRules = styles.slice(mobileStart, mobileEnd);

    expect(mobileRules).toMatch(/\.world-actions\s*{[^}]*display:\s*grid;/s);
    expect(mobileRules).toMatch(/\.world-actions\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
    expect(mobileRules).toMatch(/\.world-actions button\s*{[^}]*min-width:\s*0;/s);
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
      "star-garland"
    ]) {
      expect(styles).toContain(`.world-decoration--${kind}`);
    }
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
