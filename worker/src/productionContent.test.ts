import { readdirSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const productionExtensions = new Set([".css", ".html", ".json", ".sql", ".ts", ".tsx"]);
const legacyValues = [
  "이서" + "준",
  "김하" + "린",
  "서준 & 하린의 정원",
  "라온" + "가든",
  "2027-05-" + "15",
  "역삼" + "역",
  "테헤" + "란로"
];

function productionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "node_modules" || entry.name === "dist" ? [] : productionFiles(path);
    }

    return productionExtensions.has(extname(entry.name)) && !entry.name.includes(".test.")
      ? [path]
      : [];
  });
}

describe("production invitation content", () => {
  it("does not retain legacy sample values in client, shared, or worker sources", () => {
    const workspaceRoot = resolve(import.meta.dirname, "../..");
    const matches = ["client", "shared", "worker"].flatMap((packageName) =>
      productionFiles(resolve(workspaceRoot, packageName)).flatMap((path) => {
        const source = readFileSync(path, "utf8");
        return legacyValues.filter((value) => source.includes(value)).map((value) => ({ path, value }));
      })
    );

    expect(matches).toEqual([]);
  });
});
