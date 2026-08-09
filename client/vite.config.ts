import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import type { Plugin, Rollup } from "vite";
import { defineConfig } from "vitest/config";
import {
  createPwaServiceWorkerSource,
  resolvePwaFeaturePrecachePaths,
  resolvePwaPrecachePaths
} from "./src/pwa/serviceWorkerSource";

function outputFingerprint(output: Rollup.OutputAsset | Rollup.OutputChunk): string {
  if (output.type === "chunk") return output.code;
  return typeof output.source === "string" ? output.source : Buffer.from(output.source).toString("base64");
}

type ViteOutputChunk = Rollup.OutputChunk & {
  viteMetadata?: { importedCss?: Set<string> };
};

function collectChunkFiles(
  outputs: readonly (Rollup.OutputAsset | Rollup.OutputChunk)[],
  roots: readonly string[],
  includeDynamicImports: boolean
): Set<string> {
  const outputFileNames = new Set(outputs.map(({ fileName }) => fileName));
  const chunks = new Map(outputs
    .filter((output): output is Rollup.OutputChunk => output.type === "chunk")
    .map((chunk) => [chunk.fileName, chunk]));
  const selected = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const fileName = queue.shift();
    if (!fileName || selected.has(fileName) || !outputFileNames.has(fileName)) continue;
    selected.add(fileName);
    const chunk = chunks.get(fileName) as ViteOutputChunk | undefined;
    if (!chunk) continue;
    chunk.viteMetadata?.importedCss?.forEach((cssFileName) => selected.add(cssFileName));
    queue.push(...chunk.imports);
    if (includeDynamicImports) queue.push(...chunk.dynamicImports);
  }
  return selected;
}

function publicPwaBundleFiles(outputs: readonly (Rollup.OutputAsset | Rollup.OutputChunk)[]) {
  const chunks = outputs.filter((output): output is Rollup.OutputChunk => output.type === "chunk");
  const entryRoots = chunks.filter(({ isEntry }) => isEntry).map(({ fileName }) => fileName);
  const primaryInvitationRoots = chunks
    .filter(({ fileName }) => /(?:^|\/)(?:GameWorld|QuickInvitation)-.*\.js$/i.test(fileName))
    .map(({ fileName }) => fileName);
  const core = collectChunkFiles(outputs, [...entryRoots, ...primaryInvitationRoots], false);
  const publicInvitation = collectChunkFiles(outputs, primaryInvitationRoots, true);
  const features = new Set([...publicInvitation].filter((fileName) => !core.has(fileName)));
  return { core, features };
}

function pwaServiceWorkerPlugin(): Plugin {
  return {
    name: "wedding-garden-pwa-service-worker",
    enforce: "post",
    apply: "build",
    generateBundle(_options, bundle) {
      const outputs = Object.values(bundle).sort((left, right) => left.fileName.localeCompare(right.fileName));
      const fingerprint = createHash("sha256");
      outputs.forEach((output) => {
        fingerprint.update(output.fileName);
        fingerprint.update(outputFingerprint(output));
      });
      const version = process.env.GITHUB_SHA?.slice(0, 12) ?? fingerprint.digest("hex").slice(0, 12);
      const outputFileNames = outputs.map((output) => output.fileName);
      const pwaFiles = publicPwaBundleFiles(outputs);
      const precachePaths = resolvePwaPrecachePaths(outputFileNames, [...pwaFiles.core]);
      const featurePaths = resolvePwaFeaturePrecachePaths([...pwaFiles.features]);
      this.emitFile({
        type: "asset",
        fileName: "service-worker.js",
        source: createPwaServiceWorkerSource(version, precachePaths, featurePaths)
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), pwaServiceWorkerPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    pool: "forks",
    deps: {
      optimizer: {
        client: {
          enabled: true,
          include: ["@testing-library/react", "@testing-library/jest-dom/vitest"]
        }
      }
    }
  }
});
