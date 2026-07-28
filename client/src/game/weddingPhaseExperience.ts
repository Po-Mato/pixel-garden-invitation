import type { WeddingJourneyTiming } from "./weddingJourneyTiming";

export type WeddingPhaseExperience = {
  phase: WeddingJourneyTiming["phase"];
  eyebrow: string;
  title: string;
  detail: string;
  ambience: "morning" | "golden" | "ceremony" | "celebration";
};

export function weddingPhaseExperience(
  timing: WeddingJourneyTiming | null
): WeddingPhaseExperience | null {
  if (!timing) return null;
  if (timing.phase === "soon") return {
    phase: timing.phase,
    eyebrow: "CEREMONY SOON",
    title: "예식이 곧 시작돼요",
    detail: "조명이 따뜻해지고 예식홀 안내가 우선 표시됩니다.",
    ambience: "golden"
  };
  if (timing.phase === "ceremony") return {
    phase: timing.phase,
    eyebrow: "CEREMONY NOW",
    title: "두 사람의 예식이 진행 중이에요",
    detail: "NPC가 예식 흐름에 맞춰 조용히 안내합니다.",
    ambience: "ceremony"
  };
  if (timing.phase === "reception") return {
    phase: timing.phase,
    eyebrow: "CELEBRATION",
    title: "축하와 인사를 나눌 시간이에요",
    detail: "연회장과 축하 메시지 여정을 이어가세요.",
    ambience: "celebration"
  };
  return {
    phase: timing.phase,
    eyebrow: "WEDDING DAY",
    title: timing.label,
    detail: "정원을 천천히 둘러보며 두 사람의 이야기를 만나보세요.",
    ambience: "morning"
  };
}
