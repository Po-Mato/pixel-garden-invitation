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
    fireEvent.click(screen.getByRole("button", { name: "우표" }));
    fireEvent.click(screen.getByRole("button", { name: "별빛 스티커" }));
    fireEvent.click(screen.getByRole("button", { name: "고화질 2배" }));
    expect(screen.getByLabelText("포토스트립 미리보기")).toHaveAttribute("data-frame", "postage");
    expect(screen.getByRole("button", { name: "별빛 스티커" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "고화질 2배" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /포토존 사진/ }));
    expect(onOpenPhotoAlbum).toHaveBeenCalledOnce();
  });
});
