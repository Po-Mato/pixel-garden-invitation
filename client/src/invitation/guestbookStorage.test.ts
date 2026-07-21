import { beforeEach, describe, expect, it } from "vitest";

import {
  clearGuestbookCredential,
  loadGuestbookCredential,
  saveGuestbookCredential
} from "./guestbookStorage";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return [...values.keys()][index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); }
  };
}

describe("guestbookStorage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  });

  it("초대장별 방명록 소유권을 저장하고 불러온다", () => {
    const credential = { guestbookId: "guestbook_1", editToken: "secret" };
    expect(saveGuestbookCredential("sample-garden", credential)).toBe(true);
    expect(loadGuestbookCredential("sample-garden")).toEqual(credential);
    expect(loadGuestbookCredential("another")).toBeNull();
  });

  it("손상된 값은 제거하고 삭제 결과를 반환한다", () => {
    localStorage.setItem("wedding:guestbook:sample-garden", "{broken");
    expect(loadGuestbookCredential("sample-garden")).toBeNull();
    expect(localStorage.getItem("wedding:guestbook:sample-garden")).toBeNull();

    saveGuestbookCredential("sample-garden", { guestbookId: "guestbook_1", editToken: "secret" });
    expect(clearGuestbookCredential("sample-garden")).toBe(true);
    expect(clearGuestbookCredential("sample-garden")).toBe(false);
  });
});
