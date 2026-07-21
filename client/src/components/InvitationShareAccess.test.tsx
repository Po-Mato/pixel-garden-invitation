import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyText,
  isShareAbortError,
  shareContent
} from "../invitation/browserActions";
import { invitationPublicUrl } from "../invitation/shareInvitation";
import { InvitationShareAccess } from "./InvitationShareAccess";

vi.mock("../invitation/browserActions", () => ({
  copyText: vi.fn(),
  shareContent: vi.fn(),
  isShareAbortError: vi.fn(
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError"
  )
}));

beforeEach(() => {
  vi.mocked(copyText).mockResolvedValue(undefined);
  vi.mocked(shareContent).mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { share: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("InvitationShareAccess", () => {
  it("아이콘 진입점에서 예식 정보를 포함한 공유 시트를 연다", () => {
    render(<InvitationShareAccess variant="icon" />);

    fireEvent.click(screen.getByRole("button", { name: "초대장 공유" }));

    const dialog = screen.getByRole("dialog", { name: "초대장 공유" });
    expect(dialog).toHaveTextContent("이건희 · 이승재");
    expect(dialog).toHaveTextContent("2027년 5월 1일 토요일");
    expect(dialog).toHaveTextContent("MJ컨벤션 5층 파티오볼룸");
    expect(within(dialog).getByRole("button", { name: "공유 앱 선택" })).toBeInTheDocument();
  });

  it("모바일 공유창에 공개 canonical URL과 공통 문구를 전달한다", async () => {
    render(<InvitationShareAccess variant="menu" />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 공유" }));
    fireEvent.click(screen.getByRole("button", { name: "공유 앱 선택" }));

    expect(shareContent).toHaveBeenCalledWith(expect.objectContaining({
      title: "이건희 · 이승재 결혼식",
      text: expect.stringContaining("오후 5시 10분"),
      url: invitationPublicUrl
    }));
    expect(await screen.findByText("공유 앱으로 초대장을 전달했습니다.")).toBeInTheDocument();
  });

  it("공유 취소는 링크 복사로 처리하지 않는다", async () => {
    const abortError = new DOMException("취소", "AbortError");
    vi.mocked(shareContent).mockRejectedValue(abortError);
    render(<InvitationShareAccess variant="menu" />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 공유" }));
    fireEvent.click(screen.getByRole("button", { name: "공유 앱 선택" }));

    expect(await screen.findByText("공유를 취소했습니다.")).toBeInTheDocument();
    expect(isShareAbortError).toHaveBeenCalledWith(abortError);
    expect(copyText).not.toHaveBeenCalled();
  });

  it("공유 미지원이나 오류에는 공개 링크를 복사한다", async () => {
    vi.stubGlobal("navigator", {});
    vi.mocked(shareContent).mockRejectedValue(new Error("unsupported"));
    render(<InvitationShareAccess variant="menu" />);
    fireEvent.click(screen.getByRole("button", { name: "초대장 공유" }));
    fireEvent.click(screen.getByRole("button", { name: "링크 복사로 공유" }));

    expect(await screen.findByText("공유창을 열지 못해 초대장 링크를 복사했습니다.")).toBeInTheDocument();
    expect(copyText).toHaveBeenCalledWith(invitationPublicUrl);
  });
});
