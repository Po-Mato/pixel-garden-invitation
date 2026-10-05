import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { installSyntheticAnalyticsGuard } from "./lib/syntheticAnalytics.mjs";

test("canaries suppress fetch and beacon analytics but preserve other traffic", async () => {
  const requests = [], beacons = [];
  const context = vm.createContext({ URL, Response,
    location: { href: "https://po-mato.github.io/pixel-garden-invitation/" },
    fetch: async (...args) => { requests.push(args); return new Response("real"); },
    navigator: { sendBeacon: (...args) => { beacons.push(args); return true; } }
  });
  vm.runInContext(`(${installSyntheticAnalyticsGuard.toString()})()`, context);
  const worker = "https://wedding-game-invitation.happyugn.workers.dev";
  for (const input of [worker + "/api/pages/visits", { url: worker + "/api/invitations/sample-garden/analytics/events" }]) {
    assert.equal((await context.fetch(input, { method: "POST", body: "synthetic" })).status, 204);
  }
  assert.equal(context.navigator.sendBeacon(worker + "/api/invitations/sample-garden/analytics/events", "synthetic"), true);
  assert.equal(requests.length, 0);
  assert.equal(beacons.length, 0);
  await context.fetch(worker + "/api/invitations/sample-garden", { method: "GET" });
  await context.fetch("https://example.com/api/pages/visits", { method: "POST" });
  context.navigator.sendBeacon("https://example.com/other", "unchanged");
  assert.equal(requests.length, 2);
  assert.equal(beacons.length, 1);
});
