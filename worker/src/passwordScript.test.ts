import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { verifyPassword } from "./security";

const scriptPath = fileURLToPath(new URL("../../scripts/hash-rsvp-admin-password.mjs", import.meta.url));

describe("RSVP admin password hash script", () => {
  it("emits a Worker-compatible hash that the runtime verifier accepts", async () => {
    const password = "deployment password";
    const encodedHash = execFileSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, RSVP_ADMIN_PASSWORD: password }
    });

    expect(encodedHash).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    await expect(verifyPassword(password, encodedHash)).resolves.toBe(true);
  });

  it("rejects passwords shorter than twelve characters", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, RSVP_ADMIN_PASSWORD: "short" }
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});
