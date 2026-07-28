import { describe, expect, it } from "vitest";
import { registerCooperativeCelebration } from "./cooperativeCelebration";

describe("cooperativeCelebration", () => {
  it("completes when two unique guests celebrate inside the time window", () => {
    const first = registerCooperativeCelebration([], { guestId: "one", nickname: "첫 하객", at: 1_000 });
    const second = registerCooperativeCelebration(first.pulses, { guestId: "two", nickname: "둘째 하객", at: 4_000 });
    expect(second).toMatchObject({ completed: true, participantNames: ["첫 하객", "둘째 하객"] });
  });

  it("expires old reactions and deduplicates one guest", () => {
    const first = registerCooperativeCelebration([], { guestId: "one", nickname: "첫 하객", at: 1_000 });
    const repeated = registerCooperativeCelebration(first.pulses, { guestId: "one", nickname: "첫 하객", at: 2_000 });
    const late = registerCooperativeCelebration(repeated.pulses, { guestId: "two", nickname: "둘째 하객", at: 8_000 });
    expect(repeated.completed).toBe(false);
    expect(late.pulses).toHaveLength(1);
  });
});
