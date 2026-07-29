import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NpcDialogueBubble } from "./NpcDialogueBubble";

describe("NpcDialogueBubble", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("opens the couple profile action and can be dismissed", () => {
    const onClose = vi.fn();
    const onOpenProfile = vi.fn();
    render(
      <NpcDialogueBubble
        dialogue={{ npcId: "bride", message: "와주셔서 고마워요.", tone: "welcome" }}
        speaker="신부 이건희"
        placement="below"
        onClose={onClose}
        onOpenProfile={onOpenProfile}
      />
    );

    expect(screen.getByLabelText("신부 이건희의 인사")).toHaveTextContent("와주셔서 고마워요.");
    expect(screen.getByLabelText("신부 이건희의 인사")).toHaveAttribute("data-placement", "below");
    fireEvent.click(screen.getByRole("button", { name: "두 사람 소개" }));
    expect(onOpenProfile).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "대화 닫기" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("automatically closes after the greeting has been readable", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <NpcDialogueBubble
        dialogue={{ npcId: "groom", message: "반갑습니다.", tone: "thanks" }}
        speaker="신랑 이승재"
        onClose={onClose}
        onOpenProfile={vi.fn()}
      />
    );

    act(() => vi.advanceTimersByTime(7199));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("대화 선택지를 전달하고 답변 이후에는 선택지를 숨긴다", () => {
    const onChoose = vi.fn();
    const { rerender } = render(
      <NpcDialogueBubble
        dialogue={{ npcId: "bride", message: "반가워요.", tone: "welcome" }}
        speaker="신부 이건희"
        onClose={vi.fn()}
        onOpenProfile={vi.fn()}
        onChoose={onChoose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "축하 전하기" }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: "celebrate", reaction: "celebrate" }));

    rerender(
      <NpcDialogueBubble
        dialogue={{ npcId: "bride", message: "고마워요.", tone: "celebration", responded: true }}
        speaker="신부 이건희"
        onClose={vi.fn()}
        onOpenProfile={vi.fn()}
        onChoose={onChoose}
      />
    );
    expect(screen.queryByLabelText("대화 답변 선택")).not.toBeInTheDocument();
  });
});
