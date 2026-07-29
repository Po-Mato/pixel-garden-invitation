import { describe, expect, it } from "vitest";
import { parseDestinationVoiceNumber } from "./destinationVoiceSelection";

describe("destination voice selection", () => {
  it("understands spoken digits and common Korean number forms", () => {
    expect(parseDestinationVoiceNumber("2번 목적지", 5)).toBe(1);
    expect(parseDestinationVoiceNumber("세 번째", 5)).toBe(2);
    expect(parseDestinationVoiceNumber("첫 번째", 5)).toBe(0);
    expect(parseDestinationVoiceNumber("열 번", 10)).toBe(9);
  });

  it("rejects numbers outside the visible destination list", () => {
    expect(parseDestinationVoiceNumber("8번", 4)).toBeNull();
    expect(parseDestinationVoiceNumber("목적지", 4)).toBeNull();
  });
});
