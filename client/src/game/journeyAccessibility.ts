import type { JourneyCheckpoint, JourneyCheckpointId } from "./journeyProgress";

export type JourneyAccessibilityGuide = {
  stepFree: string;
  elevator: string;
  restroom: string;
};

export const venueAccessibilityVerification = {
  checkedLabel: "2026년 7월 공식 안내 확인",
  confirmed: "소사역 1번 출구에서 70m · 경기 부천시 소사구 경인로 386",
  needsConfirmation: "엘리베이터, 무단차 주출입구, 접근 가능한 화장실의 위치는 공개 안내에 없어 방문 전 확인이 필요합니다.",
  phone: "032-347-5500",
  phoneHref: "tel:0323475500"
} as const;

const quickSectionByCheckpoint: Record<JourneyCheckpointId, string> = {
  directions: "directions",
  gallery: "gallery",
  bride: "couple",
  ceremony: "schedule",
  guestbook: "guestbook"
};

const accessibilityGuideByCheckpoint: Record<JourneyCheckpointId, JourneyAccessibilityGuide> = {
  directions: {
    stepFree: "공식 안내는 소사역 1번 출구에서 70m입니다. 계단 없는 보행 동선은 방문 전에 확인해 주세요.",
    elevator: "역사와 예식장 엘리베이터의 실제 운행 위치는 출발 전에 확인해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 예식장 대표전화로 확인해 주세요."
  },
  gallery: {
    stepFree: "갤러리까지 계단·문턱과 단차가 없는 동선은 도착 후 안내 데스크에서 확인해 주세요.",
    elevator: "층 이동에 필요한 엘리베이터 위치와 운행 여부는 예식장에 문의해 주세요.",
    restroom: "가까운 접근 가능 화장실의 실제 위치는 예식장에 문의해 주세요."
  },
  bride: {
    stepFree: "신부대기실까지 계단·문턱과 단차가 없는 동선은 방문 전에 예식장에 확인해 주세요.",
    elevator: "5층 이동에 필요한 엘리베이터 위치와 운행 여부는 예식장에 미리 문의해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 신부대기실 방문 전에 확인해 주세요."
  },
  ceremony: {
    stepFree: "5층 파티오볼룸까지 계단 없이 이어지는 출입 동선은 방문 전에 예식장에 확인해 주세요.",
    elevator: "5층까지 이용할 엘리베이터 위치와 운행 여부는 예식장에 미리 문의해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 예식 전 대표전화로 확인해 주세요."
  },
  guestbook: {
    stepFree: "방명록까지 계단·문턱과 단차가 없는 동선은 도착 후 안내 데스크에서 확인해 주세요.",
    elevator: "다른 층에서 오시는 경우 엘리베이터 위치와 운행 여부를 예식장에 문의해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 방명록 작성 전에 확인해 주세요."
  }
};

export function journeyAccessibilityGuide(
  checkpoint: Pick<JourneyCheckpoint, "id">
): JourneyAccessibilityGuide {
  return accessibilityGuideByCheckpoint[checkpoint.id];
}

export function quickInvitationSectionForCheckpoint(
  checkpoint: Pick<JourneyCheckpoint, "id">
): string {
  return quickSectionByCheckpoint[checkpoint.id];
}

export function quickInvitationHashForCheckpoint(
  checkpoint: Pick<JourneyCheckpoint, "id">
): `#${string}` {
  return `#${quickInvitationSectionForCheckpoint(checkpoint)}`;
}
