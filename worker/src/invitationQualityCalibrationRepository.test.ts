import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { InvitationExperienceQualityGuard } from "@wedding-game/shared";
import {
  ensureInvitationQualityCalibrationSnapshot,
  qualityCalibrationWeekStart,
  reviewInvitationQualityCalibrationSnapshot
} from "./invitationQualityCalibrationRepository";

type Statement = { get(...values: unknown[]): unknown; all(...values: unknown[]): unknown[]; run(...values: unknown[]): { changes: number } };
type Database = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Database };

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE invitations (id TEXT PRIMARY KEY); INSERT INTO invitations VALUES ('sample-garden');");
  sqlite.exec(readFileSync(new URL("../migrations/0025_quality_calibration_snapshots.sql", import.meta.url), "utf8"));
  const prepare = (sql: string) => {
    let values: unknown[] = [];
    const statement = {
      bind: (...nextValues: unknown[]) => { values = nextValues; return statement; },
      first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
      all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
      run: async () => {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    };
    return statement;
  };
  const db = {
    prepare,
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    }
  } as unknown as D1Database;
  return { sqlite, db };
}

const readyGuard: InvitationExperienceQualityGuard = {
  window: { from: "2026-08-01", to: "2026-08-07", days: 7 },
  status: "stable",
  minimumActiveDays: 7,
  minimumSamples: 20,
  calibrationStatus: "ready",
  metrics: [
    { key: "camera-center", label: "캐릭터 중심 오차", unit: "px", sampleCount: 21, activeDays: 7, average: 1, alertThreshold: 2, status: "stable", calibration: { status: "ready", remainingActiveDays: 0, remainingSamples: 0, dailyP95: 1.2, suggestedThreshold: 2, decision: "retain" } },
    { key: "cls", label: "화면 배치 흔들림", unit: "score", sampleCount: 21, activeDays: 7, average: 0.04, alertThreshold: 0.1, status: "stable", calibration: { status: "ready", remainingActiveDays: 0, remainingSamples: 0, dailyP95: 0.05, suggestedThreshold: 0.1, decision: "retain" } },
    { key: "long-frame", label: "긴 프레임 p95", unit: "ms", sampleCount: 21, activeDays: 7, average: 110, alertThreshold: 100, status: "watch", calibration: { status: "ready", remainingActiveDays: 0, remainingSamples: 0, dailyP95: 120, suggestedThreshold: 150, decision: "review-increase" } }
  ],
  generatedAt: "2026-08-07T00:00:00.000Z"
};

describe("quality calibration snapshots", () => {
  it("월요일 기준 주차를 계산한다", () => {
    expect(qualityCalibrationWeekStart("2026-08-07")).toBe("2026-08-03");
    expect(qualityCalibrationWeekStart("2026-08-03")).toBe("2026-08-03");
  });

  it("7일·20표본 후보를 주 1회 고정하고 수동 검토를 불변 이력으로 남긴다", async () => {
    const { sqlite, db } = database();
    try {
      const now = new Date("2026-08-07T01:00:00.000Z");
      const first = await ensureInvitationQualityCalibrationSnapshot(db, "sample-garden", readyGuard, now);
      const second = await ensureInvitationQualityCalibrationSnapshot(db, "sample-garden", readyGuard, new Date("2026-08-07T02:00:00.000Z"));
      expect(first.snapshots).toHaveLength(3);
      expect(second.snapshots).toHaveLength(3);
      expect(second.pendingCount).toBe(3);
      expect(second.snapshots.find(({ metricKey }) => metricKey === "long-frame")).toMatchObject({
        weekStart: "2026-08-03",
        suggestedThreshold: 150,
        decision: "pending"
      });

      const reviewed = await reviewInvitationQualityCalibrationSnapshot(db, "sample-garden", {
        weekStart: "2026-08-03",
        metricKey: "long-frame",
        decision: "approve-candidate"
      }, new Date("2026-08-08T01:00:00.000Z"));
      expect(reviewed?.pendingCount).toBe(2);
      expect(reviewed?.snapshots.find(({ metricKey }) => metricKey === "long-frame")).toMatchObject({
        decision: "approve-candidate",
        reviewedAt: "2026-08-08T01:00:00.000Z"
      });
      await expect(reviewInvitationQualityCalibrationSnapshot(db, "sample-garden", {
        weekStart: "2026-08-03",
        metricKey: "long-frame",
        decision: "retain-current"
      })).resolves.toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
