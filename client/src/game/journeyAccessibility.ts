import type { JourneyCheckpoint, JourneyCheckpointId } from "./journeyProgress";

export type JourneyAccessibilityGuide = {
  stepFree: string;
  elevator: string;
  restroom: string;
};

const quickSectionByCheckpoint: Record<JourneyCheckpointId, string> = {
  directions: "directions",
  gallery: "gallery",
  bride: "couple",
  ceremony: "schedule",
  guestbook: "guestbook"
};

const accessibilityGuideByCheckpoint: Record<JourneyCheckpointId, JourneyAccessibilityGuide> = {
  directions: {
    stepFree: "소사역 출구부터 예식장까지 계단 없는 보행 동선을 우선 확인해 주세요.",
    elevator: "역사 내 엘리베이터 운행 위치는 출발 전에 교통 안내에서 확인해 주세요.",
    restroom: "도착 후 접근 가능한 화장실은 5층 안내 데스크에서 확인해 주세요."
  },
  gallery: {
    stepFree: "층과 공간을 옮길 때 계단 대신 완만한 출입구를 이용해 주세요.",
    elevator: "층 이동이 필요하면 로비 안내 데스크에서 엘리베이터 동선을 확인해 주세요.",
    restroom: "가까운 접근 가능 화장실 위치는 예식장 안내 데스크에서 확인해 주세요."
  },
  bride: {
    stepFree: "신부대기실까지 문턱과 계단이 적은 로비 동선을 우선 이용해 주세요.",
    elevator: "5층 도착 후 안내 데스크에서 신부대기실까지의 엘리베이터 동선을 확인해 주세요.",
    restroom: "접근 가능한 화장실 위치는 신부대기실 방문 전에 안내 데스크에서 확인해 주세요."
  },
  ceremony: {
    stepFree: "파티오볼룸 입장 시 계단 없는 중앙 출입 동선을 우선 이용해 주세요.",
    elevator: "층 이동은 계단 대신 예식장 엘리베이터 안내를 따라 주세요.",
    restroom: "예식 전 접근 가능한 화장실 위치를 안내 데스크에서 먼저 확인해 주세요."
  },
  guestbook: {
    stepFree: "방명록으로 이동할 때 계단과 높은 문턱이 없는 로비 동선을 이용해 주세요.",
    elevator: "다른 층에서 오시는 경우 안내 데스크에 엘리베이터 동선을 문의해 주세요.",
    restroom: "접근 가능한 화장실은 방명록 작성 전 안내 데스크에서 위치를 확인해 주세요."
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
