import assert from "node:assert/strict";
import test from "node:test";
import {
  mapApprovalContractCommands,
  runMapApprovalContracts
} from "./lib/mapApprovalContracts.mjs";

test("map approval contracts start all independent read-only checks concurrently", async () => {
  const started = [];
  const releases = [];
  let timestamp = 1_000;
  const pending = runMapApprovalContracts({
    now: () => timestamp += 10,
    runCommand: async (_command, _args, { id }) => {
      started.push(id);
      await new Promise((resolve) => releases.push(resolve));
      return { code: 0 };
    }
  });
  await Promise.resolve();
  assert.deepEqual(started, mapApprovalContractCommands.map(({ id }) => id));
  releases.forEach((release) => release());
  const report = await pending;
  assert.equal(report.status, "passed");
  assert.equal(report.strategy, "parallel-read-only-contracts");
  assert.equal(report.results.length, 3);
  assert.ok(report.sequentialDurationMs >= report.durationMs);
});

test("map approval contracts retain every result when one parallel check fails", async () => {
  const report = await runMapApprovalContracts({
    runCommand: async (_command, _args, { id }) => ({ code: id === "contract-tests" ? 1 : 0 })
  });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.results.map(({ id, status }) => [id, status]), [
    ["asset-audits", "passed"],
    ["contract-tests", "failed"],
    ["world-layout", "passed"]
  ]);
});
