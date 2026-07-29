type AuditRect = { x: number; y: number; width: number; height: number };

export type GameHudAuditViewport = {
  id: "tiny-portrait" | "small-android" | "phone-landscape" | "foldable";
  width: number;
  height: number;
  safeBottom: number;
};

export type GameHudAuditMode = "standard" | "one-handed-left" | "one-handed-right";

export const gameHudAuditViewports: readonly GameHudAuditViewport[] = [
  { id: "tiny-portrait", width: 320, height: 471, safeBottom: 20 },
  { id: "small-android", width: 360, height: 640, safeBottom: 16 },
  { id: "phone-landscape", width: 667, height: 278, safeBottom: 0 },
  { id: "foldable", width: 717, height: 415, safeBottom: 0 }
];

export const gameHudAuditModes: readonly GameHudAuditMode[] = [
  "standard",
  "one-handed-left",
  "one-handed-right"
];

const overlaps = (left: AuditRect, right: AuditRect) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

const withinViewport = (rect: AuditRect, viewport: GameHudAuditViewport) => (
  rect.x >= 0
  && rect.y >= 0
  && rect.x + rect.width <= viewport.width
  && rect.y + rect.height <= viewport.height - viewport.safeBottom
);

export function auditGameHudViewport(
  viewport: GameHudAuditViewport,
  mode: GameHudAuditMode = "standard"
): string[] {
  const margin = viewport.width <= 360 ? 6 : 9;
  const joystickSize = viewport.width <= 360 ? 78 : viewport.height <= 500 ? 72 : 96;
  const buttonSize = viewport.width <= 360 ? 44 : 46;
  const buttonHeight = viewport.width <= 360 ? 44 : 48;
  const gap = viewport.width <= 360 ? 3 : 4;
  const dockButtonCount = 4;
  const dockWidth = buttonSize * dockButtonCount + gap * (dockButtonCount - 1);
  const controlsBottom = 9 + viewport.safeBottom;
  const groupWidth = joystickSize + 5 + dockWidth;
  const groupX = mode === "one-handed-right" ? viewport.width - margin - groupWidth : margin;
  const joystickX = mode === "standard"
    ? margin
    : mode === "one-handed-right" ? groupX + dockWidth + 5 : groupX;
  const dockX = mode === "standard"
    ? viewport.width - margin - dockWidth
    : mode === "one-handed-right" ? groupX : groupX + joystickSize + 5;
  const joystick = {
    x: joystickX,
    y: viewport.height - controlsBottom - joystickSize,
    width: joystickSize,
    height: joystickSize
  };
  const dock = {
    x: dockX,
    y: viewport.height - controlsBottom - buttonHeight,
    width: dockWidth,
    height: buttonHeight
  };
  const contextWidth = Math.min(224, viewport.width - 24);
  const contextHeight = 46;
  const contextBottom = (viewport.width <= 350
    ? 158
    : viewport.height <= 500 && viewport.width > viewport.height ? 82 : 154) + viewport.safeBottom;
  const context = {
    x: (viewport.width - contextWidth) / 2,
    y: viewport.height - contextBottom - contextHeight,
    width: contextWidth,
    height: contextHeight
  };
  const landscapeQuest = viewport.height <= 500 && viewport.width > viewport.height;
  const questContext = {
    x: (viewport.width - contextWidth) / 2,
    y: landscapeQuest ? 12 : 190,
    width: contextWidth,
    height: contextHeight
  };
  const minimap = { x: viewport.width - margin - 48, y: 10, width: 48, height: 48 };
  const collectionProgress = {
    x: 9,
    y: viewport.height - viewport.safeBottom - 108 - 44,
    width: 64,
    height: 44
  };
  const issues: string[] = [];
  const namedRects = [
    ["조이스틱", joystick],
    ["빠른 도구", dock],
    ["상황형 버튼", context],
    ["미니 퀘스트 버튼", questContext],
    ["미니맵", minimap],
    ["수집 진행 표시", collectionProgress]
  ] as const;

  namedRects.forEach(([label, rect]) => {
    if (!withinViewport(rect, viewport)) issues.push(`${label} 화면 이탈`);
    if (label !== "조이스틱" && (rect.width < 44 || rect.height < 44)) issues.push(`${label} 터치 영역 부족`);
  });
  if (overlaps(joystick, dock)) issues.push("조이스틱과 빠른 도구 겹침");
  if (overlaps(context, joystick)) issues.push("상황형 버튼과 조이스틱 겹침");
  if (overlaps(context, dock)) issues.push("상황형 버튼과 빠른 도구 겹침");
  if (overlaps(context, collectionProgress)) issues.push("상황형 버튼과 수집 진행 표시 겹침");
  if (overlaps(questContext, joystick)) issues.push("미니 퀘스트 버튼과 조이스틱 겹침");
  if (overlaps(questContext, dock)) issues.push("미니 퀘스트 버튼과 빠른 도구 겹침");
  if (overlaps(questContext, collectionProgress)) issues.push("미니 퀘스트 버튼과 수집 진행 표시 겹침");
  return issues;
}
