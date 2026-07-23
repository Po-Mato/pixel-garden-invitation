import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import type { Plugin, Rollup } from "vite";
import { defineConfig } from "vitest/config";
import { createPwaServiceWorkerSource, resolvePwaPrecachePaths } from "./src/pwa/serviceWorkerSource";

function outputFingerprint(output: Rollup.OutputAsset | Rollup.OutputChunk): string {
  if (output.type === "chunk") return output.code;
  return typeof output.source === "string" ? output.source : Buffer.from(output.source).toString("base64");
}

function pwaServiceWorkerPlugin(): Plugin {
  return {
    name: "wedding-garden-pwa-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const outputs = Object.values(bundle).sort((left, right) => left.fileName.localeCompare(right.fileName));
      const fingerprint = createHash("sha256");
      outputs.forEach((output) => {
        fingerprint.update(output.fileName);
        fingerprint.update(outputFingerprint(output));
      });
      const version = process.env.GITHUB_SHA?.slice(0, 12) ?? fingerprint.digest("hex").slice(0, 12);
      const precachePaths = resolvePwaPrecachePaths(outputs.map((output) => output.fileName));
      this.emitFile({
        type: "asset",
        fileName: "service-worker.js",
        source: createPwaServiceWorkerSource(version, precachePaths)
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
