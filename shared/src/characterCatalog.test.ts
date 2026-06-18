import { describe, expect, it } from "vitest";
import {
  characterCatalog,
  defaultCharacterAppearance,
  parseCharacterAppearance,
  resolveAppearanceOptions
} from "./characterCatalog";

describe("character catalog", () => {
  it("contains the approved initial catalog counts", () => {
    expect(characterCatalog.skinTones).toHaveLength(5);
    expect(characterCatalog.hairColors).toHaveLength(6);
    expect(characterCatalog.hairStyles.filter((item) => item.family === "masculine")).toHaveLength(8);
    expect(characterCatalog.hairStyles.filter((item) => item.family === "feminine")).toHaveLength(8);
    expect(characterCatalog.outfits.filter((item) => item.family === "masculine")).toHaveLength(5);
    expect(characterCatalog.outfits.filter((item) => item.family === "feminine")).toHaveLength(5);
    expect(characterCatalog.accessories).toHaveLength(10);
    expect(characterCatalog.npcs.map((item) => item.id)).toEqual(["groom", "bride"]);
    expect(characterCatalog.outfits.every((item) => item.palettes.length === 4)).toBe(true);
  });

  it("accepts the default appearance", () => {
    expect(parseCharacterAppearance(defaultCharacterAppearance)).toEqual(defaultCharacterAppearance);
  });

  it("rejects unknown and incompatible ids", () => {
    expect(parseCharacterAppearance({
      ...defaultCharacterAppearance,
      hairStyle: "missing-hair"
    })).toBeNull();

    expect(parseCharacterAppearance({
      ...defaultCharacterAppearance,
      family: "masculine",
      hairStyle: "feminine-long-wave"
    })).toBeNull();
  });

  it("resolves only compatible options for a family", () => {
    const options = resolveAppearanceOptions("masculine");
    expect(options.hairStyles).toHaveLength(8);
    expect(options.outfits).toHaveLength(5);
    expect(options.hairStyles.every((item) => item.family === "masculine")).toBe(true);
  });
});
