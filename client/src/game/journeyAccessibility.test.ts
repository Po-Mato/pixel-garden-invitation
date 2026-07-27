import { describe, expect, it } from "vitest";
import { journeyCheckpoints } from "./journeyProgress";
import { quickInvitationHashForCheckpoint } from "./journeyAccessibility";

describe("journey accessibility", () => {
  it("게임의 모든 목적지를 간편 초대장 섹션에 연결한다", () => {
    expect(journeyCheckpoints.map((checkpoint) => quickInvitationHashForCheckpoint(checkpoint))).toEqual([
      "#directions",
      "#gallery",
      "#couple",
      "#schedule",
      "#guestbook"
    ]);
  });
});
