import { describe, expect, it } from "vitest";
import { auditGameHudViewport, gameHudAuditViewports } from "./gameHudResponsiveAudit";

describe("게임 HUD 반응형 자동 감사", () => {
  it.each(gameHudAuditViewports)("$id 화면에서 주요 조작 UI가 겹치지 않는다", (viewport) => {
    expect(auditGameHudViewport(viewport)).toEqual([]);
  });
});
