import { describe, expect, it } from "vitest";
import {
  listenForDestinationVoiceResult,
  parseDestinationVoiceCommand,
  parseDestinationVoiceNumber
} from "./destinationVoiceSelection";

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

  it("understands next, move, cancel, repeat, and close game commands", () => {
    expect(parseDestinationVoiceCommand("다음 목적지", 4)).toEqual({ type: "next" });
    expect(parseDestinationVoiceCommand("여기로 이동", 4)).toEqual({ type: "move" });
    expect(parseDestinationVoiceCommand("미니맵 닫기", 4)).toEqual({ type: "close" });
    expect(parseDestinationVoiceCommand("이동 취소", 4)).toEqual({ type: "cancel" });
    expect(parseDestinationVoiceCommand("안내 반복", 4)).toEqual({ type: "repeat" });
    expect(parseDestinationVoiceCommand("3번", 4)).toEqual({ type: "number", index: 2 });
  });

  it("honors user-defined call phrases before the built-in aliases", () => {
    const preferences = {
      movePhrase: "출발해",
      nextPhrase: "넘어가",
      cancelPhrase: "잠깐",
      repeatPhrase: "다시 알려줘"
    };
    expect(parseDestinationVoiceCommand("이제 출발해", 4, preferences)).toEqual({ type: "move" });
    expect(parseDestinationVoiceCommand("다시 알려줘", 4, preferences)).toEqual({ type: "repeat" });
    expect(parseDestinationVoiceCommand("잠깐 멈춰", 4, preferences)).toEqual({ type: "cancel" });
    expect(parseDestinationVoiceCommand("3번", 4, { ...preferences, cancelPhrase: "" }))
      .toEqual({ type: "number", index: 2 });
  });

  it("returns the heard phrase even when it is not a valid command", async () => {
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((event: { results: Array<{ 0: { transcript: string } }> }) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start() { this.onresult?.({ results: [{ 0: { transcript: "근처 화장실" } }] }); }
      stop() { /* no-op */ }
    }
    const target = {
      SpeechRecognition: Recognition,
      setTimeout: window.setTimeout.bind(window),
      clearTimeout: window.clearTimeout.bind(window)
    };
    await expect(listenForDestinationVoiceResult(4, target as never)).resolves.toEqual({
      command: null,
      transcript: "근처 화장실"
    });
  });
});
