import { describe, expect, it, vi } from "vitest";
import {
  loadWorldForegroundReviewDecisions,
  parseWorldForegroundReviewDecisions,
  saveWorldForegroundReviewDecisions,
  serializeWorldForegroundReviewDecisions,
  worldForegroundReviewStorageKey,
  writeWorldForegroundReviewDecisionsToUrl
} from "./worldForegroundReviewState";

describe("전경 추천 검토 상태", () => {
  it("유효한 승인·거절만 안정적인 공유 문자열로 왕복한다", () => {
    const decisions = {
      "lobby/lobby-desk": "accepted",
      "home/home-plant": "rejected",
      "invalid/key": "accepted",
      "banquet/banquet-table-1": "pending"
    } as const;
    const serialized = serializeWorldForegroundReviewDecisions(decisions);
    expect(serialized).toBe("r:home/home-plant,a:lobby/lobby-desk");
    expect(parseWorldForegroundReviewDecisions(serialized)).toEqual({
      "home/home-plant": "rejected",
      "lobby/lobby-desk": "accepted"
    });
  });

  it("공유 URL을 우선하고 없으면 버전된 로컬 상태를 복원한다", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({
        version: 1,
        decisions: { "home/home-plant": "accepted" }
      })),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    expect(loadWorldForegroundReviewDecisions("r:lobby/lobby-desk", storage)).toEqual({
      "lobby/lobby-desk": "rejected"
    });
    expect(loadWorldForegroundReviewDecisions(null, storage)).toEqual({
      "home/home-plant": "accepted"
    });
    saveWorldForegroundReviewDecisions({ "lobby/lobby-desk": "accepted" }, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      worldForegroundReviewStorageKey,
      JSON.stringify({ version: 1, decisions: { "lobby/lobby-desk": "accepted" } })
    );
    saveWorldForegroundReviewDecisions({}, storage);
    expect(storage.removeItem).toHaveBeenCalledWith(worldForegroundReviewStorageKey);
  });

  it("결정이 없으면 URL 매개변수를 제거한다", () => {
    const url = new URL("https://example.test/?mapAudit=1&mapAuditReview=a%3Alobby%2Flobby-desk");
    writeWorldForegroundReviewDecisionsToUrl(url, {});
    expect(url.searchParams.has("mapAuditReview")).toBe(false);
  });
});
