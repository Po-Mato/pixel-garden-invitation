import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { getDeviceQaDetailAdminState, recordDeviceQaReport, updateDeviceQaAlertSettings } from "./deviceQaReportRepository";

type Statement = { get(...values: unknown[]): unknown; all(...values: unknown[]): unknown[]; run(...values: unknown[]): unknown };
type Database = { exec(sql: string): void; prepare(sql: string): Statement; close(): void };
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: new (path: string) => Database };

function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE invitations (id TEXT PRIMARY KEY); INSERT INTO invitations VALUES ('sample-garden');");
  sqlite.exec(readFileSync(new URL("../migrations/0021_game_transfer_and_device_qa_detail.sql", import.meta.url), "utf8"));
  const db = { prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({
    first: async <T>() => (sqlite.prepare(sql).get(...values) ?? null) as T | null,
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...values) as T[] }),
    run: async () => sqlite.prepare(sql).run(...values)
  }) }) } as unknown as D1Database;
  return { sqlite, db };
}

describe("deviceQaReportRepository", () => {
  it("OS·브라우저 조합을 익명 집계하고 반복 경고를 한 번만 만든다", async () => {
    const { sqlite, db } = database();
    try {
      const now = new Date("2026-07-30T10:00:00.000Z");
      for (let index = 0; index < 3; index += 1) {
        const result = await recordDeviceQaReport(db, {
          invitationId: "sample-garden",
          clientHash: String(index).repeat(43),
          platform: "android",
          osName: "Android",
          osVersion: "14",
          browserName: "Chrome",
          browserVersion: "126",
          status: "warning",
          issues: ["layout", "portal"]
        }, new Date(now.getTime() + index * 1_000));
        expect(result.accepted).toBe(true);
        expect(Boolean(result.alert)).toBe(index === 2);
      }
      const state = await getDeviceQaDetailAdminState(db, "sample-garden", false, now);
      expect(state?.profiles[0]).toMatchObject({ osLabel: "Android 14", browserLabel: "Chrome 126", reports: 3, warnings: 3, issues: 6 });
      expect(state?.latestAlert?.body).toContain("경고 3회");
      expect(state?.latestAlert?.emailStatus).toBe("disabled");
    } finally {
      sqlite.close();
    }
  });

  it("관리자 이메일 기준을 서버 설정으로 저장한다", async () => {
    const { sqlite, db } = database();
    try {
      expect(await updateDeviceQaAlertSettings(db, "sample-garden", { emailEnabled: true, warningThreshold: 5 })).toBe(true);
      const state = await getDeviceQaDetailAdminState(db, "sample-garden", true);
      expect(state).toMatchObject({ emailConfigured: true, emailEnabled: true, warningThreshold: 5 });
    } finally {
      sqlite.close();
    }
  });
});
