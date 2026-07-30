import test from "node:test";
import assert from "node:assert/strict";
import { auditMobileHudRectangles } from "./lib/mobileHudBrowserAudit.mjs";

test("mobile HUD rectangle audit accepts separated controls", () => {
  assert.deepEqual(auditMobileHudRectangles({
    hud: { x: 8, y: 8, width: 344, height: 90 },
    minimap: { x: 298, y: 120, width: 54, height: 54 },
    collection: { x: 8, y: 480, width: 54, height: 44 },
    controls: { x: 8, y: 540, width: 344, height: 92 },
    context: null
  }, { width: 360, height: 640 }), []);
});

test("mobile HUD rectangle audit catches clipping and meaningful overlap", () => {
  assert.deepEqual(auditMobileHudRectangles({
    hud: { x: 8, y: 8, width: 344, height: 90 },
    minimap: { x: 340, y: 120, width: 54, height: 54 },
    controls: { x: 8, y: 540, width: 344, height: 92 },
    context: { x: 80, y: 560, width: 200, height: 48 }
  }, { width: 360, height: 640 }), [
    "minimap 화면 이탈",
    "context/controls 겹침"
  ]);
});
