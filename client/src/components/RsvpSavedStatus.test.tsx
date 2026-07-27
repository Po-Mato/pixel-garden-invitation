import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchOwnedRsvp } from "../api/weddingApi";
import { loadRsvpCredential } from "../invitation/rsvpStorage";
import { RsvpSavedStatus } from "./RsvpSavedStatus";

vi.mock("../api/weddingApi", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/weddingApi")>();
  return { ...original, fetchOwnedRsvp: vi.fn() };
});

vi.mock("../invitation/rsvpStorage", () => ({
  clearRsvpCredential: vi.fn(),
  loadRsvpCredential: vi.fn(),
  rsvpCredentialChangedEvent: "wedding:rsvp-credential-changed"
}));

const response = {
  id: "rsvp_1",
  side: "bride" as const,
  guestName: "김하객",
  phone: "01012345678",
  attendance: "yes" as const,
  partySize: 2,
  mealStatus: "yes" as const,
  note: "",
  consentVersion: "v1",
  revision: 3,
  createdAt: "2027-04-01T01:00:00.000Z",
  updatedAt: "2027-04-20T03:30:00.000Z"
};

describe("RsvpSavedStatus", () => {
  beforeEach(() => {
    vi.mocked(loadRsvpCredential).mockReturnValue({ rsvpId: "rsvp_1", editToken: "token" });
    vi.mocked(fetchOwnedRsvp).mockResolvedValue(response);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("같은 기기에 저장된 상태와 최초·최근 수정 이력을 표시한다", async () => {
    const onOpenDetails = vi.fn();
    render(<RsvpSavedStatus event={invitationContent.event} onOpenDetails={onOpenDetails} />);

    expect(await screen.findByText("참석 예정")).toBeInTheDocument();
    expect(screen.getByText("3번째 저장")).toBeInTheDocument();
    expect(screen.getByText("최초 답변").parentElement).toHaveTextContent("2027년 4월 1일");
    expect(screen.getByText("최근 수정").parentElement).toHaveTextContent("2027년 4월 20일");
    fireEvent.click(screen.getByRole("button", { name: "답변 확인·수정" }));
    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  it("최신 상태를 다시 요청할 수 있다", async () => {
    render(<RsvpSavedStatus event={invitationContent.event} onOpenDetails={vi.fn()} />);
    await screen.findByText("참석 예정");

    fireEvent.click(screen.getByRole("button", { name: "참석 답변 최신 상태 확인" }));

    expect(fetchOwnedRsvp).toHaveBeenCalledTimes(2);
  });

  it("저장된 자격 정보가 없으면 상태 영역을 숨긴다", () => {
    vi.mocked(loadRsvpCredential).mockReturnValue(null);
    render(<RsvpSavedStatus event={invitationContent.event} onOpenDetails={vi.fn()} />);

    expect(screen.queryByLabelText("이 기기에 저장된 참석 답변")).not.toBeInTheDocument();
  });
});
