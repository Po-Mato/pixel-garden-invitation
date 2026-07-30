import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JourneyMemoryCardAccess } from "./JourneyMemoryCardAccess";
import { installMemoryLocalStorage } from "../test/memoryStorage";

const keepsakeMocks = vi.hoisted(() => ({
  save: vi.fn(async () => undefined),
  share: vi.fn(async (): Promise<"shared" | "saved"> => "shared")
}));

vi.mock("../game/journeyKeepsake", async (importOriginal) => ({
  ...await importOriginal<typeof import("../game/journeyKeepsake")>(),
  saveJourneyKeepsake: keepsakeMocks.save,
  shareJourneyKeepsake: keepsakeMocks.share
}));

beforeEach(() => {
  installMemoryLocalStorage();
  keepsakeMocks.save.mockClear();
  keepsakeMocks.share.mockClear();
});

describe("JourneyMemoryCardAccess", () => {
  it("첫 방문 전에는 비활성화하고 진행 중인 스탬프만 카드에 담는다", async () => {
    const { rerender } = render(<JourneyMemoryCardAccess nickname="정원하객" progress={{ version: 1, completedIds: [], updatedAt: null }} />);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

    rerender(<JourneyMemoryCardAccess nickname="정원하객" progress={{ version: 1, completedIds: ["directions"], updatedAt: "2027-05-01T08:00:00.000Z" }} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(keepsakeMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      checkpointStates: expect.arrayContaining([
        { label: "오시는 길", complete: true },
        { label: "웨딩 갤러리", complete: false }
      ])
    })));
    expect(screen.getByText("중간 여정 카드를 저장했어요")).toBeInTheDocument();
    fireEvent.click(screen.getByText("카드 꾸미기"));
    expect(screen.getByRole("button", { name: "별빛" })).toBeInTheDocument();
    expect(screen.getByLabelText("여정 카드 대표 사진")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "인물" }));
    fireEvent.click(screen.getByRole("button", { name: "오른쪽으로 3도 회전" }));
    expect(screen.getByRole("button", { name: "사진 편집 실행 취소" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("확대"), { target: { value: "1.25" } });
    fireEvent.change(screen.getByLabelText("짧은 문구"), { target: { value: "오래 행복하세요" } });
    fireEvent.click(screen.getByRole("button", { name: "로즈 스티커 색상" }));
    fireEvent.click(screen.getByRole("button", { name: "손글씨" }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(keepsakeMocks.save).toHaveBeenLastCalledWith(expect.objectContaining({
      photoTransform: expect.objectContaining({ zoom: 1.25, rotation: 3 }),
      stickerText: "오래 행복하세요",
      stickerStyle: { tone: "rose", font: "hand" }
    })));
  });
});
