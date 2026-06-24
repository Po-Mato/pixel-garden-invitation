import { describe, expect, it } from "vitest";
import {
  characterCatalog,
  defaultCharacterAppearance,
  parseCharacterAppearance
} from "./characterCatalog";

describe("character catalog", () => {
  it("NPC와 하객 프리셋 카탈로그를 제공한다", () => {
    expect(characterCatalog.npcs.map((item) => item.id)).toEqual(["groom", "bride"]);
    expect(characterCatalog.guestPresets).toHaveLength(8);
  });

  it("기본 appearance를 허용한다", () => {
    expect(parseCharacterAppearance(defaultCharacterAppearance)).toEqual(defaultCharacterAppearance);
  });
});
