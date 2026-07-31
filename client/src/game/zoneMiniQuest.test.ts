import { describe, expect, it } from "vitest";
import {
  completeCurrentZoneMiniQuestStep,
  createEmptyZoneMiniQuestProgress,
  currentZoneMiniQuestStep,
  loadZoneMiniQuestProgress,
  zoneMiniQuestFor,
  zoneMiniQuestStepDuplicatesCheckpoint,
  zoneMiniQuests
} from "./zoneMiniQuest";
import { journeyCheckpoints } from "./journeyProgress";

describe("zoneMiniQuest", () => {
  it("모든 맵에 한 개 이상의 순차 목표를 제공한다", () => {
    expect(zoneMiniQuests).toHaveLength(10);
    expect(zoneMiniQuests.every(({ steps }) => steps.length > 0 && steps.length <= 3)).toBe(true);
  });

  it("현재 단계와 일치하는 행동만 순서대로 완료한다", () => {
    const empty = createEmptyZoneMiniQuestProgress();
    const skipped = completeCurrentZoneMiniQuestStep(empty, "home", { type: "portal", id: "home-to-neighborhood" });
    expect(skipped.changed).toBe(false);

    const first = completeCurrentZoneMiniQuestStep(empty, "home", { type: "spot", id: "directions" });
    expect(first.changed).toBe(true);
    expect(currentZoneMiniQuestStep(zoneMiniQuestFor("home"), first.progress)?.id).toBe("home-exit");
  });

  it("예식홀에서는 신랑과 신부 중 누구와 대화해도 인사 단계를 완료한다", () => {
    const result = completeCurrentZoneMiniQuestStep(
      createEmptyZoneMiniQuestProgress(),
      "ceremony-hall",
      { type: "npc", id: "groom" }
    );
    expect(result.completedStep?.id).toBe("hall-greeting");
  });

  it("저장값에서 알 수 없는 단계와 중복을 제거한다", () => {
    const storage = {
      getItem: () => JSON.stringify({ completedStepIds: ["home-directions", "unknown", "home-directions"] }),
      setItem: () => undefined
    };
    expect(loadZoneMiniQuestProgress(storage)).toEqual({ version: 1, completedStepIds: ["home-directions"] });
  });

  it("상단 다음 목적지와 같은 짧은 퀘스트를 중복 안내로 판별한다", () => {
    const homeStep = zoneMiniQuestFor("home").steps[0];
    const directions = journeyCheckpoints.find(({ id }) => id === "directions")!;
    const gallery = journeyCheckpoints.find(({ id }) => id === "gallery")!;

    expect(zoneMiniQuestStepDuplicatesCheckpoint(homeStep, directions)).toBe(true);
    expect(zoneMiniQuestStepDuplicatesCheckpoint(homeStep, gallery)).toBe(false);
  });
});
