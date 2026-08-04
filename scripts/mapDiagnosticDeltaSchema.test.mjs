import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [schema, golden, typescript, viewer, protocol] = await Promise.all([
  readFile(path.join(root, "client/public/map-diagnostic-delta.schema.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "scripts/fixtures/map-diagnostic-delta.golden.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, "client/src/game/worldDiagnosticBundle.ts"), "utf8"),
  readFile(path.join(root, "client/public/map-diagnostic-bundle-viewer.html"), "utf8"),
  readFile(path.join(root, "shared/src/protocol.ts"), "utf8")
]);

function arrayLiteral(source, expression) {
  const match = source.match(expression);
  assert.ok(match?.[1], `배열 계약을 찾지 못했습니다: ${expression}`);
  return JSON.parse(`[${match[1]}]`);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

test("JSON Schema, TypeScript, and standalone viewer share one DELTA vocabulary", () => {
  const schemaFields = schema.properties.changes.items.properties.field.enum;
  const typescriptFields = arrayLiteral(typescript, /worldDiagnosticDeltaFields\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const viewerFields = arrayLiteral(viewer, /deltaFields\s*=\s*Object\.freeze\(\[([^\]]+)\]\)/);
  assert.deepEqual(typescriptFields, schemaFields);
  assert.deepEqual(viewerFields, schemaFields);

  const schemaZones = schema.$defs.zoneId.enum;
  const typescriptZones = arrayLiteral(protocol, /worldZoneIds\s*=\s*\[([\s\S]*?)\]\s*as const/);
  const viewerZones = arrayLiteral(viewer, /deltaZones\s*=\s*Object\.freeze\(\[([^\]]+)\]\)/);
  assert.deepEqual(typescriptZones, schemaZones);
  assert.deepEqual(viewerZones, schemaZones);
  assert.match(viewer, /exactKeys\(bundle,/);
  assert.match(viewer, /DELTA 스크린샷 체크섬이 올바르지 않습니다/);
});

test("golden DELTA is strict, lightweight, and checksum-valid", () => {
  assert.deepEqual(Object.keys(golden).sort(), [...schema.required].sort());
  assert.equal(golden.kind, schema.properties.kind.const);
  assert.equal(golden.version, schema.properties.version.const);
  assert.ok(schema.$defs.zoneId.enum.includes(golden.base.zoneId));
  assert.ok(schema.$defs.zoneId.enum.includes(golden.candidate.zoneId));
  assert.ok(golden.changes.every(({ field, before, after }) => (
    schema.properties.changes.items.properties.field.enum.includes(field)
    && typeof before === "string" && typeof after === "string"
  )));
  assert.equal(golden.screenshots.changed, golden.screenshots.baseChecksum !== golden.screenshots.candidateChecksum);
  assert.doesNotMatch(JSON.stringify(golden), /data:image\/png;base64,/);
  const { integrity, ...payload } = golden;
  const checksum = createHash("sha256").update(canonicalJson(payload)).digest("hex");
  assert.equal(integrity.checksum, checksum);
});
