import test from "node:test";
import assert from "node:assert/strict";
import { collectPhotoEffectAuditReports, opaqueBounds, photoEffectAnchors } from "./render-photo-effect-anchor-audit.mjs";

test("detects visible bounds and ordered cosmetic anchors", () => {
  const raw = new Uint8Array(4 * 4 * 4);
  for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 2; x += 1) raw[(y * 4 + x) * 4 + 3] = 255;
  const bounds = opaqueBounds(raw, 4, 4);
  assert.deepEqual(bounds, { left: 1, top: 1, right: 3, bottom: 4, width: 2, height: 3 });
  const anchors = photoEffectAnchors(bounds);
  assert.ok(anchors.head.y < anchors.chest.y && anchors.chest.y < anchors.feet.y);
});

test("audits the exact twelve generated game portraits", async () => {
  const reports = await collectPhotoEffectAuditReports();
  assert.equal(reports.length, 12);
  assert.deepEqual(reports.map(({ guestId }) => guestId), Array.from(
    { length: 12 },
    (_, index) => `guest-${String(index + 1).padStart(2, "0")}`
  ));
});
