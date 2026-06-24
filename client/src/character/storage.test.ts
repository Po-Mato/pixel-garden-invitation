import { defaultCharacterAppearance } from "@wedding-game/shared";
import { beforeEach, expect, it } from "vitest";
import { loadAppearance, saveAppearance } from "./storage";

const values = new Map<string, string>();
const storage: Storage = {
  get length() {
    return values.size;
  },
  clear() {
    values.clear();
  },
  getItem(key) {
    return values.get(key) ?? null;
  },
  key(index) {
    return [...values.keys()][index] ?? null;
  },
  removeItem(key) {
    values.delete(key);
  },
  setItem(key, value) {
    values.set(key, value);
  }
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storage
});

beforeEach(() => {
  window.localStorage.clear();
});

it("loads a valid saved appearance", () => {
  window.localStorage.setItem("pixel-garden-character-v1", JSON.stringify(defaultCharacterAppearance));
  expect(loadAppearance()).toEqual(defaultCharacterAppearance);
});

it("saves an appearance in the versioned storage key", () => {
  saveAppearance(defaultCharacterAppearance);
  expect(JSON.parse(window.localStorage.getItem("pixel-garden-character-v1") ?? "null"))
    .toEqual(defaultCharacterAppearance);
});

it("알 수 없는 appearance 객체를 기본 프리셋으로 변환해서 로드한다", () => {
  window.localStorage.setItem("pixel-garden-character-v1", JSON.stringify({ family: "bad" }));
  expect(loadAppearance()).toEqual(defaultCharacterAppearance);
  expect(JSON.parse(window.localStorage.getItem("pixel-garden-character-v1") ?? "null"))
    .toEqual(defaultCharacterAppearance);
});

it("구버전 조합형 appearance를 기본 프리셋으로 변환해서 로드한다", () => {
  window.localStorage.setItem("pixel-garden-character-v1", JSON.stringify({
    family: "feminine",
    skinTone: "skin-02-fair",
    hairStyle: "feminine-long-wave",
    hairColor: "dark-brown",
    outfit: "feminine-midi-dress",
    outfitPalette: "dusty-rose",
    accessories: { face: null, jewelry: null, neckwear: null, carry: null }
  }));

  expect(loadAppearance()).toEqual(defaultCharacterAppearance);
});
