import { describe, expect, it } from "vitest";
import {
  characterCatalog,
  defaultCharacterAppearance,
  parseCharacterAppearance
} from "./characterCatalog";
import { invitationContent } from "./content";

describe("character catalog", () => {
  it("NPC와 하객 프리셋 카탈로그를 제공한다", () => {
    expect(characterCatalog.npcs).toEqual([
      { id: "groom", label: `신랑 ${invitationContent.event.couple.groom}` },
      { id: "bride", label: `신부 ${invitationContent.event.couple.bride}` }
    ]);
    expect(characterCatalog.guestPresets).toHaveLength(12);
  });

  it("기본 appearance를 허용한다", () => {
    expect(parseCharacterAppearance(defaultCharacterAppearance)).toEqual(defaultCharacterAppearance);
  });
});
