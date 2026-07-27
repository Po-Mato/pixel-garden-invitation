import { describe, expect, it, vi } from "vitest";
import {
  deriveInvitationPerformanceConfig,
  handleInvitationPerformanceConfigRequest,
  loadInvitationPerformanceConfig
} from "./invitationPerformanceConfig";
import type { Env } from "./index";

describe("invitation performance config", () => {
  it("표본이 부족하면 안정적인 기본값을 유지한다", () => {
    expect(deriveInvitationPerformanceConfig({
      fps_sample_count: 12,
      fps_value_sum: 600,
      downgrade_count: 1
    }, "2026-07-28T00:00:00.000Z")).toMatchObject({
      source: "default",
      slowFpsThreshold: 42,
      recoveryFpsThreshold: 52
    });
  });

  it("충분한 익명 표본으로 임계값을 제한 범위 안에서 보정한다", () => {
    expect(deriveInvitationPerformanceConfig({
      fps_sample_count: 100,
      fps_value_sum: 4_800,
      downgrade_count: 18
    })).toMatchObject({
      source: "observed",
      sampleCount: 100,
      observedAverageFps: 48,
      slowFpsThreshold: 39,
      recoveryFpsThreshold: 47,
      slowWindowsRequired: 3
    });
  });

  it("최근 14일 집계만 읽고 공개 캐시 응답을 반환한다", async () => {
    const first = vi.fn()
      .mockResolvedValueOnce({ id: "sample-garden" })
      .mockResolvedValueOnce({ fps_sample_count: 30, fps_value_sum: 1_500, downgrade_count: 2 });
    const bind = vi.fn(() => ({ first }));
    const env = { DB: { prepare: vi.fn(() => ({ bind })) } } as unknown as Env;
    await expect(loadInvitationPerformanceConfig(env.DB, "sample-garden", new Date("2026-07-28T00:00:00.000Z")))
      .resolves.toMatchObject({ source: "observed", observedAverageFps: 50 });

    first.mockReset();
    first.mockResolvedValueOnce({ id: "sample-garden" })
      .mockResolvedValueOnce({ fps_sample_count: 30, fps_value_sum: 1_500, downgrade_count: 2 });
    const response = await handleInvitationPerformanceConfigRequest(
      new Request("https://worker.test/performance-config"),
      env,
      "sample-garden"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=3600");
  });
});
