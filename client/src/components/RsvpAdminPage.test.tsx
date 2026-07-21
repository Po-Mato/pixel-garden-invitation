import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RsvpAdminResult } from "@wedding-game/shared";
import { WeddingApiError } from "../api/weddingApi";
import { RsvpAdminPage } from "./RsvpAdminPage";

const api = vi.hoisted(() => ({
  createAdminSession: vi.fn(),
  fetchAdminNotifications: vi.fn(),
  markAdminNotificationsRead: vi.fn(),
  fetchAdminRsvps: vi.fn(),
  updateAdminRsvp: vi.fn(),
  deleteAdminRsvp: vi.fn()
}));

const storage = vi.hoisted(() => ({
  loadAdminSession: vi.fn(),
  saveAdminSession: vi.fn(),
  clearAdminSession: vi.fn()
}));

const csv = vi.hoisted(() => ({ downloadRsvpCsv: vi.fn() }));

vi.mock("../api/weddingApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api/weddingApi")>(),
  ...api
}));
vi.mock("../invitation/rsvpStorage", () => storage);
vi.mock("../invitation/rsvpCsv", () => csv);

const session = { token: "admin-token", expiresAt: 1_900_000_000_000 };
const result: RsvpAdminResult = {
  summary: {
    responseCount: 4,
    attendingResponseCount: 2,
    attendingPartySize: 5,
    mealPartySize: 4,
    declinedResponseCount: 1,
    unsureResponseCount: 1,
    unsurePartySize: 2,
    deleteAt: "2027-05-31T14:59:59.000Z"
  },
  responses: [
    { id: "1", side: "groom", guestName: "김하객", phone: "01012345678", attendance: "yes", partySize: 3, mealStatus: "yes", note: "축하합니다", consentVersion: "v1", revision: 1, createdAt: "2027-01-01T00:00:00Z", updatedAt: "2027-01-02T00:00:00Z" },
    { id: "2", side: "bride", guestName: "Lee Guest", phone: "010 9999 8888", attendance: "yes", partySize: 2, mealStatus: "no", note: "", consentVersion: "v1", revision: 2, createdAt: "2027-01-01T00:00:00Z", updatedAt: "2027-01-03T00:00:00Z" },
    { id: "3", side: "legacy", guestName: "옛 하객", phone: null, attendance: "no", partySize: 0, mealStatus: "not_applicable", note: "기존", consentVersion: null, revision: 1, createdAt: "2027-01-01T00:00:00Z", updatedAt: "2027-01-01T00:00:00Z" },
    { id: "4", side: "bride", guestName: "박미정", phone: "01022223333", attendance: "unsure", partySize: 2, mealStatus: "unsure", note: "확인 중", consentVersion: "v1", revision: 1, createdAt: "2027-01-01T00:00:00Z", updatedAt: "2027-01-01T00:00:00Z" }
  ]
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function login() {
  fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByRole("heading", { name: "참석 답변 현황" });
}

describe("RsvpAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.loadAdminSession.mockReturnValue(null);
    storage.saveAdminSession.mockReturnValue(true);
    storage.clearAdminSession.mockReturnValue(true);
    api.createAdminSession.mockResolvedValue(session);
    api.fetchAdminNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, emailConfigured: false });
    api.markAdminNotificationsRead.mockResolvedValue({ notifications: [], unreadCount: 0, emailConfigured: false });
    api.fetchAdminRsvps.mockResolvedValue(result);
    api.updateAdminRsvp.mockResolvedValue({ ...result.responses[0], revision: 2 });
    api.deleteAdminRsvp.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows only the password login before authentication and clears the password after failure", async () => {
    api.createAdminSession.mockRejectedValue(new WeddingApiError(403, "invalid_credentials"));
    render(<RsvpAdminPage />);

    const input = screen.getByLabelText("관리자 비밀번호");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("비밀번호를 확인해 주세요");
    expect(input).toHaveValue("");
    expect(screen.queryByText("참석 답변 현황")).not.toBeInTheDocument();
  });

  it("stores a successful session and immediately fetches all responses", async () => {
    render(<RsvpAdminPage />);
    await login();

    expect(storage.saveAdminSession).toHaveBeenCalledWith("sample-garden", session);
    expect(api.fetchAdminRsvps).toHaveBeenCalledWith("admin-token");
    expect(screen.getByText("김하객")).toBeInTheDocument();
    expect(screen.queryByLabelText("관리자 비밀번호")).not.toBeInTheDocument();
  });

  it("restores a valid stored session and clears it when initial fetch is unauthorized", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    api.fetchAdminRsvps.mockRejectedValue(new WeddingApiError(401, "unauthorized"));
    render(<RsvpAdminPage />);

    expect(await screen.findByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(storage.clearAdminSession).toHaveBeenCalledWith("sample-garden");
  });

  it("restores a valid stored session without showing the login form", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<RsvpAdminPage />);

    expect(await screen.findByText("김하객")).toBeInTheDocument();
    expect(screen.queryByLabelText("관리자 비밀번호")).not.toBeInTheDocument();
    expect(api.createAdminSession).not.toHaveBeenCalled();
  });

  it.each(["login", "restore"])("expires an active %s session at expiresAt and clears all admin data", async (source) => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const expiringSession = { token: "expiring-token", expiresAt: Date.now() + 2_000 };
    if (source === "restore") storage.loadAdminSession.mockReturnValue(expiringSession);
    else api.createAdminSession.mockResolvedValue(expiringSession);
    api.fetchAdminRsvps.mockResolvedValue(result);

    render(<RsvpAdminPage />);
    if (source === "login") {
      fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
      fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    }
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "CSV 저장" })).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1_999); });
    expect(screen.getByText("김하객")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });

    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CSV 저장" })).not.toBeInTheDocument();
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
    expect(storage.clearAdminSession).toHaveBeenCalledWith("sample-garden");
  });

  it("preserves search and filters across session expiry while clearing protected data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    const expiringSession = { token: "expiring-token", expiresAt: Date.now() + 2_000 };
    api.createAdminSession.mockResolvedValueOnce(expiringSession).mockResolvedValueOnce(session);
    render(<RsvpAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("대상 필터"), { target: { value: "bride" } });
    fireEvent.change(screen.getByLabelText("참석 필터"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("식사 필터"), { target: { value: "no" } });

    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.queryByText("Lee Guest")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(screen.getByLabelText("검색")).toHaveValue("Lee");
    expect(screen.getByLabelText("대상 필터")).toHaveValue("bride");
    expect(screen.getByLabelText("참석 필터")).toHaveValue("yes");
    expect(screen.getByLabelText("식사 필터")).toHaveValue("no");
  });

  it("preserves search and filters after an authenticated request returns 401", async () => {
    api.fetchAdminRsvps.mockResolvedValueOnce(result).mockRejectedValueOnce(new WeddingApiError(401, "unauthorized"));
    render(<RsvpAdminPage />);
    await login();
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("대상 필터"), { target: { value: "bride" } });
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));

    expect(await screen.findByRole("button", { name: "로그인" })).toBeInTheDocument();
    await login();
    expect(screen.getByLabelText("검색")).toHaveValue("Lee");
    expect(screen.getByLabelText("대상 필터")).toHaveValue("bride");
  });

  it("restores and loads the session under React StrictMode without a busy-ref deadlock", async () => {
    storage.loadAdminSession.mockReturnValue(session);
    render(<StrictMode><RsvpAdminPage /></StrictMode>);

    expect(await screen.findByText("김하객")).toBeInTheDocument();
    expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(1);
  });

  it("lets an authenticated administrator retry an initial fetch failure", async () => {
    api.fetchAdminRsvps.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(result);
    render(<RsvpAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    expect(await screen.findByText("김하객")).toBeInTheDocument();
    expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(2);
  });

  it("keeps the rate-limit alert static while the non-live countdown changes", async () => {
    vi.useFakeTimers();
    api.createAdminSession.mockRejectedValue(new WeddingApiError(429, "rate_limited", 2));
    render(<RsvpAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await act(async () => { await Promise.resolve(); });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("로그인 시도가 제한되었습니다");
    expect(alert).not.toHaveTextContent(/\d+초/);
    expect(screen.getByText("2초 후 다시 시도해 주세요.")).toHaveAttribute("aria-live", "off");
    expect(screen.getByRole("button", { name: /로그인/ })).toBeDisabled();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("로그인 시도가 제한되었습니다");
    expect(screen.getByText("1초 후 다시 시도해 주세요.")).toHaveAttribute("aria-live", "off");
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByLabelText("관리자 비밀번호")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "retry" } });
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });

  it.each(["visibilitychange", "focus", "pageshow"] as const)(
    "recomputes an absolute Retry-After lock on %s after background timer suspension",
    async (eventName) => {
      vi.useFakeTimers();
      vi.setSystemTime(1_800_000_000_000);
      api.createAdminSession.mockRejectedValue(new WeddingApiError(429, "rate_limited", 2));
      render(<RsvpAdminPage />);
      fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "wrong" } });
      fireEvent.click(screen.getByRole("button", { name: "로그인" }));

      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button", { name: "2초 후 로그인" })).toBeDisabled();

      act(() => {
        vi.setSystemTime(1_800_000_001_001);
        const target = eventName === "visibilitychange" ? document : window;
        target.dispatchEvent(new Event(eventName));
      });
      expect(screen.getByRole("button", { name: "1초 후 로그인" })).toBeDisabled();

      act(() => {
        vi.setSystemTime(1_800_000_002_100);
        const target = eventName === "visibilitychange" ? document : window;
        target.dispatchEvent(new Event(eventName));
      });

      expect(screen.getByLabelText("관리자 비밀번호")).toBeEnabled();
      fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "retry" } });
      expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
    }
  );

  it("does not invent a one-second lockout when a malformed 429 omits Retry-After", async () => {
    api.createAdminSession.mockRejectedValue(new WeddingApiError(429, "rate_limited"));
    render(<RsvpAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 후 다시 시도");
    expect(screen.queryByText(/1초 후/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("관리자 비밀번호")).toBeEnabled();
  });

  it("displays the complete server summary without changing it for filters", async () => {
    render(<RsvpAdminPage />);
    await login();

    for (const value of ["4", "2", "5", "4", "1", "2", "2027. 5. 31."]) {
      expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    }
    fireEvent.change(screen.getByLabelText("대상 필터"), { target: { value: "legacy" } });
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("searches normalized names and phone numbers and resets all filters", async () => {
    render(<RsvpAdminPage />);
    await login();

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "lee guest" } });
    expect(screen.getByText("Lee Guest")).toBeInTheDocument();
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "01099998888" } });
    expect(screen.getByText("Lee Guest")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("대상 필터"), { target: { value: "bride" } });
    fireEvent.change(screen.getByLabelText("참석 필터"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("식사 필터"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));
    expect(screen.getByLabelText("검색")).toHaveValue("");
    expect(screen.getByLabelText("대상 필터")).toHaveValue("all");
    expect(screen.getByText("옛 하객")).toBeInTheDocument();
  });

  it("uses NFKC names and common phone normalization for punctuation and country-code searches", async () => {
    api.fetchAdminRsvps.mockResolvedValue({
      ...result,
      responses: [{ ...result.responses[1], guestName: "Ｌｅｅ　Ｇｕｅｓｔ", phone: "+82.10.9999.8888" }]
    });
    render(<RsvpAdminPage />);
    await login();

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "lee guest" } });
    expect(screen.getAllByText((_, element) => element?.textContent === "Ｌｅｅ　Ｇｕｅｓｔ").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "+82 (10) 9999-8888" } });
    expect(screen.getAllByText((_, element) => element?.textContent === "Ｌｅｅ　Ｇｕｅｓｔ").length).toBeGreaterThan(0);
  });

  it("does not interpret digits inside a name query as a phone-number search", async () => {
    render(<RsvpAdminPage />);
    await login();

    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "하객1" } });

    expect(screen.getByRole("status")).toHaveTextContent("조건에 맞는 답변이 없습니다");
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
  });

  it("shows an explicit empty result state", async () => {
    render(<RsvpAdminPage />);
    await login();
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "없는 사람" } });
    expect(screen.getByRole("status")).toHaveTextContent("조건에 맞는 답변이 없습니다");
  });

  it("requires deletion confirmation, supports cancel, and refetches the whole result after success", async () => {
    const refreshed = { ...result, summary: { ...result.summary, responseCount: 3 }, responses: result.responses.slice(1) };
    api.fetchAdminRsvps.mockResolvedValueOnce(result).mockResolvedValueOnce(refreshed);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    expect(screen.getByRole("dialog", { name: "답변 삭제 확인" })).toHaveTextContent("김하객");
    expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(api.deleteAdminRsvp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.deleteAdminRsvp).toHaveBeenCalledWith("admin-token", "1"));
    await waitFor(() => expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
  });

  it("keeps the focused inert dialog through the forced GET after DELETE succeeds", async () => {
    const forcedRefresh = deferred<RsvpAdminResult>();
    const refreshed = { ...result, summary: { ...result.summary, responseCount: 3 }, responses: result.responses.slice(1) };
    api.fetchAdminRsvps.mockResolvedValueOnce(result).mockReturnValueOnce(forcedRefresh.promise);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(2));

    const dialog = screen.getByRole("dialog", { name: "답변 삭제 확인" });
    expect(dialog).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector(".rsvp-admin-shell")).toHaveAttribute("inert");

    forcedRefresh.resolve(refreshed);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "전체 답변" })).toHaveFocus();
  });

  it("force-refetches after deletion while an older GET is pending and discards the stale GET", async () => {
    const oldRefresh = deferred<RsvpAdminResult>();
    const fresh = { ...result, summary: { ...result.summary, responseCount: 3 }, responses: result.responses.slice(1) };
    api.fetchAdminRsvps
      .mockResolvedValueOnce(result)
      .mockReturnValueOnce(oldRefresh.promise)
      .mockResolvedValueOnce(fresh);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
    oldRefresh.resolve(result);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
  });

  it("preserves the list on delete failure and logs out on a delete 401", async () => {
    api.deleteAdminRsvp.mockRejectedValueOnce(new Error("network")).mockRejectedValueOnce(new WeddingApiError(401, "unauthorized"));
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("삭제하지 못했습니다");
    expect(screen.getByText("김하객")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(await screen.findByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(storage.clearAdminSession).toHaveBeenCalledWith("sample-garden");
  });

  it("blocks duplicate delete requests while one deletion is pending", async () => {
    const pendingDelete = deferred<void>();
    api.deleteAdminRsvp.mockReturnValue(pendingDelete.promise);
    render(<RsvpAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));

    const confirm = screen.getByRole("button", { name: "삭제" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.deleteAdminRsvp).toHaveBeenCalledTimes(1);
    pendingDelete.resolve(undefined);
    await waitFor(() => expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(2));
  });

  it("traps dialog focus, cancels with Escape, hides the shell, and restores the delete trigger", async () => {
    render(<RsvpAdminPage />);
    await login();
    const trigger = screen.getByRole("button", { name: "김하객 답변 삭제" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "답변 삭제 확인" });
    const cancel = screen.getByRole("button", { name: "취소" });
    const remove = screen.getByRole("button", { name: "삭제" });
    expect(cancel).toHaveFocus();
    expect(document.querySelector(".rsvp-admin-shell")).toHaveAttribute("inert");
    expect(document.querySelector(".rsvp-admin-shell")).toHaveAttribute("aria-hidden", "true");

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(remove).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.querySelector(".rsvp-admin-shell")).not.toHaveAttribute("inert");
  });

  it("does not close the deletion dialog with Escape while deletion is pending", async () => {
    const pendingDelete = deferred<void>();
    api.deleteAdminRsvp.mockReturnValue(pendingDelete.promise);
    render(<RsvpAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    pendingDelete.resolve(undefined);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "전체 답변" })).toHaveFocus();
  });

  it("keeps focus on the dialog itself while every deletion action is disabled", async () => {
    const pendingDelete = deferred<void>();
    api.deleteAdminRsvp.mockReturnValue(pendingDelete.promise);
    render(<RsvpAdminPage />);
    await login();
    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    const dialog = screen.getByRole("dialog", { name: "답변 삭제 확인" });
    await waitFor(() => expect(dialog).toHaveAttribute("aria-busy", "true"));
    expect(dialog).toHaveAttribute("tabindex", "-1");
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(dialog).toHaveFocus();

    pendingDelete.resolve(undefined);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("announces refresh progress and completion for an existing result", async () => {
    const refresh = deferred<RsvpAdminResult>();
    api.fetchAdminRsvps.mockResolvedValueOnce(result).mockReturnValueOnce(refresh.promise);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(screen.getByRole("status")).toHaveTextContent("새로고침하고 있습니다");
    refresh.resolve(result);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("새로고침을 완료했습니다"));
  });

  it("clears the refresh progress announcement when a manual refresh fails", async () => {
    const refresh = deferred<RsvpAdminResult>();
    api.fetchAdminRsvps.mockResolvedValueOnce(result).mockReturnValueOnce(refresh.promise);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(screen.getByRole("status")).toHaveTextContent("새로고침하고 있습니다");
    refresh.reject(new Error("network"));

    expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    expect(screen.queryByText("참석 답변을 새로고침하고 있습니다.")).not.toBeInTheDocument();
  });

  it("clears a superseded refresh announcement before a forced refetch and after forced failure", async () => {
    const staleRefresh = deferred<RsvpAdminResult>();
    const forcedRefresh = deferred<RsvpAdminResult>();
    api.fetchAdminRsvps
      .mockResolvedValueOnce(result)
      .mockReturnValueOnce(staleRefresh.promise)
      .mockReturnValueOnce(forcedRefresh.promise);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(screen.getByRole("status")).toHaveTextContent("새로고침하고 있습니다");
    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.fetchAdminRsvps).toHaveBeenCalledTimes(3));

    expect(screen.queryByText("참석 답변을 새로고침하고 있습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "답변 삭제 확인" })).toHaveFocus();
    forcedRefresh.reject(new Error("network"));
    expect(await screen.findByRole("alert")).toHaveTextContent("불러오지 못했습니다");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("참석 답변을 새로고침하고 있습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "전체 답변" })).toHaveFocus();

    staleRefresh.resolve(result);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText("참석 답변을 새로고침하고 있습니다.")).not.toBeInTheDocument();
  });

  it("exports the complete server result regardless of list filters", async () => {
    render(<RsvpAdminPage />);
    await login();
    fireEvent.change(screen.getByLabelText("대상 필터"), { target: { value: "legacy" } });
    fireEvent.click(screen.getByRole("button", { name: "CSV 저장" }));
    expect(csv.downloadRsvpCsv).toHaveBeenCalledWith(result);
  });

  it("관리자가 참석 답변을 수정하고 유효한 조건부 값을 저장한다", async () => {
    const updatedResult = {
      ...result,
      responses: [{ ...result.responses[0], side: "bride" as const, guestName: "김수정", phone: "01099998888", revision: 2 }, ...result.responses.slice(1)]
    };
    api.fetchAdminRsvps.mockResolvedValueOnce(result).mockResolvedValueOnce(updatedResult);
    render(<RsvpAdminPage />);
    await login();

    fireEvent.click(screen.getByRole("button", { name: "김하객 답변 수정" }));
    const dialog = screen.getByRole("dialog", { name: "참석 답변 수정" });
    expect(dialog).toBeInTheDocument();
    const editor = within(dialog);
    expect(editor.getByLabelText("이름")).toHaveFocus();
    fireEvent.change(editor.getByLabelText("이름"), { target: { value: "김수정" } });
    fireEvent.change(editor.getByLabelText("연락처"), { target: { value: "010-9999-8888" } });
    fireEvent.change(editor.getByLabelText("대상"), { target: { value: "bride" } });
    fireEvent.change(editor.getByLabelText("참석 여부"), { target: { value: "no" } });
    expect(editor.getByLabelText("인원")).toHaveValue(0);
    expect(editor.getByLabelText("식사 여부")).toHaveValue("not_applicable");
    fireEvent.click(editor.getByRole("button", { name: "변경 저장" }));

    await waitFor(() => expect(api.updateAdminRsvp).toHaveBeenCalledWith("admin-token", "1", {
      side: "bride",
      guestName: "김수정",
      phone: "01099998888",
      attendance: "no",
      partySize: 0,
      mealStatus: "not_applicable",
      note: "축하합니다",
      revision: 1
    }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "참석 답변 수정" })).not.toBeInTheDocument());
    expect(screen.getByText("김수정")).toBeInTheDocument();
  });

  it("기존 마이그레이션 답변은 수정하지 못하지만 삭제는 유지한다", async () => {
    render(<RsvpAdminPage />);
    await login();

    expect(screen.getByRole("button", { name: "옛 하객 답변 수정" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "옛 하객 답변 삭제" })).toBeEnabled();
  });

  it("clears persistent and in-memory admin state on logout", async () => {
    render(<RsvpAdminPage />);
    await login();
    fireEvent.change(screen.getByLabelText("검색"), { target: { value: "Lee" } });
    fireEvent.change(screen.getByLabelText("대상 필터"), { target: { value: "bride" } });
    fireEvent.change(screen.getByLabelText("참석 필터"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("식사 필터"), { target: { value: "no" } });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(storage.clearAdminSession).toHaveBeenCalledWith("sample-garden");
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();

    await login();
    expect(screen.getByLabelText("검색")).toHaveValue("");
    expect(screen.getByLabelText("대상 필터")).toHaveValue("all");
    expect(screen.getByLabelText("참석 필터")).toHaveValue("all");
    expect(screen.getByLabelText("식사 필터")).toHaveValue("all");
  });

  it("ignores stale fetch responses and prevents duplicate login and delete requests", async () => {
    const firstFetch = deferred<RsvpAdminResult>();
    const secondFetch = deferred<RsvpAdminResult>();
    api.fetchAdminRsvps.mockReturnValueOnce(firstFetch.promise).mockReturnValueOnce(secondFetch.promise);
    render(<RsvpAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    fireEvent.click(screen.getByRole("button", { name: "로그인 중" }));
    expect(api.createAdminSession).toHaveBeenCalledTimes(1);

    firstFetch.resolve(result);
    await screen.findByText("김하객");
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    secondFetch.resolve({ ...result, responses: [result.responses[1]] });
    expect(await screen.findByText("Lee Guest")).toBeInTheDocument();
  });

  it("does not update state after unmount while login is pending", async () => {
    const pending = deferred<typeof session>();
    api.createAdminSession.mockReturnValue(pending.promise);
    const { unmount } = render(<RsvpAdminPage />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    unmount();
    pending.resolve(session);
    await act(async () => { await Promise.resolve(); });
    expect(api.fetchAdminRsvps).not.toHaveBeenCalled();
  });

  it("does not let an old fetch restore data after logout", async () => {
    const pendingFetch = deferred<RsvpAdminResult>();
    storage.loadAdminSession.mockReturnValue(session);
    api.fetchAdminRsvps.mockReturnValue(pendingFetch.promise);
    render(<RsvpAdminPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    pendingFetch.resolve(result);
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByText("김하객")).not.toBeInTheDocument();
  });
});
