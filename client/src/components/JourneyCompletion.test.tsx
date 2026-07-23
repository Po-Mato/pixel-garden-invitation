import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { JourneyCompletion } from "./JourneyCompletion";
import { weddingPhotoMemoryStorageKey } from "../game/weddingPhoto";
import { installMemoryLocalStorage } from "../test/memoryStorage";

const keepsakeMocks = vi.hoisted(() => ({
  save: vi.fn(async () => undefined),
  share: vi.fn(async (): Promise<"shared" | "saved"> => "shared")
}));

vi.mock("../game/journeyKeepsake", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../game/journeyKeepsake")>();
  return {
    ...actual,
    saveJourneyKeepsake: keepsakeMocks.save,
    shareJourneyKeepsake: keepsakeMocks.share
  };
});

function renderCompletion() {
  const actions = {
    onClose: vi.fn(),
    onOpenRsvp: vi.fn(),
    onOpenShare: vi.fn(),
    onOpenPhotoAlbum: vi.fn()
  };
  render(
    <JourneyCompletion
      nickname="정원하객"
      appearance={defaultCharacterAppearance}
      {...actions}
    />
  );
  return actions;
}

beforeEach(() => {
  keepsakeMocks.save.mockClear();
  keepsakeMocks.share.mockClear();
  keepsakeMocks.share.mockResolvedValue("shared");
  installMemoryLocalStorage();
});

afterEach(() => cleanup());

describe("JourneyCompletion", () => {
  it("shows the personalized finale, five stamps, and real wedding details", () => {
    renderCompletion();

    const dialog = screen.getByRole("dialog", { name: "방문 여정 완주" });
    expect(dialog).toHaveTextContent("정원하객님, 축하의 정원을 완주했어요");
    expect(dialog).toHaveTextContent("이건희 · 이승재");
    expect(dialog).toHaveTextContent("2027년 5월 1일 토요일");
    expect(dialog).toHaveTextContent("MJ컨벤션 5층 파티오볼룸");
    expect(screen.getByLabelText("방문 스탬프 5개 완료").children).toHaveLength(5);
    expect(screen.getByRole("button", { name: "완주 안내 닫기" })).toHaveFocus();
  });

  it("saves and shares a personalized keepsake image", async () => {
    renderCompletion();

    fireEvent.click(screen.getByRole("button", { name: /기념 카드 저장/ }));
    await waitFor(() => expect(keepsakeMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      guestName: "정원하객",
      coupleNames: "이건희 · 이승재",
      checkpointLabels: expect.arrayContaining(["오시는 길", "축하 메시지"])
    })));
    expect(screen.getByText("기념 카드를 이미지로 저장했습니다.")).toBeInTheDocument();

    keepsakeMocks.share.mockResolvedValueOnce("saved");
    fireEvent.click(screen.getByRole("button", { name: /기념 카드 보내기/ }));
    await waitFor(() => expect(screen.getByText(
      "이미지 공유를 지원하지 않아 기념 카드를 저장했습니다."
    )).toBeInTheDocument());
  });

  it("uses the latest photo-zone image in the journey keepsake", async () => {
    localStorage.setItem(weddingPhotoMemoryStorageKey, JSON.stringify({
      version: 1,
      dataUrl: "data:image/jpeg;base64,photo",
      photoSpotId: "ceremony-aisle",
      zoneId: "ceremony-hall",
      spotLabel: "버진로드 포토존",
      guestName: "정원하객",
      pose: "hearts",
      createdAt: 1234
    }));
    renderCompletion();

    expect(screen.getByRole("img", { name: "버진로드 포토존에서 촬영한 기념 사진" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /기념 카드 저장/ }));
    await waitFor(() => expect(keepsakeMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      photoUrl: "data:image/jpeg;base64,photo"
    })));
  });

  it("keeps RSVP, invitation sharing, photo album, close, and Escape actions available", () => {
    const actions = renderCompletion();

    fireEvent.click(screen.getByRole("button", { name: "참석 답변하기" }));
    fireEvent.click(screen.getByRole("button", { name: "초대장 공유" }));
    fireEvent.click(screen.getByRole("button", { name: "포토앨범 0/3" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(actions.onOpenRsvp).toHaveBeenCalledTimes(1);
    expect(actions.onOpenShare).toHaveBeenCalledTimes(1);
    expect(actions.onOpenPhotoAlbum).toHaveBeenCalledTimes(1);
    expect(actions.onClose).toHaveBeenCalledTimes(1);
  });
});
