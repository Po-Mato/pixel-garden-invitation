import {
  buildDefaultEditableInvitationContent,
  buildDefaultEditableInvitationGallery,
  invitationContent
} from "@wedding-game/shared";
import { describe, expect, it } from "vitest";
import { buildSetupWizardProgress, setupWizardBlockers } from "./setupWizard";

function drafts() {
  return {
    content: buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content),
    gallery: buildDefaultEditableInvitationGallery(invitationContent.content)
  };
}

describe("실데이터 일괄 입력 완료도", () => {
  it("기본 초안에서 실제 연락처·계좌·사진 누락을 단계별로 표시한다", () => {
    const { content, gallery } = drafts();
    const progress = buildSetupWizardProgress(content, gallery);

    expect(progress.find(({ id }) => id === "event")?.complete).toBe(true);
    expect(progress.find(({ id }) => id === "contacts")).toMatchObject({ completed: 0, total: 6, complete: false });
    expect(progress.find(({ id }) => id === "accounts")).toMatchObject({ completed: 0, total: 6, complete: false });
    expect(progress.find(({ id }) => id === "gallery")).toMatchObject({ completed: 0, total: 10, complete: false });
    expect(setupWizardBlockers(content, gallery)).toEqual([
      "연락처 6건",
      "계좌 6건",
      "웨딩 사진"
    ]);
  });

  it("모든 필수 데이터가 채워지면 최종 검토를 완료 처리한다", () => {
    const { content, gallery } = drafts();
    content.familyContacts.contacts.forEach((contact, index) => {
      contact.name ||= `연락처 ${index + 1}`;
      contact.phone = `010-1234-12${index}0`;
    });
    content.giftAccounts.accounts.forEach((account, index) => {
      account.name ||= `계좌 ${index + 1}`;
      account.bank = "은행";
      account.accountNumber = `123-${index}`;
      account.holder = `예금주 ${index + 1}`;
    });
    gallery.photos.forEach((photo, index) => {
      photo.assetId = `12345678-1234-4123-8123-${String(index).padStart(12, "0")}`;
    });

    const progress = buildSetupWizardProgress(content, gallery);
    expect(progress.every(({ complete }) => complete)).toBe(true);
    expect(setupWizardBlockers(content, gallery)).toEqual([]);
  });
});
