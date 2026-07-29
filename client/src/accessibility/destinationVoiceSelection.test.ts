import { describe, expect, it } from "vitest";
import { parseDestinationVoiceCommand, parseDestinationVoiceNumber } from "./destinationVoiceSelection";

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

  it("understands next, move, and close game commands", () => {
    expect(parseDestinationVoiceCommand("다음 목적지", 4)).toEqual({ type: "next" });
    expect(parseDestinationVoiceCommand("여기로 이동", 4)).toEqual({ type: "move" });
    expect(parseDestinationVoiceCommand("미니맵 닫기", 4)).toEqual({ type: "close" });
    expect(parseDestinationVoiceCommand("3번", 4)).toEqual({ type: "number", index: 2 });
  });
});
