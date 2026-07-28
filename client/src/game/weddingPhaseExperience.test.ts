import { describe, expect, it } from "vitest";
import { weddingPhaseExperience } from "./weddingPhaseExperience";

describe("weddingPhaseExperience", () => {
  it("maps ceremony timing to a synchronized ambience and notice", () => {
    expect(weddingPhaseExperience({
      phase: "ceremony",
      label: "예식 시작 3분 경과",
      detail: "예식홀 안내",
      urgent: true,
      showFastCeremonyRoute: true
    })).toMatchObject({ phase: "ceremony", ambience: "ceremony", title: expect.stringContaining("진행 중") });
  });
});
