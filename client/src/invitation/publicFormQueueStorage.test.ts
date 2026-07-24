import { beforeEach, describe, expect, it } from "vitest";
import { installMemoryLocalStorage } from "../test/memoryStorage";
import {
  clearGuestbookSendQueue,
  loadGuestbookSendQueue,
  loadRsvpSendQueue,
  saveGuestbookSendQueue,
  saveRsvpSendQueue
} from "./publicFormQueueStorage";

const rsvp = {
  side: "bride" as const,
  guestName: "오프라인 하객",
  phone: "01012345678",
  attendance: "yes" as const,
  partySize: 2,
  mealStatus: "yes" as const,
  note: "곧 만나요",
  consentVersion: "2026-07-01"
};

beforeEach(() => installMemoryLocalStorage());

describe("공개 폼 전송 대기함", () => {
  it("RSVP를 기기에 저장하고 7일 뒤 만료시킨다", () => {
    const queuedAt = new Date("2027-04-20T00:00:00.000Z");
    expect(saveRsvpSendQueue("sample", rsvp, undefined, queuedAt)?.value).toEqual(rsvp);
    expect(loadRsvpSendQueue("sample", undefined, queuedAt.getTime() + 6 * 86_400_000)?.value).toEqual(rsvp);
    expect(loadRsvpSendQueue("sample", undefined, queuedAt.getTime() + 8 * 86_400_000)).toBeNull();
  });

  it("방명록 대기 항목을 저장하고 삭제한다", () => {
    saveGuestbookSendQueue("sample", { nickname: "하객", message: "축하합니다" });
    expect(loadGuestbookSendQueue("sample")?.value.message).toBe("축하합니다");
    expect(clearGuestbookSendQueue("sample")).toBe(true);
    expect(loadGuestbookSendQueue("sample")).toBeNull();
  });
});
