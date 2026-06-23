import { defaultCharacterAppearance } from "@wedding-game/shared";
import { expect, it } from "vitest";
import { resolveCharacterLayers } from "./assets";

it("resolves generated guest layer paths in render order", () => {
  const layers = resolveCharacterLayers(defaultCharacterAppearance, "./");

  expect(layers).toEqual([
    {
      slot: "back-hair",
      walkUrl: "./characters/generated/hair/feminine-long-wave__dark-brown__back-walk.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    },
    {
      slot: "base",
      walkUrl: "./characters/generated/base/feminine__skin-02-fair__walk.png",
      idleUrl: "./characters/generated/base/feminine__skin-02-fair__idle.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    },
    {
      slot: "outfit",
      walkUrl: "./characters/generated/outfits/feminine-midi-dress__dusty-rose__walk.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    },
    {
      slot: "front-hair",
      walkUrl: "./characters/generated/hair/feminine-long-wave__dark-brown__front-walk.png",
      sourceSize: { width: 96, height: 144 },
      displaySize: {
        world: { width: 48, height: 72 },
        preview: { width: 96, height: 144 }
      }
    }
  ]);
});

it("places accessories in catalog-defined layers", () => {
  expect(resolveCharacterLayers({
    ...defaultCharacterAppearance,
    accessories: {
      face: "glasses-round-gold",
      jewelry: "earrings-pearl",
      neckwear: "brooch-floral",
      carry: "shoulder-bag-structured"
    }
  }, "./").map((layer) => layer.slot)).toEqual([
    "back-accessory",
    "back-hair",
    "base",
    "outfit",
    "front-hair",
    "face",
    "jewelry",
    "neckwear"
  ]);
});
