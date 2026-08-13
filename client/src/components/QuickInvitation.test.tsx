import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadInvitationViewSync,
  saveGameViewLocation
} from "../game/invitationViewSync";
import { installMemoryLocalStorage } from "../test/memoryStorage";
import { QuickInvitation } from "./QuickInvitation";

vi.mock("./RsvpPanel", () => ({
  RsvpPanel: ({ onBackToDirections }: { onBackToDirections?: () => void }) => (
    <div>
      참석 답변 내용
      <button type="button" onClick={onBackToDirections}>오시는 길 다시 보기</button>
    </div>
  )
}));
vi.mock("./GuestbookExperience", () => ({
  GuestbookExperience: ({ nickname }: { nickname?: string }) => <div>방명록 내용 {nickname}</div>
}));
vi.mock("./WeddingGallery", () => ({ WeddingGallery: () => <div>웨딩 사진 모음</div> }));
vi.mock("./InvitationShareAccess", () => ({
  InvitationShareAccess: ({ variant, compactLabel, current }: { variant: string; compactLabel?: boolean; current?: boolean }) => (
    <button type="button" aria-label={compactLabel ? "초대장 공유" : undefined} aria-current={current ? "page" : undefined}>
      {compactLabel ? "공유" : `공유 ${variant}`}
    </button>
  )
}));

beforeEach(() => {
  installMemoryLocalStorage();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("간편 초대장", () => {
  it("핵심 정보를 세로 섹션과 목차로 제공한다", () => {
    render(<QuickInvitation nickname="하객1" onOpenGarden={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "이건희 & 이승재" })).toBeInTheDocument();
    expect(screen.getByLabelText("예식 핵심 정보")).toHaveTextContent("2027년 5월 1일");
    expect(screen.getByLabelText("예식 핵심 정보")).toHaveTextContent("MJ컨벤션");
    expect(screen.getByRole("button", { name: /예식 정보 보기/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "두 사람 이야기부터 보기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "오시는 길" })).toHaveAttribute("href", "#directions");
    expect(document.getElementById("gallery")).toHaveTextContent("웨딩 사진 모음");
    expect(document.getElementById("rsvp")).toHaveTextContent("참석 답변 내용");
    expect(document.getElementById("guestbook")).toHaveTextContent("방명록 내용 하객1");
    expect(screen.getAllByText("경기 부천시 소사구 경인로 386")).toHaveLength(2);
    expect(screen.getByText("THANK YOU")).toBeInTheDocument();
    expect(screen.getByText("초대장을 간직하거나 참석 여부를 알려주세요.")).toBeInTheDocument();
    expect(document.getElementById("couple")).toHaveAttribute("data-flow", "story");
    expect(document.getElementById("directions")).toHaveAttribute("data-flow", "visit");
    expect(document.getElementById("rsvp")).toHaveAttribute("data-flow", "reply");
    expect(document.querySelectorAll(".quick-section-heading__eyebrow")).toHaveLength(9);
    const gameJourney = screen.getByText("게임으로 둘러볼 장소").closest("details");
    expect(gameJourney).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("게임으로 둘러볼 장소"));
    expect(screen.getByRole("navigation", { name: "초대장 목적지 탐색" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /신부에게 인사/ })).toHaveAttribute("href", "#couple");
  });

  it("답변 전에는 참석 답변을 첫 번째 우선 행동으로 제공한다", () => {
    render(
      <QuickInvitation
        onOpenGarden={vi.fn()}
        now={new Date("2027-04-01T12:00:00+09:00")}
      />
    );

    const actions = screen.getByRole("navigation", { name: "지금 필요한 안내" });
    expect(actions.querySelector("button")?.textContent).toContain("참석 답변");
  });

  it("일정·길 찾기·참석·공유를 항상 보이고 선택 즉시 현재 위치를 표시한다", () => {
    render(<QuickInvitation onOpenGarden={vi.fn()} />);

    const dock = screen.getByRole("navigation", { name: "초대장 핵심 바로가기" });
    expect(within(dock).getByRole("button", { name: "일정" })).toBeInTheDocument();
    const directions = within(dock).getByRole("button", { name: "길 찾기" });
    expect(directions).toBeInTheDocument();
    expect(within(dock).getByRole("button", { name: "참석" })).toBeInTheDocument();
    expect(within(dock).getByRole("button", { name: "초대장 공유" })).toHaveTextContent("공유");

    fireEvent.click(directions);
    expect(directions).toHaveAttribute("aria-current", "page");
    expect(dock).toHaveAttribute("data-active-section", "directions");
    expect(document.querySelector(".quick-invitation__topbar-brand")).toHaveTextContent("06 / 11 · 오시는 길");
    expect(loadInvitationViewSync()).toMatchObject({ source: "quick", sectionId: "directions" });
  });

  it("스크롤 위치에 맞춰 상단 바 맥락과 목차의 현재 위치를 갱신한다", () => {
    render(<QuickInvitation onOpenGarden={vi.fn()} />);

    const invitation = document.querySelector<HTMLElement>(".quick-invitation");
    const topbar = document.querySelector<HTMLElement>(".quick-invitation__topbar");
    expect(invitation).toHaveAttribute("data-scroll-state", "hero");
    expect(topbar).not.toHaveAttribute("data-scrolled");
    expect(screen.getByText(/WEDDING DAY · 2027\.05\.01/)).toBeInTheDocument();

    Object.defineProperty(invitation, "scrollTop", { configurable: true, value: 96 });
    fireEvent.scroll(invitation as HTMLElement);
    expect(invitation).toHaveAttribute("data-scroll-state", "scrolled");
    expect(topbar).toHaveAttribute("data-scrolled", "true");
    expect(document.querySelector(".quick-invitation__topbar-progress span")).toHaveStyle({ width: "9.090909090909092%" });

    const directions = screen.getByRole("link", { name: "오시는 길" });
    fireEvent.click(directions);
    expect(directions).toHaveAttribute("aria-current", "location");
  });

  it("첫 화면과 답변 완료 동선에서 필요한 섹션으로 바로 이동한다", () => {
    render(<QuickInvitation onOpenGarden={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /예식 정보 보기/ }));
    expect(loadInvitationViewSync()).toMatchObject({ source: "quick", sectionId: "schedule" });

    fireEvent.click(screen.getByRole("button", { name: "두 사람 이야기부터 보기" }));
    expect(loadInvitationViewSync()).toMatchObject({ source: "quick", sectionId: "couple" });

    fireEvent.click(screen.getByRole("button", { name: "오시는 길 다시 보기" }));
    expect(loadInvitationViewSync()).toMatchObject({ source: "quick", sectionId: "directions" });
  });

  it("게임에서 온 방문자가 아니면 입장 선택으로 돌아간다", () => {
    const onOpenGarden = vi.fn();
    render(<QuickInvitation onOpenGarden={onOpenGarden} />);

    fireEvent.click(screen.getByRole("button", { name: "입장 선택" }));
    expect(onOpenGarden).toHaveBeenCalledOnce();
  });

  it("정원 이동 명령을 제공한다", () => {
    const onOpenGarden = vi.fn();
    render(<QuickInvitation canReturnToGarden onOpenGarden={onOpenGarden} />);

    fireEvent.click(screen.getByRole("button", { name: /정원으로 돌아가기/ }));

    expect(onOpenGarden).toHaveBeenCalledOnce();
  });

  it("게임 위치에 대응하는 섹션을 유지해 정원 복귀 위치와 동기화한다", () => {
    saveGameViewLocation("bridal-room");
    const onOpenGarden = vi.fn();
    render(<QuickInvitation canReturnToGarden onOpenGarden={onOpenGarden} />);

    fireEvent.click(screen.getByRole("button", { name: /정원으로 돌아가기/ }));

    expect(loadInvitationViewSync()).toMatchObject({
      source: "quick",
      sectionId: "couple",
      checkpointId: "bride"
    });
    expect(onOpenGarden).toHaveBeenCalledOnce();
  });
});
