import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchInvitationPerformanceConfig } from "./performanceConfigApi";

afterEach(() => vi.unstubAllGlobals());

describe("performance config API", () => {
  it("청첩장별 공개 성능 설정을 조회한다", async () => {
    const config = { version: 1, source: "default", sampleCount: 0 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(config), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchInvitationPerformanceConfig()).resolves.toEqual(config);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/performance-config"), {
      method: "GET",
      headers: { accept: "application/json" }
    });
  });
});
