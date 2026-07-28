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
      onClose={vi.fn()}
      onOpenPhotoAlbum={onOpenPhotoAlbum}
    />);

    expect(screen.getByRole("dialog", { name: "게임 추억 앨범" })).toHaveTextContent("획득 완료");
    expect(screen.getByText("하객과 동행")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /포토존 사진/ }));
    expect(onOpenPhotoAlbum).toHaveBeenCalledOnce();
  });
});
