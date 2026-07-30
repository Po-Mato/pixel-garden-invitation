import { describe, expect, it } from "vitest";
import { gameTransferLiveStatusLabel, gameTransferLiveSteps } from "./gameTransferLiveProgress";

describe("기기 이전 실시간 진행", () => {
  it("수신 기기의 확인 단계가 발신 기기에도 같은 순서로 표시된다", () => {
    const previewing = { status: "active" as const, receiverPhase: "previewing" as const, receiverSeenAt: "2026-07-31T01:00:00.000Z" };
    expect(gameTransferLiveSteps("sender", previewing).map(({ complete }) => complete)).toEqual([true, true, true, false]);
    expect(gameTransferLiveStatusLabel("sender", previewing)).toContain("복원 내용을 확인");
    expect(gameTransferLiveSteps("receiver", { ...previewing, status: "claimed" as const }).every(({ complete }) => complete)).toBe(true);
  });
});
