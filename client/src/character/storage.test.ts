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

it("deletes invalid saved appearance", () => {
  window.localStorage.setItem("pixel-garden-character-v1", JSON.stringify({ family: "bad" }));
  expect(loadAppearance()).toBeNull();
  expect(window.localStorage.getItem("pixel-garden-character-v1")).toBeNull();
});
