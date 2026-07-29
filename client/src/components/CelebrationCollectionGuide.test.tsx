import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultCharacterAppearance } from "@wedding-game/shared";
import { allCelebrationCollectibles } from "../game/celebrationCollectibles";
import { CelebrationCollectionGuide } from "./CelebrationCollectionGuide";

describe("CelebrationCollectionGuide", () => {
  it("shows reward progress and equips an unlocked cosmetic", () => {
    const items = allCelebrationCollectibles();
    const collectedIds = items.filter(({ kind }) => kind === "petal").map(({ id }) => id);
    const onEquipCosmetic = vi.fn();
    render(<CelebrationCollectionGuide
      items={items}
      collectedIds={collectedIds}
      currentZoneId="home"
      guidedItemId={null}
      equippedCosmetic="none"
      equippedTone="rose"
      onEquipCosmetic={onEquipCosmetic}
      onChangeTone={vi.fn()}
      appearance={defaultCharacterAppearance}
      onGuide={vi.fn()}
      onClose={vi.fn()}
    />);

    expect(screen.getByRole("heading", { name: "수집 보상 도감" })).toBeInTheDocument();
    const equipButtons = screen.getAllByRole("button", { name: "착용" });
    expect(equipButtons).toHaveLength(1);
    fireEvent.click(equipButtons[0]!);
    expect(onEquipCosmetic).toHaveBeenCalledWith("petal-trail");
    expect(screen.getAllByRole("button", { name: "잠김" })).toHaveLength(3);
  });

  it("previews and equips the combined set reward", () => {
    const items = allCelebrationCollectibles();
    const onEquipCosmetic = vi.fn();
    render(<CelebrationCollectionGuide
      items={items}
      collectedIds={items.map(({ id }) => id)}
      currentZoneId="home"
      guidedItemId={null}
      equippedCosmetic="none"
      equippedTone="rose"
      onEquipCosmetic={onEquipCosmetic}
      onChangeTone={vi.fn()}
      appearance={defaultCharacterAppearance}
      onGuide={vi.fn()}
      onClose={vi.fn()}
    />);
    fireEvent.click(screen.getAllByRole("button", { name: "웨딩 가든 축복 세트 미리보기" }).at(-1)!);
    expect(screen.getByLabelText("웨딩 가든 축복 세트 캐릭터 미리보기"))
      .toHaveAttribute("data-collection-cosmetic", "garden-blessing-set");
    fireEvent.click(screen.getAllByRole("button", { name: "착용" }).at(-1)!);
    expect(onEquipCosmetic).toHaveBeenCalledWith("garden-blessing-set");
  });

  it("saves and reapplies a favorite cosmetic and tone combination", () => {
    const items = allCelebrationCollectibles();
    const onEquipCosmetic = vi.fn();
    const onChangeTone = vi.fn();
    render(<CelebrationCollectionGuide
      items={items}
      collectedIds={items.map(({ id }) => id)}
      currentZoneId="home"
      guidedItemId={null}
      equippedCosmetic="none"
      equippedTone="rose"
      onEquipCosmetic={onEquipCosmetic}
      onChangeTone={onChangeTone}
      appearance={defaultCharacterAppearance}
      onGuide={vi.fn()}
      onClose={vi.fn()}
    />);
    fireEvent.click(screen.getAllByRole("button", { name: "별빛 오라 미리보기" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "샴페인 골드 효과 색상" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "현재 조합 저장" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: /즐겨찾기 1 별빛 오라 샴페인 골드 적용/ }).at(-1)!);
    expect(onEquipCosmetic).toHaveBeenCalledWith("starlight-aura");
    expect(onChangeTone).toHaveBeenCalledWith("gold");
  });
});
