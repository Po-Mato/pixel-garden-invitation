import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/memoryStorage";
import {
  isJourneyStampRewardUnlocked,
  journeyStampRewardStorageKey,
  loadJourneyStampReward,
  saveJourneyStampReward
} from "./journeyStampReward";

describe("방문 스탬프 캐릭터 장식", () => {
  it("각 방문 스탬프를 완료한 뒤 해당 장식을 해금한다", () => {
    const progress = { completedIds: ["directions", "gallery"] as const };
    expect(isJourneyStampRewardUnlocked("garden-map-pin", progress)).toBe(true);
    expect(isJourneyStampRewardUnlocked("gallery-ribbon", progress)).toBe(true);
    expect(isJourneyStampRewardUnlocked("promise-tiara", progress)).toBe(false);
    expect(isJourneyStampRewardUnlocked("none", progress)).toBe(true);
  });

  it("선택한 장식을 기기에 저장하고 알 수 없는 값은 기본 모습으로 복구한다", () => {
    const storage = memoryStorage();
    expect(saveJourneyStampReward("bridal-corsage", storage)).toBe(true);
    expect(loadJourneyStampReward(storage)).toBe("bridal-corsage");
    storage.setItem(journeyStampRewardStorageKey, "unknown");
    expect(loadJourneyStampReward(storage)).toBe("none");
  });
});
