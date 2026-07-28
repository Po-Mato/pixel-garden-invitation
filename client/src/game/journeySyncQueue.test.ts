import { describe, expect, it } from "vitest";
import { createEmptyJourneyProgress } from "./journeyProgress";
import {
  clearJourneySyncQueue,
  journeyProgressDiffers,
  journeySyncQueueStorageKey,
  loadJourneySyncQueue,
  markJourneySyncAttemptFailed,
  queueJourneyProgress
} from "./journeySyncQueue";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

describe("journeySyncQueue", () => {
  const scope = "sample-garden:guest-a";

  it("오프라인 변경을 하나의 최신 합집합으로 모은다", () => {
    const storage = memoryStorage();
    queueJourneyProgress(scope, {
      ...createEmptyJourneyProgress(),
      completedIds: ["directions"],
      updatedAt: "2026-07-28T01:00:00.000Z"
    }, storage, "2026-07-28T01:00:01.000Z");
    queueJourneyProgress(scope, {
      ...createEmptyJourneyProgress(),
      completedIds: ["gallery"],
      updatedAt: "2026-07-28T01:01:00.000Z"
    }, storage, "2026-07-28T01:01:01.000Z");

    expect(loadJourneySyncQueue(scope, storage)).toMatchObject({
      progress: { completedIds: ["directions", "gallery"], updatedAt: "2026-07-28T01:01:00.000Z" },
      attempts: 0
    });
  });

  it("전송 실패 횟수를 남기고 같은 변경이 저장된 경우에만 비운다", () => {
    const storage = memoryStorage();
    const progress = {
      ...createEmptyJourneyProgress(),
      completedIds: ["directions" as const],
      updatedAt: "2026-07-28T01:00:00.000Z"
    };
    queueJourneyProgress(scope, progress, storage);
    expect(markJourneySyncAttemptFailed(scope, storage)?.attempts).toBe(1);
    expect(clearJourneySyncQueue(scope, { ...progress, updatedAt: "later" }, storage)).toBe(false);
    expect(clearJourneySyncQueue(scope, progress, storage)).toBe(true);
    expect(storage.getItem(journeySyncQueueStorageKey)).toBeNull();
  });

  it("다른 개인 초대 링크의 대기 기록을 불러오지 않는다", () => {
    const storage = memoryStorage();
    queueJourneyProgress(scope, {
      ...createEmptyJourneyProgress(),
      completedIds: ["directions"],
      updatedAt: "2026-07-28T01:00:00.000Z"
    }, storage);
    expect(loadJourneySyncQueue("sample-garden:guest-b", storage)).toBeNull();
  });

  it("기기별 완료 목록 차이를 병합 안내 대상으로 판별한다", () => {
    const empty = createEmptyJourneyProgress();
    expect(journeyProgressDiffers(empty, { ...empty, completedIds: ["bride"] })).toBe(true);
    expect(journeyProgressDiffers(empty, empty)).toBe(false);
  });
});
