import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RsvpRecord } from "@wedding-game/shared";
import { WeddingApiError } from "../api/weddingApi";
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

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  ...api
}));
vi.mock("../invitation/rsvpStorage", () => storage);

const credential = { rsvpId: "rsvp_1", editToken: "edit-token" };
const response: RsvpRecord = {
  id: "rsvp_1", side: "bride", guestName: "김하객", phone: "01012345678",
  attendance: "yes", partySize: 2, mealStatus: "yes", note: "축하합니다",
  consentVersion: "2026-07-20", revision: 3,
  createdAt: "2027-04-20T00:00:00.000Z", updatedAt: "2027-04-20T01:00:00.000Z"
};

function fillNewForm() {
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: "새 하객" } });
  fireEvent.change(screen.getByLabelText("연락처"), { target: { value: "010-9999-8888" } });
  fireEvent.click(screen.getByLabelText(/개인정보 수집/));
}

describe("RsvpPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadRsvpCredential.mockReturnValue(null);
    storage.saveRsvpCredential.mockReturnValue(true);
    storage.clearRsvpCredential.mockReturnValue(true);
  });
  afterEach(cleanup);

  it("creates an RSVP, stores its credential, and shows the summary", async () => {
    api.createRsvp.mockResolvedValue({ response, credential });
    render(<RsvpPanel />);
    fillNewForm();

    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(storage.saveRsvpCredential).toHaveBeenCalledWith("sample-garden", credential);
    expect(screen.getByText("김하객")).toBeInTheDocument();
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

  it("keeps the summary when credential storage fails and warns about revisit editing", async () => {
    storage.saveRsvpCredential.mockReturnValue(false);
    api.createRsvp.mockResolvedValue({ response, credential });
    render(<RsvpPanel />);
    fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    expect(await screen.findByRole("heading", { name: "보내주신 답변" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("이 기기에서 다시 수정하기 어려울 수 있습니다");
  });

  it("persists the credential when creation succeeds after the sheet unmounts", async () => {
    let resolveCreate: ((value: { response: RsvpRecord; credential: typeof credential }) => void) | undefined;
    api.createRsvp.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    const { unmount } = render(<RsvpPanel />);
    fillNewForm();
    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));

    unmount();
    resolveCreate?.({ response, credential });
    await Promise.resolve();
    await Promise.resolve();

    expect(storage.saveRsvpCredential).toHaveBeenCalledWith("sample-garden", credential);
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
    fillNewForm();

    fireEvent.click(screen.getByRole("button", { name: "참석 답변 보내기" }));
    fireEvent.click(screen.getByRole("button", { name: "보내는 중" }));
    expect(api.createRsvp).toHaveBeenCalledTimes(1);
    rejectCreate?.(new Error("network"));

    expect(await screen.findByRole("alert")).toHaveTextContent("답변을 보내지 못했습니다");
    expect(screen.getByLabelText("이름")).toHaveValue("새 하객");
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
