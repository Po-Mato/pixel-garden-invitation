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

  it("lowers the selected character together with its floor halo", () => {
    expect(styles).toMatch(/\.entry-character-picker \.character-customizer__sprite\s*\{[^}]*top:\s*calc\(50% \+ 9px\);/s);
    expect(styles).toMatch(/\.entry-character-picker \.character-customizer__halo\s*\{[^}]*top:\s*calc\(50% \+ 81px\);/s);
  });
});
