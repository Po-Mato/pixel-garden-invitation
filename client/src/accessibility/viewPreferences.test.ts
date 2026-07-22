import { describe, expect, it, vi } from "vitest";
import {
  applyViewPreferences,
  defaultViewPreferences,
  loadViewPreferences,
  saveViewPreferences,
  shouldReduceMotion,
  viewPreferencesStorageKey
} from "./viewPreferences";

function storage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, next: string) => { value = next; })
  };
}

describe("보기 설정 저장", () => {
  it("검증된 설정만 불러오고 손상된 값은 기본값으로 복구한다", () => {
    expect(loadViewPreferences(storage(JSON.stringify({ textScale: "large", reduceMotion: true }))))
      .toEqual({ textScale: "large", reduceMotion: true });
    expect(loadViewPreferences(storage("{broken"))).toEqual(defaultViewPreferences);
    expect(loadViewPreferences(storage(JSON.stringify({ textScale: "huge", reduceMotion: true }))))
      .toEqual(defaultViewPreferences);
  });

  it("기기 저장소에 버전 키로 저장한다", () => {
    const target = storage();
    expect(saveViewPreferences({ textScale: "large", reduceMotion: true }, target)).toBe(true);
    expect(target.setItem).toHaveBeenCalledWith(
      viewPreferencesStorageKey,
      JSON.stringify({ textScale: "large", reduceMotion: true })
    );
  });

  it("문서 속성과 시스템 모션 설정을 함께 반영한다", () => {
    const root = document.createElement("html");
    applyViewPreferences({ textScale: "large", reduceMotion: true }, root);
    expect(root).toHaveAttribute("data-text-scale", "large");
    expect(root).toHaveAttribute("data-reduce-motion", "true");
    expect(shouldReduceMotion(root, vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia)).toBe(true);

    applyViewPreferences(defaultViewPreferences, root);
    expect(root).not.toHaveAttribute("data-text-scale");
    expect(root).not.toHaveAttribute("data-reduce-motion");
    expect(shouldReduceMotion(root, vi.fn(() => ({ matches: true })) as unknown as typeof window.matchMedia)).toBe(true);
  });
});
