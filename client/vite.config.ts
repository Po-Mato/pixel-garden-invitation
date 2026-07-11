import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
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
