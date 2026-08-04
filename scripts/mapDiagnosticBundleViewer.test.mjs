import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("standalone diagnostic bundle viewer stays local and renders every evidence section", async () => {
  const html = await readFile(path.join(root, "client/public/map-diagnostic-bundle-viewer.html"), "utf8");
  assert.match(html, /NO UPLOAD · LOCAL ONLY/);
  assert.match(html, /data:image\/png;base64/);
  assert.match(html, /REVIEW DECISIONS/);
  assert.match(html, /SELECTED JSON PATCH/);
  assert.match(html, /dataTransfer\?\.files/);
  assert.match(html, /\.drop\[hidden\]/);
  assert.doesNotMatch(html, /https?:\/\//);
});
