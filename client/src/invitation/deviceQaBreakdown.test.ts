import { describe, expect, it } from "vitest";
import { analyzeDeviceQaBreakdown } from "./deviceQaBreakdown";

describe("deviceQaBreakdown", () => {
  it("서버 집계를 기기별 불편률과 주요 문제로 묶는다", () => {
    const result = analyzeDeviceQaBreakdown(
      [
        { key: "ios:complete", count: 5 },
        { key: "android:complete", count: 2 },
        { key: "android:warning", count: 3 }
      ],
      [
        { key: "android:layout", count: 2 },
        { key: "android:portal", count: 1 },
        { key: "ios:audio", count: 1 }
      ]
    );
    expect(result[0]).toEqual(expect.objectContaining({ id: "android", reports: 5, warnings: 3, issues: 3, issueRate: 0.6 }));
    expect(result[0].topIssues[0]).toEqual({ id: "layout", label: "화면 배치", count: 2 });
    expect(result[1]).toEqual(expect.objectContaining({ id: "ios", reports: 5, issueRate: 0.2 }));
  });
});
