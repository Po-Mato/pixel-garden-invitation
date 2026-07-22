import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeddingApiError } from "../api/weddingApi";
import { useInvitationInvite } from "./useInvitationInvite";
import { installMemoryLocalStorage } from "../test/memoryStorage";

const fetchPublicInvitationInvite = vi.hoisted(() => vi.fn());
vi.mock("../api/invitationInviteLinksApi", () => ({ fetchPublicInvitationInvite }));

describe("useInvitationInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMemoryLocalStorage();
    window.history.replaceState({}, "", `/?invite=${"A".repeat(43)}&view=invitation`);
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("resolves, stores and removes the bearer token from the visible URL", async () => {
    fetchPublicInvitationInvite.mockResolvedValue({ guestName: "김하객", side: "bride", groupLabel: "친구" });
    const { result } = renderHook(() => useInvitationInvite());
    await waitFor(() => expect(result.current.invite?.guestName).toBe("김하객"));
    expect(window.location.search).toBe("?view=invitation");
    expect(window.localStorage.getItem("wedding:invite-link:sample-garden")).toContain("김하객");
  });

  it("falls back without disclosing why an invite token is invalid", async () => {
    window.history.replaceState({}, "", `/?invite=${"B".repeat(43)}&view=invitation`);
    fetchPublicInvitationInvite.mockRejectedValue(new WeddingApiError(404, "not_found"));
    const { result } = renderHook(() => useInvitationInvite());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invite).toBeNull();
    expect(result.current.notice).toContain("일반 초대장");
    expect(window.location.search).toBe("?view=invitation");
  });

  it("does not resolve personal tokens on administrator routes", () => {
    const { result } = renderHook(() => useInvitationInvite(false));
    expect(result.current.invite).toBeNull();
    expect(fetchPublicInvitationInvite).not.toHaveBeenCalled();
    expect(window.location.search).toContain("invite=");
  });

  it("shares one resolution request across React StrictMode remounts", async () => {
    window.history.replaceState({}, "", `/?invite=${"C".repeat(43)}`);
    fetchPublicInvitationInvite.mockResolvedValue({ guestName: "엄격 하객", side: "groom", groupLabel: "친구" });
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useInvitationInvite(), { wrapper });
    await waitFor(() => expect(result.current.invite?.guestName).toBe("엄격 하객"));
    expect(fetchPublicInvitationInvite).toHaveBeenCalledOnce();
  });
});
