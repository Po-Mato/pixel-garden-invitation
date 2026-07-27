import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStoredInvitationInvite } from "../invitation/inviteLinkStorage";
import { fetchSyncedJourneyProgress, saveSyncedJourneyProgress } from "./journeyProgressApi";

vi.mock("../invitation/inviteLinkStorage", () => ({ loadStoredInvitationInvite: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("journey progress API", () => {
  it("개인 초대 링크가 없으면 서버 요청을 생략한다", async () => {
    vi.mocked(loadStoredInvitationInvite).mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchSyncedJourneyProgress()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("개인 초대 토큰으로 여정 진행도를 불러오고 저장한다", async () => {
    const progress = { version: 1 as const, completedIds: ["directions" as const], updatedAt: "2026-07-28T00:00:00.000Z" };
    vi.mocked(loadStoredInvitationInvite).mockReturnValue({
      token: "A".repeat(43),
      invite: { guestName: "김하객", side: "bride", groupLabel: "친구" }
    });
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(progress), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSyncedJourneyProgress()).resolves.toEqual(progress);
    await expect(saveSyncedJourneyProgress(progress)).resolves.toEqual(progress);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("/journey-progress"), expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({ "x-invite-token": "A".repeat(43) })
    }));
  });
});
