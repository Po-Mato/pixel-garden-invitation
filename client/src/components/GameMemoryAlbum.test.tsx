import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEmptyWeddingPhotoAlbum } from "../game/weddingPhoto";
import { GameMemoryAlbum } from "./GameMemoryAlbum";

describe("GameMemoryAlbum", () => {
  it("shows collection, photo, companion, and reward progress", () => {
    const onOpenPhotoAlbum = vi.fn();
    render(<GameMemoryAlbum
      album={{ version: 1, entries: [{
        id: "companion:one",
        kind: "companion",
        title: "하객과 동행",
        detail: "로비를 함께 걸었어요",
        zoneId: "lobby",
        createdAt: "2026-07-28T10:00:00.000Z"
      }] }}
      photoAlbum={createEmptyWeddingPhotoAlbum()}
      collectedCount={30}
      totalCollectibles={30}
      rewardUnlocked
      nickname="정원하객"
      onClose={vi.fn()}
      onOpenPhotoAlbum={onOpenPhotoAlbum}
    />);

    expect(screen.getByRole("dialog", { name: "게임 추억 앨범" })).toHaveTextContent("획득 완료");
    expect(screen.getByText("하객과 동행")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "A4 PDF" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "엽서 PDF" })).toBeEnabled();
    expect(screen.getByRole("group", { name: "인화 업체 규격" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A4 PNG" })).toBeEnabled();
    expect(screen.getByLabelText("A4 재단 미리보기")).toBeInTheDocument();
    expect(screen.getByText(/300dpi · 일반 사진관 규격 · 재단\/안전영역 포함/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4×6" }));
    expect(screen.getByLabelText("4×6 엽서 재단 미리보기")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "양면 PDF" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "뒷면" }));
    expect(screen.getByLabelText("4×6 엽서 뒷면 재단 미리보기")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "우표" }));
    fireEvent.click(screen.getByRole("button", { name: "별빛 스티커" }));
    fireEvent.click(screen.getByRole("button", { name: "비둘기 스티커" }));
    fireEvent.change(screen.getByRole("textbox", { name: "문구 스티커 내용" }), { target: { value: "건희와 승재의 봄" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    fireEvent.click(screen.getByRole("button", { name: "고화질 2배" }));
    expect(screen.getByLabelText("포토스트립 미리보기")).toHaveAttribute("data-frame", "postage");
    expect(screen.getByRole("button", { name: "별빛 스티커" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "비둘기 스티커" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "문구 스티커 위치 조절" })).toHaveTextContent("건희와 승재의 봄");
    expect(screen.getByRole("button", { name: "고화질 2배" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /포토존 사진/ }));
    expect(onOpenPhotoAlbum).toHaveBeenCalledOnce();
  });

  it("edits crop and free placement for a selected photo", () => {
    render(<GameMemoryAlbum
      album={{ version: 1, entries: [] }}
      photoAlbum={{ version: 2, photos: [{
        version: 1,
        dataUrl: "data:image/png;base64,photo",
        photoSpotId: "ceremony-aisle",
        zoneId: "ceremony-hall",
        spotLabel: "버진로드",
        guestName: "정원하객",
        pose: "wave",
        createdAt: 1
      }] }}
      collectedCount={1}
      totalCollectibles={30}
      rewardUnlocked={false}
      nickname="정원하객"
      onClose={vi.fn()}
      onOpenPhotoAlbum={vi.fn()}
    />);

    fireEvent.change(screen.getByRole("slider", { name: "선택 사진 확대" }), { target: { value: "1.5" } });
    fireEvent.change(screen.getByRole("slider", { name: "선택 사진 좌우 위치" }), { target: { value: "0.5" } });
    expect(screen.getByRole("button", { name: "버진로드 사진 자르기 선택" }).querySelector("img"))
      .toHaveStyle({ transform: "translate(-9%, 0%) scale(1.5)" });
  });
});
