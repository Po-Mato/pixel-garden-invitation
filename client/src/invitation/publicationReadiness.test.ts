import { describe, expect, it } from "vitest";
import {
  invitationContent,
  weddingContentPublication,
  type WeddingContent,
  type WeddingEvent
} from "@wedding-game/shared";

import {
  buildPublicationReadiness,
  type ReadinessRuntime
} from "./publicationReadiness";

const readyRuntime: ReadinessRuntime = {
  rsvp: { state: "ready" },
  guestbook: { state: "ready" },
  notifications: { state: "ready" },
  rsvpDeleteAt: "2027-05-31T14:59:59.000Z",
  guestbookDeleteAt: "2027-05-31T14:59:59.000Z",
  turnstileConfigured: false,
  emailConfigured: false
};

describe("buildPublicationReadiness", () => {
  it("현재 임시 콘텐츠와 운영 TODO를 실제 완료 항목과 분리한다", () => {
    const result = buildPublicationReadiness({
      event: invitationContent.event,
      content: invitationContent.content,
      publication: weddingContentPublication,
      runtime: readyRuntime
    });

    expect(result).toMatchObject({
      readyCount: 8,
      attentionCount: 5,
      pendingCount: 2,
      totalCount: 15,
      percent: 53,
      isReady: false
    });
    expect(result.categories.find(({ id }) => id === "content")?.items)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "gallery", status: "attention" }),
        expect.objectContaining({ id: "couple-introduction", status: "attention" }),
        expect.objectContaining({ id: "story-timeline", status: "attention" })
      ]));
    expect(result.categories.find(({ id }) => id === "operation")?.items)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "turnstile", status: "pending" }),
        expect.objectContaining({ id: "admin-email", status: "pending" })
      ]));
  });

  it("실데이터와 운영 연동이 모두 준비되면 공개 준비 완료가 된다", () => {
    const event = structuredClone(invitationContent.event) as WeddingEvent;
    event.familyContacts.contacts.forEach((contact, index) => {
      Object.assign(contact, { name: contact.name || `혼주 ${index}`, phone: `010-1234-12${index}0` });
    });
    event.giftAccounts.accounts.forEach((account, index) => {
      Object.assign(account, {
        name: account.name || `혼주 ${index}`,
        bank: "은행",
        accountNumber: `123-${index}`,
        holder: `예금주 ${index}`
      });
    });
    const content = structuredClone(invitationContent.content) as WeddingContent;

    const result = buildPublicationReadiness({
      event,
      content,
      publication: {
        gallery: "ready",
        coupleIntroduction: "ready",
        storyTimeline: "ready"
      },
      runtime: { ...readyRuntime, turnstileConfigured: true, emailConfigured: true }
    });

    expect(result).toMatchObject({
      readyCount: 15,
      attentionCount: 0,
      pendingCount: 0,
      percent: 100,
      isReady: true
    });
  });

  it("운영 삭제일이 공통 예식 데이터와 다르면 운영 대기로 표시한다", () => {
    const result = buildPublicationReadiness({
      event: invitationContent.event,
      content: invitationContent.content,
      publication: weddingContentPublication,
      runtime: { ...readyRuntime, guestbookDeleteAt: "2027-06-01T00:00:00.000Z" }
    });

    const retention = result.categories
      .find(({ id }) => id === "operation")
      ?.items.find(({ id }) => id === "retention-sync");
    expect(retention).toMatchObject({ status: "pending" });
  });
});
