import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminRsvpHistory, restoreAdminRsvpHistory } from "../api/rsvpHistoryApi";
import { RsvpHistoryDialog } from "./RsvpHistoryDialog";

vi.mock("../api/rsvpHistoryApi", () => ({
  fetchAdminRsvpHistory: vi.fn(),
  fetchOwnedRsvpHistory: vi.fn(),
  restoreAdminRsvpHistory: vi.fn()
}));

const response = {
  id: "rsvp_1",
  side: "bride" as const,
  guestName: "김하객",
  phone: "01012345678",
  attendance: "yes" as const,
  partySize: 2,
  childCount: 0,
  mealStatus: "yes" as const,
  note: "창가 자리",
  consentVersion: "2026-07-20",
  revision: 2,
  createdAt: "2027-04-01T00:00:00.000Z",
  updatedAt: "2027-04-02T00:00:00.000Z"
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RsvpHistoryDialog", () => {
  it("최신 개정부터 변경 필드를 표시하고 닫을 수 있다", async () => {
    vi.mocked(fetchAdminRsvpHistory).mockResolvedValue({
      rsvpId: response.id,
      entries: [
        { id: "2", action: "updated", revision: 2, response, occurredAt: response.updatedAt },
        {
          id: "1",
          action: "created",
          revision: 1,
          response: { ...response, partySize: 1, note: "", revision: 1, updatedAt: response.createdAt },
          occurredAt: response.createdAt
        }
      ]
    });
    const onClose = vi.fn();
    render(<RsvpHistoryDialog token="admin-token" response={response} onClose={onClose} onUnauthorized={vi.fn()} />);

    expect(await screen.findByText("답변 수정 · rev. 2")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "rev. 2 변경 내용" })).toBeInTheDocument();
    expect(screen.getByText("인원")).toBeInTheDocument();
    expect(screen.getByText("1명")).toBeInTheDocument();
    expect(screen.getByText("2명")).toBeInTheDocument();
    expect(screen.getByText("전달사항")).toBeInTheDocument();
    expect(screen.getByText("없음")).toBeInTheDocument();
    expect(screen.getByText("창가 자리", { selector: "ins" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "변경 이력 닫기" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("관리자가 복원 사유를 입력해 특정 개정본을 복원한다", async () => {
    const history = {
      rsvpId: response.id,
      entries: [
        { id: "2", action: "updated" as const, revision: 2, response, occurredAt: response.updatedAt },
        {
          id: "1",
          action: "created" as const,
          revision: 1,
          response: { ...response, partySize: 1, revision: 1, updatedAt: response.createdAt },
          occurredAt: response.createdAt
        }
      ]
    };
    vi.mocked(fetchAdminRsvpHistory).mockResolvedValue(history);
    vi.mocked(restoreAdminRsvpHistory).mockResolvedValue({
      ...history,
      entries: [{
        ...history.entries[0],
        id: "3",
        revision: 3,
        changeReason: "최초 답변 확인 후 복원"
      }, ...history.entries]
    });
    const onRestored = vi.fn();
    render(<RsvpHistoryDialog
      token="admin-token"
      response={response}
      onClose={vi.fn()}
      onUnauthorized={vi.fn()}
      onRestored={onRestored}
    />);

    const restoreButtons = await screen.findAllByRole("button", { name: "이 버전으로 복원" });
    fireEvent.click(restoreButtons.at(-1)!);
    fireEvent.change(screen.getByLabelText("복원 사유"), { target: { value: "최초 답변 확인 후 복원" } });
    fireEvent.click(screen.getByRole("button", { name: "이 버전으로 복원" }));

    await waitFor(() => {
      expect(restoreAdminRsvpHistory).toHaveBeenCalledWith("admin-token", response.id, {
        targetRevision: 1,
        currentRevision: 2,
        reason: "최초 답변 확인 후 복원"
      });
      expect(onRestored).toHaveBeenCalledOnce();
    });
  });
});
