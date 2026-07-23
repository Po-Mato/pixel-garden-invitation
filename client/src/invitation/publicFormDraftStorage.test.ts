import { describe, expect, it } from "vitest";
import {
  clearGuestbookFormDraft,
  loadGuestbookFormDraft,
  loadRsvpFormDraft,
  saveGuestbookFormDraft,
  saveRsvpFormDraft
} from "./publicFormDraftStorage";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); }
  };
}

describe("공개 폼 임시 저장", () => {
  it("참석 답변을 저장하고 7일 안에 복원한다", () => {
    const storage = memoryStorage();
    const now = new Date("2027-04-01T00:00:00.000Z");
    const value = {
      side: "bride" as const,
      guestName: "김하객",
      phone: "01012345678",
      attendance: "yes" as const,
      partySize: 2,
      mealStatus: "yes" as const,
      note: "축하합니다",
      consentVersion: "2027-01"
    };

    expect(saveRsvpFormDraft("sample", value, storage, now)?.value).toEqual(value);
    expect(loadRsvpFormDraft("sample", storage, now.getTime() + 1_000)?.value).toEqual(value);
  });

  it("만료된 임시 저장은 복원하지 않는다", () => {
    const storage = memoryStorage();
    const now = new Date("2027-04-01T00:00:00.000Z");
    saveGuestbookFormDraft("sample", { nickname: "하객", message: "축하해요" }, storage, now);

    expect(loadGuestbookFormDraft("sample", storage, now.getTime() + 8 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("전송 완료 후 방명록 임시 저장을 지운다", () => {
    const storage = memoryStorage();
    saveGuestbookFormDraft("sample", { nickname: "하객", message: "축하해요" }, storage);

    expect(clearGuestbookFormDraft("sample", storage)).toBe(true);
    expect(loadGuestbookFormDraft("sample", storage)).toBeNull();
  });
});
