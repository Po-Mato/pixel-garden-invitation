import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./security", () => ({ verifyAdminToken: vi.fn() }));
vi.mock("./invitationAnalyticsRepository", () => ({
  analyticsLocalDate: vi.fn(() => "2026-07-22"),
  recordInvitationAnalytics: vi.fn(),
  getInvitationAnalytics: vi.fn()
}));
vi.mock("./invitationPerformanceConfig", () => ({
  getInvitationPerformanceAdminState: vi.fn(),
  setInvitationPerformanceMode: vi.fn()
}));
vi.mock("./deviceQaReportRepository", () => ({
  getDeviceQaDetailAdminState: vi.fn(),
  updateDeviceQaAlertSettings: vi.fn()
}));
vi.mock("./invitationExperienceQualityGuard", () => ({
  getInvitationExperienceQualityGuard: vi.fn()
}));
vi.mock("./invitationQualityCalibrationRepository", () => ({
  ensureInvitationQualityCalibrationSnapshot: vi.fn(),
  reviewInvitationQualityCalibrationSnapshot: vi.fn()
}));

import {
  handleAdminInvitationAnalyticsRequest,
  handlePublicInvitationAnalyticsRequest
} from "./invitationAnalyticsHttp";
import * as repository from "./invitationAnalyticsRepository";
import * as performanceConfig from "./invitationPerformanceConfig";
import * as deviceQaRepository from "./deviceQaReportRepository";
import * as qualityGuardRepository from "./invitationExperienceQualityGuard";
import * as qualityCalibrationRepository from "./invitationQualityCalibrationRepository";
import { verifyAdminToken } from "./security";
import type { Env } from "./index";

const mockedRepository = vi.mocked(repository);
const mockedPerformance = vi.mocked(performanceConfig);
const mockedDeviceQa = vi.mocked(deviceQaRepository);
const mockedQualityGuard = vi.mocked(qualityGuardRepository);
const mockedQualityCalibration = vi.mocked(qualityCalibrationRepository);
const mockedVerify = vi.mocked(verifyAdminToken);
const env = {
  DB: {} as D1Database,
  RSVP_ADMIN_SESSION_SECRET: "session-secret"
} as Env;

describe("invitation analytics HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRepository.recordInvitationAnalytics.mockResolvedValue(true);
    mockedRepository.getInvitationAnalytics.mockResolvedValue({
      range: { from: "2026-07-16", to: "2026-07-22", days: 7 },
      totals: {
        visits: 0, returningVisits: 0, gameEntries: 0, simpleEntries: 0,
        directionsViews: 0, mapClicks: 0, callClicks: 0, shareClicks: 0, calendarClicks: 0,
        rsvpViews: 0, rsvpStarts: 0, rsvpSubmits: 0, rsvpResponses: 0, attendingGuests: 0,
        guestbookViews: 0, guestbookMessages: 0, galleryViews: 0, galleryZooms: 0,
        clientErrors: 0, characterAssetFallbacks: 0, pageLoadSamples: 0, averagePageLoadMs: null,
        fpsSamples: 0, averageFps: null, longTaskCount: 0, averageLongTaskMs: null,
        qualityDowngrades: 0, qualityRecoveries: 0,
        cameraCenterSamples: 0, averageCameraCenterErrorPx: null,
        clsSamples: 0, averageCls: null, longFrameSamples: 0, averageLongFrameMs: null,
        deviceQaReports: 0, deviceQaIssues: 0
      },
      daily: [],
      breakdowns: { devices: [], modes: [], maps: [], shares: [], calendars: [], qualityModes: [], characterFallbacks: [], deviceQaDevices: [], deviceQaIssues: [] },
      generatedAt: "2026-07-22T00:00:00.000Z"
    });
    mockedPerformance.getInvitationPerformanceAdminState.mockResolvedValue({
      mode: "adaptive",
      effective: {
        version: 1, source: "observed", sampleCount: 30, observedAverageFps: 50,
        slowFpsThreshold: 41, recoveryFpsThreshold: 49,
        slowWindowsRequired: 2, recoveryWindowsRequired: 4,
        generatedAt: "2026-07-22T00:00:00.000Z"
      },
      adaptive: {
        version: 1, source: "observed", sampleCount: 30, observedAverageFps: 50,
        slowFpsThreshold: 41, recoveryFpsThreshold: 49,
        slowWindowsRequired: 2, recoveryWindowsRequired: 4,
        generatedAt: "2026-07-22T00:00:00.000Z"
      },
      updatedAt: null
    });
    mockedDeviceQa.getDeviceQaDetailAdminState.mockResolvedValue({
      profiles: [], latestAlert: null, recentAlerts: [], emailConfigured: false,
      emailEnabled: false, warningThreshold: 3, generatedAt: "2026-07-22T00:00:00.000Z"
    });
    mockedQualityGuard.getInvitationExperienceQualityGuard.mockResolvedValue({
      window: { from: "2026-07-16", to: "2026-07-22", days: 7 },
      status: "collecting",
      minimumActiveDays: 7,
      minimumSamples: 20,
      calibrationStatus: "locked",
      metrics: [],
      generatedAt: "2026-07-22T00:00:00.000Z"
    });
    mockedQualityCalibration.ensureInvitationQualityCalibrationSnapshot.mockResolvedValue({
      currentWeekStart: "2026-07-20",
      eligible: false,
      pendingCount: 0,
      snapshots: [],
      generatedAt: "2026-07-22T00:00:00.000Z"
    });
    mockedQualityCalibration.reviewInvitationQualityCalibrationSnapshot.mockResolvedValue({
      currentWeekStart: "2026-07-20",
      eligible: true,
      pendingCount: 2,
      snapshots: [],
      generatedAt: "2026-07-22T00:00:00.000Z"
    });
    mockedDeviceQa.updateDeviceQaAlertSettings.mockResolvedValue(true);
    mockedPerformance.setInvitationPerformanceMode.mockImplementation(async (_db, _id, mode) => ({
      ...(await mockedPerformance.getInvitationPerformanceAdminState(env.DB, "sample-garden")),
      mode
    } as Awaited<ReturnType<typeof performanceConfig.setInvitationPerformanceMode>>));
    mockedVerify.mockResolvedValue({ invitationId: "sample-garden", expiresAt: Date.now() + 60_000 });
  });

  it("허용된 집계 이벤트 묶음만 저장한다", async () => {
    const response = await handlePublicInvitationAnalyticsRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/analytics/events",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: [
          { name: "visit", dimension: "entry:new:mobile" },
          { name: "page_load", dimension: "mobile", value: 900 },
          { name: "character_asset_fallback", dimension: "feminine-teal-modern-hanbok" },
          { name: "quality_camera_center", dimension: "mobile:interior", value: 1 },
          { name: "quality_cls", dimension: "mobile", value: 12 },
          { name: "quality_long_frame", dimension: "mobile", value: 64 },
          { name: "performance_quality_change", dimension: "lite:battery" },
          { name: "device_qa", dimension: "ios:warning" },
          { name: "device_qa", dimension: "ios:issue-layout" }
        ] })
      }
    ), env, "sample-garden");
    expect(response.status).toBe(204);
    expect(mockedRepository.recordInvitationAnalytics).toHaveBeenCalledWith(
      env.DB,
      "sample-garden",
      expect.arrayContaining([expect.objectContaining({ name: "visit" })])
    );
  });

  it("임의 이벤트·차원·성능 값을 거부한다", async () => {
    for (const event of [
      { name: "unknown", dimension: "x" },
      { name: "map_click", dimension: "unknown" },
      { name: "page_load", dimension: "mobile", value: 60_001 },
      { name: "character_asset_fallback", dimension: "../../secrets" },
      { name: "quality_camera_center", dimension: "mobile:unknown", value: 1 },
      { name: "quality_cls", dimension: "mobile", value: 1_001 },
      { name: "device_qa", dimension: "ios:issue-free-text" }
    ]) {
      const response = await handlePublicInvitationAnalyticsRequest(new Request("https://worker.test", {
        method: "POST",
        body: JSON.stringify({ events: [event] })
      }), env, "sample-garden");
      expect(response.status).toBe(400);
    }
    expect(mockedRepository.recordInvitationAnalytics).not.toHaveBeenCalled();
  });

  it("관리자 인증과 날짜 검증 후 집계만 반환한다", async () => {
    const request = new Request("https://worker.test/api/invitations/sample-garden/admin/analytics?from=2026-07-16&to=2026-07-22", {
      headers: { authorization: "Bearer admin-token" }
    });
    const response = await handleAdminInvitationAnalyticsRequest(request, env, "sample-garden");
    expect(response.status).toBe(200);
    expect(mockedVerify).toHaveBeenCalledWith("admin-token", "session-secret", "sample-garden", expect.any(Number));
    expect(mockedRepository.getInvitationAnalytics).toHaveBeenCalledWith(env.DB, "sample-garden", {
      from: "2026-07-16",
      to: "2026-07-22"
    });
    expect(await response.json()).toMatchObject({
      performance: { mode: "adaptive" },
      qualityGuard: { status: "collecting" },
      qualityCalibration: { currentWeekStart: "2026-07-20", eligible: false }
    });
  });

  it("관리자가 주간 보정 후보를 수동 검토 이력으로 확정한다", async () => {
    const response = await handleAdminInvitationAnalyticsRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/admin/analytics",
      {
        method: "POST",
        headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
        body: JSON.stringify({ qualityCalibrationReview: {
          weekStart: "2026-07-20",
          metricKey: "long-frame",
          decision: "approve-candidate"
        } })
      }
    ), env, "sample-garden");
    expect(response.status).toBe(200);
    expect(mockedQualityCalibration.reviewInvitationQualityCalibrationSnapshot).toHaveBeenCalledWith(
      env.DB,
      "sample-garden",
      {
        weekStart: "2026-07-20",
        metricKey: "long-frame",
        decision: "approve-candidate",
        note: undefined
      }
    );
  });

  it("관리자가 성능 운영 모드를 즉시 전환한다", async () => {
    const response = await handleAdminInvitationAnalyticsRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/admin/analytics",
      {
        method: "POST",
        headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
        body: JSON.stringify({ performanceMode: "safe-default" })
      }
    ), env, "sample-garden");
    expect(response.status).toBe(200);
    expect(mockedPerformance.setInvitationPerformanceMode).toHaveBeenCalledWith(
      env.DB,
      "sample-garden",
      "safe-default"
    );
  });

  it("관리자가 기기별 반복 경고 기준을 서버에 저장한다", async () => {
    const response = await handleAdminInvitationAnalyticsRequest(new Request(
      "https://worker.test/api/invitations/sample-garden/admin/analytics",
      {
        method: "POST",
        headers: { authorization: "Bearer admin-token", "content-type": "application/json" },
        body: JSON.stringify({ deviceQaAlerts: { emailEnabled: false, warningThreshold: 5 } })
      }
    ), env, "sample-garden");
    expect(response.status).toBe(200);
    expect(mockedDeviceQa.updateDeviceQaAlertSettings).toHaveBeenCalledWith(env.DB, "sample-garden", {
      emailEnabled: false,
      warningThreshold: 5
    });
  });

  it("인증 실패와 잘못된 기간을 구분한다", async () => {
    mockedVerify.mockResolvedValueOnce(null);
    const unauthorized = await handleAdminInvitationAnalyticsRequest(new Request("https://worker.test/api/invitations/sample-garden/admin/analytics", {
      headers: { authorization: "Bearer invalid" }
    }), env, "sample-garden");
    const invalid = await handleAdminInvitationAnalyticsRequest(new Request("https://worker.test/api/invitations/sample-garden/admin/analytics?from=2026-07-23&to=2026-07-22", {
      headers: { authorization: "Bearer valid" }
    }), env, "sample-garden");
    expect(unauthorized.status).toBe(401);
    expect(invalid.status).toBe(400);
  });
});
