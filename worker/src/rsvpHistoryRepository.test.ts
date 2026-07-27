import { describe, expect, it, vi } from "vitest";
import { listRsvpHistory } from "./rsvpHistoryRepository";

const snapshot = {
  id: "rsvp_1",
  side: "bride",
  guestName: "김하객",
  phone: "01012345678",
  attendance: "yes",
  partySize: 2,
  childCount: 0,
  mealStatus: "yes",
  note: "",
  consentVersion: "2026-07-20",
  revision: 2,
  createdAt: "2027-04-01T00:00:00.000Z",
  updatedAt: "2027-04-02T00:00:00.000Z"
};

describe("listRsvpHistory", () => {
  it("초대장과 RSVP 범위 안에서 최신 개정부터 스냅샷을 반환한다", async () => {
    const all = vi.fn().mockResolvedValue({ results: [{
      id: 12,
      rsvp_id: "rsvp_1",
      revision: 2,
      action: "updated",
      snapshot_json: JSON.stringify(snapshot),
      occurred_at: "2027-04-02T00:00:00.000Z"
    }] });
    const bind = vi.fn(() => ({ all }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(listRsvpHistory(
      { prepare } as unknown as D1Database,
      "sample-garden",
      "rsvp_1"
    )).resolves.toEqual({
      rsvpId: "rsvp_1",
      entries: [{
        id: "12",
        action: "updated",
        revision: 2,
        response: snapshot,
        occurredAt: "2027-04-02T00:00:00.000Z"
      }]
    });
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/ORDER BY revision DESC/));
    expect(bind).toHaveBeenCalledWith("sample-garden", "rsvp_1");
  });

  it("이력이 없으면 존재 여부를 노출하지 않고 null을 반환한다", async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ all: vi.fn().mockResolvedValue({ results: [] }) })) }))
    } as unknown as D1Database;
    await expect(listRsvpHistory(db, "sample-garden", "missing")).resolves.toBeNull();
  });
});
