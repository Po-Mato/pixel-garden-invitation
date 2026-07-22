import { describe, expect, it } from "vitest";
import { invitationContent } from "./content";
import {
  buildDefaultEditableInvitationContent,
  editableInvitationContentPublishIssues,
  parseEditableInvitationContent
} from "./editableInvitationContent";

function defaultContent() {
  return buildDefaultEditableInvitationContent(invitationContent.event, invitationContent.content);
}

describe("editable invitation content", () => {
  it("정적 초대장 데이터에서 편집 가능한 기본값을 만든다", () => {
    const content = defaultContent();

    expect(content.familyContacts.contacts).toHaveLength(6);
    expect(content.giftAccounts.accounts).toHaveLength(6);
    expect(content.storyTimeline.map(({ id }) => id)).toEqual(["hello", "seasons", "promise", "wedding"]);
    expect(content.coupleIntroduction.bride).toContain("함께 걷는 첫날");
    expect(content.share.title).toContain("{names}");
    expect(parseEditableInvitationContent(content)).toEqual(content);
  });

  it("연락처 순서, 전화번호, HTTPS 송금 링크와 글자 수를 검증한다", () => {
    const wrongOrder = defaultContent();
    wrongOrder.familyContacts.contacts.reverse();
    expect(parseEditableInvitationContent(wrongOrder)).toBeNull();

    const wrongPhone = defaultContent();
    wrongPhone.familyContacts.contacts[0].phone = "call-me";
    expect(parseEditableInvitationContent(wrongPhone)).toBeNull();

    const insecurePay = defaultContent();
    insecurePay.giftAccounts.accounts[0].kakaoPayUrl = "http://pay.example.com";
    expect(parseEditableInvitationContent(insecurePay)).toBeNull();

    const longStory = defaultContent();
    longStory.storyTimeline[0].body = "가".repeat(401);
    expect(parseEditableInvitationContent(longStory)).toBeNull();
  });

  it("미완성 초안은 저장 가능하지만 공개 차단 항목을 구분한다", () => {
    expect(editableInvitationContentPublishIssues(defaultContent())).toEqual([
      "family_contacts",
      "gift_accounts"
    ]);

    const complete = defaultContent();
    complete.familyContacts.contacts.forEach((contact, index) => {
      contact.name ||= `혼주 ${index}`;
      contact.phone = `010-1234-12${index}0`;
    });
    complete.giftAccounts.accounts.forEach((account, index) => {
      account.name ||= `혼주 ${index}`;
      account.bank = "은행";
      account.accountNumber = `123-${index}`;
      account.holder = `예금주 ${index}`;
    });

    expect(editableInvitationContentPublishIssues(complete)).toEqual([]);
  });
});
