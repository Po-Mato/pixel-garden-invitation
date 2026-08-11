import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { classifyAndroidChromeFailure } from "./lib/androidChromeFailureTaxonomy.mjs";

const captureArgs = ["visual:android-chrome", "--", ...process.argv.slice(2)];
const firstAttemptLog = path.join(
  process.env.RUNNER_TEMP ?? process.cwd(),
  "android-chrome-capture-attempt-1.log"
);

function run(command, args, { env = process.env, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    const chunks = [];
    if (capture) {
      child.stdout.on("data", (chunk) => chunks.push(chunk));
      child.stderr.on("data", (chunk) => chunks.push(chunk));
    }
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({
      code: Number.isInteger(code) ? code : 1,
      signal,
      output: Buffer.concat(chunks).toString("utf8")
    }));
  });
}

const firstAttempt = await run("pnpm", captureArgs, { capture: true });
await writeFile(firstAttemptLog, firstAttempt.output);
process.stdout.write(firstAttempt.output);

if (firstAttempt.code === 0) process.exit(0);

const classification = classifyAndroidChromeFailure(firstAttempt.output);
if (!classification.retryable) process.exit(firstAttempt.code);

console.log("Android Chrome 렌더러 단절 감지: 세션 재생성 후 1회 재시도");
await run("adb", ["shell", "am", "force-stop", "com.android.chrome"]).catch(() => undefined);
await new Promise((resolve) => setTimeout(resolve, 2_000));
const secondAttempt = await run("pnpm", captureArgs, {
  env: {
    ...process.env,
    ANDROID_CAPTURE_RETRY: classification.kind
  }
});
process.exit(secondAttempt.code);
