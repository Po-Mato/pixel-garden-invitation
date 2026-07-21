import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickInvitation } from "./QuickInvitation";

vi.mock("./RsvpPanel", () => ({ RsvpPanel: () => <div>참석 답변 내용</div> }));
vi.mock("./GuestbookExperience", () => ({
  GuestbookExperience: ({ nickname }: { nickname?: string }) => <div>방명록 내용 {nickname}</div>
}));
vi.mock("./WeddingGallery", () => ({ WeddingGallery: () => <div>웨딩 사진 모음</div> }));
vi.mock("./InvitationShareAccess", () => ({
  InvitationShareAccess: ({ variant }: { variant: string }) => <button type="button">공유 {variant}</button>
}));

afterEach(cleanup);

describe("간편 초대장", () => {
  it("핵심 정보를 세로 섹션과 목차로 제공한다", () => {
    render(<QuickInvitation nickname="하객1" onOpenGarden={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "이건희 & 이승재" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "오시는 길" })).toHaveAttribute("href", "#directions");
    expect(document.getElementById("gallery")).toHaveTextContent("웨딩 사진 모음");
    expect(document.getElementById("rsvp")).toHaveTextContent("참석 답변 내용");
    expect(document.getElementById("guestbook")).toHaveTextContent("방명록 내용 하객1");
    expect(screen.getAllByText("경기 부천시 소사구 경인로 386")).toHaveLength(2);
  });

  it("정원 이동 명령을 제공한다", () => {
    const onOpenGarden = vi.fn();
    render(<QuickInvitation canReturnToGarden onOpenGarden={onOpenGarden} />);

    fireEvent.click(screen.getByRole("button", { name: /정원으로 돌아가기/ }));

    expect(onOpenGarden).toHaveBeenCalledOnce();
  });
});
