import { describe, expect, it, vi } from "vitest";
import {
  deriveInvitationPerformanceConfig,
  getInvitationPerformanceAdminState,
  handleInvitationPerformanceConfigRequest,
  loadInvitationPerformanceConfig,
  setInvitationPerformanceMode
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
      .mockResolvedValueOnce({ fps_sample_count: 30, fps_value_sum: 1_500, downgrade_count: 2 })
      .mockResolvedValueOnce(null);
    const bind = vi.fn(() => ({ first }));
    const env = { DB: { prepare: vi.fn(() => ({ bind })) } } as unknown as Env;
    await expect(loadInvitationPerformanceConfig(env.DB, "sample-garden", new Date("2026-07-28T00:00:00.000Z")))
      .resolves.toMatchObject({ source: "observed", observedAverageFps: 50 });

    first.mockReset();
    first.mockResolvedValueOnce({ id: "sample-garden" })
      .mockResolvedValueOnce({ fps_sample_count: 30, fps_value_sum: 1_500, downgrade_count: 2 })
      .mockResolvedValueOnce(null);
    const response = await handleInvitationPerformanceConfigRequest(
      new Request("https://worker.test/performance-config"),
      env,
      "sample-garden"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("안전 모드에서는 실측 표본을 보존하면서 기본 임계값을 강제한다", async () => {
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(
          sql.includes("SELECT id FROM invitations")
            ? { id: "sample-garden" }
            : sql.includes("invitation_performance_settings")
              ? { force_default: 1, updated_at: "2026-07-28T01:00:00.000Z" }
              : { fps_sample_count: 40, fps_value_sum: 1_920, downgrade_count: 8 }
        )
      }))
    }));
    await expect(getInvitationPerformanceAdminState(
      { prepare } as unknown as D1Database,
      "sample-garden",
      new Date("2026-07-28T02:00:00.000Z")
    )).resolves.toMatchObject({
      mode: "safe-default",
      effective: { source: "default", slowFpsThreshold: 42, sampleCount: 40 },
      adaptive: { source: "observed", slowFpsThreshold: 39, sampleCount: 40 }
    });
  });

  it("관리자 선택을 저장하고 갱신된 운영 상태를 반환한다", async () => {
    let forceDefault = 0;
    const run = vi.fn().mockImplementation(async () => {
      forceDefault = 1;
      return { meta: { changes: 1 } };
    });
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockImplementation(async () => (
          sql.includes("SELECT id FROM invitations")
            ? { id: "sample-garden" }
            : sql.includes("FROM invitation_performance_settings")
              ? (forceDefault ? { force_default: forceDefault, updated_at: "2026-07-28T02:00:00.000Z" } : null)
              : { fps_sample_count: 30, fps_value_sum: 1_500, downgrade_count: 2 }
        )),
        run
      }))
    }));
    await expect(setInvitationPerformanceMode(
      { prepare } as unknown as D1Database,
      "sample-garden",
      "safe-default",
      new Date("2026-07-28T02:00:00.000Z")
    )).resolves.toMatchObject({ mode: "safe-default" });
    expect(run).toHaveBeenCalledOnce();
  });
});
