import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/entry-screen-v3.css", "utf8");

describe("entry screen wedding artwork", () => {
  it("keeps optimized wedding backgrounds in the initial hero", () => {
    expect(existsSync("src/assets/entry-wedding-garden-hero.avif")).toBe(true);
    expect(existsSync("src/assets/entry-wedding-garden-hero.webp")).toBe(true);
    expect(styles).toContain("entry-wedding-garden-hero.avif");
    expect(styles).toContain("entry-wedding-garden-hero.webp");
    expect(styles).toMatch(/\.entry-screen__hero::before\s*\{[^}]*background-size:\s*cover;/s);
  });

  it("uses an optimized wedding lounge behind the selected guest", () => {
    expect(existsSync("src/assets/guest-character-preview-lounge.avif")).toBe(true);
    expect(existsSync("src/assets/guest-character-preview-lounge.webp")).toBe(true);
    expect(styles).toContain("guest-character-preview-lounge.avif");
    expect(styles).toContain("guest-character-preview-lounge.webp");
  });

  it("anchors the selected character lower together with its floor shadow", () => {
    expect(styles).toMatch(/\.entry-character-picker \.character-customizer__sprite\s*\{[^}]*top:\s*calc\(50% \+ 30px\);/s);
    expect(styles).toMatch(/\.entry-character-picker \.character-customizer__halo\s*\{[^}]*top:\s*calc\(50% \+ 102px\);/s);
  });

  it("keeps the greenhouse crop and primary controls composed on short portrait phones", () => {
    expect(styles).toContain("(orientation: portrait) and (max-height: 700px)");
    expect(styles).toMatch(/max-height: 700px[\s\S]*?\.entry-screen__hero::before\s*\{[^}]*background-position:\s*center 44%;/s);
    expect(styles).toMatch(/max-height: 700px[\s\S]*?\.entry-screen__event-brief\s*\{[^}]*min-height:\s*68px;/s);
    expect(styles).toMatch(/max-height: 600px[\s\S]*?\.entry-screen__hero::before\s*\{[^}]*background-position:\s*center 41%;/s);
  });
});
