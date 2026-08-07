import { describe, expect, it } from "vitest";
import {
  buildInvitationExperienceQualityGuard,
  EXPERIENCE_QUALITY_MINIMUM_ACTIVE_DAYS,
  EXPERIENCE_QUALITY_MINIMUM_SAMPLES
} from "./invitationExperienceQualityGuard";

const days = ["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05"];

describe("invitation experience quality guard", () => {
  it("keeps alerts in collection mode until both day and sample gates are satisfied", () => {
    const result = buildInvitationExperienceQualityGuard([
      { local_date: days[0], event_name: "quality_camera_center", sample_count: 19, value_sum: 19 }
    ], { to: "2026-08-07", now: new Date("2026-08-07T03:00:00.000Z") });
    expect(result.status).toBe("collecting");
    expect(result.minimumActiveDays).toBe(EXPERIENCE_QUALITY_MINIMUM_ACTIVE_DAYS);
    expect(result.minimumSamples).toBe(EXPERIENCE_QUALITY_MINIMUM_SAMPLES);
    expect(result.window).toEqual({ from: "2026-08-01", to: "2026-08-07", days: 7 });
  });

  it("activates fixed production budgets after five active days and flags regressions", () => {
    const rows = days.flatMap((local_date) => [
      { local_date, event_name: "quality_camera_center" as const, sample_count: 4, value_sum: 4 },
      { local_date, event_name: "quality_cls" as const, sample_count: 4, value_sum: 160 },
      { local_date, event_name: "quality_long_frame" as const, sample_count: 4, value_sum: 496 }
    ]);
    const result = buildInvitationExperienceQualityGuard(rows, { to: "2026-08-07" });
    expect(result.status).toBe("watch");
    expect(result.metrics).toEqual([
      expect.objectContaining({ key: "camera-center", average: 1, alertThreshold: 2, status: "stable" }),
      expect.objectContaining({ key: "cls", average: 0.04, alertThreshold: 0.1, status: "stable" }),
      expect.objectContaining({ key: "long-frame", average: 124, alertThreshold: 100, status: "watch" })
    ]);
  });
});
