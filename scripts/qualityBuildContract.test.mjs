import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  probeQualityRuntime,
  validateQualityBuildPackage,
  withStaticQualityServer
} from "./lib/qualityBuildContract.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "quality-build-contract-"));
  const generated = Buffer.from([1, 2, 3, 4]);
  await mkdir(path.join(root, "generated-characters"), { recursive: true });
  await writeFile(path.join(root, "generated-characters/guest.png"), generated);
  for (const variant of ["production", "device"]) {
    await mkdir(path.join(root, variant, "assets"), { recursive: true });
    await mkdir(path.join(root, variant, "characters/generated"), { recursive: true });
    await writeFile(path.join(root, variant, "index.html"), '<div id="root"></div><script src="./assets/index.js"></script>');
    await writeFile(path.join(root, variant, "assets/index.js"), "export {};\n");
    await writeFile(path.join(root, variant, "manifest.webmanifest"), "{}\n");
    await writeFile(path.join(root, variant, "service-worker.js"), "// worker\n");
    await writeFile(path.join(root, variant, "characters/generated/guest.png"), generated);
  }
  await writeFile(path.join(root, "quality-build-manifest.json"), JSON.stringify({
    version: 1,
    sha: "a".repeat(40),
    variants: ["production", "device"],
    buildDurationsMs: { production: 120_000, device: 40_000 }
  }));
  return root;
}

test("shared quality package validates both variants and probes real HTTP assets", async () => {
  const packageDir = await fixture();
  const result = await validateQualityBuildPackage({ packageDir, expectedSha: "a".repeat(40) });
  assert.equal(result.generated.length, 1);
  assert.equal(result.variants.production.generatedAssets, 1);
  const probe = await withStaticQualityServer(path.join(packageDir, "production"), (baseUrl) => (
    probeQualityRuntime({ baseUrl, generatedPaths: ["guest.png"], requireServiceWorker: true })
  ));
  assert.deepEqual(probe, { referencesChecked: 1, generatedSamplesChecked: 1 });
});

test("shared quality package rejects a missing generated runtime asset", async () => {
  const packageDir = await fixture();
  await writeFile(path.join(packageDir, "device/characters/generated/guest.png"), Buffer.from([9]));
  await assert.rejects(
    validateQualityBuildPackage({ packageDir, expectedSha: "a".repeat(40) }),
    /device 런타임 캐릭터 불일치/
  );
});

test("restore action runs the actual dev and preview contract before consumers continue", async () => {
  const action = await readFile(new URL("../.github/actions/restore-quality-build/action.yml", import.meta.url), "utf8");
  assert.match(action, /check-quality-build-runtime-contract\.mjs/);
  assert.match(action, /--mode restored/);
  const workflow = await readFile(new URL("../.github/workflows/quality-build.yml", import.meta.url), "utf8");
  assert.match(workflow, /--mode package/);
});
