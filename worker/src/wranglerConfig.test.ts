import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function parseSection(source: string, sectionName: string): Record<string, unknown> {
  const lines = source.split(/\r?\n/);
  const sectionStart = lines.findIndex((line) => line.trim() === `[${sectionName}]`);
  if (sectionStart < 0) return {};

  const values: Record<string, unknown> = {};
  for (const line of lines.slice(sectionStart + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) break;
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    values[trimmed.slice(0, separator).trim()] = JSON.parse(trimmed.slice(separator + 1).trim());
  }
  return values;
}

describe("wrangler RSVP settings", () => {
  it("keeps the production cron and exact public origin allowlist configured", () => {
    const source = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");

    expect(parseSection(source, "triggers")).toMatchObject({ crons: ["17 15 * * *"] });
    expect(parseSection(source, "vars")).toMatchObject({
      RSVP_ALLOWED_ORIGINS: "https://po-mato.github.io,http://localhost:5173,http://127.0.0.1:5173",
      ADMIN_NOTIFICATION_BASE_URL: "https://po-mato.github.io/pixel-garden-invitation"
    });
  });
});
