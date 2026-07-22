import {
  editableInvitationContentPublishIssues,
  editableInvitationGalleryPublishIssues,
  type EditableInvitationContent,
  type EditableInvitationGallery
} from "@wedding-game/shared";

export type SetupWizardStepId =
  | "event"
  | "contacts"
  | "accounts"
  | "introduction"
  | "story"
  | "share"
  | "gallery"
  | "review";

export type SetupWizardStepProgress = {
  id: SetupWizardStepId;
  label: string;
  completed: number;
  total: number;
  complete: boolean;
};

export const setupWizardIssueLabels: Record<string, string> = {
  family_contacts: "연락처 6건",
  gift_accounts: "계좌 6건",
  couple_introduction: "신랑·신부 소개",
  story_timeline: "4단계 스토리",
  share: "공유 문구",
  images: "웨딩 사진",
  alt_text: "사진 대체 문구"
};

function truthyCount(values: boolean[]): number {
  return values.filter(Boolean).length;
}

export function buildSetupWizardProgress(
  content: EditableInvitationContent,
  gallery: EditableInvitationGallery
): SetupWizardStepProgress[] {
  const contactStates = content.familyContacts.contacts.map(({ name, phone }) => Boolean(name && phone));
  const accountStates = content.giftAccounts.accounts.map(({ name, bank, accountNumber, holder }) => (
    Boolean(name && bank && accountNumber && holder)
  ));
  const introductionStates = [
    content.coupleIntroduction.bride,
    content.coupleIntroduction.groom,
    content.coupleIntroduction.together
  ].map(Boolean);
  const storyStates = content.storyTimeline.map(({ title, body }) => Boolean(title && body));
  const shareStates = [content.share.title, content.share.description].map(Boolean);
  const galleryStates = gallery.photos.map(({ assetId, alt }) => Boolean(assetId && alt));
  const contentIssues = editableInvitationContentPublishIssues(content);
  const galleryIssues = editableInvitationGalleryPublishIssues(gallery);

  const progress: SetupWizardStepProgress[] = [
    { id: "event", label: "예식 정보", completed: 1, total: 1, complete: true },
    {
      id: "contacts",
      label: "연락처",
      completed: truthyCount(contactStates),
      total: contactStates.length,
      complete: contactStates.every(Boolean)
    },
    {
      id: "accounts",
      label: "계좌",
      completed: truthyCount(accountStates),
      total: accountStates.length,
      complete: accountStates.every(Boolean)
    },
    {
      id: "introduction",
      label: "두 사람 소개",
      completed: truthyCount(introductionStates),
      total: introductionStates.length,
      complete: introductionStates.every(Boolean)
    },
    {
      id: "story",
      label: "스토리",
      completed: truthyCount(storyStates),
      total: storyStates.length,
      complete: storyStates.every(Boolean)
    },
    {
      id: "share",
      label: "공유 문구",
      completed: truthyCount(shareStates),
      total: shareStates.length,
      complete: shareStates.every(Boolean)
    },
    {
      id: "gallery",
      label: "웨딩 사진",
      completed: truthyCount(galleryStates),
      total: galleryStates.length,
      complete: galleryStates.length > 0 && galleryStates.every(Boolean)
    }
  ];
  const reviewComplete = contentIssues.length === 0 && galleryIssues.length === 0;
  progress.push({
    id: "review",
    label: "최종 검토",
    completed: reviewComplete ? 1 : 0,
    total: 1,
    complete: reviewComplete
  });
  return progress;
}

export function setupWizardBlockers(
  content: EditableInvitationContent,
  gallery: EditableInvitationGallery
): string[] {
  return [
    ...editableInvitationContentPublishIssues(content),
    ...editableInvitationGalleryPublishIssues(gallery)
  ].map((issue) => setupWizardIssueLabels[issue] ?? issue);
}
