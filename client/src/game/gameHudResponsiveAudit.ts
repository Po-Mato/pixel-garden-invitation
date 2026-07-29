type AuditRect = { x: number; y: number; width: number; height: number };

export type GameHudAuditViewport = {
  id: "tiny-portrait" | "phone-landscape" | "foldable";
  width: number;
  height: number;
};

export const gameHudAuditViewports: readonly GameHudAuditViewport[] = [
  { id: "tiny-portrait", width: 320, height: 471 },
  { id: "phone-landscape", width: 667, height: 278 },
  { id: "foldable", width: 717, height: 415 }
];

const overlaps = (left: AuditRect, right: AuditRect) => (
  left.x < right.x + right.width
  && left.x + left.width > right.x
  && left.y < right.y + right.height
  && left.y + left.height > right.y
);

export function auditGameHudViewport(viewport: GameHudAuditViewport): string[] {
  const margin = viewport.width <= 360 ? 6 : 9;
  const joystickSize = viewport.width <= 360 ? 78 : 96;
  const buttonSize = viewport.width <= 360 ? 42 : 46;
  const gap = viewport.width <= 360 ? 3 : 4;
  const dockWidth = buttonSize * 4 + gap * 3;
  const buttonHeight = viewport.width <= 360 ? 44 : 48;
  const controlsBottom = 9;
  const contextWidth = Math.min(224, viewport.width - 24);
  const contextHeight = 42;
  const joystick = { x: margin, y: viewport.height - controlsBottom - joystickSize, width: joystickSize, height: joystickSize };
  const dock = { x: viewport.width - margin - dockWidth, y: viewport.height - controlsBottom - buttonHeight, width: dockWidth, height: buttonHeight };
  const contextBottom = viewport.width <= 350 ? 148 : viewport.height <= 500 && viewport.width > viewport.height ? 82 : 154;
  const context = { x: (viewport.width - contextWidth) / 2, y: viewport.height - contextBottom - contextHeight, width: contextWidth, height: contextHeight };
  const minimap = { x: viewport.width - margin - 48, y: 10, width: 48, height: 48 };
  const collectionProgress = { x: 8, y: viewport.height - 138, width: 64, height: 35 };
  const issues: string[] = [];

  [joystick, dock, context, minimap, collectionProgress].forEach((rect, index) => {
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > viewport.width || rect.y + rect.height > viewport.height) {
      issues.push(`요소 ${index + 1} 화면 이탈`);
    }
  });
  if (overlaps(joystick, dock)) issues.push("조이스틱과 빠른 도구 겹침");
  if (overlaps(context, joystick)) issues.push("상황형 버튼과 조이스틱 겹침");
  if (overlaps(context, dock)) issues.push("상황형 버튼과 빠른 도구 겹침");
  if (overlaps(context, collectionProgress)) issues.push("상황형 버튼과 수집 진행 표시 겹침");
  return issues;
}
