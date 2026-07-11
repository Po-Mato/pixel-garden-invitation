import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");

describe("mobile world controls", () => {
  it("wraps invitation actions into two columns beside the joystick", () => {
    const mobileStart = styles.indexOf("@media (max-width: 420px)");
    const mobileEnd = styles.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
    const mobileRules = styles.slice(mobileStart, mobileEnd);

    expect(mobileRules).toMatch(/\.world-actions\s*{[^}]*display:\s*grid;/s);
    expect(mobileRules).toMatch(/\.world-actions\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
    expect(mobileRules).toMatch(/\.world-actions button\s*{[^}]*min-width:\s*0;/s);
  });
});
