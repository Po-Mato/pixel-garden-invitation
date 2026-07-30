import { describe, expect, it } from "vitest";
import { resolveWorldSecretClue } from "./worldSecretClue";

const interaction = { actionRadius: 40, clueLabel: "꽃잎이 흔들려요" };
const decoration = { x: 300, y: 200, width: 40, height: 40 };

describe("resolveWorldSecretClue", () => {
  it("거리와 방향을 시각 외 문구로 함께 안내한다", () => {
    expect(resolveWorldSecretClue(interaction, decoration, { x: 20, y: 220 })).toMatchObject({
      band: "distant",
      directionLabel: "오른쪽"
    });
    expect(resolveWorldSecretClue(interaction, decoration, { x: 230, y: 220 })).toMatchObject({
      band: "near",
      directionLabel: "바로 근처"
    });
    expect(resolveWorldSecretClue(interaction, decoration, { x: 230, y: 220 }).message).toContain("꽃잎이 흔들려요");
  });
});
