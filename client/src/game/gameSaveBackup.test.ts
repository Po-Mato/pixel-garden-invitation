import { describe, expect, it, vi } from "vitest";
import {
  createGameSaveBackup,
  createGameSaveRollback,
  parseGameSaveBackup,
  parseGameSaveRollback,
  restoreGameSaveBackup,
  restoreGameSaveRollback,
  summarizeGameSaveBackup
} from "./gameSaveBackup";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

describe("gameSaveBackup", () => {
  it("게임 진행만 백업하고 관리자·RSVP 데이터는 제외한다", () => {
    const source = storage({
      "wedding-game:journey-progress:v1": "journey",
      "wedding-world-secrets:v1": "secrets",
      "wedding-admin-session:v1": "admin",
      "wedding-rsvp-draft:v1": "rsvp"
    });
    expect(createGameSaveBackup(source, "2027-05-01T00:00:00.000Z").entries).toEqual({
      "wedding-game:journey-progress:v1": "journey",
      "wedding-world-secrets:v1": "secrets"
    });
  });

  it("허용된 백업만 복원하고 실패하면 기존 값을 되돌린다", () => {
    const target = storage({ "wedding-game:journey-progress:v1": "old" });
    const backup = parseGameSaveBackup(JSON.stringify({
      schema: "wedding-game-save",
      version: 1,
      createdAt: "2027-05-01T00:00:00.000Z",
      entries: { "wedding-game:journey-progress:v1": "new", "wedding-world-secrets:v1": "secret" }
    }));
    expect(restoreGameSaveBackup(backup, target)).toBe(2);
    expect(target.getItem("wedding-game:journey-progress:v1")).toBe("new");

    const failing = { ...target, setItem: vi.fn((key: string, value: string) => {
      if (key === "wedding-world-secrets:v1" && value === "secret") throw new Error("quota");
      target.setItem(key, value);
    }) };
    target.setItem("wedding-game:journey-progress:v1", "old");
    expect(() => restoreGameSaveBackup(backup, failing)).toThrow("quota");
    expect(target.getItem("wedding-game:journey-progress:v1")).toBe("old");
  });

  it("알 수 없는 항목이 든 파일을 거부한다", () => {
    expect(() => parseGameSaveBackup(JSON.stringify({
      schema: "wedding-game-save", version: 1, createdAt: "now", entries: { "admin-token": "secret" }
    }))).toThrow("허용되지 않은");
  });

  it("복원 전에 신규·교체 항목을 요약하고 직전 상태로 되돌린다", () => {
    const target = storage({ "wedding-game:journey-progress:v1": "old" });
    const backup = parseGameSaveBackup(JSON.stringify({
      schema: "wedding-game-save",
      version: 1,
      createdAt: "2027-05-01T00:00:00.000Z",
      entries: {
        "wedding-game:journey-progress:v1": "new",
        "wedding-game:npc-dialogue-memory:guest": "npc"
      }
    }));
    expect(summarizeGameSaveBackup(backup, target)).toEqual(expect.objectContaining({
      totalEntries: 2,
      newEntries: 1,
      overwrittenEntries: 1,
      changedEntries: 1,
      unchangedEntries: 0,
      categories: expect.arrayContaining([
        expect.objectContaining({ id: "journey", count: 1 }),
        expect.objectContaining({ id: "relationship", count: 1 })
      ])
    }));
    expect(summarizeGameSaveBackup(backup, target).changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "여정 진행", status: "changed", before: "3B 데이터", after: "3B 데이터" }),
      expect.objectContaining({ label: "두 사람과의 인연", status: "new", before: "저장 없음" })
    ]));

    const rollback = parseGameSaveRollback(JSON.stringify(createGameSaveRollback(backup, target, "2027-05-02T00:00:00.000Z")));
    restoreGameSaveBackup(backup, target);
    expect(target.getItem("wedding-game:journey-progress:v1")).toBe("new");
    restoreGameSaveRollback(rollback, target);
    expect(target.getItem("wedding-game:journey-progress:v1")).toBe("old");
    expect(target.getItem("wedding-game:npc-dialogue-memory:guest")).toBeNull();

    restoreGameSaveBackup(backup, target);
    const failingRollback = { ...target, setItem: vi.fn((key: string, value: string) => {
      if (key === "wedding-game:journey-progress:v1" && value === "old") throw new Error("quota");
      target.setItem(key, value);
    }) };
    expect(() => restoreGameSaveRollback(rollback, failingRollback)).toThrow("quota");
    expect(target.getItem("wedding-game:journey-progress:v1")).toBe("new");
  });
});
