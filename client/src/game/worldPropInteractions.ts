import type { GuestReaction, WorldZoneId } from "@wedding-game/shared";
import type { WorldDecoration, WorldZone } from "./world";

export type WorldPropEffect = "sparkle" | "glow" | "rest" | "scenery";

export type WorldPropInteraction = {
  decorationId: string;
  secretId: string;
  secretLabel: string;
  secretHint: string;
  actionLabel: string;
  resultMessage: string;
  reaction: GuestReaction;
  effect: WorldPropEffect;
  actionRadius: number;
};

const interactionsByZone: Record<WorldZoneId, readonly WorldPropInteraction[]> = {
  home: [{
    decorationId: "home-mail",
    secretId: "first-invitation",
    secretLabel: "첫 초대의 설렘",
    secretHint: "우리 집에 놓인 작은 우편물을 살펴보세요",
    actionLabel: "청첩장 살펴보기",
    resultMessage: "두 사람의 초대장을 다시 한번 정성껏 펼쳐봤어요",
    reaction: "heart",
    effect: "glow",
    actionRadius: 42
  }],
  neighborhood: [{
    decorationId: "street-bench",
    secretId: "garden-pause",
    secretLabel: "꽃길의 쉼표",
    secretHint: "꽃향기가 머무는 골목의 쉼터를 찾아보세요",
    actionLabel: "잠시 쉬기",
    resultMessage: "꽃향기가 스치는 골목 벤치에서 잠시 숨을 골랐어요",
    reaction: "wave",
    effect: "rest",
    actionRadius: 48
  }],
  "subway-station": [{
    decorationId: "station-sign",
    secretId: "promise-route",
    secretLabel: "약속으로 가는 노선",
    secretHint: "탑승장 안에서 목적지를 알려주는 표식을 찾아보세요",
    actionLabel: "노선 확인하기",
    resultMessage: "예식장으로 가는 노선과 내릴 역을 확인했어요",
    reaction: "applause",
    effect: "glow",
    actionRadius: 180
  }],
  "subway-train": [{
    decorationId: "train-window-3",
    secretId: "passing-scenery",
    secretLabel: "스쳐 가는 풍경",
    secretHint: "열차 창밖 풍경이 가장 잘 보이는 곳을 찾아보세요",
    actionLabel: "창밖 바라보기",
    resultMessage: "창밖 풍경을 보며 설레는 마음으로 예식장에 가까워졌어요",
    reaction: "heart",
    effect: "scenery",
    actionRadius: 54
  }],
  "venue-exterior": [{
    decorationId: "venue-fountain",
    secretId: "fountain-wish",
    secretLabel: "분수의 소원",
    secretHint: "예식장 앞에서 반짝이는 물빛을 찾아보세요",
    actionLabel: "소원 빌기",
    resultMessage: "작은 분수 앞에서 두 사람의 행복을 빌었어요",
    reaction: "heart",
    effect: "sparkle",
    actionRadius: 48
  }],
  lobby: [{
    decorationId: "lobby-banner",
    secretId: "welcome-letter",
    secretLabel: "환영의 한마디",
    secretHint: "로비에서 두 사람의 환영 인사를 찾아보세요",
    actionLabel: "환영 문구 보기",
    resultMessage: "환영 가랜드 아래에서 오늘의 축하를 마음에 담았어요",
    reaction: "celebrate",
    effect: "sparkle",
    actionRadius: 60
  }],
  "bridal-room": [{
    decorationId: "bridal-flower-front",
    secretId: "bridal-bouquet",
    secretLabel: "기다림의 꽃향기",
    secretHint: "신부 가까이에서 가장 화사한 꽃을 찾아보세요",
    actionLabel: "꽃향기 맡기",
    resultMessage: "화사한 꽃향기가 신부 대기실을 가득 채우고 있어요",
    reaction: "heart",
    effect: "sparkle",
    actionRadius: 48
  }],
  "ceremony-hall": [{
    decorationId: "hall-lights",
    secretId: "aisle-light",
    secretLabel: "약속을 비추는 빛",
    secretHint: "버진로드 위를 따뜻하게 비추는 빛을 찾아보세요",
    actionLabel: "조명 감상하기",
    resultMessage: "버진로드 위의 조명이 두 사람을 따뜻하게 비추고 있어요",
    reaction: "applause",
    effect: "glow",
    actionRadius: 66
  }],
  restroom: [{
    decorationId: "restroom-mirror-2",
    secretId: "ready-reflection",
    secretLabel: "단정한 마음",
    secretHint: "잠시 모습을 가다듬을 수 있는 반짝이는 곳을 찾아보세요",
    actionLabel: "옷매무새 다듬기",
    resultMessage: "거울 앞에서 옷매무새를 단정하게 다듬었어요",
    reaction: "wave",
    effect: "glow",
    actionRadius: 48
  }],
  banquet: [{
    decorationId: "banquet-buffet",
    secretId: "celebration-table",
    secretLabel: "축하의 식탁",
    secretHint: "연회장에 정성껏 준비된 메뉴를 찾아보세요",
    actionLabel: "메뉴 살펴보기",
    resultMessage: "정성스럽게 준비된 웨딩 메뉴를 살펴봤어요",
    reaction: "celebrate",
    effect: "sparkle",
    actionRadius: 60
  }]
};

export const totalWorldSecrets = Object.values(interactionsByZone)
  .reduce((total, interactions) => total + interactions.length, 0);

export function worldPropInteractionsForZone(zone: WorldZone): Array<{
  decoration: WorldDecoration;
  interaction: WorldPropInteraction;
}> {
  const decorations = new Map(zone.decorations.map((decoration) => [decoration.id, decoration]));
  return interactionsByZone[zone.id].flatMap((interaction) => {
    const decoration = decorations.get(interaction.decorationId);
    return decoration ? [{ decoration, interaction }] : [];
  });
}

export function worldPropInteractionFor(
  zone: WorldZone,
  decorationId: string
): WorldPropInteraction | null {
  return worldPropInteractionsForZone(zone)
    .find(({ decoration }) => decoration.id === decorationId)?.interaction ?? null;
}
