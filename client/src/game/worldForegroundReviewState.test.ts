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
      "venue-exterior/venue-arch": "accepted",
      "neighborhood/street-tree-1": "rejected",
      "invalid/key": "accepted",
      "banquet/banquet-table-1": "pending"
    } as const;
    const serialized = serializeWorldForegroundReviewDecisions(decisions);
    expect(serialized).toBe("r:neighborhood/street-tree-1,a:venue-exterior/venue-arch");
    expect(parseWorldForegroundReviewDecisions(serialized)).toEqual({
      "neighborhood/street-tree-1": "rejected",
      "venue-exterior/venue-arch": "accepted"
    });
  });

  it("공유 URL을 우선하고 없으면 버전된 로컬 상태를 복원한다", () => {
    const storage = {
      getItem: vi.fn(() => JSON.stringify({
        version: 1,
        decisions: { "neighborhood/street-tree-1": "accepted" }
      })),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    expect(loadWorldForegroundReviewDecisions("r:venue-exterior/venue-arch", storage)).toEqual({
      "venue-exterior/venue-arch": "rejected"
    });
    expect(loadWorldForegroundReviewDecisions(null, storage)).toEqual({
      "neighborhood/street-tree-1": "accepted"
    });
    saveWorldForegroundReviewDecisions({ "venue-exterior/venue-arch": "accepted" }, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      worldForegroundReviewStorageKey,
      JSON.stringify({ version: 1, decisions: { "venue-exterior/venue-arch": "accepted" } })
    );
    saveWorldForegroundReviewDecisions({}, storage);
    expect(storage.removeItem).toHaveBeenCalledWith(worldForegroundReviewStorageKey);
  });

  it("결정이 없으면 URL 매개변수를 제거한다", () => {
    const url = new URL("https://example.test/?mapAudit=1&mapAuditReview=a%3Avenue-exterior%2Fvenue-arch");
    writeWorldForegroundReviewDecisionsToUrl(url, {});
    expect(url.searchParams.has("mapAuditReview")).toBe(false);
  });
});
