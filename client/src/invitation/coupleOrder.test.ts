import { invitationContent } from "@wedding-game/shared";
import { describe, expect, it, vi } from "vitest";
import {
  chooseCoupleDisplayOrder,
  coupleOrderStorageKey,
  coupleSides,
  formatCoupleNames,
  formatWeddingTitle,
  loadOrCreateCoupleDisplayOrder
} from "./coupleOrder";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value))
  };
}

describe("신랑·신부 표시 순서", () => {
  it("접속 시 두 순서를 같은 확률 경계로 선택한다", () => {
    expect(chooseCoupleDisplayOrder(() => 0)).toBe("bride-first");
    expect(chooseCoupleDisplayOrder(() => 0.499999)).toBe("bride-first");
    expect(chooseCoupleDisplayOrder(() => 0.5)).toBe("groom-first");
    expect(chooseCoupleDisplayOrder(() => 0.999999)).toBe("groom-first");
  });

  it("한 번 정한 순서를 같은 세션에서 다시 사용한다", () => {
    const storage = memoryStorage();

    expect(loadOrCreateCoupleDisplayOrder(storage, () => 0.9)).toBe("groom-first");
    expect(storage.setItem).toHaveBeenCalledWith(coupleOrderStorageKey, "groom-first");
    expect(loadOrCreateCoupleDisplayOrder(storage, () => 0.1)).toBe("groom-first");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("저장소가 차단되어도 현재 진입 순서를 반환한다", () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error("blocked"); }),
      setItem: vi.fn(() => { throw new Error("blocked"); })
    };

    expect(loadOrCreateCoupleDisplayOrder(storage, () => 0.2)).toBe("bride-first");
  });

  it("이름과 예식 제목을 선택한 한 가지 순서로 구성한다", () => {
    const event = invitationContent.event;

    expect(coupleSides("bride-first")).toEqual(["bride", "groom"]);
    expect(coupleSides("groom-first")).toEqual(["groom", "bride"]);
    expect(formatCoupleNames(event, "bride-first")).toBe("이건희 · 이승재");
    expect(formatCoupleNames(event, "groom-first", " & ")).toBe("이승재 & 이건희");
    expect(formatWeddingTitle(event, "groom-first")).toBe("이승재 · 이건희 결혼식");
  });

  it("이름 조합이 없는 별도 행사 제목은 변경하지 않는다", () => {
    expect(formatWeddingTitle({ ...invitationContent.event, title: "우리의 봄날" }, "groom-first"))
      .toBe("우리의 봄날");
  });
});
