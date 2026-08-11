export const mapApprovalContractCommands = Object.freeze([
  Object.freeze({ id: "asset-audits", command: "pnpm", args: ["maps:audit"] }),
  Object.freeze({ id: "contract-tests", command: "pnpm", args: ["maps:test"] }),
  Object.freeze({ id: "world-layout", command: "pnpm", args: ["visual:world-layout"] })
]);

export async function runMapApprovalContracts({
  runCommand,
  commands = mapApprovalContractCommands,
  now = Date.now
}) {
  if (typeof runCommand !== "function") throw new Error("맵 계약 실행기가 필요합니다.");
  const startedAtMs = now();
  const results = await Promise.all(commands.map(async ({ id, command, args }) => {
    const commandStartedAtMs = now();
    const result = await runCommand(command, args, { id });
    const finishedAtMs = now();
    return {
      id,
      command: [command, ...args].join(" "),
      status: result.code === 0 ? "passed" : "failed",
      exitCode: result.code,
      durationMs: Math.max(0, finishedAtMs - commandStartedAtMs)
    };
  }));
  const finishedAtMs = now();
  return {
    status: results.every(({ status }) => status === "passed") ? "passed" : "failed",
    strategy: "parallel-read-only-contracts",
    startedAtMs,
    finishedAtMs,
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
    sequentialDurationMs: results.reduce((total, { durationMs }) => total + durationMs, 0),
    savedMs: Math.max(0, results.reduce((total, { durationMs }) => total + durationMs, 0) - (finishedAtMs - startedAtMs)),
    results
  };
}
