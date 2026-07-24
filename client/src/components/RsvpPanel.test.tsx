import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RsvpRecord } from "@wedding-game/shared";
import { WeddingApiError } from "../api/weddingApi";
import { loadRsvpSendQueue } from "../invitation/publicFormQueueStorage";
import { installMemoryLocalStorage } from "../test/memoryStorage";
import { RsvpPanel } from "./RsvpPanel";

const api = vi.hoisted(() => ({
  createRsvp: vi.fn(),
  fetchOwnedRsvp: vi.fn(),
  updateOwnedRsvp: vi.fn()
}));

const storage = vi.hoisted(() => ({
  loadRsvpCredential: vi.fn(),
  saveRsvpCredential: vi.fn(),
  clearRsvpCredential: vi.fn()
}));
const inviteStorage = vi.hoisted(() => ({ loadStoredInvitationInvite: vi.fn() }));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  ...api
}));
vi.mock("../invitation/rsvpStorage", () => storage);
vi.mock("../invitation/inviteLinkStorage", () => inviteStorage);

const credential = { rsvpId: "rsvp_1", editToken: "edit-token" };
const response: RsvpRecord = {
  id: "rsvp_1", side: "bride", guestName: "김하객", phone: "01012345678",
  attendance: "yes", partySize: 2, mealStatus: "yes", note: "축하합니다",
  consentVersion: "2026-07-20", revision: 3,
  createdAt: "2027-04-20T00:00:00.000Z", updatedAt: "2027-04-20T01:00:00.000Z"
};

async function fillNewForm() {
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: "새 하객" } });
  fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-9999-8888" } });
  fireEvent.click(screen.getByLabelText(/개인정보 수집/));
  await waitFor(() => expect(screen.getByRole("button", { name: "참석 답변 보내기" })).toBeEnabled());
}

describe("RsvpPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMemoryLocalStorage();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    storage.loadRsvpCredential.mockReturnValue(null);
    storage.saveRsvpCredential.mockReturnValue(true);
    storage.clearRsvpCredential.mockReturnValue(true);
    inviteStorage.loadStoredInvitationInvite.mockReturnValue(null);
  });
  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("오프라인 참석 답변을 전송 대기함에 보관한다", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<RsvpPanel />);
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "대기 하객" } });
    fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-9999-8888" } });
    fireEvent.click(screen.getByLabelText(/개인정보 수집/));

    fireEvent.click(screen.getByRole("button", { name: "전송 대기함에 저장" }));

    await waitFor(() => expect(loadRsvpSendQueue("sample-garden")?.value.guestName).toBe("대기 하객"));
    expect(api.createRsvp).not.toHaveBeenCalled();
    expect(screen.getByLabelText("참석 답변 전송 대기함")).toHaveTextContent("연결되면 안전하게");
  });

  it("creates an RSVP, stores its credential, and shows the summary", async () => {
    api.createRsvp.mockResolvedValue({ response, credential });
    render(<RsvpPanel />);
    await fillNewForm();

    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(storage.saveRsvpCredential).toHaveBeenCalledWith("sample-garden", credential);
    expect(screen.getByText("김하객")).toBeInTheDocument();
  });

  it("개인 초대 링크의 이름과 측을 새 참석 답변에 미리 입력한다", () => {
    inviteStorage.loadStoredInvitationInvite.mockReturnValue({
      token: "A".repeat(43),
      invite: { guestName: "초대 하객", side: "bride", groupLabel: "친구" }
    });
    render(<RsvpPanel />);

    expect(screen.getByLabelText("이름")).toHaveValue("초대 하객");
    expect(screen.getByLabelText("신부측")).toBeChecked();
  });

  it("restores a stored credential from loading to summary", async () => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValue(response);
    render(<RsvpPanel />);

    expect(screen.getByRole("status")).toHaveTextContent("답변을 확인하고 있습니다");
    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(api.fetchOwnedRsvp).toHaveBeenCalledWith(credential);
  });

  it("restores a stored credential once under React StrictMode", async () => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValue(response);

    render(<StrictMode><RsvpPanel /></StrictMode>);

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(api.fetchOwnedRsvp).toHaveBeenCalledTimes(1);
  });

  it.each([401, 404])("clears a rejected credential after a %s lookup", async (status) => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockRejectedValue(new WeddingApiError(status, "unauthorized"));
    render(<RsvpPanel />);

    expect(await screen.findByRole("button", { name: "참석 답변 보내기" })).toBeInTheDocument();
    expect(storage.clearRsvpCredential).toHaveBeenCalledWith("sample-garden");
  });

  it("updates with the current revision and returns to summary", async () => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValue(response);
    api.updateOwnedRsvp.mockResolvedValue({ ...response, guestName: "김수정", revision: 4 });
    render(<RsvpPanel />);
    await screen.findByRole("heading", { name: "보내주신 답변" });

    fireEvent.click(screen.getByRole("button", { name: "답변 수정" }));
    fireEvent.change(screen.getByLabelText("이름"), { target: { value: "김수정" } });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => expect(api.updateOwnedRsvp).toHaveBeenCalledWith(
      credential,
      expect.objectContaining({ guestName: "김수정", revision: 3 })
    ));
    expect(await screen.findByText("김수정")).toBeInTheDocument();
  });

  it("reloads the latest response and explains a revision conflict", async () => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, guestName: "최신 하객", revision: 4 });
    api.updateOwnedRsvp.mockRejectedValue(new WeddingApiError(409, "conflict"));
    render(<RsvpPanel />);
    await screen.findByRole("heading", { name: "보내주신 답변" });

    fireEvent.click(screen.getByRole("button", { name: "답변 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByRole("status")).toHaveTextContent("다른 변경사항을 반영했습니다");
    expect(screen.getByText("최신 하객")).toBeInTheDocument();
    expect(api.fetchOwnedRsvp).toHaveBeenCalledTimes(2);
  });

  it.each([401, 404])("clears an invalid credential and recovers to a new form after update returns %s", async (status) => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValue(response);
    api.updateOwnedRsvp.mockRejectedValue(new WeddingApiError(status, "unauthorized"));
    render(<RsvpPanel />);
    await screen.findByRole("heading", { name: "보내주신 답변" });

    fireEvent.click(screen.getByRole("button", { name: "답변 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByRole("button", { name: "참석 답변 보내기" })).toBeInTheDocument();
    expect(storage.clearRsvpCredential).toHaveBeenCalledWith("sample-garden");
    expect(screen.getByRole("status")).toHaveTextContent("수정 정보를 확인할 수 없어 새 답변 작성으로 전환했습니다");
  });

  it("keeps the summary when credential storage fails and warns about revisit editing", async () => {
    storage.saveRsvpCredential.mockReturnValue(false);
    api.createRsvp.mockResolvedValue({ response, credential });
    render(<RsvpPanel />);
    await fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("이 기기에서 다시 수정하기 어려울 수 있습니다");
  });

  it("persists the credential when creation succeeds after the sheet unmounts", async () => {
    let resolveCreate: ((value: { response: RsvpRecord; credential: typeof credential }) => void) | undefined;
    api.createRsvp.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    const { unmount } = render(<RsvpPanel />);
    await fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    unmount();
    resolveCreate?.({ response, credential });
    await Promise.resolve();
    await Promise.resolve();

    expect(storage.saveRsvpCredential).toHaveBeenCalledWith("sample-garden", credential);
  });

  it("shares an in-flight creation across a closed and reopened sheet", async () => {
    let resolveCreate: ((value: { response: RsvpRecord; credential: typeof credential }) => void) | undefined;
    api.createRsvp.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    const first = render(<RsvpPanel />);
    await fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    first.unmount();
    render(<RsvpPanel />);

    expect(screen.getByRole("status")).toHaveTextContent("답변을 저장하고 있습니다");
    expect(screen.queryByRole("button", { name: "참석 답변 보내기" })).not.toBeInTheDocument();
    resolveCreate?.({ response, credential });

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(api.createRsvp).toHaveBeenCalledTimes(1);
    expect(storage.saveRsvpCredential).toHaveBeenCalledTimes(1);
  });

  it("recovers a reopened sheet to a retryable new form after pending creation fails", async () => {
    let rejectCreate: ((reason?: unknown) => void) | undefined;
    api.createRsvp.mockImplementationOnce(() => new Promise((_, reject) => { rejectCreate = reject; }));
    const first = render(<RsvpPanel />);
    await fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    first.unmount();
    render(<StrictMode><RsvpPanel /></StrictMode>);
    expect(screen.getByRole("status")).toHaveTextContent("답변을 저장하고 있습니다");
    rejectCreate?.(new Error("network"));

    expect(await screen.findByRole("button", { name: "참석 답변 보내기" })).toBeInTheDocument();
    api.createRsvp.mockResolvedValueOnce({ response, credential });
    await fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(api.createRsvp).toHaveBeenCalledTimes(2);
  });

  it.each([null, "2025-01-01"])("requires fresh consent when an editable response has consent version %s", async (consentVersion) => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValue({ ...response, consentVersion });
    render(<RsvpPanel />);
    await screen.findByRole("heading", { name: "보내주신 답변" });

    fireEvent.click(screen.getByRole("button", { name: "답변 수정" }));

    expect(screen.getByLabelText(/개인정보 수집/)).not.toBeChecked();
    expect(screen.getByRole("button", { name: "수정 저장" })).toBeDisabled();
  });

  it("preserves form values on create failure and blocks duplicate creation", async () => {
    let rejectCreate: ((reason?: unknown) => void) | undefined;
    api.createRsvp.mockImplementation(() => new Promise((_, reject) => { rejectCreate = reject; }));
    render(<RsvpPanel />);
    await fillNewForm();

    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));
    fireEvent.click(screen.getByRole("button", { name: "보내는 중" }));
    expect(api.createRsvp).toHaveBeenCalledTimes(1);
    rejectCreate?.(new Error("network"));

    expect(await screen.findByRole("alert")).toHaveTextContent("답변을 보내지 못했습니다");
    expect(screen.getByLabelText("이름")).toHaveValue("새 하객");
  });

  it("shows the RSVP Retry-After delay after a rate-limited creation", async () => {
    api.createRsvp.mockRejectedValue(new WeddingApiError(429, "rate_limited", 60));
    render(<RsvpPanel />);
    await fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("60초 후 다시 시도해 주세요");
  });

  it("shows the RSVP Retry-After delay after a rate-limited update", async () => {
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockResolvedValue(response);
    api.updateOwnedRsvp.mockRejectedValue(new WeddingApiError(429, "rate_limited", 60));
    render(<RsvpPanel />);
    await screen.findByRole("heading", { name: "보내주신 답변" });
    fireEvent.click(screen.getByRole("button", { name: "답변 수정" }));
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("60초 후 다시 시도해 주세요");
  });

  it("does not update state after an owned lookup completes following unmount", async () => {
    let resolveLookup: ((value: RsvpRecord) => void) | undefined;
    storage.loadRsvpCredential.mockReturnValue(credential);
    api.fetchOwnedRsvp.mockImplementation(() => new Promise((resolve) => { resolveLookup = resolve; }));
    const { unmount } = render(<RsvpPanel />);

    unmount();
    resolveLookup?.(response);
    await Promise.resolve();
  });
});
