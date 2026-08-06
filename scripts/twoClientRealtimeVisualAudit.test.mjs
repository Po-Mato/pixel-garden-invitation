import assert from "node:assert/strict";
import test from "node:test";
import { assessTwoClientRealtimeVisualMetrics } from "./lib/twoClientRealtimeVisualAudit.mjs";

const healthySnapshot = {
  id: "home",
  remoteVisible: true,
  nameplateContained: true,
  singleLine: true,
  fullNameAvailable: true,
  collisions: []
};

test("two-client realtime audit accepts connected movement and collision-free UI", () => {
  assert.deepEqual(assessTwoClientRealtimeVisualMetrics({
    pageErrors: [],
    failedRequests: [],
    bothConnected: true,
    movementDistance: 24,
    reactionVisible: true,
    snapshots: [healthySnapshot]
  }), []);
});

test("two-client realtime audit rejects transport, movement, and visual collisions", () => {
  const issues = assessTwoClientRealtimeVisualMetrics({
    pageErrors: ["boom"],
    failedRequests: ["asset"],
    bothConnected: false,
    movementDistance: 2,
    reactionVisible: false,
    snapshots: [{
      ...healthySnapshot,
      id: "npc",
      remoteVisible: false,
      nameplateContained: false,
      singleLine: false,
      fullNameAvailable: false,
      collisions: [{ id: "npc-dialogue", area: 12 }]
    }]
  });
  assert.ok(issues.some((issue) => issue.includes("동시 접속")));
  assert.ok(issues.some((issue) => issue.includes("이동 반영")));
  assert.ok(issues.some((issue) => issue.includes("리액션")));
  assert.ok(issues.some((issue) => issue.includes("npc-dialogue")));
});
