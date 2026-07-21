import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance, invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoupleOrderProvider } from "../invitation/CoupleOrderContext";
import { EntryScreen } from "./EntryScreen";

afterEach(() => {
  cleanup();
});

describe("EntryScreen", () => {
  it("shows the confirmed couple and compact wedding summary before entry", () => {
    render(<EntryScreen onEnter={vi.fn()} />);

    const { couple, startAt, timeZone } = invitationContent.event;
    const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone }).format(new Date(startAt));

    expect(screen.getByText(`WEDDING GARDEN · ${year}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `${couple.bride} & ${couple.groom}의 정원` })).toBeInTheDocument();
    expect(screen.getByText("2027년 5월 1일 토요일")).toBeInTheDocument();
    expect(screen.getByText("오후 5시 10분")).toHaveAttribute("dateTime", startAt);
    expect(screen.queryByText("오후 6시 40분")).not.toBeInTheDocument();
    expect(screen.getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오시는 길" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "오시는 길" }));

    expect(screen.getByRole("dialog", { name: "오시는 길" })).toBeInTheDocument();
  });

  it("신랑 우선 세션에서는 입장 제목도 신랑 이름부터 표시한다", () => {
    render(
      <CoupleOrderProvider initialOrder="groom-first">
        <EntryScreen onEnter={vi.fn()} />
      </CoupleOrderProvider>
    );

    expect(screen.getByRole("heading", { name: "이승재 & 이건희의 정원" })).toBeInTheDocument();
  });

  it("opens calendar choices without requiring a nickname", () => {
    render(<EntryScreen onEnter={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "캘린더 저장" }));

    expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정원 입장" })).toBeDisabled();
  });

  it("예식 당일 미리보기에서 입장 전에 퀵 안내를 연다", () => {
    render(<EntryScreen onEnter={vi.fn()} weddingDayPreview />);

    fireEvent.click(screen.getByRole("button", { name: /예식 당일 안내/ }));

    expect(screen.getByRole("dialog", { name: "예식 당일 안내" })).toHaveTextContent("예식까지 45분");
    expect(screen.getByRole("button", { name: "정원 입장" })).toBeDisabled();
  });

  it("disables entry for initial or whitespace-only nickname", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    const enterButton = screen.getByRole("button", { name: "정원 입장" });

    expect(enterButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "   " } });

    expect(enterButton).toBeDisabled();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("submits trimmed nickname", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "  하객2  " } });
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객2",
      appearance: defaultCharacterAppearance
    });
  });

  it("submits nickname and customized appearance", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하객1" } });
    fireEvent.click(screen.getByRole("button", { name: "네이비 클래식 수트" }));
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객1",
      appearance: { presetId: "masculine-navy-suit" }
    });
  });

  it("exposes the character customizer", () => {
    render(<EntryScreen onEnter={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "완성 하객 캐릭터" })).toBeInTheDocument();
    expect(screen.getByLabelText("선택한 하객 캐릭터")).toBeInTheDocument();
  });

  it("keeps ambient decoration outside the foreground entry controls", () => {
    const { container } = render(<EntryScreen onEnter={vi.fn()} />);
    const controls = container.querySelector(".entry-screen__controls");

    expect(container.querySelector(".entry-screen__ambient")).toHaveAttribute("aria-hidden", "true");
    expect(controls).toContainElement(screen.getByLabelText("닉네임"));
    expect(controls).toContainElement(screen.getByRole("button", { name: "정원 입장" }));
  });
});
