import { describe, expect, it } from "vitest";
import { characterCatalog } from "./characterCatalog";
import { guestPartManifest } from "./guestPartManifest";

const sortIds = (ids: string[]) => [...ids].sort((left, right) => left.localeCompare(right));

describe("guest part manifest", () => {
  it("uses the approved high-density guest frame contract", () => {
    expect(guestPartManifest.frame.source).toEqual({ width: 96, height: 144 });
    expect(guestPartManifest.frame.walk.sheet).toEqual({ width: 288, height: 576 });
    expect(guestPartManifest.frame.walk.columns).toBe(3);
    expect(guestPartManifest.frame.walk.rows).toEqual(["down", "left", "right", "up"]);
    expect(guestPartManifest.frame.idle.sheet).toEqual({ width: 192, height: 144 });
    expect(guestPartManifest.frame.idle.columns).toBe(2);
    expect(guestPartManifest.frame.display.world).toEqual({ width: 48, height: 72 });
    expect(guestPartManifest.frame.display.preview).toEqual({ width: 96, height: 144 });
  });

  it("keeps the approved render layer order", () => {
    expect(guestPartManifest.layerOrder).toEqual([
      "back-accessory",
      "back-hair",
      "base",
      "outfit",
      "front-hair",
      "face",
      "jewelry",
      "neckwear",
      "carry"
    ]);
  });

  it("covers every selectable catalog id", () => {
    expect(sortIds(guestPartManifest.parts.base.map((part) => part.id))).toEqual(["feminine", "masculine"]);
    expect(sortIds(guestPartManifest.parts.hair.map((part) => part.id))).toEqual(
      sortIds(characterCatalog.hairStyles.map((item) => item.id))
    );
    expect(sortIds(guestPartManifest.parts.outfits.map((part) => part.id))).toEqual(
      sortIds(characterCatalog.outfits.map((item) => item.id))
    );
    expect(sortIds(guestPartManifest.parts.accessories.map((part) => part.id))).toEqual(
      sortIds(characterCatalog.accessories.map((item) => item.id))
    );
  });

  it("keeps catalog family, slot, and layer metadata aligned", () => {
    for (const style of characterCatalog.hairStyles) {
      const part = guestPartManifest.parts.hair.find((item) => item.id === style.id);
      expect(part?.family).toBe(style.family);
      expect(part?.layers).toEqual({ back: "back-hair", front: "front-hair" });
    }

    for (const outfit of characterCatalog.outfits) {
      const part = guestPartManifest.parts.outfits.find((item) => item.id === outfit.id);
      expect(part?.family).toBe(outfit.family);
      expect(part?.layer).toBe("outfit");
    }

    for (const accessory of characterCatalog.accessories) {
      const part = guestPartManifest.parts.accessories.find((item) => item.id === accessory.id);
      expect(part?.slot).toBe(accessory.slot);
      expect(part?.layer).toBe(accessory.layer);
    }
  });
});
