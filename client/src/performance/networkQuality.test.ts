import { describe, expect, it } from "vitest";
import { currentNetworkMode, resolveNetworkMode } from "./networkQuality";

describe("network quality policy", () => {
  it("uses economy mode for explicit saving, offline, save-data, and constrained connections", () => {
    expect(resolveNetworkMode({ dataSaver: true })).toBe("economy");
    expect(resolveNetworkMode({ online: false })).toBe("economy");
    expect(resolveNetworkMode({ connection: { saveData: true } })).toBe("economy");
    expect(resolveNetworkMode({ connection: { effectiveType: "3g" } })).toBe("economy");
    expect(resolveNetworkMode({ connection: { effectiveType: "4g", downlink: 1.25 } })).toBe("economy");
  });

  it("keeps normal image quality on an unconstrained connection", () => {
    expect(resolveNetworkMode({ connection: { effectiveType: "4g", downlink: 8 } })).toBe("balanced");
    expect(currentNetworkMode(false, {
      onLine: true,
      connection: { effectiveType: "4g", downlink: 8 }
    })).toBe("balanced");
  });
});
