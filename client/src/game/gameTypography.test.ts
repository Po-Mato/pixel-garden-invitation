import { describe, expect, it, vi } from "vitest";
import { requiresExtendedGameTypography } from "./gameTypography";

describe("requiresExtendedGameTypography", () => {
  it("keeps the measured wedding route on the critical font set", () => {
    expect(requiresExtendedGameTypography([
      "오시는 길",
      "하객 김승재",
      "같이 걷기 · 방문 스탬프 · 잠시 멈췄어요 · 횡단보도",
      "예식 보기 · 마음 전하실 곳"
    ])).toBe(false);
  });

  it("loads the extended font map for rare Korean glyphs", () => {
    expect(requiresExtendedGameTypography(["힣"])).toBe(true);
  });

  it("loads supported non-Korean nickname glyphs while retaining native emoji fallback", () => {
    for (const name of ["Ālex", "Ω", "Ж", "あき", "ㄱ", "金", "힣"]) {
      expect(requiresExtendedGameTypography([name]), name).toBe(true);
    }
    expect(requiresExtendedGameTypography(["하객😀"])).toBe(false);
  });

  it("recovers from an extended CSS load failure without an unhandled rejection", async () => {
    vi.resetModules();
    const { loadExtendedGameTypography } = await import("./gameTypography");
    const firstAttempt = loadExtendedGameTypography();
    const firstLink = document.head.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')!;
    firstLink.dispatchEvent(new Event("error"));
    expect(await firstAttempt).toBe(false);
    expect(firstLink.isConnected).toBe(false);
    const retry = loadExtendedGameTypography();
    const retryLink = document.head.querySelector<HTMLLinkElement>('link[rel="stylesheet"]')!;
    expect(retryLink).not.toBe(firstLink);
    retryLink.dispatchEvent(new Event("load"));
    expect(await retry).toBe(true);
    expect(await loadExtendedGameTypography()).toBe(true);
    retryLink.remove();
  });

  it("normalizes decomposed Korean names before checking coverage", () => {
    expect(requiresExtendedGameTypography(["하객".normalize("NFD")])).toBe(false);
  });
});
