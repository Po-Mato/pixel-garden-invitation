import type {
  WeddingContent,
  WeddingContentPublication,
  WeddingEvent
} from "@wedding-game/shared";

export type ReadinessStatus = "ready" | "attention" | "pending";
export type ReadinessServiceState = "checking" | "ready" | "error";

export type ReadinessService = {
  state: ReadinessServiceState;
  detail?: string;
};

export type ReadinessRuntime = {
  rsvp: ReadinessService;
  guestbook: ReadinessService;
  notifications: ReadinessService;
  rsvpDeleteAt?: string;
  guestbookDeleteAt?: string;
  turnstileConfigured?: boolean;
  emailConfigured?: boolean;
};

export type ReadinessItem = {
  id: string;
  label: string;
  detail: string;
  status: ReadinessStatus;
};

export type ReadinessCategory = {
  id: "event" | "content" | "contact" | "operation";
  title: string;
  description: string;
  items: ReadinessItem[];
};

export type PublicationReadiness = {
  categories: ReadinessCategory[];
  readyCount: number;
  attentionCount: number;
  pendingCount: number;
  totalCount: number;
  percent: number;
  isReady: boolean;
};

type BuildPublicationReadinessInput = {
  event: WeddingEvent;
  content: WeddingContent;
  publication: WeddingContentPublication;
  runtime: ReadinessRuntime;
};

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function validDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function completeContactCount(event: WeddingEvent): number {
  return event.familyContacts.contacts.filter((contact) => (
    hasText(contact.name) && hasText(contact.phone)
  )).length;
}

function completeAccountCount(event: WeddingEvent): number {
  return event.giftAccounts.accounts.filter((account) => (
    hasText(account.name)
    && hasText(account.bank)
    && hasText(account.accountNumber)
    && hasText(account.holder)
  )).length;
}

function serviceItem(
  id: string,
  label: string,
  service: ReadinessService,
  readyDetail: string
): ReadinessItem {
  if (service.state === "ready") {
    return { id, label, detail: service.detail || readyDetail, status: "ready" };
  }
  if (service.state === "checking") {
    return { id, label, detail: "운영 응답을 확인하고 있습니다.", status: "pending" };
  }
  return {
    id,
    label,
    detail: service.detail || "운영 응답을 확인하지 못했습니다. 다시 점검해 주세요.",
    status: "pending"
  };
}

function deletionPolicyReady(event: WeddingEvent, runtime: ReadinessRuntime): boolean {
  if (!runtime.rsvpDeleteAt || !runtime.guestbookDeleteAt) return false;
  const configuredRsvpDeleteAt = new Date(event.rsvp.deleteAt).getTime();
  const configuredGuestbookDeleteAt = new Date(event.guestbook.deleteAt).getTime();
  const liveRsvpDeleteAt = new Date(runtime.rsvpDeleteAt).getTime();
  const liveGuestbookDeleteAt = new Date(runtime.guestbookDeleteAt).getTime();
  return Number.isFinite(liveRsvpDeleteAt)
    && Number.isFinite(liveGuestbookDeleteAt)
    && liveRsvpDeleteAt === configuredRsvpDeleteAt
    && liveGuestbookDeleteAt === configuredGuestbookDeleteAt;
}

export function buildPublicationReadiness({
  event,
  content,
  publication,
  runtime
}: BuildPublicationReadinessInput): PublicationReadiness {
  const eventStart = new Date(event.startAt).getTime();
  const eventEnd = new Date(event.endAt).getTime();
  const deadline = new Date(event.rsvp.responseDeadline).getTime();
  const eventReady = hasText(event.couple.bride)
    && hasText(event.couple.groom)
    && validDate(event.startAt)
    && validDate(event.endAt)
    && eventEnd - eventStart === 90 * 60 * 1_000;
  const venueReady = [
    event.venue.name,
    event.venue.hall,
    event.venue.address,
    event.venue.directions.mapSearchName,
    event.venue.directions.phone,
    event.venue.directions.transit,
    event.venue.directions.parking
  ].every(hasText);
  const lifecycleReady = Number.isFinite(deadline)
    && deadline < eventStart
    && new Date(event.rsvp.deleteAt).getTime() > eventEnd
    && new Date(event.guestbook.deleteAt).getTime() > eventEnd
    && hasText(event.rsvp.consentVersion);
  const shareReady = event.title.includes(event.couple.bride)
    && event.title.includes(event.couple.groom)
    && content.gallery[0]?.id === "01-cover"
    && hasText(content.gallery[0]?.alt ?? "");
  const contactsReady = completeContactCount(event);
  const accountsReady = completeAccountCount(event);
  const expectedContacts = event.familyContacts.contacts.length;
  const expectedAccounts = event.giftAccounts.accounts.length;
  const galleryReady = publication.gallery === "ready"
    && content.gallery.length >= 8
    && content.gallery.length <= 12
    && content.gallery.every((photo) => hasText(photo.alt));
  const introductionReady = publication.coupleIntroduction === "ready"
    && content.coupleProfiles.every((profile) => hasText(profile.message))
    && hasText(content.coupleMessage);
  const storyReady = publication.storyTimeline === "ready"
    && content.storyTimeline.length === 4
    && content.storyTimeline.every((step) => hasText(step.title) && hasText(step.body));
  const retentionReady = deletionPolicyReady(event, runtime);

  const categories: ReadinessCategory[] = [
    {
      id: "event",
      title: "예식 기본 정보",
      description: "초대장 전체에서 공통으로 사용하는 확정 정보입니다.",
      items: [
        {
          id: "event-schedule",
          label: "신랑·신부와 예식 일정",
          detail: eventReady ? "이름과 90분 예식 일정이 설정되어 있습니다." : "이름 또는 예식 일정을 확인해 주세요.",
          status: eventReady ? "ready" : "attention"
        },
        {
          id: "venue-directions",
          label: "예식장과 오시는 길",
          detail: venueReady ? "주소, 대중교통, 주차, 전화 정보가 준비되어 있습니다." : "예식장 또는 교통 정보를 보완해 주세요.",
          status: venueReady ? "ready" : "attention"
        },
        {
          id: "rsvp-lifecycle",
          label: "응답 마감과 개인정보 보관",
          detail: lifecycleReady ? "응답 마감, 동의 버전, 자동 삭제일이 설정되어 있습니다." : "마감일과 자동 삭제 정책을 확인해 주세요.",
          status: lifecycleReady ? "ready" : "attention"
        },
        {
          id: "share-metadata",
          label: "공유 미리보기 기본 정보",
          detail: shareReady ? "두 사람의 이름과 대표 이미지 정보가 연결되어 있습니다." : "공유 제목 또는 대표 이미지 정보를 확인해 주세요.",
          status: shareReady ? "ready" : "attention"
        }
      ]
    },
    {
      id: "content",
      title: "사진·소개·스토리",
      description: "현재 임시 콘텐츠가 실제 웨딩 콘텐츠로 교체되었는지 확인합니다.",
      items: [
        {
          id: "gallery",
          label: "실제 웨딩 사진",
          detail: galleryReady ? `실제 사진 ${content.gallery.length}장이 준비되어 있습니다.` : `현재 ${content.gallery.length}장은 임시 이미지입니다. 실제 사진과 대체 텍스트로 교체해 주세요.`,
          status: galleryReady ? "ready" : "attention"
        },
        {
          id: "couple-introduction",
          label: "신랑·신부 소개 문구",
          detail: introductionReady ? "개별 소개와 함께 전하는 문구가 확정되었습니다." : "현재 문구는 초안입니다. 실제 소개 문구를 확정해 주세요.",
          status: introductionReady ? "ready" : "attention"
        },
        {
          id: "story-timeline",
          label: "네 단계 스토리",
          detail: storyReady ? "네 단계 스토리와 사진 연결이 확정되었습니다." : "현재 스토리는 초안입니다. 실제 이야기와 사진을 확정해 주세요.",
          status: storyReady ? "ready" : "attention"
        }
      ]
    },
    {
      id: "contact",
      title: "연락처·마음 전하실 곳",
      description: "입력된 항목만 공개되므로 실제 데이터 입력 현황을 표시합니다.",
      items: [
        {
          id: "family-contacts",
          label: "신랑·신부와 혼주 연락처",
          detail: contactsReady === expectedContacts
            ? `연락처 ${expectedContacts}건이 모두 준비되어 있습니다.`
            : `완료 ${contactsReady}/${expectedContacts}건 · 성함과 전화번호를 입력해 주세요.`,
          status: contactsReady === expectedContacts ? "ready" : "attention"
        },
        {
          id: "gift-accounts",
          label: "계좌와 간편송금",
          detail: accountsReady === expectedAccounts
            ? `계좌 ${expectedAccounts}건이 모두 준비되어 있습니다.`
            : `완료 ${accountsReady}/${expectedAccounts}건 · 은행, 계좌번호, 예금주를 입력해 주세요.`,
          status: accountsReady === expectedAccounts ? "ready" : "attention"
        }
      ]
    },
    {
      id: "operation",
      title: "응답·운영 연동",
      description: "관리자 인증 후 실제 Worker와 데이터 저장소 상태를 점검합니다.",
      items: [
        serviceItem("rsvp-service", "참석 답변 API·DB", runtime.rsvp, "참석 답변 조회와 데이터 저장소가 응답합니다."),
        serviceItem("guestbook-service", "방명록 API·DB", runtime.guestbook, "방명록 조회와 데이터 저장소가 응답합니다."),
        serviceItem("notification-service", "관리자 화면 알림", runtime.notifications, "신규 응답 알림 저장소가 응답합니다."),
        {
          id: "retention-sync",
          label: "운영 자동 삭제일 일치",
          detail: retentionReady
            ? "RSVP와 방명록의 운영 삭제일이 공통 예식 데이터와 일치합니다."
            : runtime.rsvp.state === "checking" || runtime.guestbook.state === "checking"
              ? "운영 삭제일을 확인하고 있습니다."
              : "운영 삭제일과 공통 예식 데이터가 일치하는지 확인해 주세요.",
          status: retentionReady ? "ready" : "pending"
        },
        {
          id: "turnstile",
          label: "공개 폼 스팸 방지",
          detail: runtime.turnstileConfigured
            ? "Turnstile 운영 검증이 연결되어 있습니다."
            : "Turnstile 운영 키와 검증 Worker 연결이 필요합니다.",
          status: runtime.turnstileConfigured ? "ready" : "pending"
        },
        {
          id: "admin-email",
          label: "관리자 이메일 알림",
          detail: runtime.emailConfigured
            ? "관리자 수신 이메일이 연결되어 있습니다."
            : "발신 도메인과 관리자 수신 이메일 연결이 필요합니다.",
          status: runtime.emailConfigured ? "ready" : "pending"
        }
      ]
    }
  ];

  const items = categories.flatMap((category) => category.items);
  const readyCount = items.filter((item) => item.status === "ready").length;
  const attentionCount = items.filter((item) => item.status === "attention").length;
  const pendingCount = items.filter((item) => item.status === "pending").length;
  const totalCount = items.length;

  return {
    categories,
    readyCount,
    attentionCount,
    pendingCount,
    totalCount,
    percent: totalCount === 0 ? 0 : Math.round((readyCount / totalCount) * 100),
    isReady: readyCount === totalCount
  };
}
