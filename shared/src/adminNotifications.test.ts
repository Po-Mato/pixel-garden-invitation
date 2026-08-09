import { describe, expect, it } from "vitest";
import {
  parseQualityCalibrationNotificationSourceId,
  qualityCalibrationAdminHref,
  qualityCalibrationNotificationSourceId
} from "./adminNotifications";

describe("quality calibration notification links", () => {
  it("round-trips an exact week and metric into the analytics deep link", () => {
    const sourceId = qualityCalibrationNotificationSourceId("2026-08-03", "camera-center");
    expect(parseQualityCalibrationNotificationSourceId(sourceId)).toEqual({
      weekStart: "2026-08-03",
      metricKey: "camera-center"
    });
    expect(qualityCalibrationAdminHref(sourceId)).toBe(
      "?admin=analytics&calibrationWeek=2026-08-03&calibrationMetric=camera-center"
    );
  });

  it("keeps older week-only notifications usable", () => {
    expect(qualityCalibrationAdminHref("2026-08-03")).toBe(
      "?admin=analytics&calibrationWeek=2026-08-03"
    );
  });
});
