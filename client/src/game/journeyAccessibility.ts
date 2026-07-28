import type { JourneyCheckpoint, JourneyCheckpointId } from "./journeyProgress";

export type JourneyAccessibilityGuide = {
  stepFree: string;
  elevator: string;
  restroom: string;
  landmark: string;
  seating: string;
  arrival: string;
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
    restroom: "접근 가능한 화장실의 층과 위치는 예식장 대표전화로 확인해 주세요.",
    landmark: "게임에서는 집 앞 안내 표지판이 도착 지점입니다.",
    seating: "잠시 쉬어야 한다면 실제 예식장 좌석 위치를 대표전화로 확인해 주세요.",
    arrival: "소사역 1번 출구에서 예식장까지 실제 무단차 동선은 출발 전에 확인해 주세요."
  },
  gallery: {
    stepFree: "갤러리까지 계단·문턱과 단차가 없는 동선은 도착 후 안내 데스크에서 확인해 주세요.",
    elevator: "층 이동에 필요한 엘리베이터 위치와 운행 여부는 예식장에 문의해 주세요.",
    restroom: "가까운 접근 가능 화장실의 실제 위치는 예식장에 문의해 주세요.",
    landmark: "게임에서는 로비 중앙 갤러리 프레임이 도착 지점입니다.",
    seating: "갤러리 인근 휴식 좌석의 실제 배치는 안내 데스크에서 확인해 주세요.",
    arrival: "로비 진입 후 안내 데스크에 계단 없는 갤러리 동선을 요청해 주세요."
  },
  bride: {
    stepFree: "신부대기실까지 계단·문턱과 단차가 없는 동선은 방문 전에 예식장에 확인해 주세요.",
    elevator: "5층 이동에 필요한 엘리베이터 위치와 운행 여부는 예식장에 미리 문의해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 신부대기실 방문 전에 확인해 주세요.",
    landmark: "게임에서는 꽃 장식 안쪽 신부 캐릭터가 도착 지점입니다.",
    seating: "대기실 동반석과 휠체어 회전 공간은 현장 안내 직원에게 요청해 주세요.",
    arrival: "5층 도착 후 신부대기실까지 문턱 없는 동선을 안내 직원에게 요청해 주세요."
  },
  ceremony: {
    stepFree: "5층 파티오볼룸까지 계단 없이 이어지는 출입 동선은 방문 전에 예식장에 확인해 주세요.",
    elevator: "5층까지 이용할 엘리베이터 위치와 운행 여부는 예식장에 미리 문의해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 예식 전 대표전화로 확인해 주세요.",
    landmark: "게임에서는 버진로드 끝의 웨딩 아치가 도착 지점입니다.",
    seating: "통로 가까운 좌석이나 휠체어석은 실제 예식 전에 예식장에 요청해 주세요.",
    arrival: "예식홀 입구에서 좌석까지 계단 없는 동선과 좌석 안내를 직원에게 요청해 주세요."
  },
  guestbook: {
    stepFree: "방명록까지 계단·문턱과 단차가 없는 동선은 도착 후 안내 데스크에서 확인해 주세요.",
    elevator: "다른 층에서 오시는 경우 엘리베이터 위치와 운행 여부를 예식장에 문의해 주세요.",
    restroom: "접근 가능한 화장실의 층과 위치는 방명록 작성 전에 확인해 주세요.",
    landmark: "게임에서는 연회장 오른쪽 축하 메시지 테이블이 도착 지점입니다.",
    seating: "게임 식탁 주변은 이동할 수 있으며 실제 접근 가능한 좌석은 현장에서 요청해 주세요.",
    arrival: "연회장 입구에서 방명록과 좌석까지 넓은 통로 안내를 직원에게 요청해 주세요."
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
