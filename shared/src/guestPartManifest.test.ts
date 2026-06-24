import { describe, expect, it } from "vitest";
import { guestPartManifest } from "./guestPartManifest";

describe("legacy guest part manifest", () => {
  it("keeps the previous high-density frame contract for archived part assets", () => {
    expect(guestPartManifest.frame.source).toEqual({ width: 96, height: 144 });
    expect(guestPartManifest.frame.walk.sheet).toEqual({ width: 288, height: 576 });
    expect(guestPartManifest.frame.idle.sheet).toEqual({ width: 192, height: 144 });
  });

  it("is not the runtime guest selection contract", () => {
    expect(guestPartManifest.parts.base.map((part) => part.id).sort()).toEqual(["feminine", "masculine"]);
  });
});
