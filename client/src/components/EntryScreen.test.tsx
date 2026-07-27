import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultCharacterAppearance, invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoupleOrderProvider } from "../invitation/CoupleOrderContext";
import { EntryScreen } from "./EntryScreen";

afterEach(() => {
  cleanup();
});

describe("EntryScreen", () => {
  const openCharacterPicker = () => {
    fireEvent.click(screen.getByRole("button", { name: /입장 캐릭터/ }));
  };

  const openEventInformation = () => {
    fireEvent.click(screen.getByRole("button", { name: "예식 정보 열기" }));
  };

  it("확정된 두 사람과 간결한 예식 요약만 먼저 보여준다", () => {
    const { container } = render(<EntryScreen onEnter={vi.fn()} />);

    const { couple, startAt, timeZone } = invitationContent.event;
    const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone }).format(new Date(startAt));

    expect(screen.getByText(`WEDDING GARDEN · ${year}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: `${couple.bride} & ${couple.groom}의 정원` })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: `${couple.bride} · ${couple.groom} 2D 퍼펫` })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: `${couple.bride} · ${couple.groom} 2D 퍼펫` }))
      .toHaveAttribute("data-arrangement", "close");
    expect(screen.getByRole("img", { name: `${couple.bride} · ${couple.groom} 2D 퍼펫` }))
      .toHaveAttribute("data-renderer-enabled", "false");
    expect(screen.getByText("2027년 5월 1일 토요일")).toBeInTheDocument();
    expect(screen.getByText("오후 5시 10분")).toHaveAttribute("dateTime", startAt);
    expect(screen.queryByText("오후 6시 40분")).not.toBeInTheDocument();
    expect(screen.getByText("MJ컨벤션 5층 파티오볼룸")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /입장 캐릭터/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "빠른 도구" })).toContainElement(
      screen.getByRole("button", { name: "예식 도움말" })
    );
    expect(screen.getByRole("navigation", { name: "빠른 도구" })).toContainElement(
      screen.getByRole("button", { name: "초대장 공유" })
    );
    expect(screen.getByRole("navigation", { name: "빠른 도구" })).toContainElement(
      screen.getByRole("button", { name: "환경 설정" })
    );
    expect(container.querySelector(".entry-screen__hero")).toContainElement(
      screen.getByRole("heading", { name: `${couple.bride} & ${couple.groom}의 정원` })
    );
    expect(container.querySelector(".entry-screen__actions")).toContainElement(
      screen.getByRole("button", { name: /입장 캐릭터/ })
    );
    expect(screen.queryByRole("heading", { name: "완성 하객 캐릭터" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("닉네임")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "오시는 길" })).not.toBeInTheDocument();

    openEventInformation();
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

  it("빠른 도구의 도움말 아이콘에서 예식 상세를 연다", () => {
    render(<EntryScreen onEnter={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "예식 도움말" }));

    expect(screen.getByRole("dialog", { name: "예식 정보" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "캘린더 저장" })).toBeInTheDocument();
  });

  it("opens calendar choices without requiring a nickname", () => {
    render(<EntryScreen onEnter={vi.fn()} />);

    openEventInformation();
    fireEvent.click(screen.getByRole("button", { name: "캘린더 저장" }));

    expect(screen.getByRole("dialog", { name: "캘린더 저장" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "정원 입장" })).not.toBeInTheDocument();
  });

  it("예식 당일 미리보기에서 입장 전에 퀵 안내를 연다", () => {
    render(<EntryScreen onEnter={vi.fn()} weddingDayPreview />);

    openEventInformation();
    fireEvent.click(screen.getByRole("button", { name: /예식 당일 안내/ }));

    expect(screen.getByRole("dialog", { name: "예식 당일 안내" })).toHaveTextContent("예식까지 45분");
    expect(screen.queryByRole("button", { name: "정원 입장" })).not.toBeInTheDocument();
  });

  it("disables entry for initial or whitespace-only nickname", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);
    openCharacterPicker();

    const enterButton = screen.getByRole("button", { name: "정원 입장" });

    expect(enterButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "   " } });

    expect(enterButton).toBeDisabled();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("submits trimmed nickname", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);
    openCharacterPicker();

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "  하객2  " } });
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객2",
      appearance: defaultCharacterAppearance
    });
  });

  it("개인 초대 하객에게 맞춤 인사와 미리 입력된 닉네임을 제공한다", () => {
    const onEnter = vi.fn();
    render(<EntryScreen
      onEnter={onEnter}
      invitedGuest={{ guestName: "김하객", side: "bride", groupLabel: "대학 친구" }}
    />);

    expect(screen.getByText("김하객님을 초대합니다.")).toBeInTheDocument();
    expect(screen.getByText(/대학 친구 하객으로/)).toBeInTheDocument();
    openCharacterPicker();
    expect(screen.getByLabelText("닉네임")).toHaveValue("김하객");
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));
    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ nickname: "김하객" }));
  });

  it("starts loading the garden when nickname entry begins", () => {
    const onEnterIntent = vi.fn();
    render(<EntryScreen onEnter={vi.fn()} onEnterIntent={onEnterIntent} />);

    openCharacterPicker();
    fireEvent.focus(screen.getByLabelText("닉네임"));

    expect(onEnterIntent).toHaveBeenCalled();
    expect(screen.getByRole("img", { name: /2D 퍼펫/ })).toHaveAttribute("data-renderer-enabled", "true");
  });

  it("닉네임 없이 간편 초대장을 열고 화면을 미리 불러온다", () => {
    const onQuickView = vi.fn();
    const onQuickViewIntent = vi.fn();
    render(
      <EntryScreen
        onEnter={vi.fn()}
        onQuickView={onQuickView}
        onQuickViewIntent={onQuickViewIntent}
      />
    );

    const quickButton = screen.getByRole("button", { name: /초대장 바로 보기/ });
    fireEvent.pointerEnter(quickButton);
    fireEvent.click(quickButton);

    expect(onQuickViewIntent).toHaveBeenCalled();
    expect(onQuickView).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "정원 입장" })).not.toBeInTheDocument();
  });

  it("submits nickname and customized appearance", () => {
    const onEnter = vi.fn();
    render(<EntryScreen onEnter={onEnter} />);
    openCharacterPicker();

    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "하객1" } });
    fireEvent.click(screen.getByRole("button", { name: "네이비 클래식 수트" }));
    fireEvent.click(screen.getByRole("button", { name: "정원 입장" }));

    expect(onEnter).toHaveBeenCalledWith({
      nickname: "하객1",
      appearance: { presetId: "masculine-navy-suit" }
    });
  });

  it("캐릭터 선택 요청 후 넓은 선택창을 연다", () => {
    render(<EntryScreen onEnter={vi.fn()} />);
    openCharacterPicker();

    expect(screen.getByRole("dialog", { name: "하객 캐릭터 선택" })).toHaveClass("entry-character-sheet");
    expect(screen.getByRole("heading", { name: "완성 하객 캐릭터" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "선택한 하객 캐릭터" })).toBeInTheDocument();
  });

  it("장식은 첫 화면 뒤에 유지하고 입장 제어는 선택창 안에 배치한다", () => {
    const { container } = render(<EntryScreen onEnter={vi.fn()} />);

    expect(container.querySelector(".entry-screen__ambient")).toHaveAttribute("aria-hidden", "true");
    openCharacterPicker();
    const controls = document.querySelector(".entry-character-picker__controls");
    expect(controls).toContainElement(screen.getByLabelText("닉네임"));
    expect(controls).toContainElement(screen.getByRole("button", { name: "정원 입장" }));
  });
});
