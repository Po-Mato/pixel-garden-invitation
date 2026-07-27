import { describe, expect, it, vi } from "vitest";
import { loadJourneyProgress, mergeJourneyProgress } from "./journeyProgressRepository";

function database(existing: { completed_json: string; updated_at: string } | null = null) {
  const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const first = vi.fn()
    .mockResolvedValueOnce({ id: "invite_1" })
    .mockResolvedValueOnce(existing);
  const prepare = vi.fn((sql: string) => ({
    bind: vi.fn(() => ({
      first: sql.includes("invitation_invite_links")
        ? first
        : first,
      run
    }))
  }));
  return { db: { prepare } as unknown as D1Database, prepare, run };
}

describe("journey progress repository", () => {
  it("개인 초대 링크에 저장된 진행도를 불러온다", async () => {
    const { db } = database({
      completed_json: JSON.stringify(["gallery", "unknown", "directions"]),
      updated_at: "2026-07-28T00:00:00.000Z"
    });
    await expect(loadJourneyProgress(db, "sample-garden", "A".repeat(43))).resolves.toEqual({
      version: 1,
      completedIds: ["directions", "gallery"],
      updatedAt: "2026-07-28T00:00:00.000Z"
    });
  });

  it("기존과 새 완료 지점을 합쳐 저장한다", async () => {
    const { db, run } = database({
      completed_json: JSON.stringify(["directions"]),
      updated_at: "2026-07-28T00:00:00.000Z"
    });
    await expect(mergeJourneyProgress(
      db,
      "sample-garden",
      "A".repeat(43),
      ["gallery", "unknown"],
      new Date("2026-07-28T01:00:00.000Z")
    )).resolves.toEqual({
      version: 1,
      completedIds: ["directions", "gallery"],
      updatedAt: "2026-07-28T01:00:00.000Z"
    });
    expect(run).toHaveBeenCalledOnce();
  });
});
