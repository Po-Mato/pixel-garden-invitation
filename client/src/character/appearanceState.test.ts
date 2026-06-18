import {
  defaultCharacterAppearance,
  getDefaultAppearance,
  parseCharacterAppearance
} from "@wedding-game/shared";
import { expect, it } from "vitest";
import { changeFamily, randomizeAppearance, updateAppearance } from "./appearanceState";

it("resets incompatible fields when family changes", () => {
  expect(changeFamily(defaultCharacterAppearance, "masculine")).toEqual(getDefaultAppearance("masculine"));
});

it("keeps the current appearance when an update is incompatible", () => {
  expect(updateAppearance(defaultCharacterAppearance, {
    hairStyle: "masculine-side-part"
  })).toEqual(defaultCharacterAppearance);
});

it("randomizer always returns valid appearances", () => {
  for (let index = 0; index < 100; index += 1) {
    expect(parseCharacterAppearance(randomizeAppearance(index / 100))).not.toBeNull();
  }
});
